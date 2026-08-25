import assert from "node:assert/strict";
import test from "node:test";

import type { BrandGovernance } from "../src/brandGovernance.js";
import {
  directGeneratedCampaign,
  type GeneratedCampaign,
} from "../src/commands/directCampaign.js";
import {
  generateCampaign,
  type GenerateCampaignRequest,
} from "../src/commands/generateCampaign.js";
import { parseCreativeDirectorReview } from "../src/creativeDirectorValidator.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import type { TruthRecord } from "../src/types.js";

const records: TruthRecord[] = [
  {
    key: "price",
    value: 950,
    status: "SOURCE_VERIFIED",
    sourceId: "UBER_BURGER_WELLAMPITIYA",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
      productId: "CRISPY_CHICKEN_BURGER",
      salesChannel: "UBER_EATS",
    },
  },
  {
    key: "productName",
    value: "Crispy Chicken Burger",
    status: "SOURCE_VERIFIED",
    sourceId: "UBER_BURGER_WELLAMPITIYA",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
      productId: "CRISPY_CHICKEN_BURGER",
      salesChannel: "UBER_EATS",
    },
  },
];

const governance: BrandGovernance = {
  allowProposedIdentity: false,
  assetStatus: {
    logo: "PROPOSED",
    colors: "PROPOSED",
    typography: "PROPOSED",
    tagline: "PROPOSED",
  },
  proposedIdentityTerms: ["Unlock the Flavour"],
};

function creativeObject() {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Tonight's Pick",
        coreIdea: "Put the verified product and ordering path first.",
        customerEmotion: "decisiveness",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Product-led hero composition with clear overlay space.",
        cta: "Order on Uber Eats",
        targetAudience: "Delivery customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Craving Has a Name",
        coreIdea: "Build appetite around the verified product name without extra claims.",
        customerEmotion: "desire",
        headlineDirection: "The craving has a name.",
        visualConcept: "Bold food hero with warm directional light and negative space.",
        cta: "Order on Uber Eats",
        targetAudience: "Social-first burger buyers",
        expectedStrength: 9,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "Product First",
        coreIdea: "Create a restrained repeatable product-first territory.",
        customerEmotion: "confidence",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Minimal product composition with strong hierarchy.",
        cta: "Order on Uber Eats",
        targetAudience: "Urban customers",
        expectedStrength: 7,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "Clear conversion route.",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "On Uber Eats",
      cta: "Order on Uber Eats",
      visualDirection: "Product-led food hero.",
      composition: "Centered subject with negative space.",
      lighting: "Warm directional light.",
      photographyStyle: "Believable commercial food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy Chicken Burger on Uber Eats for LKR 950.",
    imageGeneration: {
      basePrompt: "Generic crispy chicken burger concept image with neutral styling and overlay-safe negative space.",
      negativePrompt: "No text, numbers, logos, badges or watermarks.",
      visualConstraints: ["concept image only", "no exact served-product claim"],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "On Uber Eats",
      price: { amount: 950, currency: "LKR" },
      cta: "Order on Uber Eats",
      logoUsage: "OMIT",
      placementHints: {
        headline: "top-left",
        supportingCopy: "below headline",
        price: "top-right",
        cta: "bottom-right",
        logo: "omit",
      },
    },
    factualQaNotes: ["Uber Eats Wellampitiya scoped facts only."],
  };
}

function request(): GenerateCampaignRequest {
  return {
    campaignId: "DIRECTOR-TEST",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    objective: "Promote Crispy Chicken Burger on Uber Eats",
    channel: "instagram",
    assetType: "poster",
    requirements: [
      { key: "productName", productId: "CRISPY_CHICKEN_BURGER", salesChannel: "UBER_EATS" },
      { key: "price", productId: "CRISPY_CHICKEN_BURGER", salesChannel: "UBER_EATS" },
    ],
    truthRecords: records,
    allowSourceVerified: true,
    brandContext: "ATTHA'S Burger is bold, energetic, food-led and uncomplicated.",
    brandGovernance: governance,
    maxRepairAttempts: 0,
  };
}

function provider(name: string, outputs: unknown[]): CampaignGenerationProvider {
  let index = 0;
  return {
    providerName: name,
    model: `${name}-model`,
    async generate() {
      const output = outputs[Math.min(index, outputs.length - 1)];
      index += 1;
      return typeof output === "string" ? output : JSON.stringify(output);
    },
  };
}

