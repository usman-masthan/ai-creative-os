import { ATTHAS_TOKENS, atthasDisplayFont } from "../atthasTokens.js";
import type { CampaignCreativeOutput, CampaignProductionFormat } from "../creativeTypes.js";
import type { AtthasBrandId, AtthasLayoutDefinition } from "../layouts/atthas.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import type { DesignAssetRef, DesignDocument, DesignLayer, DesignTextLayer } from "../designDocument/types.js";
import { resolveLayerGeometry, type DesignCopyZone } from "../layoutEngine/resolver.js";

function textLayer(input: Omit<DesignTextLayer, "type" | "rotation" | "opacity" | "visible" | "locked" | "aiEditable">): DesignTextLayer {
  return {
    ...input,
    type: "text",
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    aiEditable: true,
  };
}

export interface AssembleDesignDocumentRequest {
  id: string;
  campaignId: string;
  creativeBriefId?: string;
  truthSnapshotId: string;
  clientId: string;
  brandId: AtthasBrandId;
  brandKitId: string;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  layout: AtthasLayoutDefinition;
  backgroundAsset: DesignAssetRef;
  subjectAsset?: DesignAssetRef;
  logoAsset?: DesignAssetRef;
  copyZone?: DesignCopyZone;
  createdAt?: string;
}

