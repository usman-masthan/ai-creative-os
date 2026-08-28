import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import type { DesignAssetRef, DesignDocument, DesignLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import { renderPosterPng } from "../posterRenderer.js";

export type DesignExportPreset = "standard" | "high-resolution" | "4k";

export interface DesignExportResult {
  format: "png";
  preset: DesignExportPreset;
  htmlPath: string;
  outputPath: string;
  width: number;
  height: number;
}

function mimeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    case ".webp": return "image/webp";
    default: return "image/jpeg";
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCss(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

async function assetDataUri(asset: DesignAssetRef): Promise<string> {
  if (!asset.uri?.trim()) throw new Error(`ASSET_MISSING: ${asset.assetId} has no runtime URI.`);
  if (asset.uri.startsWith("data:")) return asset.uri;
  const path = resolve(asset.uri);
  const bytes = await readFile(path);
  const mimeType = asset.mimeType?.trim() || mimeFromPath(path);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

function scaled(value: number, scale: number): number {
  return Math.round(value * scale * 100) / 100;
}

function layerStyle(layer: DesignLayer, scale: number): string {
  return [
    "position:absolute",
    `left:${scaled(layer.x, scale)}px`,
    `top:${scaled(layer.y, scale)}px`,
    `width:${scaled(layer.width, scale)}px`,
    `height:${scaled(layer.height, scale)}px`,
    `opacity:${layer.opacity}`,
    `z-index:${layer.zIndex}`,
    `transform:rotate(${layer.rotation}deg)`,
    "transform-origin:center center",
    layer.visible ? "display:block" : "display:none",
  ].join(";");
}

async function renderLayer(layer: DesignLayer, scale: number): Promise<string> {
  const base = layerStyle(layer, scale);
  switch (layer.type) {
    case "background": {
      if (layer.asset) {
        const src = await assetDataUri(layer.asset);
        return `<img data-layer-id="${escapeHtml(layer.id)}" alt="" src="${escapeHtml(src)}" style="${base};object-fit:${layer.fit ?? "cover"};" />`;
      }
      return `<div data-layer-id="${escapeHtml(layer.id)}" style="${base};background:${escapeCss(layer.fill ?? "transparent")};"></div>`;
    }
    case "image": {
      const src = await assetDataUri(layer.asset);
      return `<img data-layer-id="${escapeHtml(layer.id)}" alt="" src="${escapeHtml(src)}" style="${base};object-fit:${layer.fit};" />`;
    }
    case "logo": {
      const src = await assetDataUri(layer.asset);
      return `<img data-layer-id="${escapeHtml(layer.id)}" alt="Brand logo" src="${escapeHtml(src)}" style="${base};object-fit:contain;" />`;
    }
    case "shape": {
      const radius = scaled(layer.cornerRadius ?? 0, scale);
      if (layer.shape === "ellipse") {
        return `<div data-layer-id="${escapeHtml(layer.id)}" style="${base};border-radius:50%;background:${escapeCss(layer.fill ?? "transparent")};border:${scaled(layer.strokeWidth ?? 0, scale)}px solid ${escapeCss(layer.stroke ?? "transparent")};"></div>`;
      }
      if (layer.shape === "line") {
        return `<div data-layer-id="${escapeHtml(layer.id)}" style="${base};height:0;border-top:${Math.max(1, scaled(layer.strokeWidth ?? 1, scale))}px solid ${escapeCss(layer.stroke ?? layer.fill ?? "#000000")};"></div>`;
      }
      return `<div data-layer-id="${escapeHtml(layer.id)}" style="${base};border-radius:${radius}px;background:${escapeCss(layer.fill ?? "transparent")};border:${scaled(layer.strokeWidth ?? 0, scale)}px solid ${escapeCss(layer.stroke ?? "transparent")};"></div>`;
    }
    case "text": {
      const shadow = layer.shadow
        ? `${scaled(layer.shadow.offsetX, scale)}px ${scaled(layer.shadow.offsetY, scale)}px ${scaled(layer.shadow.blur, scale)}px color-mix(in srgb, ${escapeCss(layer.shadow.color)} ${Math.round(layer.shadow.opacity * 100)}%, transparent)`
        : "none";
      const vertical = layer.role === "cta" || layer.role === "price" ? "center" : "flex-start";
      return `<div data-layer-id="${escapeHtml(layer.id)}" style="${base};display:flex;align-items:${vertical};justify-content:${layer.align === "center" ? "center" : layer.align === "right" ? "flex-end" : "flex-start"};overflow:hidden;white-space:pre-wrap;font-family:&quot;${escapeHtml(layer.fontFamily)}&quot;,Arial,sans-serif;font-size:${scaled(layer.fontSize, scale)}px;font-weight:${layer.fontWeight};line-height:${layer.lineHeight};letter-spacing:${scaled(layer.letterSpacing, scale)}px;text-align:${layer.align};color:${escapeCss(layer.fill)};${layer.stroke ? `-webkit-text-stroke:${Math.max(0.5, scale * 0.5)}px ${escapeCss(layer.stroke)};` : ""}text-shadow:${shadow};">${escapeHtml(layer.text)}</div>`;
    }
    case "group":
      return "";
    case "mask":
      throw new Error(`UNSUPPORTED_LAYER: mask rendering is not implemented for ${layer.id}.`);
  }
}

export async function buildDesignDocumentHtml(documentInput: DesignDocument, scale = 1): Promise<string> {
  const document = assertDesignDocument(documentInput);
  if (!Number.isFinite(scale) || scale <= 0 || scale > 8) throw new Error("Export scale must be greater than 0 and at most 8.");
  const width = Math.round(document.artboard.width * scale);
  const height = Math.round(document.artboard.height * scale);
  const sorted = [...document.layers].sort((a, b) => a.zIndex - b.zIndex);
  const rendered = await Promise.all(sorted.map((layer) => renderLayer(layer, scale)));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${width}, initial-scale=1" />
<style>
  *{box-sizing:border-box}
  html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${escapeCss(document.artboard.background)}}
  body{position:relative}
  #artboard{position:relative;width:${width}px;height:${height}px;overflow:hidden;background:${escapeCss(document.artboard.background)};isolation:isolate}
  img{user-select:none;-webkit-user-drag:none}
</style>
</head>
<body>
<main id="artboard" data-design-id="${escapeHtml(document.id)}" data-design-version="${document.version}">
${rendered.filter(Boolean).join("\n")}
</main>
</body>
</html>`;
}

function scaleForPreset(preset: DesignExportPreset): number {
  if (preset === "high-resolution") return 2;
  if (preset === "4k") return 4;
  return 1;
}

export async function exportDesignDocumentPng(input: {
  document: DesignDocument;
  outputDir: string;
  preset?: DesignExportPreset;
  chromePath?: string;
}): Promise<DesignExportResult> {
  const document = assertDesignDocument(input.document);
  const preset = input.preset ?? "standard";
  const scale = scaleForPreset(preset);
  const outputDir = resolve(input.outputDir);
  await mkdir(outputDir, { recursive: true });
  const htmlPath = join(outputDir, `design-v${document.version}-${preset}.html`);
  const outputPath = join(outputDir, `design-v${document.version}-${preset}.png`);
  const html = await buildDesignDocumentHtml(document, scale);
  await writeFile(htmlPath, html, "utf8");
  const width = Math.round(document.artboard.width * scale);
  const height = Math.round(document.artboard.height * scale);
  await renderPosterPng({
    htmlPath,
    outputPath,
    width,
    height,
    ...(input.chromePath ? { chromePath: input.chromePath } : {}),
  });
  return { format: "png", preset, htmlPath, outputPath, width, height };
}
