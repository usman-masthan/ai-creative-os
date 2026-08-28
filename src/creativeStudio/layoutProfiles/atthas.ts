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
  CreativeLayoutDirectionInput,
  CreativeLayoutDirectionSpec,
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

const FLUID_LAYOUT_BY_SOURCE = {
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

function ratioValue(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`ATTHAS_LAYOUT_PROVIDER_INVALID_ASPECT_RATIO: ${value}.`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`ATTHAS_LAYOUT_PROVIDER_INVALID_ASPECT_RATIO: ${value}.`);
  }
  return width / height;
}

function storyLikeRatio(value: string): boolean {
  return ratioValue(value) <= 1 / 1.55;
}

function adaptationLayoutId(input: CreativeLayoutAdaptationInput): AtthasLayoutId {
  const brand = brandId(input.brandId);
  const source = layoutById(input.sourceLayoutId);
  if (source.brandId !== brand) throw new Error("ATTHAS_LAYOUT_PROVIDER_BRAND_MISMATCH.");

  if (storyLikeRatio(input.targetAspectRatio)) return STORY_LAYOUT_BY_BRAND[brand];
  return FLUID_LAYOUT_BY_SOURCE[source.id];
}

function directionSpecs(input: CreativeLayoutDirectionInput): CreativeLayoutDirectionSpec[] {
  const brand = brandId(input.brandId);
  if (input.vertical) {
    const layoutId = STORY_LAYOUT_BY_BRAND[brand];
    return [
      {
        id: "A",
        name: "Hero Lead",
        rationale: "Strong upper-left message field with the subject carrying the lower visual weight.",
        layoutId,
        copyZone: "upperLeft",
      },
      {
        id: "B",
        name: "Editorial Counterbalance",
        rationale: "Upper-right copy creates a different visual flow while protecting story UI zones.",
        layoutId,
        copyZone: "upperRight",
      },
      {
        id: "C",
        name: "Lower Narrative",
        rationale: "Lower-left copy creates a more editorial reveal while retaining the protected vertical composition.",
        layoutId,
        copyZone: "lowerLeft",
      },
    ];
  }

  if (brand === "ATTHAS_BURGER") {
    return [
      {
        id: "A",
        name: "Crave Hero",
        rationale: "Product-first appetite composition with a direct conversion hierarchy.",
        layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
        copyZone: "upperLeft",
      },
      {
        id: "B",
        name: "Premium Minimal",
        rationale: "More negative space and restrained premium hierarchy for brand-building strength.",
        layoutId: "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",
        copyZone: "upperRight",
      },
      {
        id: "C",
        name: input.hasPrice ? "Conversion Price" : "Bold Counterflow",
        rationale: input.hasPrice
          ? "Price-forward conversion composition with a separate visual route from the hero treatment."
          : "A contrasting lower-left message flow that keeps the product dominant.",
        layoutId: input.hasPrice
          ? "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1"
          : "ATTHAS_BURGER_HERO_PRODUCT_V1",
        copyZone: "lowerLeft",
      },
    ];
  }

  return [
    {
      id: "A",
      name: "Food Hero",
      rationale: "Warm food-led composition with a clear hospitality message field.",
      layoutId: "ATTHAS_RESTAURANT_FOOD_HERO_V1",
      copyZone: "upperLeft",
    },
    {
      id: "B",
      name: "Editorial Premium",
      rationale: "Restrained editorial composition with more breathing room and premium pacing.",
      layoutId: "ATTHAS_RESTAURANT_EDITORIAL_V1",
      copyZone: "upperRight",
    },
    {
      id: "C",
      name: "Hospitality Invitation",
      rationale: "Invitation-led lower message flow suited to dine-in and occasion storytelling.",
      layoutId: "ATTHAS_RESTAURANT_HOSPITALITY_V1",
      copyZone: "lowerLeft",
    },
  ];
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
    return enrichedLayout(layoutById(adaptationLayoutId(input)));
  },
  directions(input: CreativeLayoutDirectionInput): CreativeLayoutDirectionSpec[] {
    return directionSpecs(input).map((spec) => ({ ...spec }));
  },
};
