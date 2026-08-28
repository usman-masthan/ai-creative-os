import type { CampaignPreflight } from "./commands/createCampaign.js";
import type { CampaignCreativeOutput } from "./creativeTypes.js";

export interface ClaimGovernance {
  blockedUnverifiedTerms?: string[];
  allowedCreativeTerms?: string[];
}

const defaultBlockedTerms = [
  "juicy",
  "spicy",
  "fresh",
  "homemade",
  "handmade",
  "organic",
  "healthy",
  "low calorie",
  "best",
  "biggest",
  "largest",
  "award-winning",
  "award winning",
  "100%",
  "available now",
  "currently available",
  "available today",
  "today",
  "limited time",
  "signature",
  "signature item",
  "bestseller",
  "best seller",
  "customer favourite",
  "customer favorite",
  "most popular",
  "most ordered",
  "reliable",
  "consistent delivery",
  "delivered directly",
  "delivered fast",
  "fast delivery",
  "delivered quickly",
  "quick delivery",
  "instant delivery",
  "lettuce",
  "tomato",
  "cheese",
  "pickle",
  "pickles",
  "onion",
  "onions",
  "mayo",
  "mayonnaise",
  "sauce",
  "sesame",
  "steam",
  "steaming",
];

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}

function collectClaimBearingText(creative: CampaignCreativeOutput): string[] {
  // Concept objects are internal ideation metadata. They are never rendered or sent
  // directly to the image model. Govern only production-facing/customer-facing fields;
  // if an internal idea leaks into final copy or image instructions it is still blocked.
  return [
    creative.creativeBrief.headline,
    creative.creativeBrief.supportingCopy,
    creative.creativeBrief.cta,
    creative.creativeBrief.visualDirection,
    creative.creativeBrief.composition,
    creative.creativeBrief.lighting,
    creative.creativeBrief.photographyStyle,
    creative.caption,
    creative.imageGeneration.basePrompt,
    ...creative.imageGeneration.visualConstraints,
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
  ];
}

function collectVerifiedText(preflight: CampaignPreflight): string {
  return normalize(
    preflight.facts
      .map((fact) => (typeof fact.value === "string" ? fact.value : String(fact.value)))
      .join("\n"),
  );
}

export function findUnsupportedClaimTermsInText(
  text: string,
  preflight: CampaignPreflight,
  governance: ClaimGovernance = {},
): string[] {
  const normalizedText = normalize(text);
  const verifiedText = collectVerifiedText(preflight);
  const allowedTerms = new Set(
    (governance.allowedCreativeTerms ?? []).map((term) => normalize(term.trim())).filter(Boolean),
  );

  return (governance.blockedUnverifiedTerms ?? defaultBlockedTerms).filter((term) => {
    const normalizedTerm = normalize(term.trim());
    if (!normalizedTerm) return false;
    if (allowedTerms.has(normalizedTerm)) return false;
    if (!normalizedText.includes(normalizedTerm)) return false;
    if (verifiedText.includes(normalizedTerm)) return false;
    return true;
  });
}

export function assertCreativeRespectsClaimGovernance(
  creative: CampaignCreativeOutput,
  preflight: CampaignPreflight,
  governance: ClaimGovernance = {},
): void {
  const claimBearingText = normalize(collectClaimBearingText(creative).join("\n"));
  const verifiedText = collectVerifiedText(preflight);
  const allowedTerms = new Set(
    (governance.allowedCreativeTerms ?? []).map((term) => normalize(term.trim())).filter(Boolean),
  );

  for (const term of governance.blockedUnverifiedTerms ?? defaultBlockedTerms) {
    const normalizedTerm = normalize(term.trim());
    if (!normalizedTerm) continue;
    if (allowedTerms.has(normalizedTerm)) continue;
    if (!claimBearingText.includes(normalizedTerm)) continue;
    if (verifiedText.includes(normalizedTerm)) continue;

    throw new Error(
      `Claim governance violation: unsupported product/service claim or depiction \"${term}\" was not present in verified facts.`,
    );
  }
}
