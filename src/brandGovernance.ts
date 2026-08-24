import type { CampaignCreativeOutput } from "./creativeTypes.js";

export type BrandAssetStatus = "APPROVED" | "PROPOSED" | "LEGACY" | "MISSING";

export interface BrandGovernance {
  allowProposedIdentity?: boolean;
  assetStatus?: {
    logo?: BrandAssetStatus;
    colors?: BrandAssetStatus;
    typography?: BrandAssetStatus;
    tagline?: BrandAssetStatus;
  };
  proposedIdentityTerms?: string[];
  legacyIdentityTerms?: string[];
}

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}

function collectProductionStrings(creative: CampaignCreativeOutput): string[] {
  const conceptStrings = creative.concepts.flatMap((concept) => [
    concept.campaignName,
    concept.coreIdea,
    concept.customerEmotion,
    concept.headlineDirection,
    concept.visualConcept,
    concept.cta,
    concept.targetAudience,
    ...concept.risks,
  ]);

  const brief = creative.creativeBrief;
  const overlay = creative.overlaySpec;

  return [
    ...conceptStrings,
    brief.headline,
    brief.supportingCopy,
    brief.cta,
    brief.visualDirection,
    brief.composition,
    brief.lighting,
    brief.photographyStyle,
    brief.aspectRatio,
    creative.caption,
    creative.imageGeneration.basePrompt,
    creative.imageGeneration.negativePrompt,
    ...creative.imageGeneration.visualConstraints,
    overlay.headline,
    overlay.supportingCopy,
    overlay.price ?? "",
    overlay.cta,
    overlay.logoUsage,
    overlay.placementHints.headline,
    overlay.placementHints.supportingCopy,
    overlay.placementHints.price ?? "",
    overlay.placementHints.cta,
    overlay.placementHints.logo,
  ];
}

export function assertCreativeRespectsBrandGovernance(
  creative: CampaignCreativeOutput,
  governance?: BrandGovernance,
): void {
  if (!governance) return;

  const allowProposed = governance.allowProposedIdentity === true;
  const productionText = normalize(collectProductionStrings(creative).join("\n"));

  if (!allowProposed) {
    for (const term of governance.proposedIdentityTerms ?? []) {
      if (term.trim() && productionText.includes(normalize(term))) {
        throw new Error(
          `Brand governance violation: proposed identity term \"${term}\" appeared in production-facing creative output.`,
        );
      }
    }

    if (
      governance.assetStatus?.logo &&
      governance.assetStatus.logo !== "APPROVED" &&
      creative.overlaySpec.logoUsage !== "OMIT"
    ) {
      throw new Error(
        "Brand governance violation: logo is not approved, so overlaySpec.logoUsage must be OMIT.",
      );
    }
  }
}
