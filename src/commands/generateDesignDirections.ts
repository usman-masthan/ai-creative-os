import { getCreativeLayoutProvider } from "../creativeStudio/layoutProfiles/registry.js";
import type { CreativeLayoutDirectionSpec } from "../creativeStudio/layoutProfiles/types.js";
import type { DesignDocument, DesignLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import { resolveLayerGeometry } from "../layoutEngine/resolver.js";

export interface DesignDirection {
  id: "A" | "B" | "C";
  name: string;
  rationale: string;
  document: DesignDocument;
}

function isStory(document: DesignDocument): boolean {
  return document.artboard.height / document.artboard.width > 1.5;
}

function hasPrice(document: DesignDocument): boolean {
  return document.layers.some((layer) => layer.type === "text" && layer.role === "price" && layer.visible);
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
  spec: CreativeLayoutDirectionSpec;
  designId: string;
  createdAt: string;
}): DesignDirection {
  const provider = getCreativeLayoutProvider(input.source.brand.clientId);
  const layout = provider.get(input.spec.layoutId);
  if (layout.brandId !== input.source.brand.brandId) {
    throw new Error(`DIRECTION_LAYOUT_BRAND_MISMATCH: ${layout.id} does not belong to ${input.source.brand.brandId}.`);
  }
  const geometry = resolveLayerGeometry({
    artboard: input.source.artboard,
    geometryProfile: layout.geometryProfile,
    hasPrice: hasPrice(input.source),
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
  const provider = getCreativeLayoutProvider(source.brand.clientId);
  const specs = provider.directions({
    brandId: source.brand.brandId,
    vertical: isStory(source),
    hasPrice: hasPrice(source),
  });
  if (specs.length !== 3 || specs.map((spec) => spec.id).join("") !== "ABC") {
    throw new Error("DIRECTION_PROVIDER_INVALID: provider must return exactly A, B and C directions in order.");
  }
  const createdAt = input.createdAt ?? new Date().toISOString();
  return specs.map((spec) => buildDirection({
    source,
    spec,
    designId: `${input.newDesignPrefix.trim()}-${spec.id.toLowerCase()}`,
    createdAt,
  }));
}
