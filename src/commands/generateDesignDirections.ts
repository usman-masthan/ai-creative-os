import { getCreativeLayoutProvider } from "../creativeStudio/layoutProfiles/registry.js";
import type { DesignDocument, DesignLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import type { AtthasBrandId, AtthasLayoutId } from "../layouts/atthas.js";
import { resolveLayerGeometry, type DesignCopyZone } from "../layoutEngine/resolver.js";

export interface DesignDirection {
  id: "A" | "B" | "C";
  name: string;
  rationale: string;
  document: DesignDocument;
}

interface DirectionSpec {
  id: DesignDirection["id"];
  name: string;
  rationale: string;
  layoutId: AtthasLayoutId;
  copyZone: DesignCopyZone;
}

function brandId(document: DesignDocument): AtthasBrandId {
  if (document.brand.brandId === "ATTHAS_BURGER" || document.brand.brandId === "ATTHAS_RESTAURANT") {
    return document.brand.brandId;
  }
  throw new Error(`DIRECTION_UNSUPPORTED_BRAND: ${document.brand.brandId}.`);
}

function isStory(document: DesignDocument): boolean {
  return document.artboard.height / document.artboard.width > 1.5;
}

function hasPrice(document: DesignDocument): boolean {
  return document.layers.some((layer) => layer.type === "text" && layer.role === "price" && layer.visible);
}

function directionSpecs(document: DesignDocument): DirectionSpec[] {
  const brand = brandId(document);
  if (isStory(document)) {
    const layoutId: AtthasLayoutId = brand === "ATTHAS_BURGER"
      ? "ATTHAS_BURGER_STORY_VERTICAL_V1"
      : "ATTHAS_RESTAURANT_STORY_VERTICAL_V1";
    return [
      { id: "A", name: "Hero Lead", rationale: "Strong upper-left message field with the subject carrying the lower visual weight.", layoutId, copyZone: "upperLeft" },
      { id: "B", name: "Editorial Counterbalance", rationale: "Upper-right copy creates a different visual flow while protecting story UI zones.", layoutId, copyZone: "upperRight" },
      { id: "C", name: "Lower Narrative", rationale: "Lower-left copy creates a more editorial reveal while retaining the protected vertical composition.", layoutId, copyZone: "lowerLeft" },
    ];
  }

  if (brand === "ATTHAS_BURGER") {
    return [
      { id: "A", name: "Crave Hero", rationale: "Product-first appetite composition with a direct conversion hierarchy.", layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1", copyZone: "upperLeft" },
      { id: "B", name: "Premium Minimal", rationale: "More negative space and restrained premium hierarchy for brand-building strength.", layoutId: "ATTHAS_BURGER_MINIMAL_PREMIUM_V1", copyZone: "upperRight" },
      {
        id: "C",
        name: hasPrice(document) ? "Conversion Price" : "Bold Counterflow",
        rationale: hasPrice(document)
          ? "Price-forward conversion composition with a separate visual route from the hero treatment."
          : "A contrasting lower-left message flow that keeps the product dominant.",
        layoutId: hasPrice(document) ? "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1" : "ATTHAS_BURGER_HERO_PRODUCT_V1",
        copyZone: "lowerLeft",
      },
    ];
  }

  return [
    { id: "A", name: "Food Hero", rationale: "Warm food-led composition with a clear hospitality message field.", layoutId: "ATTHAS_RESTAURANT_FOOD_HERO_V1", copyZone: "upperLeft" },
    { id: "B", name: "Editorial Premium", rationale: "Restrained editorial composition with more breathing room and premium pacing.", layoutId: "ATTHAS_RESTAURANT_EDITORIAL_V1", copyZone: "upperRight" },
    { id: "C", name: "Hospitality Invitation", rationale: "Invitation-led lower message flow suited to dine-in and occasion storytelling.", layoutId: "ATTHAS_RESTAURANT_HOSPITALITY_V1", copyZone: "lowerLeft" },
  ];
}

function reflowLayer(
  layer: DesignLayer,
  geometry: ReturnType<typeof resolveLayerGeometry>,
): DesignLayer {
  const rect = (() => {
    switch (layer.id) {
      case "background": return geometry.background;
      case "product-subject": return geometry.subject;
      case "headline": return geometry.headline;
      case "supporting-copy":
      case "supporting": return geometry.supporting;
      case "cta":
      case "cta-background": return geometry.cta;
      case "price":
      case "price-background": return geometry.price;
      case "logo": return geometry.logo;
      default: return undefined;
    }
  })();
  return rect ? ({ ...layer, ...rect } as DesignLayer) : layer;
}

function buildDirection(input: {
  source: DesignDocument;
  spec: DirectionSpec;
  designId: string;
  createdAt: string;
}): DesignDirection {
  const price = hasPrice(input.source);
  const layout = getCreativeLayoutProvider(input.source.brand.clientId).get(input.spec.layoutId);
  const geometry = resolveLayerGeometry({
    artboard: input.source.artboard,
    geometryProfile: layout.geometryProfile,
    hasPrice: price,
    copyZone: input.spec.copyZone,
  });
  const document = assertDesignDocument({
    ...input.source,
    id: input.designId,
    version: 1,
    layoutId: layout.id,
    layers: input.source.layers.map((layer) => reflowLayer(layer, geometry)),
    history: [{
      version: 1,
      createdAt: input.createdAt,
      actor: "system",
      summary: `Design direction ${input.spec.id}: ${input.spec.name}. Derived deterministically from ${input.source.id} v${input.source.version}.`,
    }],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
  return {
    id: input.spec.id,
    name: input.spec.name,
    rationale: input.spec.rationale,
    document,
  };
}

export function generateDesignDirections(input: {
  document: DesignDocument;
  newDesignPrefix: string;
  createdAt?: string;
}): DesignDirection[] {
  const source = assertDesignDocument(input.document);
  if (!/^[A-Za-z0-9._-]{1,140}$/.test(input.newDesignPrefix.trim())) {
    throw new Error("newDesignPrefix contains unsafe characters or is too long.");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  return directionSpecs(source).map((spec) => buildDirection({
    source,
    spec,
    designId: `${input.newDesignPrefix.trim()}-${spec.id.toLowerCase()}`,
    createdAt,
  }));
}
