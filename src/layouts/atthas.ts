import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../creativeTypes.js";
import type { MarketingCampaignType } from "../marketingPlannerTypes.js";

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
  imageCompositionRequirements: string[];
}

export const ATTHAS_LAYOUTS: readonly AtthasLayoutDefinition[] = [
  {
    id: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Hero Product",
    intent: "Crave-led product hero with strong appetite image and compact copy.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "keep the main food subject in the centre-right or lower-centre appetite zone",
      "reserve clean negative space in the upper-left for headline and supporting copy",
      "keep the lower-right action zone visually quiet enough for a CTA overlay",
      "avoid important food detail within the outer 5 percent social safe area",
    ],
  },
  {
    id: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Promotional Price",
    intent: "Conversion-first layout with deterministic price as a dominant branded element.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "keep the food hero in the lower-centre or centre-left area",
      "reserve a clean upper-left headline zone",
      "reserve a clean upper-right area for the deterministic price component",
      "keep the lower-right action zone free from critical food detail",
    ],
  },
  {
    id: "ATTHAS_BURGER_OFFER_DEAL_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Offer / Deal",
    intent: "High-energy deal treatment for verified offer campaigns.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "keep the hero product concentrated in the lower two-thirds of the frame",
      "preserve a broad uncluttered message zone across the upper third",
      "leave one clean corner for deterministic offer or price treatment",
      "do not place generated signs, labels, packaging copy or badges in the reserved message zones",
    ],
  },
  {
    id: "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Minimal Premium",
    intent: "Lower-copy brand-building layout that still feels bold and premium.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "low",
    imageCompositionRequirements: [
      "use a single strong focal subject with generous negative space",
      "prefer an off-centre or lower-right hero position",
      "keep at least one large uninterrupted area for minimal headline treatment",
      "avoid busy props or background elements that compete with the subject",
    ],
  },
  {
    id: "ATTHAS_BURGER_STORY_VERTICAL_V1",
    brandId: "ATTHAS_BURGER",
    name: "Burger Story Vertical",
    intent: "9:16 story/reel-cover layout with protected message and action zones.",
    supportedAspectRatios: ["9:16"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "compose for a 9:16 vertical crop with the hero in the middle-to-lower portion",
      "protect the upper 25 percent as a clean message zone",
      "protect the lower 20 percent as a clean action zone",
      "keep critical product detail away from extreme top and bottom platform UI areas",
    ],
  },
  {
    id: "ATTHAS_RESTAURANT_FOOD_HERO_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Food Hero",
    intent: "Warm, spacious product-led layout with restrained hospitality styling.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "keep the plated food hero in the lower half or centre-right",
      "reserve warm uncluttered negative space in the upper-left for copy",
      "show believable serving scale without exaggerated perspective",
      "keep the outer social safe area free from critical dish detail",
    ],
  },
  {
    id: "ATTHAS_RESTAURANT_EDITORIAL_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Editorial",
    intent: "Premium editorial treatment for brand-building and considered storytelling.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "low",
    imageCompositionRequirements: [
      "use a restrained editorial composition with generous breathing room",
      "place the primary food or hospitality subject off-centre",
      "reserve one large clean text field without visual clutter",
      "avoid loud promotional props or overly saturated synthetic styling",
    ],
  },
  {
    id: "ATTHAS_RESTAURANT_MULTI_DISH_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Multi Dish",
    intent: "Broad-menu / shared-table layout for variety, spreads and group dining.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "keep the table spread or multiple dishes within the lower two-thirds",
      "preserve the upper third as a clean copy-safe area",
      "maintain believable dish scale and spacing rather than overcrowding",
      "avoid cropping every dish at the frame edge; preserve a coherent shared-table composition",
    ],
  },
  {
    id: "ATTHAS_RESTAURANT_HOSPITALITY_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Hospitality",
    intent: "Warm invitation-led layout for dine-in, service and occasion campaigns.",
    supportedAspectRatios: ["4:5", "1:1"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "use a warm restaurant or table scene concentrated in the lower or right side",
      "leave a clear invitation/message zone in the upper-left",
      "preserve natural human-scale perspective and believable restaurant ambience",
      "avoid generated signage, menus or wall text that could create false brand claims",
    ],
  },
  {
    id: "ATTHAS_RESTAURANT_STORY_VERTICAL_V1",
    brandId: "ATTHAS_RESTAURANT",
    name: "Restaurant Story Vertical",
    intent: "9:16 warm editorial story/reel-cover layout.",
    supportedAspectRatios: ["9:16"],
    copyDensity: "medium",
    imageCompositionRequirements: [
      "compose for a 9:16 vertical crop with the main hospitality subject in the middle-to-lower frame",
      "reserve the upper 30 percent as warm clean editorial copy space",
      "keep the lower action zone uncluttered for deterministic CTA treatment",
      "keep important faces, food and table detail away from extreme platform UI edges",
    ],
  },
] as const;

export interface SelectAtthasLayoutInput {
  brandId: AtthasBrandId;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  campaignType?: MarketingCampaignType;
  preferredLayoutId?: AtthasLayoutId;
}

function getLayout(id: AtthasLayoutId): AtthasLayoutDefinition {
  const layout = ATTHAS_LAYOUTS.find((candidate) => candidate.id === id);
  if (!layout) throw new Error(`Unknown ATTHA'S layout: ${id}.`);
  return layout;
}

function isStoryLikeFormat(format: CampaignProductionFormat): boolean {
  return format.height / format.width >= 1.55;
}

function isStoryLayout(layout: AtthasLayoutDefinition): boolean {
  return layout.supportedAspectRatios.length === 1 && layout.supportedAspectRatios[0] === "9:16";
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
  if (layout.supportedAspectRatios.includes(format.aspectRatio)) return;
  if (isStoryLayout(layout) === isStoryLikeFormat(format)) return;
  throw new Error(
    `ATTHA'S layout ${layout.id} is not compatible with ${format.width}x${format.height} (${format.aspectRatio}).`,
  );
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

  if (isStoryLikeFormat(input.format)) {
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
    if (input.campaignType === "DINE_IN") {
      return getLayout("ATTHAS_BURGER_MINIMAL_PREMIUM_V1");
    }
    if (input.campaignType === "BRAND_BUILDING" || role === "brand-building") {
      return getLayout("ATTHAS_BURGER_MINIMAL_PREMIUM_V1");
    }
    return getLayout("ATTHAS_BURGER_HERO_PRODUCT_V1");
  }

  if (multiDishLanguage) return getLayout("ATTHAS_RESTAURANT_MULTI_DISH_V1");
  if (input.campaignType === "PRODUCT_PUSH") return getLayout("ATTHAS_RESTAURANT_FOOD_HERO_V1");
  if (input.campaignType === "DINE_IN") return getLayout("ATTHAS_RESTAURANT_HOSPITALITY_V1");
  if (role === "brand-building") return getLayout("ATTHAS_RESTAURANT_EDITORIAL_V1");
  if (hasVerifiedPriceOverlay) return getLayout("ATTHAS_RESTAURANT_FOOD_HERO_V1");
  return getLayout("ATTHAS_RESTAURANT_HOSPITALITY_V1");
}
