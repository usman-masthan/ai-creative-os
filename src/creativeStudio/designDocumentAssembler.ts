import type { CampaignCreativeOutput, CampaignProductionFormat } from "../creativeTypes.js";
import type { CreativeLayoutDefinition } from "./layoutProfiles/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import type { DesignAssetRef, DesignDocument, DesignLayer, DesignTextLayer } from "../designDocument/types.js";
import { resolveLayerGeometry, type DesignCopyZone } from "../layoutEngine/resolver.js";
import { getCreativeBrandTheme } from "./clientProfiles/registry.js";

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
  brandId: string;
  brandKitId: string;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  layout: CreativeLayoutDefinition;
  backgroundAsset: DesignAssetRef;
  subjectAsset?: DesignAssetRef;
  logoAsset?: DesignAssetRef;
  copyZone?: DesignCopyZone;
  createdAt?: string;
}

export function assembleDesignDocument(request: AssembleDesignDocumentRequest): DesignDocument {
  const createdAt = request.createdAt ?? new Date().toISOString();
  const overlay = request.creative.overlaySpec;
  const theme = getCreativeBrandTheme(request.clientId, request.brandId);
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
      fontFamily: theme.displayFont,
      fontSize: Math.max(32, Math.round(request.format.width * 0.078)),
      fontWeight: 800,
      lineHeight: 0.98,
      letterSpacing: -1,
      align: request.copyZone?.endsWith("Right") ? "right" : "left",
      fill: theme.primaryText,
    }),
  );
  if (overlay.supportingCopy.trim()) {
    layers.push(
      textLayer({
        id: "supporting-copy",
        name: "Supporting Copy",
        role: "supporting",
        ...geometry.supporting,
        zIndex: 21,
        text: overlay.supportingCopy,
        fontFamily: theme.bodyFont,
        fontSize: Math.max(18, Math.round(request.format.width * 0.029)),
        fontWeight: 600,
        lineHeight: 1.22,
        letterSpacing: 0,
        align: request.copyZone?.endsWith("Right") ? "right" : "left",
        fill: theme.secondaryText,
      }),
    );
  }
  layers.push(
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
      fill: theme.ctaFill,
      cornerRadius: Math.max(6, Math.round(request.format.width * 0.008)),
    },
    textLayer({
      id: "cta",
      name: "CTA",
      role: "cta",
      ...geometry.cta,
      zIndex: 30,
      text: overlay.cta,
      fontFamily: theme.bodyFont,
      fontSize: Math.max(18, Math.round(request.format.width * 0.026)),
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: 0,
      align: "center",
      fill: theme.ctaText,
    }),
  );
  if (overlay.price) {
    const priceStyle = overlay.price.priceStyle ?? theme.defaultPriceStyle;
    const priceTheme = theme.priceThemes[priceStyle];
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
        fill: priceTheme.fill,
        cornerRadius: Math.max(6, Math.round(request.format.width * 0.008)),
      },
      textLayer({
        id: "price",
        name: "Price",
        role: "price",
        ...geometry.price,
        zIndex: 32,
        text: overlay.price.display,
        fontFamily: theme.priceFont,
        fontSize: Math.max(24, Math.round(request.format.width * 0.043)),
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0,
        align: "center",
        fill: priceTheme.text,
      }),
    );
  }
  if (request.logoAsset) {
    layers.push({
      id: "logo",
      name: theme.logoLayerName,
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
      background: theme.artboardBackground,
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
