import type { CampaignCreativeOutput } from "./creativeTypes.js";
import type { MarketingCampaignType } from "./marketingPlannerTypes.js";
import type { VerifiedFact } from "./types.js";

export type CampaignCopyPolicyId =
  | "PRODUCT_PUSH"
  | "DINE_IN"
  | "DELIVERY"
  | "OFFER"
  | "BRAND_BUILDING"
  | "RESTAURANT_HOSPITALITY";

export const FORBIDDEN_GENERIC_COPY_DEFAULTS = Object.freeze([
  "Passion for flavour",
  "Made with love",
  "Taste the difference",
  "Food you'll love",
  "Generous food made with passion and served with warmth",
] as const);

export interface CampaignCopyRuleContext {
  campaignType?: MarketingCampaignType;
  brandId: string;
  facts: VerifiedFact[];
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9%']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, words: readonly string[]): boolean {
  const normalized = normalize(text);
  return words.some((word) => new RegExp(`(^|\\s)${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i").test(normalized));
}

function stringsFromUnknown(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(stringsFromUnknown);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(stringsFromUnknown);
  }
  return [];
}

function factStrings(facts: VerifiedFact[], key: string): string[] {
  return facts
    .filter((fact) => fact.verified && (fact.key === key || fact.key.startsWith(`${key}|`)))
    .flatMap((fact) => stringsFromUnknown(fact.value));
}

function hasFact(facts: VerifiedFact[], key: string): boolean {
  return facts.some(
    (fact) => fact.verified && (fact.key === key || fact.key.startsWith(`${key}|`)),
  );
}

function editableCustomerCopy(creative: CampaignCreativeOutput): string[] {
  return [
    creative.creativeBrief.headline,
    creative.creativeBrief.supportingCopy,
    creative.creativeBrief.cta,
    creative.caption,
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
  ];
}

export function resolveCampaignCopyPolicy(
  campaignType: MarketingCampaignType | undefined,
  brandId: string,
): CampaignCopyPolicyId | undefined {
  if (!campaignType) return undefined;
  if (campaignType === "DINE_IN" && brandId === "ATTHAS_RESTAURANT") {
    return "RESTAURANT_HOSPITALITY";
  }
  switch (campaignType) {
    case "PRODUCT_PUSH":
    case "DINE_IN":
    case "DELIVERY":
    case "OFFER":
    case "BRAND_BUILDING":
      return campaignType;
    default:
      return undefined;
  }
}

function assertNoForbiddenGenericCopy(creative: CampaignCreativeOutput): void {
  for (const text of editableCustomerCopy(creative)) {
    const normalizedText = normalize(text);
    for (const forbidden of FORBIDDEN_GENERIC_COPY_DEFAULTS) {
      if (normalizedText.includes(normalize(forbidden))) {
        throw new Error(
          `M3.2 copy rule violation: generic default \"${forbidden}\" is forbidden. Replace it with campaign-specific, ownable copy.`,
        );
      }
    }
  }
}

function assertProductPush(creative: CampaignCreativeOutput, facts: VerifiedFact[]): void {
  const productNames = factStrings(facts, "productName");
  if (productNames.length === 0) {
    throw new Error("M3.2 PRODUCT_PUSH copy rule violation: verified productName is required.");
  }
  const headline = normalize(creative.overlaySpec.headline);
  if (!productNames.some((name) => headline.includes(normalize(name)))) {
    throw new Error(
      `M3.2 PRODUCT_PUSH copy rule violation: headline must name the verified product (${productNames.join(" / ")}) so the desire is unmistakably product-specific.`,
    );
  }
  if (!includesAny(creative.overlaySpec.cta, ["try", "order"])) {
    throw new Error(
      'M3.2 PRODUCT_PUSH copy rule violation: CTA must be action-specific, using a "Try" or "Order" action.',
    );
  }
}

function containsTimeSensitiveDineInLanguage(text: string): boolean {
  const normalized = normalize(text);
  return (
    /\b(tonight|today|now|open|closing|closes)\b/.test(normalized) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm)\b/.test(normalized)
  );
}

