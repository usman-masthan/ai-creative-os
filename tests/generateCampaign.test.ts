import assert from "node:assert/strict";
import test from "node:test";

import type { BrandGovernance } from "../src/brandGovernance.js";
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

const governance: BrandGovernance = {
  allowProposedIdentity: false,
  assetStatus: {
    logo: "PROPOSED",
    colors: "PROPOSED",
    typography: "PROPOSED",
    tagline: "PROPOSED",
  },
  proposedIdentityTerms: ["Unlock the Flavour", "Deep Red", "Flame Gold"],
};

function creativeObject() {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Crunch Tonight",
        coreIdea: "Make the product and ordering action immediately clear.",
        customerEmotion: "craving",
        headlineDirection: "Crispy chicken, ready when the craving hits.",
        visualConcept: "Tight hero crop of a crispy chicken burger with clean negative space.",
        cta: "Order on Uber Eats",
        targetAudience: "Evening burger buyers",
        expectedStrength: 9,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Hear the Crunch",
        coreIdea: "Sell appetite through believable crispy texture and warmth.",
        customerEmotion: "desire",
        headlineDirection: "Built around the sensory anticipation of the first bite.",
        visualConcept: "Macro food texture with warm directional light and visible crunch.",
        cta: "Order on Uber Eats",
        targetAudience: "Social-first food lovers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "Craving Made Simple",
        coreIdea: "Create a repeatable product-first visual territory without relying on unapproved identity assets.",
        customerEmotion: "confidence",
        headlineDirection: "Simple, memorable product language with no unsupported claims.",
        visualConcept: "Minimal food-led composition with strong hierarchy and restrained accents.",
        cta: "Order on Uber Eats",
        targetAudience: "Urban delivery customers",
        expectedStrength: 7,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "Strongest balance of appetite, clarity and immediate conversion intent.",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available on Uber Eats in Wellampitiya.",
      cta: "Order on Uber Eats",
      visualDirection: "Bold close-up food hero with neutral production-safe styling.",
      composition: "Burger centered with clean negative space reserved for deterministic overlays.",
      lighting: "Warm directional light.",
      photographyStyle: "Believable premium food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy, satisfying and ready when the craving hits. Order the Crispy Chicken Burger on Uber Eats.",
    imageGeneration: {
      basePrompt: "High-impact 4:5 food advertising image of a generic crispy chicken burger as the hero subject, tight appetizing crop, believable crunchy texture, warm directional lighting, clean neutral background and generous negative space for later deterministic layout.",
      negativePrompt: "No letters, numbers, logos, badges, watermarks, menus, labels or promotional typography.",
      visualConstraints: [
        "generic crispy chicken burger only",
        "do not claim exact served-product appearance",
        "clean negative space for deterministic overlays",
      ],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Now on Uber Eats",
      price: "LKR 950",
      cta: "Order on Uber Eats",
      logoUsage: "OMIT",
      placementHints: {
        headline: "top-left",
        supportingCopy: "below headline",
        price: "top-right",
        cta: "bottom-right",
        logo: "omit until an approved logo exists",
      },
    },
    factualQaNotes: ["LKR 950 is source-verified for Uber Eats Wellampitiya only."],
  };
}

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
    brandContext:
      "ATTHA'S Burger is bold, craveable and food-led. Unlock the Flavour is proposed only. Deep Red and Flame Gold are proposed only.",
    brandGovernance: governance,
  };
}

function mockProvider(outputFactory: () => unknown): CampaignGenerationProvider {
  return {
    providerName: "mock",
    model: "mock-model",
    async generate() {
      return JSON.stringify(outputFactory());
    },
  };
}

test("does not call AI provider when fact preflight fails", async () => {
  let called = false;
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-model",
    async generate() {
      called = true;
      return JSON.stringify(creativeObject());
    },
  };

  const request = readyRequest();
  request.allowSourceVerified = false;

  const result = await generateCampaign(request, provider);

  assert.equal(result.status, "BLOCKED_MISSING_VERIFIED_DATA");
  assert.equal(called, false);
});

test("generates V2 creative only after fact-safe preflight passes", async () => {
  let receivedPrompt = "";
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-model",
    async generate(prompt) {
      receivedPrompt = prompt;
      return JSON.stringify(creativeObject());
    },
  };

  const result = await generateCampaign(readyRequest(), provider);

  assert.equal(result.status, "GENERATED");
  if (result.status !== "GENERATED") return;

  assert.deepEqual(
    result.creative.concepts.map((concept) => concept.strategicRole),
    ["conversion", "crave-emotion", "brand-building"],
  );
  assert.equal(result.creative.overlaySpec.price, "LKR 950");
  assert.equal(result.creative.overlaySpec.logoUsage, "OMIT");
  assert.equal(result.creative.imageGeneration.textPolicy, "NO_TEXT_OR_LOGOS");
  assert.doesNotMatch(result.creative.imageGeneration.basePrompt, /950/);
  assert.match(receivedPrompt, /Use ONLY the verified facts supplied below/);
  assert.match(receivedPrompt, /C1 = conversion/);
  assert.match(receivedPrompt, /DO NOT USE these proposed identity terms/);
});

test("rejects malformed provider output instead of accepting unsafe structure", async () => {
  const provider = mockProvider(() => ({ concepts: [] }));

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /exactly 3 concepts are required/,
  );
});

test("rejects proposed tagline leakage when proposed identity is not approved", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.creativeBrief.headline = "Unlock the Flavour";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /proposed identity term \"Unlock the Flavour\"/,
  );
});

test("rejects unapproved logo usage", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.overlaySpec.logoUsage = "APPROVED_ONLY";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /logo is not approved/,
  );
});

test("rejects verified price leaking into the base image prompt", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.imageGeneration.basePrompt += " Include a 950 price badge.";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /verified price 950 appeared inside imageGeneration\.basePrompt/,
  );
});

test("rejects a mutated price in deterministic overlay output", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.overlaySpec.price = "LKR 900";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /overlaySpec\.price must preserve verified price 950/,
  );
});

test("rejects concept-role drift", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.concepts[1]!.strategicRole = "conversion";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /concepts\[1\]\.strategicRole must be crave-emotion/,
  );
});
