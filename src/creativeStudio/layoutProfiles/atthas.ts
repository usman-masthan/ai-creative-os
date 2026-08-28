import {
  ATTHAS_LAYOUTS,
  selectAtthasLayout,
  type AtthasBrandId,
  type AtthasLayoutDefinition,
  type AtthasLayoutId,
} from "../../layouts/atthas.js";
import type { LayerGeometryProfile } from "../../layoutEngine/geometry.js";
import type {
  CreativeLayoutAdaptationInput,
  CreativeLayoutDefinition,
  CreativeLayoutProvider,
  CreativeLayoutSelectionInput,
} from "./types.js";

const GEOMETRY_PROFILE_BY_LAYOUT = {
  ATTHAS_BURGER_HERO_PRODUCT_V1: "STANDARD_HERO",
  ATTHAS_BURGER_PROMOTIONAL_PRICE_V1: "STANDARD_HERO",
  ATTHAS_BURGER_OFFER_DEAL_V1: "STANDARD_HERO",
  ATTHAS_BURGER_MINIMAL_PREMIUM_V1: "EDITORIAL_OFFCENTER",
  ATTHAS_BURGER_STORY_VERTICAL_V1: "VERTICAL_STORY",
  ATTHAS_RESTAURANT_FOOD_HERO_V1: "STANDARD_HERO",
  ATTHAS_RESTAURANT_EDITORIAL_V1: "EDITORIAL_OFFCENTER",
  ATTHAS_RESTAURANT_MULTI_DISH_V1: "STANDARD_HERO",
  ATTHAS_RESTAURANT_HOSPITALITY_V1: "STANDARD_HERO",
  ATTHAS_RESTAURANT_STORY_VERTICAL_V1: "VERTICAL_STORY",
} satisfies Record<AtthasLayoutId, LayerGeometryProfile>;

const SQUARE_PORTRAIT_LAYOUT_BY_SOURCE = {
  ATTHAS_BURGER_HERO_PRODUCT_V1: "ATTHAS_BURGER_HERO_PRODUCT_V1",
  ATTHAS_BURGER_PROMOTIONAL_PRICE_V1: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
  ATTHAS_BURGER_OFFER_DEAL_V1: "ATTHAS_BURGER_OFFER_DEAL_V1",
  ATTHAS_BURGER_MINIMAL_PREMIUM_V1: "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",
  ATTHAS_BURGER_STORY_VERTICAL_V1: "ATTHAS_BURGER_HERO_PRODUCT_V1",
  ATTHAS_RESTAURANT_FOOD_HERO_V1: "ATTHAS_RESTAURANT_FOOD_HERO_V1",
  ATTHAS_RESTAURANT_EDITORIAL_V1: "ATTHAS_RESTAURANT_EDITORIAL_V1",
  ATTHAS_RESTAURANT_MULTI_DISH_V1: "ATTHAS_RESTAURANT_MULTI_DISH_V1",
  ATTHAS_RESTAURANT_HOSPITALITY_V1: "ATTHAS_RESTAURANT_HOSPITALITY_V1",
  ATTHAS_RESTAURANT_STORY_VERTICAL_V1: "ATTHAS_RESTAURANT_HOSPITALITY_V1",
} satisfies Record<AtthasLayoutId, AtthasLayoutId>;

const STORY_LAYOUT_BY_BRAND = {
  ATTHAS_BURGER: "ATTHAS_BURGER_STORY_VERTICAL_V1",
  ATTHAS_RESTAURANT: "ATTHAS_RESTAURANT_STORY_VERTICAL_V1",
} satisfies Record<AtthasBrandId, AtthasLayoutId>;

function brandId(value: string): AtthasBrandId {
  if (value === "ATTHAS_BURGER" || value === "ATTHAS_RESTAURANT") return value;
  throw new Error(`ATTHAS_LAYOUT_PROVIDER_UNSUPPORTED_BRAND: ${value}.`);
}

function layoutById(value: string): AtthasLayoutDefinition {
  const layout = ATTHAS_LAYOUTS.find((candidate) => candidate.id === value);
  if (!layout) throw new Error(`ATTHAS_LAYOUT_PROVIDER_UNKNOWN_LAYOUT: ${value}.`);
  return layout;
}

function enrichedLayout(layout: AtthasLayoutDefinition): CreativeLayoutDefinition {
  return {
    ...layout,
    geometryProfile: GEOMETRY_PROFILE_BY_LAYOUT[layout.id],
  };
}

function adaptationLayoutId(input: CreativeLayoutAdaptationInput): AtthasLayoutId {
  const brand = brandId(input.brandId);
  const source = layoutById(input.sourceLayoutId);
  if (source.brandId !== brand) throw new Error("ATTHAS_LAYOUT_PROVIDER_BRAND_MISMATCH.");

  if (input.targetAspectRatio === "9:16") return STORY_LAYOUT_BY_BRAND[brand];
  if (input.targetAspectRatio !== "4:5" && input.targetAspectRatio !== "1:1") {
    throw new Error(`ATTHAS_LAYOUT_PROVIDER_UNSUPPORTED_ASPECT_RATIO: ${input.targetAspectRatio}.`);
  }
  return SQUARE_PORTRAIT_LAYOUT_BY_SOURCE[source.id];
}

export const ATTHAS_CREATIVE_LAYOUT_PROVIDER: CreativeLayoutProvider = {
  clientId: "T001",
  list(selectedBrandId?: string): CreativeLayoutDefinition[] {
    if (!selectedBrandId) return ATTHAS_LAYOUTS.map(enrichedLayout);
    const selected = brandId(selectedBrandId);
    return ATTHAS_LAYOUTS.filter((layout) => layout.brandId === selected).map(enrichedLayout);
  },
  get(layoutId: string): CreativeLayoutDefinition {
    return enrichedLayout(layoutById(layoutId));
  },
  select(input: CreativeLayoutSelectionInput): CreativeLayoutDefinition {
    const selectedBrand = brandId(input.brandId);
    const preferred = input.preferredLayoutId
      ? layoutById(input.preferredLayoutId).id
      : undefined;
    const selected = selectAtthasLayout({
      brandId: selectedBrand,
      creative: input.creative,
      format: input.format,
      ...(input.campaignType ? { campaignType: input.campaignType } : {}),
      ...(preferred ? { preferredLayoutId: preferred } : {}),
    });
    return enrichedLayout(selected);
  },
  adaptationLayout(input: CreativeLayoutAdaptationInput): CreativeLayoutDefinition {
    const selected = layoutById(adaptationLayoutId(input));
    if (!selected.supportedAspectRatios.includes(input.targetAspectRatio)) {
      throw new Error(`ATTHAS_LAYOUT_PROVIDER_INCOMPATIBLE_ADAPTATION: ${selected.id} does not support ${input.targetAspectRatio}.`);
    }
    return enrichedLayout(selected);
  },
};
