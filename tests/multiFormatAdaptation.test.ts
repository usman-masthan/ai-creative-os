import assert from "node:assert/strict";
import test from "node:test";

import { adaptDirectedCampaign } from "../src/commands/adaptCampaign.js";
import type { DirectedCampaign } from "../src/commands/directCampaign.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";

function sourceCampaign(): DirectedCampaign {
  const creative = {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion" as const,
        campaignName: "Tonight's Pick",
        coreIdea: "Put the verified product and ordering route first.",
        customerEmotion: "decisiveness",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Product hero with clean overlay space.",
        cta: "Order on Uber Eats",
        targetAudience: "Delivery customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion" as const,
        campaignName: "Craving Has a Name",
        coreIdea: "Build appetite around the verified product name.",
        customerEmotion: "desire",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Bold food hero with negative space.",
        cta: "Order on Uber Eats",
        targetAudience: "Urban burger buyers",
        expectedStrength: 9,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building" as const,
        campaignName: "Product First",
        coreIdea: "Create a repeatable product-first territory.",
        customerEmotion: "confidence",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Minimal product composition.",
        cta: "Order on Uber Eats",
        targetAudience: "Brand audience",
        expectedStrength: 7,
        risks: [],
      },
    ],
    recommendedConceptId: "C2",
    recommendationReason: "Selected for stronger appetite and conversion potential.",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "On Uber Eats",
      cta: "Order on Uber Eats",
      visualDirection: "Single product hero with realistic commercial food styling.",
      composition: "Hero lower-centre with clean upper copy space.",
      lighting: "Warm directional light.",
      photographyStyle: "Believable commercial food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy Chicken Burger on Uber Eats for LKR 1,090.",
    imageGeneration: {
      basePrompt: "Generic crispy chicken burger concept image with neutral styling and overlay-safe negative space.",
      negativePrompt: "No text, numbers, logos, badges or watermarks.",
      visualConstraints: ["concept image only", "no exact served-product claim"],
      textPolicy: "NO_TEXT_OR_LOGOS" as const,
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "On Uber Eats",
      price: { amount: 1090, currency: "LKR" as const, display: "LKR 1,090" },
      cta: "Order on Uber Eats",
      logoUsage: "OMIT" as const,
      placementHints: {
        headline: "top-left",
        supportingCopy: "below headline",
        price: "top-right",
        cta: "bottom-right",
        logo: "omit",
      },
    },
    factualQaNotes: ["Uber Eats scoped facts only."],
  };

  return {
    status: "GENERATED",
    preflight: {
      status: "READY_FOR_CREATIVE",
      factGate: "PASS",
      missing: [],
      conflicts: [],
      facts: [
        {
          key: "productName|CRISPY_CHICKEN_BURGER|UBER_EATS",
          value: "Crispy Chicken Burger",
          verified: true,
          status: "SOURCE_VERIFIED",
          source: "UBER_BURGER_WELLAMPITIYA",
        },
        {
          key: "price|CRISPY_CHICKEN_BURGER|UBER_EATS",
          value: 1090,
          verified: true,
          status: "SOURCE_VERIFIED",
          source: "UBER_BURGER_WELLAMPITIYA",
        },
      ],
      riskLevel: "low",
      humanApprovalRequired: false,
    },
    provider: { name: "gemini", model: "generator-model" },
    generation: { attempts: 1, repairs: 0 },
    production: {
      format: {
        channel: "instagram",
        assetType: "poster",
        aspectRatio: "4:5",
        width: 1080,
        height: 1350,
      },
      complexity: { score: 0, level: "low", reasons: [] },
    },
    creative,
    creativeDirector: {
      director: { provider: "gemini", model: "director-model" },
      finalizer: { provider: "gemini", model: "finalizer-model" },
      review: {
        reviews: [
          {
            conceptId: "C1",
            scores: { strategicFit: 8, brandFit: 8, originality: 6, emotionalStrength: 6, conversionPotential: 9, visualPotential: 8, factualSafety: 10, productionEfficiency: 9 },
            totalScore: 64,
            strengths: [], weaknesses: [], risks: [],
          },
          {
            conceptId: "C2",
            scores: { strategicFit: 9, brandFit: 9, originality: 8, emotionalStrength: 9, conversionPotential: 9, visualPotential: 9, factualSafety: 10, productionEfficiency: 9 },
            totalScore: 72,
            strengths: [], weaknesses: [], risks: [],
          },
          {
            conceptId: "C3",
            scores: { strategicFit: 7, brandFit: 8, originality: 7, emotionalStrength: 6, conversionPotential: 6, visualPotential: 7, factualSafety: 10, productionEfficiency: 9 },
            totalScore: 60,
            strengths: [], weaknesses: [], risks: [],
          },
        ],
        winnerConceptId: "C2",
        winnerRationale: "C2 wins.",
        improvementDirectives: [],
        escalation: { recommended: false, reasons: [] },
      },
      finalization: { attempts: 1, repairs: 0 },
    },
  };
}

function variant(targetId: string, overrides: Record<string, unknown> = {}) {
  return {
    targetId,
    headline: "Crispy Chicken Burger",
    supportingCopy: "On Uber Eats",
    cta: "Order on Uber Eats",
    caption: "Crispy Chicken Burger on Uber Eats for LKR 1,090.",
    composition: "Keep the product hero central with clean message and action zones.",
    placementHints: {
      headline: "upper-left",
      supportingCopy: "below headline",
      price: "upper-right",
      cta: "lower-right",
      logo: "omit",
    },
    ...overrides,
  };
}

