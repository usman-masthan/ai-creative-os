import { getCreativeBrandTheme } from "./clientProfiles/registry.js";
import type { CreativeBrandTheme } from "./clientProfiles/types.js";
import type { DesignDocument, DesignLayer, DesignTextLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import { safeAreaRect } from "../layoutEngine/geometry.js";
import type { DesignQaIssue, DesignQaResult } from "./designQa.js";

export interface DesignAutoPolishResult {
  document: DesignDocument;
  applied: Array<{
    code: string;
    layerId: string;
    summary: string;
  }>;
}

function estimatedCapacity(layer: DesignTextLayer, fontSize = layer.fontSize): number {
  const charactersPerLine = Math.max(1, Math.floor(layer.width / Math.max(1, fontSize * 0.55)));
  const linePixelHeight = Math.max(1, fontSize * layer.lineHeight);
  const lines = Math.max(1, Math.floor(layer.height / linePixelHeight));
  return charactersPerLine * lines;
}

function fitFontSize(layer: DesignTextLayer): number {
  let size = layer.fontSize;
  const minimum = layer.role === "headline" ? 28 : layer.role === "price" ? 22 : 14;
  while (size > minimum && layer.text.length > estimatedCapacity(layer, size) * 1.08) {
    size = Math.max(minimum, Math.round(size * 0.94 * 10) / 10);
  }
  return size;
}

function clampImportantLayer(layer: DesignLayer, document: DesignDocument, theme: CreativeBrandTheme): DesignLayer {
  const safe = safeAreaRect(document.artboard, theme.qa.safeAreaRatio);
  const width = Math.min(layer.width, safe.width);
  const height = Math.min(layer.height, safe.height);
  const x = Math.max(safe.x, Math.min(layer.x, safe.x + safe.width - width));
  const y = Math.max(safe.y, Math.min(layer.y, safe.y + safe.height - height));
  return { ...layer, x: Math.round(x), y: Math.round(y), width, height } as DesignLayer;
}

function minimumLogo(layer: DesignLayer, document: DesignDocument, theme: CreativeBrandTheme): DesignLayer {
  if (layer.type !== "logo") return layer;
  const minimum = theme.qa.minimumLogoPx;
  const smallest = Math.min(layer.width, layer.height);
  if (smallest >= minimum) return clampImportantLayer(layer, document, theme);
  const scale = minimum / Math.max(1, smallest);
  return clampImportantLayer(
    {
      ...layer,
      width: Math.round(layer.width * scale),
      height: Math.round(layer.height * scale),
    },
    document,
    theme,
  );
}

function approvedFont(layer: DesignTextLayer, theme: CreativeBrandTheme): string {
  if (layer.role === "price") return theme.priceFont;
  if (layer.role === "headline" || layer.role === "brand-identifier") return theme.displayFont;
  return theme.bodyFont;
}

function issueKey(issue: DesignQaIssue): string {
  return `${issue.code}:${issue.layerId ?? ""}`;
}

export function autoPolishDesign(input: {
  document: DesignDocument;
  qa: DesignQaResult;
  timestamp?: string;
}): DesignAutoPolishResult {
  const document = assertDesignDocument(input.document);
  const theme = getCreativeBrandTheme(document.brand.clientId, document.brand.brandId);
  const actionable = new Map(input.qa.issues.map((issue) => [issueKey(issue), issue]));
  const applied: DesignAutoPolishResult["applied"] = [];
  const safePercent = Math.round(theme.qa.safeAreaRatio * 100);

  const layers = document.layers.map((original): DesignLayer => {
    let layer = original;
    const safeIssue = actionable.get(`SAFE_MARGIN:${original.id}`) ?? actionable.get(`LOGO_SAFE_AREA:${original.id}`);
    if (safeIssue && (!original.locked || original.type === "logo")) {
      const next = clampImportantLayer(layer, document, theme);
      if (next.x !== layer.x || next.y !== layer.y || next.width !== layer.width || next.height !== layer.height) {
        layer = next;
        applied.push({ code: safeIssue.code, layerId: original.id, summary: `Moved layer inside the ${safePercent}% safe area.` });
      }
    }

    const logoSizeIssue = actionable.get(`LOGO_TOO_SMALL:${original.id}`);
    if (logoSizeIssue && layer.type === "logo") {
      const next = minimumLogo(layer, document, theme);
      if (next.width !== layer.width || next.height !== layer.height || next.x !== layer.x || next.y !== layer.y) {
        layer = next;
        applied.push({ code: logoSizeIssue.code, layerId: original.id, summary: `Raised approved logo to the ${theme.qa.minimumLogoPx}px deterministic minimum digital size.` });
      }
    }

    const fontIssue = actionable.get(`NON_BRAND_FONT:${original.id}`);
    if (fontIssue && layer.type === "text") {
      const fontFamily = approvedFont(layer, theme);
      if (layer.fontFamily !== fontFamily) {
        layer = { ...layer, fontFamily };
        applied.push({ code: fontIssue.code, layerId: original.id, summary: `Restored approved font ${fontFamily}.` });
      }
    }

    const overflowIssue = actionable.get(`TEXT_OVERFLOW_RISK:${original.id}`);
    if (overflowIssue && layer.type === "text") {
      const fontSize = fitFontSize(layer);
      if (fontSize < layer.fontSize) {
        layer = { ...layer, fontSize };
        applied.push({ code: overflowIssue.code, layerId: original.id, summary: `Reduced font size to ${fontSize}px to lower overflow risk.` });
      }
    }
    return layer;
  });

  if (!applied.length) return { document, applied };
  const timestamp = input.timestamp ?? new Date().toISOString();
  const version = document.version + 1;
  return {
    document: assertDesignDocument({
      ...document,
      version,
      layers,
      history: [
        ...document.history,
        {
          version,
          createdAt: timestamp,
          summary: `Applied ${applied.length} deterministic low-risk layout/brand fix${applied.length === 1 ? "" : "es"}.`,
          actor: "system",
        },
      ],
      updatedAt: timestamp,
    }),
    applied,
  };
}