function assertDineIn(creative: CampaignCreativeOutput, facts: VerifiedFact[]): void {
  if (
    !includesAny(creative.overlaySpec.headline, [
      "visit",
      "dine",
      "dining",
      "table",
      "evening",
      "night",
      "stop",
      "come",
      "join",
      "gather",
      "occasion",
    ])
  ) {
    throw new Error(
      "M3.2 DINE_IN copy rule violation: headline must connect clearly to visiting or a dine-in occasion.",
    );
  }
  if (!includesAny(creative.overlaySpec.cta, ["visit", "find", "dine"])) {
    throw new Error(
      'M3.2 DINE_IN copy rule violation: CTA must use a visit action such as "Visit", "Find Us", or "Dine".',
    );
  }
  const timedCopy = [
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
  ].join(" ");
  if (containsTimeSensitiveDineInLanguage(timedCopy) && !hasFact(facts, "physicalOpeningHours")) {
    throw new Error(
      "M3.2 DINE_IN copy rule violation: time-sensitive language may be used only when physicalOpeningHours is verified.",
    );
  }
}

function assertDelivery(creative: CampaignCreativeOutput, facts: VerifiedFact[]): void {
  const productNames = factStrings(facts, "productName");
  const headline = normalize(creative.overlaySpec.headline);
  const hasProductIntent = productNames.some((name) => headline.includes(normalize(name)));
  if (
    !hasProductIntent &&
    !includesAny(creative.overlaySpec.headline, ["order", "delivery", "delivered", "door"])
  ) {
    throw new Error(
      "M3.2 DELIVERY copy rule violation: headline must communicate product or ordering intent.",
    );
  }

  const platforms = factStrings(facts, "deliveryChannel");
  if (platforms.length === 0) {
    throw new Error("M3.2 DELIVERY copy rule violation: verified deliveryChannel is required.");
  }
  const cta = normalize(creative.overlaySpec.cta);
  if (!includesAny(cta, ["order"]) || !platforms.some((platform) => cta.includes(normalize(platform)))) {
    throw new Error(
      `M3.2 DELIVERY copy rule violation: CTA must order on a verified platform (${platforms.join(" / ")}).`,
    );
  }
}

function assertOffer(creative: CampaignCreativeOutput, facts: VerifiedFact[]): void {
  const mechanicText = normalize(
    `${creative.overlaySpec.headline} ${creative.overlaySpec.supportingCopy}`,
  );
  const verifiedTerms = factStrings(facts, "offerTerms");
  const termMatch = verifiedTerms.some((term) => {
    const normalizedTerm = normalize(term);
    return normalizedTerm.length >= 3 && mechanicText.includes(normalizedTerm);
  });
  const clearOfferCue = includesAny(mechanicText, [
    "offer",
    "deal",
    "save",
    "off",
    "free",
    "buy",
    "get",
    "claim",
  ]);
  if (!termMatch && !clearOfferCue) {
    throw new Error(
      "M3.2 OFFER copy rule violation: headline/supporting copy must make the verified offer mechanics unmistakably clear.",
    );
  }
  if (!includesAny(creative.overlaySpec.cta, ["claim", "order", "visit"])) {
    throw new Error(
      'M3.2 OFFER copy rule violation: CTA must use "Claim", "Order", or "Visit" according to the verified offer.',
    );
  }
}

function assertBrandBuilding(creative: CampaignCreativeOutput): void {
  if (!includesAny(creative.overlaySpec.cta, ["discover", "explore"])) {
    throw new Error(
      'M3.2 BRAND_BUILDING copy rule violation: CTA must be exploratory, using "Discover" or "Explore".',
    );
  }
  if (!normalize(creative.overlaySpec.cta).includes("attha's") && !normalize(creative.overlaySpec.cta).includes("atthas")) {
    throw new Error(
      "M3.2 BRAND_BUILDING copy rule violation: exploratory CTA must identify ATTHA'S rather than using a competitor-interchangeable generic action.",
    );
  }
}

