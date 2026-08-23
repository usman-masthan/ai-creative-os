import assert from "node:assert/strict";
import test from "node:test";

import { generateCampaign } from "../src/commands/generateCampaign.js";
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
];

const validCreativeJson = JSON.stringify({
  concepts: [
    {
      id: "C1",
      campaignName: "Crunch After Dark",
      coreIdea: "Own the evening craving moment.",
      customerEmotion: "craving",
      headlineDirection: "Make tonight crunch.",
      visualConcept: "Tight hero crop of a crispy chicken burger.",
      cta: "Order on Uber Eats",
      targetAudience: "Evening burger buyers",
      expectedStrength: 9,
      risks: [],
    },
    {
      id: "C2",
      campaignName: "The 950 Crave",
      coreIdea: "Price-led product focus for the specified platform.",
      customerEmotion: "value",
      headlineDirection: "Your crispy fix at LKR 950 on Uber Eats.",
      visualConcept: "Product-forward frame with deterministic price overlay.",
      cta: "Order on Uber Eats",
      targetAudience: "Price-aware burger buyers",
      expectedStrength: 8,
      risks: ["Price is platform-specific and must not be reused elsewhere."],
    },
    {
      id: "C3",
      campaignName: "Crispy Close-Up",
      coreIdea: "Sell texture and appetite through visual detail.",
      customerEmotion: "desire",
      headlineDirection: "Hear the crunch before the first bite.",
      visualConcept: "Macro texture-led food composition.",
      cta: "Order now",
      targetAudience: "Social-first food lovers",
      expectedStrength: 7,
      risks: [],
    },
  ],
  recommendedConceptId: "C1",
  recommendationReason: "Strongest balance of appetite and brand energy.",
  creativeBrief: {
    headline: "Make Tonight Crunch",
    supportingCopy: "Crispy Chicken Burger available on Uber Eats.",
    cta: "Order on Uber Eats",
    visualDirection: "Bold close-up food hero.",
    composition: "Burger centered with clear overlay space.",
    lighting: "Warm directional light.",
    photographyStyle: "Believable premium food photography.",
    aspectRatio: "4:5",
  },
  caption: "Tonight calls for crunch. Order the Crispy Chicken Burger on Uber Eats.",
  imagePrompt: {
    immutable: ["Crispy Chicken Burger identity", "No embedded price text"],
    flexible: ["warm lighting", "tight crop", "dark restaurant background"],
    prompt: "Premium close-up burger hero with warm directional lighting and clean overlay space.",
  },
  factualQaNotes: ["LKR 950 is source-verified for Uber Eats Wellampitiya only."],
});

function readyRequest() {
  return {
    campaignId: "T001-AI-001",
    tenantId: "T001" as const,
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    objective: "Promote Crispy Chicken Burger on Uber Eats",
    channel: "instagram",
    assetType: "poster",
    requirements: [
      {
        key: "price",
        productId: "CRISPY_CHICKEN_BURGER",
        salesChannel: "UBER_EATS",
      },
    ],
    truthRecords: records,
    allowSourceVerified: true,
    brandContext: "ATTHA'S Burger is bold, craveable and food-led.",
  };
}

test("does not call AI provider when fact preflight fails", async () => {
  let called = false;
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-model",
    async generate() {
      called = true;
      return validCreativeJson;
    },
  };

  const request = readyRequest();
  request.allowSourceVerified = false;

  const result = await generateCampaign(request, provider);

  assert.equal(result.status, "BLOCKED_MISSING_VERIFIED_DATA");
  assert.equal(called, false);
});

test("generates creative only after fact-safe preflight passes", async () => {
  let receivedPrompt = "";
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-model",
    async generate(prompt) {
      receivedPrompt = prompt;
      return validCreativeJson;
    },
  };

  const result = await generateCampaign(readyRequest(), provider);

  assert.equal(result.status, "GENERATED");
  if (result.status !== "GENERATED") return;

  assert.equal(result.creative.concepts.length, 3);
  assert.equal(result.creative.recommendedConceptId, "C1");
  assert.match(receivedPrompt, /price\|product=CRISPY_CHICKEN_BURGER\|salesChannel=UBER_EATS/);
  assert.match(receivedPrompt, /950/);
  assert.match(receivedPrompt, /Use ONLY the verified facts supplied below/);
});

test("rejects malformed provider output instead of accepting unsafe structure", async () => {
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-model",
    async generate() {
      return JSON.stringify({ concepts: [] });
    },
  };

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /exactly 3 concepts are required/,
  );
});