function directorReview() {
  return {
    reviews: [
      {
        conceptId: "C1",
        scores: { strategicFit: 8, brandFit: 8, originality: 6, emotionalStrength: 6, conversionPotential: 9, visualPotential: 8, factualSafety: 10, productionEfficiency: 9 },
        strengths: ["Clear conversion path"], weaknesses: ["Less distinctive"], risks: [],
      },
      {
        conceptId: "C2",
        scores: { strategicFit: 9, brandFit: 9, originality: 8, emotionalStrength: 9, conversionPotential: 9, visualPotential: 9, factualSafety: 10, productionEfficiency: 9 },
        strengths: ["Strong appetite and brand fit"], weaknesses: [], risks: [],
      },
      {
        conceptId: "C3",
        scores: { strategicFit: 7, brandFit: 8, originality: 7, emotionalStrength: 6, conversionPotential: 6, visualPotential: 7, factualSafety: 10, productionEfficiency: 9 },
        strengths: ["Reusable territory"], weaknesses: ["Lower immediate conversion"], risks: [],
      },
    ],
    winnerConceptId: "C2",
    winnerRationale: "C2 has the strongest combined appetite, brand fit and conversion potential.",
    improvementDirectives: ["Keep the product name explicit", "Preserve clean negative space for overlays"],
    escalation: { recommended: false, reasons: [] },
  };
}

async function generatedCampaign(): Promise<GeneratedCampaign> {
  const result = await generateCampaign(request(), provider("generator", [creativeObject()]));
  assert.equal(result.status, "GENERATED");
  if (result.status !== "GENERATED") throw new Error("Expected generated campaign");
  return result;
}

test("Creative Director validator computes totals and requires the highest-scoring winner", () => {
  const parsed = parseCreativeDirectorReview(JSON.stringify(directorReview()));
  assert.equal(parsed.winnerConceptId, "C2");
  assert.equal(parsed.reviews[1]?.totalScore, 72);

  const invalid = directorReview();
  invalid.winnerConceptId = "C1";
  assert.throws(
    () => parseCreativeDirectorReview(JSON.stringify(invalid)),
    /must have the highest deterministic score/,
  );
});

test("Creative Director selects a winner and finalizes the campaign without changing concepts", async () => {
  const campaign = await generatedCampaign();
  const finalCreative = structuredClone(campaign.creative);
  finalCreative.recommendedConceptId = "C2";
  finalCreative.recommendationReason = "Creative Director selected C2 for stronger appetite and brand fit.";
  finalCreative.creativeBrief.headline = "The craving has a name.";
  finalCreative.overlaySpec.headline = "The craving has a name.";

  const directed = await directGeneratedCampaign(
    { request: request(), campaign },
    {
      director: provider("creative-director", [directorReview()]),
      finalizer: provider("finalizer", [finalCreative]),
    },
  );

  assert.equal(directed.creativeDirector.review.winnerConceptId, "C2");
  assert.equal(directed.creative.recommendedConceptId, "C2");
  assert.deepEqual(directed.creative.concepts, campaign.creative.concepts);
  assert.deepEqual(directed.creative.overlaySpec.price, {
    amount: 950,
    currency: "LKR",
    display: "LKR 950",
  });
  assert.equal(directed.creativeDirector.finalization.attempts, 1);
  assert.equal(directed.creativeDirector.finalization.repairs, 0);
});

test("Creative Director repairs a finalizer that tries to mutate the three source concepts", async () => {
  const campaign = await generatedCampaign();
  const bad = structuredClone(campaign.creative);
  bad.recommendedConceptId = "C2";
  bad.concepts[0]!.campaignName = "Mutated concept";

  const good = structuredClone(campaign.creative);
  good.recommendedConceptId = "C2";
  good.recommendationReason = "C2 selected after structured Creative Director review.";

  const directed = await directGeneratedCampaign(
    { request: request(), campaign, maxFinalizerRepairAttempts: 1 },
    {
      director: provider("creative-director", [directorReview()]),
      finalizer: provider("finalizer", [bad, good]),
    },
  );

  assert.equal(directed.creativeDirector.finalization.attempts, 2);
  assert.equal(directed.creativeDirector.finalization.repairs, 1);
  assert.deepEqual(directed.creative.concepts, campaign.creative.concepts);
});
