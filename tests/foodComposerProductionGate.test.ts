import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { producePlannedCampaign } from "../src/commands/producePlannedCampaign.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";
import type { ImageDraftProvider } from "../src/imageProviders/types.js";
import type { MarketingCalendarEntry } from "../src/marketingPlannerTypes.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import type { TruthRecord } from "../src/types.js";

function entry(): MarketingCalendarEntry {
  return {
    slotId: "S-FOOD-01",
    date: "2026-09-02",
    brandId: "ATTHAS_BURGER",
    branchScope: "BURGER_WELLAMPITIYA",
    campaignType: "PRODUCT_PUSH",
    objective: "Promote a verified burger product without inventing product facts",
    audience: "Burger customers",
    channel: "instagram",
    assetType: "poster",
    priority: "P1",
    conceptDirection: "Use the verified product identity only.",
    additionalTruthNeeded: [],
    requiredTruth: ["productName", "branchAvailability", "approvedProductVisual"],
    missingTruth: [],
    truthReadiness: "READY_WITH_CURRENT_TRUTH",
  };
}

function records(): TruthRecord[] {
  const scope = {
    tenantId: "T001" as const,
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
  };
  return [
    {
      key: "productName",
      value: "Crispy Chicken Burger",
      status: "VERIFIED",
      sourceId: "OWNER_PRODUCT_MASTER",
      scope,
    },
    {
      key: "branchAvailability",
      value: true,
      status: "VERIFIED",
      sourceId: "OWNER_PRODUCT_MASTER",
      scope,
    },
    {
      key: "approvedProductVisual",
      value: "OWNER_VISUAL_REFERENCE_001",
      status: "VERIFIED",
      sourceId: "OWNER_PRODUCT_MASTER",
      scope,
    },
  ];
}

function creative(): CampaignCreativeOutput {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Choose the Burger",
        coreIdea: "Make the verified burger identity immediately actionable.",
        customerEmotion: "clarity",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Single product-led focal composition.",
        cta: "Order Now",
        targetAudience: "Burger customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Burger Focus",
        coreIdea: "Create anticipation around the named product without adding attributes.",
        customerEmotion: "anticipation",
        headlineDirection: "Your Burger Moment",
        visualConcept: "Close product-centric food moment.",
        cta: "See More",
        targetAudience: "Food-focused customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "ATTHA'S Burger Choice",
        coreIdea: "Build recognition around a repeatable ATTHA'S Burger product choice.",
        customerEmotion: "familiarity",
        headlineDirection: "ATTHA'S Burger",
        visualConcept: "Simple branded product territory without generated branding.",
        cta: "Visit Us",
        targetAudience: "Local diners",
        expectedStrength: 7,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "The conversion route best fits the product-push objective.",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available at ATTHA'S Burger Wellampitiya",
      cta: "Order Now",
      visualDirection: "A single product-led food hero based only on verified product truth.",
      composition: "Dominant food subject with protected overlay space.",
      lighting: "Controlled commercial food lighting.",
      photographyStyle: "Believable commercial food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy Chicken Burger at ATTHA'S Burger Wellampitiya.",
    imageGeneration: {
      basePrompt: "Commercial food photograph of the verified product identity with no added product facts.",
      negativePrompt: "text, logos, prices, labels, watermarks",
      visualConstraints: ["single food hero", "clean overlay-safe negative space"],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available at ATTHA'S Burger Wellampitiya",
      cta: "Order Now",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
        cta: "lower-right",
        logo: "omit",
      },
    },
    factualQaNotes: ["Product name and branch availability come from verified truth."],
  };
}

function generationProvider(): CampaignGenerationProvider {
  return {
    providerName: "mock-generation",
    model: "mock-generation-model",
    async generate() {
      return JSON.stringify(creative());
    },
  };
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "food-composer-gate-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("missing verified ingredients blocks before director, finalizer and image-provider spend", async () => {
  await withTempDir(async (outputDir) => {
    let directorCalls = 0;
    let finalizerCalls = 0;
    let imageCalls = 0;

    const neverDirector: CampaignGenerationProvider = {
      providerName: "never-director",
      model: "never-director-model",
      async generate() {
        directorCalls += 1;
        throw new Error("Director must not run after food-composer truth block.");
      },
    };
    const neverFinalizer: CampaignGenerationProvider = {
      providerName: "never-finalizer",
      model: "never-finalizer-model",
      async generate() {
        finalizerCalls += 1;
        throw new Error("Finalizer must not run after food-composer truth block.");
      },
    };
    const neverImage: ImageDraftProvider = {
      providerName: "never-image",
      model: "never-image-model",
      async generate() {
        imageCalls += 1;
        throw new Error("Image provider must not run without verified ingredients.");
      },
    };

    const result = await producePlannedCampaign({
      campaignId: "M2-FOOD-GATE-001",
      entry: entry(),
      truthRecords: records(),
      brandContext: "ATTHA'S Burger product truth is strictly governed.",
      outputDir,
      mode: "DRAFT",
      providers: {
        generation: generationProvider(),
        director: neverDirector,
        finalizer: neverFinalizer,
        image: neverImage,
      },
      featureFlags: {
        useStructuredBrief: true,
        useFoodComposer: true,
      },
    });

    assert.equal(result.status, "BLOCKED_FOOD_COMPOSER_TRUTH");
    if (result.status !== "BLOCKED_FOOD_COMPOSER_TRUTH") return;
    assert.equal(result.productName, "Crispy Chicken Burger");
    assert.deepEqual(result.missingTruth, ["ingredients"]);
    assert.equal(result.imageAttempts.length, 0);
    assert.equal(directorCalls, 0);
    assert.equal(finalizerCalls, 0);
    assert.equal(imageCalls, 0);
  });
});

test("food composer cannot be enabled without the structured brief path", async () => {
  await withTempDir(async (outputDir) => {
    await assert.rejects(
      () =>
        producePlannedCampaign({
          campaignId: "M2-FOOD-FLAG-001",
          entry: entry(),
          truthRecords: records(),
          brandContext: "ATTHA'S Burger",
          outputDir,
          mode: "DRAFT",
          providers: {
            generation: generationProvider(),
            director: generationProvider(),
            finalizer: generationProvider(),
          },
          featureFlags: {
            useStructuredBrief: false,
            useFoodComposer: true,
          },
        }),
      /useFoodComposer requires useStructuredBrief/,
    );
  });
});
