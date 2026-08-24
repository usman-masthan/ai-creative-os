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
        headlineDirection: "Crispy Chicken Burger",
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
        coreIdea: "Create appetite through believable food texture without unsupported product claims.",
        customerEmotion: "desire",
        headlineDirection: "The craving has a name.",
        visualConcept: "Macro food texture with warm directional light.",
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
        headlineDirection: "Simple product language with no unsupported claims.",
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
      supportingCopy: "Now on Uber Eats.",
      cta: "Order on Uber Eats",
      visualDirection: "Bold close-up food hero with neutral production-safe styling.",
      composition: "Burger centered with clean negative space reserved for deterministic overlays.",
      lighting: "Warm directional light.",
      photographyStyle: "Believable food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy Chicken Burger on Uber Eats for LKR 950.",
    imageGeneration: {
      basePrompt: "High-impact food advertising image of a generic crispy chicken burger as the hero subject, tight appetizing crop, believable texture, warm directional lighting, clean neutral background and generous negative space for later deterministic layout.",
      negativePrompt: "No letters, numbers, logos, badges, watermarks, menus, labels, app screens or promotional typography.",
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
      price: {
        amount: 950,
        currency: "LKR",
      },
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
    factualQaNotes: ["Price is source-verified for Uber Eats Wellampitiya only."],
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
        key: "productName",
        productId: "CRISPY_CHICKEN_BURGER",
        salesChannel: "UBER_EATS",
      },
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
    maxRepairAttempts: 0,
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

test("generates V3 creative with deterministic price format and Instagram format", async () => {
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
  assert.deepEqual(result.creative.overlaySpec.price, {
    amount: 950,
    currency: "LKR",
    display: "LKR 950",
  });
  assert.equal(result.production.format.aspectRatio, "4:5");
  assert.equal(result.production.format.width, 1080);
  assert.equal(result.production.format.height, 1350);
  assert.equal(result.generation.attempts, 1);
  assert.equal(result.generation.repairs, 0);
  assert.equal(result.creative.overlaySpec.logoUsage, "OMIT");
  assert.equal(result.creative.imageGeneration.textPolicy, "NO_TEXT_OR_LOGOS");
  assert.doesNotMatch(result.creative.imageGeneration.basePrompt, /950/);
  assert.match(receivedPrompt, /Required format: 1080x1350 \(4:5\)/);
  assert.match(receivedPrompt, /Product names are not permission to invent related sensory claims/);
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

test("rejects unsupported customer-facing product claims", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.creativeBrief.supportingCopy = "Crispy outside, juicy inside.";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /unsupported product\/service claim or depiction \"juicy\"/,
  );
});

test("rejects unsupported delivery-speed claims", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.creativeBrief.supportingCopy = "Crisp, satisfying, delivered fast.";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /unsupported product\/service claim or depiction \"delivered fast\"/,
  );
});

test("rejects unverified ingredient depictions in the image prompt", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.imageGeneration.basePrompt += " Add lettuce and tomato toppings.";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /unsupported product\/service claim or depiction \"lettuce\"/,
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

test("rejects a mutated numeric price", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.overlaySpec.price.amount = 900;
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /overlaySpec\.price\.amount must preserve verified price 950/,
  );
});

test("rejects non-deterministic customer-facing price formatting", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.caption = "Get the Crispy Chicken Burger on Uber Eats for 950 LKR.";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /customer-facing price 950 must be formatted exactly as LKR 950/,
  );
});

test("rejects model-selected 1:1 for an Instagram poster", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.creativeBrief.aspectRatio = "1:1";
    return creative;
  });

  await assert.rejects(
    () => generateCampaign(readyRequest(), provider),
    /creativeBrief\.aspectRatio must be 4:5/,
  );
});

test("automatically repairs one invalid generation and accepts the corrected response", async () => {
  let calls = 0;
  const prompts: string[] = [];
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-model",
    async generate(prompt) {
      calls += 1;
      prompts.push(prompt);
      const creative = creativeObject();
      if (calls === 1) {
        creative.creativeBrief.supportingCopy = "Crispy outside, juicy inside.";
      }
      return JSON.stringify(creative);
    },
  };

  const request = readyRequest();
  request.maxRepairAttempts = 2;
  const result = await generateCampaign(request, provider);

  assert.equal(result.status, "GENERATED");
  if (result.status !== "GENERATED") return;
  assert.equal(result.generation.attempts, 2);
  assert.equal(result.generation.repairs, 1);
  assert.equal(calls, 2);
  assert.match(prompts[1] ?? "", /REPAIR MODE/);
  assert.match(prompts[1] ?? "", /unsupported product\/service claim or depiction/);
});

test("scores complex phone-and-people production higher than hero-only creative", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.concepts[0]!.visualConcept =
      "A group of friends with hands around a table while one person holds a smartphone app screen.";
    creative.creativeBrief.visualDirection =
      "People around a table with a smartphone and app screen beside multiple burgers.";
    creative.imageGeneration.basePrompt =
      "A group of friends at a table with multiple burgers and a smartphone, no text or logos.";
    return creative;
  });

  const result = await generateCampaign(readyRequest(), provider);
  assert.equal(result.status, "GENERATED");
  if (result.status !== "GENERATED") return;
  assert.equal(result.production.complexity.level, "high");
  assert.ok(result.production.complexity.score >= 6);
});

test("does not count explicitly prohibited app screens as production complexity", async () => {
  const provider = mockProvider(() => {
    const creative = creativeObject();
    creative.imageGeneration.basePrompt += ", no app screens, no phones.";
    creative.imageGeneration.visualConstraints.push("no people or hands");
    return creative;
  });

  const result = await generateCampaign(readyRequest(), provider);
  assert.equal(result.status, "GENERATED");
  if (result.status !== "GENERATED") return;
  assert.equal(result.production.complexity.score, 0);
  assert.deepEqual(result.production.complexity.reasons, []);
});
