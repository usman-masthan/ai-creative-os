import { atthasDisplayFont, ATTHAS_TOKENS } from "../atthasTokens.js";
import type { CampaignCreativeOutput, CampaignProductionFormat } from "../creativeTypes.js";
import type { DesignDocument, DesignTextLayer } from "../designDocument/types.js";
import type { AtthasBrandId } from "../layouts/atthas.js";

export interface LayeredRenderParityIssue {
  code: string;
  message: string;
  layerId?: string;
}

export interface LayeredRenderParityResult {
  decision: "PASS" | "BLOCK";
  issues: LayeredRenderParityIssue[];
  checks: {
    artboard: boolean;
    layout: boolean;
    nativeCopy: boolean;
    typography: boolean;
    logo: boolean;
  };
}

function textByRole(document: DesignDocument, role: DesignTextLayer["role"]): DesignTextLayer | undefined {
  const layer = document.layers.find((candidate) => candidate.type === "text" && candidate.role === role);
  return layer?.type === "text" ? layer : undefined;
}

function issue(code: string, message: string, layerId?: string): LayeredRenderParityIssue {
  return { code, message, ...(layerId ? { layerId } : {}) };
}

export function evaluateLayeredRenderParity(input: {
  document: DesignDocument;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  brandId: AtthasBrandId;
  expectedLayoutId: string;
}): LayeredRenderParityResult {
  const issues: LayeredRenderParityIssue[] = [];
  const { document, creative, format, brandId } = input;
  const overlay = creative.overlaySpec;

  const artboard = document.artboard.width === format.width && document.artboard.height === format.height;
  if (!artboard) {
    issues.push(issue("ARTBOARD_PARITY", `Layered artboard ${document.artboard.width}×${document.artboard.height} differs from governed format ${format.width}×${format.height}.`));
  }

  const layout = document.layoutId === input.expectedLayoutId;
  if (!layout) {
    issues.push(issue("LAYOUT_PARITY", `Layered layout ${document.layoutId} differs from governed layout ${input.expectedLayoutId}.`));
  }

  const expectedCopy: Array<[DesignTextLayer["role"], string | undefined]> = [
    ["headline", overlay.headline],
    ["supporting", overlay.supportingCopy || undefined],
    ["cta", overlay.cta],
    ["price", overlay.price?.display],
  ];
  let nativeCopy = true;
  for (const [role, expected] of expectedCopy) {
    const layer = textByRole(document, role);
    if (!expected) {
      if (layer?.visible && layer.text.trim()) {
        nativeCopy = false;
        issues.push(issue("COPY_PARITY_EXTRA", `Layered ${role} text exists although governed overlay has no ${role}.`, layer.id));
      }
      continue;
    }
    if (!layer) {
      nativeCopy = false;
      issues.push(issue("COPY_PARITY_MISSING", `Layered document is missing native ${role} text.`, role));
      continue;
    }
    if (layer.text !== expected) {
      nativeCopy = false;
      issues.push(issue("COPY_PARITY_MISMATCH", `Layered ${role} text does not match governed overlay copy.`, layer.id));
    }
  }

  const headline = textByRole(document, "headline");
  const supporting = textByRole(document, "supporting");
  const cta = textByRole(document, "cta");
  const price = textByRole(document, "price");
  const expectedDisplay = atthasDisplayFont(brandId);
  let typography = true;
  const fontExpectations: Array<[DesignTextLayer | undefined, string, string]> = [
    [headline, expectedDisplay, "headline"],
    [supporting, ATTHAS_TOKENS.typography.body, "supporting"],
    [cta, ATTHAS_TOKENS.typography.body, "cta"],
    [price, ATTHAS_TOKENS.typography.price, "price"],
  ];
  for (const [layer, expectedFont, role] of fontExpectations) {
    if (!layer) continue;
    if (layer.fontFamily !== expectedFont) {
      typography = false;
      issues.push(issue("TYPOGRAPHY_PARITY", `${role} uses ${layer.fontFamily}; expected ${expectedFont}.`, layer.id));
    }
  }

  const logoLayer = document.layers.find((candidate) => candidate.type === "logo" && candidate.visible);
  let logo = true;
  if (overlay.logoUsage === "APPROVED_ONLY") {
    if (!logoLayer || logoLayer.type !== "logo") {
      logo = false;
      issues.push(issue("LOGO_PARITY_MISSING", "Governed overlay requires an approved logo layer."));
    } else if (logoLayer.asset.source !== "approved-brand") {
      logo = false;
      issues.push(issue("LOGO_PARITY_SOURCE", "Layered logo is not sourced from approved brand assets.", logoLayer.id));
    }
  }

  if (document.brand.brandId !== brandId) {
    issues.push(issue("BRAND_PARITY", `Layered brand ${document.brand.brandId} differs from governed brand ${brandId}.`));
  }

  return {
    decision: issues.length ? "BLOCK" : "PASS",
    issues,
    checks: { artboard, layout, nativeCopy, typography, logo },
  };
}
