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
];

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}

function collectCustomerFacingCopy(creative: CampaignCreativeOutput): string[] {
  const conceptCopy = creative.concepts.flatMap((concept) => [
    concept.campaignName,
    concept.headlineDirection,
    concept.cta,
  ]);

  return [
    ...conceptCopy,
    creative.creativeBrief.headline,
    creative.creativeBrief.supportingCopy,
    creative.creativeBrief.cta,
    creative.caption,
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

export function assertCreativeRespectsClaimGovernance(
  creative: CampaignCreativeOutput,
  preflight: CampaignPreflight,
  governance: ClaimGovernance = {},
): void {
  const customerCopy = normalize(collectCustomerFacingCopy(creative).join("\n"));
  const verifiedText = collectVerifiedText(preflight);
  const allowedTerms = new Set(
    (governance.allowedCreativeTerms ?? []).map((term) => normalize(term.trim())).filter(Boolean),
  );

  for (const term of governance.blockedUnverifiedTerms ?? defaultBlockedTerms) {
    const normalizedTerm = normalize(term.trim());
    if (!normalizedTerm) continue;
    if (allowedTerms.has(normalizedTerm)) continue;
    if (!customerCopy.includes(normalizedTerm)) continue;
    if (verifiedText.includes(normalizedTerm)) continue;

    throw new Error(
      `Claim governance violation: unsupported customer-facing product claim \"${term}\" was not present in verified facts.`,
    );
  }
}
