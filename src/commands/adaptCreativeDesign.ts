import { ATTHAS_TOKENS } from "../atthasTokens.js";
import type { DesignDocument, DesignLayer, DesignTextLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import type { AtthasBrandId, AtthasLayoutId } from "../layouts/atthas.js";
import { resolveLayerGeometry, type DesignCopyZone } from "../layoutEngine/resolver.js";

export type CreativeAdaptationPreset =
  | "instagram-square"
  | "instagram-portrait"
  | "instagram-story"
  | "facebook-post";

export interface CreativeAdaptationTarget {
  preset: CreativeAdaptationPreset;
  width: number;
  height: number;
  aspectRatio: "1:1" | "4:5" | "9:16";
}

export const CREATIVE_ADAPTATION_TARGETS: Record<CreativeAdaptationPreset, CreativeAdaptationTarget> = {
  "instagram-square": { preset: "instagram-square", width: 1080, height: 1080, aspectRatio: "1:1" },
  "instagram-portrait": { preset: "instagram-portrait", width: 1080, height: 1350, aspectRatio: "4:5" },
  "instagram-story": { preset: "instagram-story", width: 1080, height: 1920, aspectRatio: "9:16" },
  "facebook-post": { preset: "facebook-post", width: 1080, height: 1350, aspectRatio: "4:5" },
};

function brandId(document: DesignDocument): AtthasBrandId {
  if (document.brand.brandId === "ATTHAS_BURGER" || document.brand.brandId === "ATTHAS_RESTAURANT") {
    return document.brand.brandId;
  }
  throw new Error(`ADAPTATION_UNSUPPORTED_BRAND: ${document.brand.brandId}.`);
}

function targetLayout(source: DesignDocument, target: CreativeAdaptationTarget): AtthasLayoutId {
  const brand = brandId(source);
  if (target.aspectRatio === "9:16") {
    return brand === "ATTHAS_BURGER"
      ? "ATTHAS_BURGER_STORY_VERTICAL_V1"
      : "ATTHAS_RESTAURANT_STORY_VERTICAL_V1";
  }

  if (brand === "ATTHAS_BURGER") {
    if (source.layoutId.includes("OFFER_DEAL")) return "ATTHAS_BURGER_OFFER_DEAL_V1";
    if (source.layoutId.includes("PROMOTIONAL_PRICE")) return "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1";
    if (source.layoutId.includes("MINIMAL_PREMIUM")) return "ATTHAS_BURGER_MINIMAL_PREMIUM_V1";
    return "ATTHAS_BURGER_HERO_PRODUCT_V1";
  }

  if (source.layoutId.includes("MULTI_DISH")) return "ATTHAS_RESTAURANT_MULTI_DISH_V1";
  if (source.layoutId.includes("EDITORIAL")) return "ATTHAS_RESTAURANT_EDITORIAL_V1";
  if (source.layoutId.includes("FOOD_HERO")) return "ATTHAS_RESTAURANT_FOOD_HERO_V1";
  return "ATTHAS_RESTAURANT_HOSPITALITY_V1";
}

function scaledFont(layer: DesignTextLayer, source: DesignDocument, target: CreativeAdaptationTarget): number {
  const widthScale = target.width / source.artboard.width;
  const heightScale = target.height / source.artboard.height;
  const scale = Math.min(widthScale, heightScale);
  const roleMinimum = layer.role === "headline" ? 30 : layer.role === "price" ? 22 : 16;
  return Math.max(roleMinimum, Math.round(layer.fontSize * scale));
}

function geometryLayer(
  layer: DesignLayer,
  geometry: ReturnType<typeof resolveLayerGeometry>,
  source: DesignDocument,
  target: CreativeAdaptationTarget,
): DesignLayer {
  const common = (() => {
    switch (layer.id) {
      case "background": return geometry.background;
      case "product-subject": return geometry.subject;
      case "headline": return geometry.headline;
      case "supporting-copy": return geometry.supporting;
      case "cta":
      case "cta-background": return geometry.cta;
      case "price":
      case "price-background": return geometry.price;
      case "logo": return geometry.logo;
      default: return undefined;
    }
  })();

  if (common) {
    if (layer.type === "text") {
      return { ...layer, ...common, fontSize: scaledFont(layer, source, target) };
    }
    return { ...layer, ...common } as DesignLayer;
  }

  const xRatio = target.width / source.artboard.width;
  const yRatio = target.height / source.artboard.height;
  if (layer.type === "text") {
    return {
      ...layer,
      x: Math.round(layer.x * xRatio),
      y: Math.round(layer.y * yRatio),
      width: Math.round(layer.width * xRatio),
      height: Math.round(layer.height * yRatio),
      fontSize: scaledFont(layer, source, target),
    };
  }
  return {
    ...layer,
    x: Math.round(layer.x * xRatio),
    y: Math.round(layer.y * yRatio),
    width: Math.round(layer.width * xRatio),
    height: Math.round(layer.height * yRatio),
  } as DesignLayer;
}

export function adaptCreativeDesign(input: {
  document: DesignDocument;
  preset: CreativeAdaptationPreset;
  newDesignId: string;
  copyZone?: DesignCopyZone;
  createdAt?: string;
}): DesignDocument {
  const source = assertDesignDocument(input.document);
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(input.newDesignId.trim())) {
    throw new Error("newDesignId contains unsafe characters.");
  }
  const target = CREATIVE_ADAPTATION_TARGETS[input.preset];
  const layoutId = targetLayout(source, target);
  const hasPrice = source.layers.some((layer) => layer.type === "text" && layer.role === "price" && layer.visible);
  const geometry = resolveLayerGeometry({
    artboard: { width: target.width, height: target.height },
    layoutId,
    hasPrice,
    ...(input.copyZone ? { copyZone: input.copyZone } : {}),
  });
  const createdAt = input.createdAt ?? new Date().toISOString();
  const restaurant = brandId(source) === "ATTHAS_RESTAURANT";
  const layers = source.layers.map((layer) => geometryLayer(layer, geometry, source, target));
  return assertDesignDocument({
    ...source,
    id: input.newDesignId.trim(),
    version: 1,
    artboard: {
      width: target.width,
      height: target.height,
      background: restaurant ? ATTHAS_TOKENS.colours.cream : ATTHAS_TOKENS.colours.deepRed,
    },
    layoutId,
    layers,
    history: [
      {
        version: 1,
        createdAt,
        actor: "system",
        summary: `Adapted from ${source.id} v${source.version} to ${input.preset} (${target.aspectRatio}) with recomputed layout.`,
      },
    ],
    createdAt,
    updatedAt: createdAt,
  });
}