function assertRestaurantHospitality(
  creative: CampaignCreativeOutput,
  facts: VerifiedFact[],
): void {
  if (
    !includesAny(creative.overlaySpec.headline, [
      "table",
      "together",
      "shared",
      "moment",
      "welcome",
      "gather",
      "join",
      "evening",
      "occasion",
      "experience",
      "hospitality",
      "warm",
      "belonging",
    ])
  ) {
    throw new Error(
      "M3.2 RESTAURANT_HOSPITALITY copy rule violation: headline must express occasion, warmth, belonging, or the restaurant experience.",
    );
  }
  if (!includesAny(creative.overlaySpec.cta, ["reserve", "join", "experience"])) {
    throw new Error(
      'M3.2 RESTAURANT_HOSPITALITY copy rule violation: CTA must use "Reserve", "Join Us", or "Experience".',
    );
  }
  if (
    includesAny(creative.overlaySpec.cta, ["reserve"]) &&
    !facts.some(
      (fact) =>
        fact.verified &&
        (fact.key.toLowerCase().includes("reservation") || fact.key.toLowerCase().includes("booking")),
    )
  ) {
    throw new Error(
      "M3.2 RESTAURANT_HOSPITALITY copy rule violation: a Reserve CTA requires verified reservation/booking capability.",
    );
  }
}

export function assertCampaignTypeCopyRules(
  creative: CampaignCreativeOutput,
  context: CampaignCopyRuleContext,
): CampaignCopyPolicyId | undefined {
  assertNoForbiddenGenericCopy(creative);
  const policy = resolveCampaignCopyPolicy(context.campaignType, context.brandId);
  if (!policy) return undefined;

  switch (policy) {
    case "PRODUCT_PUSH":
      assertProductPush(creative, context.facts);
      break;
    case "DINE_IN":
      assertDineIn(creative, context.facts);
      break;
    case "DELIVERY":
      assertDelivery(creative, context.facts);
      break;
    case "OFFER":
      assertOffer(creative, context.facts);
      break;
    case "BRAND_BUILDING":
      assertBrandBuilding(creative);
      break;
    case "RESTAURANT_HOSPITALITY":
      assertRestaurantHospitality(creative, context.facts);
      break;
  }
  return policy;
}

export function campaignCopyPolicyPrompt(input: {
  campaignType?: MarketingCampaignType;
  brandId: string;
}): string {
  const policy = resolveCampaignCopyPolicy(input.campaignType, input.brandId);
  const global = `Forbidden generic defaults in final customer-facing copy: ${FORBIDDEN_GENERIC_COPY_DEFAULTS.map((item) => `\"${item}\"`).join(", ")}.`;
  if (!policy) return global;

  const ruleByPolicy: Record<CampaignCopyPolicyId, string> = {
    PRODUCT_PUSH:
      'PRODUCT PUSH: headline must explicitly name the verified product; CTA must be action-specific with "Try" or "Order".',
    DINE_IN:
      'DINE IN: headline must connect to visiting or a dine-in occasion; CTA must use "Visit", "Find Us", or "Dine"; time-sensitive wording is allowed only when opening hours are verified.',
    DELIVERY:
      'DELIVERY: headline must carry product or ordering intent; CTA must say "Order" on a verified delivery platform.',
    OFFER:
      'OFFER: headline/supporting copy must make the verified offer mechanics unmistakably clear; CTA must use "Claim", "Order", or "Visit" as appropriate.',
    BRAND_BUILDING:
      'BRAND BUILDING: headline must be distinctive and ownable rather than competitor-interchangeable; CTA must be exploratory ("Discover" or "Explore") and identify ATTHA\'S.',
    RESTAURANT_HOSPITALITY:
      'RESTAURANT HOSPITALITY: headline must express occasion, warmth, belonging, or experience; CTA must use "Reserve", "Join Us", or "Experience". Never use "Reserve" without verified reservation/booking capability.',
  };

  return `M3.2 COPY POLICY: ${policy}\n${ruleByPolicy[policy]}\n${global}`;
}