export function assembleDesignDocument(request: AssembleDesignDocumentRequest): DesignDocument {
  const createdAt = request.createdAt ?? new Date().toISOString();
  const overlay = request.creative.overlaySpec;
  if (overlay.logoUsage === "APPROVED_ONLY" && !request.logoAsset) {
    throw new Error("BRAND_ASSET_MISSING: an approved logo asset is required by the creative overlay.");
  }
  if (request.logoAsset && request.logoAsset.source !== "approved-brand") {
    throw new Error("BRAND_GOVERNANCE_BLOCK: logos must use approved-brand assets.");
  }
  const artboard = { width: request.format.width, height: request.format.height };
  const geometry = resolveLayerGeometry({
    artboard,
    layoutId: request.layout.id,
    ...(request.copyZone ? { copyZone: request.copyZone } : {}),
    hasPrice: Boolean(overlay.price),
  });
  const restaurant = request.brandId === "ATTHAS_RESTAURANT";
  const displayFont = atthasDisplayFont(request.brandId);
  const primaryText = restaurant ? ATTHAS_TOKENS.colours.ink : ATTHAS_TOKENS.colours.white;
  const secondaryText = restaurant ? ATTHAS_TOKENS.colours.ink : ATTHAS_TOKENS.colours.cream;
  const ctaFill = restaurant ? ATTHAS_TOKENS.colours.primaryRed : ATTHAS_TOKENS.colours.primaryYellow;
  const ctaText = restaurant ? ATTHAS_TOKENS.colours.white : ATTHAS_TOKENS.colours.ink;
  const layers: DesignLayer[] = [
    {
      id: "background",
      name: "Background",
      type: "background",
      ...geometry.background,
      rotation: 0,
      opacity: 1,
      zIndex: 0,
      visible: true,
      locked: false,
      aiEditable: true,
      asset: request.backgroundAsset,
      fit: "cover",
    },
  ];
  if (request.subjectAsset) {
    layers.push({
      id: "product-subject",
      name: "Product / Subject",
      type: "image",
      ...geometry.subject,
      rotation: 0,
      opacity: 1,
      zIndex: 10,
      visible: true,
      locked: false,
      aiEditable: true,
      asset: request.subjectAsset,
      fit: "contain",
    });
  }
  layers.push(
    textLayer({
      id: "headline",
      name: "Headline",
      role: "headline",
      ...geometry.headline,
      zIndex: 20,
      text: overlay.headline,
      fontFamily: displayFont,
      fontSize: Math.max(32, Math.round(request.format.width * 0.078)),
      fontWeight: 800,
      lineHeight: 0.98,
      letterSpacing: -1,
      align: request.copyZone?.endsWith("Right") ? "right" : "left",
      fill: primaryText,
    }),
    textLayer({
      id: "supporting-copy",
      name: "Supporting Copy",
      role: "supporting",
      ...geometry.supporting,
      zIndex: 21,
      text: overlay.supportingCopy || " ",
      fontFamily: ATTHAS_TOKENS.typography.body,
      fontSize: Math.max(18, Math.round(request.format.width * 0.029)),
      fontWeight: 600,
      lineHeight: 1.22,
      letterSpacing: 0,
      align: request.copyZone?.endsWith("Right") ? "right" : "left",
      fill: secondaryText,
    }),
    {
      id: "cta-background",
      name: "CTA Background",
      type: "shape",
      shape: "rect",
      ...geometry.cta,
      rotation: 0,
      opacity: 1,
      zIndex: 29,
      visible: true,
      locked: false,
      aiEditable: false,
      fill: ctaFill,
      cornerRadius: Math.max(6, Math.round(request.format.width * 0.008)),
    },
    textLayer({
      id: "cta",
      name: "CTA",
      role: "cta",
      ...geometry.cta,
      zIndex: 30,
      text: overlay.cta,
      fontFamily: ATTHAS_TOKENS.typography.body,
      fontSize: Math.max(18, Math.round(request.format.width * 0.026)),
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: 0,
      align: "center",
      fill: ctaText,
    }),
  );
  if (overlay.price) {
    const priceFill = overlay.price.priceStyle === "BRAND_RED"
      ? ATTHAS_TOKENS.colours.primaryRed
      : ATTHAS_TOKENS.colours.primaryYellow;
    const priceText = overlay.price.priceStyle === "BRAND_RED"
      ? ATTHAS_TOKENS.colours.white
      : ATTHAS_TOKENS.colours.ink;
    layers.push(
      {
        id: "price-background",
        name: "Price Background",
        type: "shape",
        shape: "rect",
        ...geometry.price,
        rotation: 0,
        opacity: 1,
        zIndex: 31,
        visible: true,
        locked: false,
        aiEditable: false,
        fill: priceFill,
        cornerRadius: Math.max(6, Math.round(request.format.width * 0.008)),
      },
      textLayer({
        id: "price",
        name: "Price",
        role: "price",
        ...geometry.price,
        zIndex: 32,
        text: overlay.price.display,
        fontFamily: ATTHAS_TOKENS.typography.price,
        fontSize: Math.max(24, Math.round(request.format.width * 0.043)),
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0,
        align: "center",
        fill: priceText,
      }),
    );
  }
  if (request.logoAsset) {
    layers.push({
      id: "logo",
      name: "Approved ATTHA'S Logo",
      type: "logo",
      ...geometry.logo,
      rotation: 0,
      opacity: 1,
      zIndex: 50,
      visible: true,
      locked: true,
      aiEditable: false,
      asset: request.logoAsset,
      preserveAspectRatio: true,
      clearSpacePx: Math.max(8, Math.round(request.format.width * 0.015)),
    });
  }
  return assertDesignDocument({
    schemaVersion: 1,
    id: request.id,
    version: 1,
    campaignId: request.campaignId,
    ...(request.creativeBriefId ? { creativeBriefId: request.creativeBriefId } : {}),
    truthSnapshotId: request.truthSnapshotId,
    artboard: {
      ...artboard,
      background: restaurant ? ATTHAS_TOKENS.colours.cream : ATTHAS_TOKENS.colours.deepRed,
    },
    brand: {
      clientId: request.clientId,
      brandId: request.brandId,
      brandKitId: request.brandKitId,
    },
    layoutId: request.layout.id,
    layers,
    history: [{ version: 1, createdAt, summary: "Initial layered design assembled from governed campaign output.", actor: "system" }],
    createdAt,
    updatedAt: createdAt,
  });
}
