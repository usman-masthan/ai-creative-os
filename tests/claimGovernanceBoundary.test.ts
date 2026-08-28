import assert from "node:assert/strict";
import test from "node:test";

import { assertCreativeRespectsClaimGovernance } from "../src/claimGovernance.js";
import type { CampaignPreflight } from "../src/commands/createCampaign.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";

function creative(): CampaignCreativeOutput {
  return {
    concepts: [{
      id: "C1",
      strategicRole: "brand-building",
      campaignName: "Internal strategy",
      coreIdea: "Build a signature hospitality ritual internally.",
      customerEmotion: "belonging",
      headlineDirection: "Distinctive brand idea",
      visualConcept: "signature stack silhouette for concept exploration",
      cta: "Discover",
      targetAudience: "local diners",
      expectedStrength: 8,
      risks: [],
    }],
    recommendedConceptId: "C1",
    recommendationReason: "test",
    creativeBrief: {
      headline: "Made for your kind of burger night",
      supportingCopy: "ATTHA'S Burger",
      cta: "Discover ATTHA'S",
      visualDirection: "Abstract brand atmosphere with no specific menu item claim.",
      composition: "One focal subject with negative space.",
      lighting: "Controlled editorial light.",
      photographyStyle: "Photoreal brand atmosphere.",
      aspectRatio: "4:5",
    },
    caption: "ATTHA'S Burger.",
    imageGeneration: {
      basePrompt: "Photoreal brand atmosphere with no specific menu item identity.",
      negativePrompt: "text, logos, labels",
      visualConstraints: [],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Made for your kind of burger night",
      supportingCopy: "ATTHA'S Burger",
      cta: "Discover ATTHA'S",
      logoUsage: "OMIT",
      placementHints: { headline: "upper-left", supportingCopy: "below", cta: "with copy", logo: "omit" },
    },
    factualQaNotes: [],
  };
}

const preflight = { facts: [] } as unknown as CampaignPreflight;

test("internal concept strategy vocabulary does not create a publishable claim violation", () => {
  assert.doesNotThrow(() => assertCreativeRespectsClaimGovernance(creative(), preflight));
});

test("the same unsupported claim still blocks when it reaches production-facing copy", () => {
  const value = creative();
  value.overlaySpec.supportingCopy = "Our signature burger experience";
  assert.throws(
    () => assertCreativeRespectsClaimGovernance(value, preflight),
    /unsupported product\/service claim or depiction "signature"/,
  );
});

test("unsupported claim vocabulary still blocks when it reaches the image prompt", () => {
  const value = creative();
  value.imageGeneration.basePrompt = "Photograph the signature burger hero.";
  assert.throws(
    () => assertCreativeRespectsClaimGovernance(value, preflight),
    /unsupported product\/service claim or depiction "signature"/,
  );
});
