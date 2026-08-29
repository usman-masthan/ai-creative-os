import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { SubjectSegmentationProvider } from "../creativeStudio/segmentation/types.js";
import type { DesignAssetRef, DesignDocument, DesignLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";

function sourceLayer(document: DesignDocument, layerId: string): DesignLayer {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (!layer) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${layerId}`);
  if (layer.type !== "background" && layer.type !== "image") {
    throw new Error("SEGMENTATION_REQUIRES_IMAGE_LAYER.");
  }
  return layer;
}

function sourceAsset(layer: DesignLayer): DesignAssetRef {
  if (layer.type === "image") return layer.asset;
  if (layer.type === "background" && layer.asset) return layer.asset;
  throw new Error("SEGMENTATION_REQUIRES_ASSET: selected layer has no image asset.");
}

function assertImagePayload(value: string, name: string): Buffer {
  const bytes = Buffer.from(value, "base64");
  if (bytes.length < 1_000) throw new Error(`${name} segmentation payload is unexpectedly small.`);
  return bytes;
}

function extensionForMime(mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml"): string {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/svg+xml") return ".svg";
  return ".png";
}

export async function segmentCreativeSubject(input: {
  document: DesignDocument;
  layerId: string;
  imageBase64: string;
  mimeType: string;
  provider: SubjectSegmentationProvider;
  outputDir: string;
  subjectHint?: string;
  timestamp?: string;
}): Promise<DesignDocument> {
  const layer = sourceLayer(input.document, input.layerId);
  const asset = sourceAsset(layer);
  if (input.document.layers.some((candidate) => candidate.id === "product-subject")) {
    throw new Error("SEGMENTATION_ALREADY_EXISTS: product-subject layer is already present.");
  }
  if (!input.imageBase64.trim() || !input.mimeType.startsWith("image/")) {
    throw new Error("SEGMENTATION_INPUT_INVALID: valid image bytes and MIME type are required.");
  }

  const result = await input.provider.segment({
    imageBase64: input.imageBase64,
    mimeType: input.mimeType,
    width: input.document.artboard.width,
    height: input.document.artboard.height,
    ...(input.subjectHint?.trim() ? { subjectHint: input.subjectHint.trim() } : {}),
  });
  const foreground = assertImagePayload(result.foregroundBase64, "Foreground");
  const background = assertImagePayload(result.backgroundBase64, "Background");
  if (result.confidence !== undefined && (!Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1)) {
    throw new Error("SEGMENTATION_INVALID: confidence must be between 0 and 1.");
  }

  const outputDir = resolve(input.outputDir);
  await mkdir(outputDir, { recursive: true });
  const nextVersion = input.document.version + 1;
  const foregroundPath = join(
    outputDir,
    `product-subject-v${nextVersion}${extensionForMime(result.foregroundMimeType)}`,
  );
  const backgroundPath = join(
    outputDir,
    `background-separated-v${nextVersion}${extensionForMime(result.backgroundMimeType)}`,
  );
  await Promise.all([
    writeFile(foregroundPath, foreground),
    writeFile(backgroundPath, background),
  ]);

  const sourceVisualTruth = asset.visualTruthClass;
  const separatedBackground: DesignAssetRef = {
    assetId: `separated-background-v${nextVersion}`,
    source: "runtime",
    uri: backgroundPath,
    mimeType: result.backgroundMimeType,
    visualTruthClass: "GENERIC_CONCEPT_VISUAL",
    generation: {
      provider: input.provider.providerName,
      model: input.provider.model,
    },
  };
  const separatedSubject: DesignAssetRef = {
    assetId: `separated-subject-v${nextVersion}`,
    source: sourceVisualTruth === "VERIFIED_PRODUCT_VISUAL" ? "verified-product" : "runtime",
    uri: foregroundPath,
    mimeType: result.foregroundMimeType,
    ...(sourceVisualTruth ? { visualTruthClass: sourceVisualTruth } : {}),
    generation: {
      provider: input.provider.providerName,
      model: input.provider.model,
    },
  };

  const layers = input.document.layers.map((candidate): DesignLayer => {
    if (candidate.id !== input.layerId) return candidate;
    if (candidate.type === "background") {
      return { ...candidate, asset: separatedBackground, fit: "cover" };
    }
    if (candidate.type === "image") {
      return { ...candidate, asset: separatedBackground, fit: "cover" };
    }
    return candidate;
  });
  layers.push({
    id: "product-subject",
    name: "Product / Subject",
    type: "image",
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    opacity: 1,
    zIndex: Math.max(...input.document.layers.map((candidate) => candidate.zIndex), 0) + 5,
    visible: true,
    locked: sourceVisualTruth === "VERIFIED_PRODUCT_VISUAL",
    aiEditable: sourceVisualTruth !== "VERIFIED_PRODUCT_VISUAL",
    asset: separatedSubject,
    fit: "contain",
  });

  const at = input.timestamp ?? new Date().toISOString();
  return assertDesignDocument({
    ...input.document,
    version: nextVersion,
    layers,
    history: [
      ...input.document.history,
      {
        version: nextVersion,
        createdAt: at,
        summary: `Separated subject from ${input.layerId} using ${input.provider.providerName}/${input.provider.model}.`,
        actor: "ai",
      },
    ],
    updatedAt: at,
  });
}
