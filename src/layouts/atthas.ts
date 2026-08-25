import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../creativeTypes.js";

export type AtthasBrandId = "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";

export type AtthasLayoutId =
  | "ATTHAS_BURGER_HERO_PRODUCT_V1"
  | "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1"
  | "ATTHAS_BURGER_OFFER_DEAL_V1"
  | "ATTHAS_BURGER_MINIMAL_PREMIUM_V1"
  | "ATTHAS_BURGER_STORY_VERTICAL_V1"
  | "ATTHAS_RESTAURANT_FOOD_HERO_V1"
  | "ATTHAS_RESTAURANT_EDITORIAL_V1"
  | "ATTHAS_RESTAURANT_MULTI_DISH_V1"
  | "ATTHAS_RESTAURANT_HOSPITALITY_V1"
  | "ATTHAS_RESTAURANT_STORY_VERTICAL_V1";

export interface AtthasLayoutDefinition {
  id: AtthasLayoutId;
  brandId: AtthasBrandId;
  name: string;
  intent: string;
  supportedAspectRatios: string[];
  copyDensity: "low" | "medium";
}

export const ATTHAS_LAYOUTS: readonly AtthasLayoutDefinition[] = [
  {
    id: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Hero Product",
    intent: "Crave-led product hero with strong appetite image and compact copy.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
  },
  {
    id: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Promotional Price",
    intent: "Conversion-first layout with deterministic price as a dominant branded element.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
  },
  {
    id: "ATTHAS_BURGER_OFFER_DEAL_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Offer / Deal",
    intent: "High-energy deal treatment for verified offer campaigns.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
  },
  {
    id: "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Minimal Premium",
    intent: "Lower-copy brand-building layout that still feels bold and premium.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "low",
  },
  {
    id: "ATTHAS_BURGER_STORY_VERTICAL_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Story Vertical",
    intent: "9:16 story/reel-cover layout with protected message and action zones.",
    supportedAspectRatios: ["9:16"],
    copyDensity: "medium",
  },
  {
    id: "ATTHAS_RESTAURANT_FOOD_HERO_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Food Hero",
    intent: "Warm, spacious product-led layout with restrained hospitality styling.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
  },
  {
    id: "ATTHAS_RESTAURANT_EDITORIAL_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Editorial",
    intent: "Premium editorial treatment for brand-building and considered storytelling.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "low",
  },
  {
    id: "ATTHAS_RESTAURANT_MULTI_DISH_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Multi Dish",
    intent: "Broad-menu / shared-table layout for variety, spreads and group dining.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
  },
  {
    id: "ATTHAS_RESTAURANT_HOSPITALITY_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Hospitality",
    intent: "Warm invitation-led layout for dine-in, service and occasion campaigns.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
  },
  {
    id: "ATTHAS_RESTAURANT_STORY_VERTICAL_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Story Vertical",
    intent: "9:16 warm editorial story/reel-cover layout.",
    supportedAspectRatios: ["9:16"],
    copyDensity: "medium",
  },
] as const;

export interface SelectAtthasLayoutInput {
  brandId: AtthasBrandId;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  preferredLayoutId?: AtthasLayoutId;
}

function getLayout(id: AtthasLayoutId): AtthasLayoutDefinition {
  const layout = ATTHAS_LAYOUTS.find((candidate) => candidate.id === id);
  if (!layout) throw new Error(`Unknown ATTHA'S layout: ${id}.`);
  return layout;
}

function assertLayoutCompatible(
  layout: AtthasLayoutDefinition,
  brandId: AtthasBrandId,
  format: CampaignProductionFormat,
): void {
  if (layout.brandId !== brandId) {
    throw new Error(
      `ATTHA'S layout ${layout.id} belongs to ${layout.brandId}, not ${brandId}.`,
    );
  }
  if (!layout.supportedAspectRatios.includes(format.aspectRatio)) {
    throw new Error(
      `ATTHA'S layout ${layout.id} does not support aspect ratio ${format.aspectRatio}.`,
    );
  }
}

function recommendedRole(creative: CampaignCreativeOutput): string | undefined {
  return creative.concepts.find((concept) => concept.id === creative.recommendedConceptId)
    ?.strategicRole;
}

function normalizedCreativeText(creative: CampaignCreativeOutput): string {
  return [
    creative.creativeBrief.headline,
    creative.creativeBrief.supportingCopy,
    creative.creativeBrief.visualDirection,
    creative.creativeBrief.composition,
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.caption,
  ]
    .join(" ")
    .toLowerCase();
}

export function selectAtthasLayout(input: SelectAtthasLayoutInput): AtthasLayoutDefinition {
  if (input.preferredLayoutId) {
    const preferred = getLayout(input.preferredLayoutId);
    assertLayoutCompatible(preferred, input.brandId, input.format);
    return preferred;
  }

  if (input.format.aspectRatio === "9:16") {
    return getLayout(
      input.brandId === "ATTHAS_BURGER"
        ? "ATTHAS_BURGER_STORY_VERTICAL_V1"
        : "ATTHAS_RESTAURANT_STORY_VERTICAL_V1",
    );
  }

  const role = recommendedRole(input.creative);
  const text = normalizedCreativeText(input.creative);
  const hasVerifiedPriceOverlay = Boolean(input.creative.overlaySpec.price);
  const offerLanguage = /\b(buy\s*1|free|offer|deal|save|discount|off)\b|%/.test(text);
  const multiDishLanguage = /\b(spread|sharing|shared|variety|multi[- ]?dish|multiple dishes|table full|selection)\b/.test(
    text,
  );

  if (input.brandId === "ATTHAS_BURGER") {
    if (offerLanguage) return getLayout("ATTHAS_BURGER_OFFER_DEAL_V1");
    if (hasVerifiedPriceOverlay) return getLayout("ATTHAS_BURGER_PROMOTIONAL_PRICE_V1");
    if (role === "brand-building") return getLayout("ATTHAS_BURGER_MINIMAL_PREMIUM_V1");
    return getLayout("ATTHAS_BURGER_HERO_PRODUCT_V1");
  }

  if (multiDishLanguage) return getLayout("ATTHAS_RESTAURANT_MULTI_DISH_V1");
  if (role === "brand-building") return getLayout("ATTHAS_RESTAURANT_EDITORIAL_V1");
  if (hasVerifiedPriceOverlay) return getLayout("ATTHAS_RESTAURANT_FOOD_HERO_V1");
  return getLayout("ATTHAS_RESTAURANT_HOSPITALITY_V1");
}