const targetIds = [
  "INSTAGRAM_FEED_4X5",
  "INSTAGRAM_STORY_9X16",
  "INSTAGRAM_REEL_COVER_9X16",
  "FACEBOOK_FEED_4X5",
  "WHATSAPP_STATUS_9X16",
];

function output(overrides?: { targetId?: string; variant?: Record<string, unknown> }) {
  return {
    variants: targetIds.map((id) =>
      variant(id, id === overrides?.targetId ? overrides.variant : {}),
    ),
    adaptationNotes: ["Keep one approved concept across all formats."],
  };
}

function provider(outputs: unknown[]): CampaignGenerationProvider {
  let index = 0;
  return {
    providerName: "gemini",
    model: "adaptation-model",
    async generate() {
      const value = outputs[Math.min(index, outputs.length - 1)];
      index += 1;
      return typeof value === "string" ? value : JSON.stringify(value);
    },
  };
}

test("one directed campaign adapts into five governed ATTHAS formats", async () => {
  const campaign = sourceCampaign();
  const result = await adaptDirectedCampaign({
    campaignId: "ATTHAS-CAMPAIGN-001",
    brandId: "ATTHAS_BURGER",
    campaign,
    provider: provider([output()]),
    truthVersion: "truth-2026-08-25",
    brandVersion: "brand-v0.1",
    maxRepairAttempts: 0,
  });

  assert.equal(result.variants.length, 5);
  assert.equal(result.sourceConceptId, "C2");
  assert.equal(result.truthVersion, "truth-2026-08-25");
  assert.equal(result.brandVersion, "brand-v0.1");
  for (const adapted of result.variants) {
    assert.deepEqual(adapted.creative.concepts, campaign.creative.concepts);
    assert.equal(adapted.creative.recommendedConceptId, "C2");
    assert.deepEqual(adapted.creative.overlaySpec.price, campaign.creative.overlaySpec.price);
  }
  assert.equal(
    result.variants.find((item) => item.target.id === "INSTAGRAM_STORY_9X16")?.layout.id,
    "ATTHAS_BURGER_STORY_VERTICAL_V1",
  );
  assert.equal(
    result.variants.find((item) => item.target.id === "INSTAGRAM_FEED_4X5")?.target.format.aspectRatio,
    "4:5",
  );
});

test("adaptation can target a safe subset without generating unrequested variants", async () => {
  const subset = ["INSTAGRAM_FEED_4X5", "WHATSAPP_STATUS_9X16"] as const;
  const partialOutput = {
    variants: subset.map((id) => variant(id)),
    adaptationNotes: [],
  };
  const result = await adaptDirectedCampaign({
    campaignId: "ATTHAS-CAMPAIGN-002",
    brandId: "ATTHAS_BURGER",
    campaign: sourceCampaign(),
    provider: provider([partialOutput]),
    truthVersion: "truth-v1",
    brandVersion: "brand-v1",
    targetIds: [...subset],
    maxRepairAttempts: 0,
  });
  assert.deepEqual(result.variants.map((item) => item.target.id), [...subset]);
});

test("adaptation rejects unverified numeric claims", async () => {
  await assert.rejects(
    adaptDirectedCampaign({
      campaignId: "ATTHAS-CAMPAIGN-003",
      brandId: "ATTHAS_BURGER",
      campaign: sourceCampaign(),
      provider: provider([output({ targetId: "INSTAGRAM_FEED_4X5", variant: { supportingCopy: "Save 20%" } })]),
      truthVersion: "truth-v1",
      brandVersion: "brand-v1",
      maxRepairAttempts: 0,
    }),
    /unverified numeric claim 20/,
  );
});

test("adaptation rejects mutated formatting of verified price", async () => {
  await assert.rejects(
    adaptDirectedCampaign({
      campaignId: "ATTHAS-CAMPAIGN-004",
      brandId: "ATTHAS_BURGER",
      campaign: sourceCampaign(),
      provider: provider([output({ targetId: "FACEBOOK_FEED_4X5", variant: { caption: "Crispy Chicken Burger for 1090 on Uber Eats." } })]),
      truthVersion: "truth-v1",
      brandVersion: "brand-v1",
      maxRepairAttempts: 0,
    }),
    /format verified price exactly as LKR 1,090/,
  );
});

test("adaptation repairs an invalid first response without changing campaign truth", async () => {
  const bad = output({ targetId: "WHATSAPP_STATUS_9X16", variant: { supportingCopy: "Save 20%" } });
  const good = output();
  const result = await adaptDirectedCampaign({
    campaignId: "ATTHAS-CAMPAIGN-005",
    brandId: "ATTHAS_BURGER",
    campaign: sourceCampaign(),
    provider: provider([bad, good]),
    truthVersion: "truth-v1",
    brandVersion: "brand-v1",
    maxRepairAttempts: 1,
  });
  assert.equal(result.trace.attempts, 2);
  assert.equal(result.trace.repairs, 1);
  assert.equal(result.variants[4]?.creative.overlaySpec.price?.amount, 1090);
});

test("adaptation keeps existing claim governance active", async () => {
  await assert.rejects(
    adaptDirectedCampaign({
      campaignId: "ATTHAS-CAMPAIGN-006",
      brandId: "ATTHAS_BURGER",
      campaign: sourceCampaign(),
      provider: provider([output({ targetId: "INSTAGRAM_STORY_9X16", variant: { supportingCopy: "Available today" } })]),
      truthVersion: "truth-v1",
      brandVersion: "brand-v1",
      maxRepairAttempts: 0,
    }),
    /Claim governance violation/,
  );
});
