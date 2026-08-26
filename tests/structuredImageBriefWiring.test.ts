import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlannedImagePrompt,
  type PlannedImagePromptPlan,
} from "../src/commands/producePlannedCampaign.js";
import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../src/creativeTypes.js";
import { ATTHAS_LAYOUTS } from "../src/layouts/atthas.js";
import type { VisualQaResult } from "../src/visualQa/types.js";

function creative(): CampaignCreativeOutput {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Order Route",
        coreIdea: "Make the product easy to order.",
        customerEmotion: "clarity",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Food hero with protected price and copy space.",
        cta: "Order Now",
        targetAudience: "Burger customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Crave Route",
        coreIdea: "Build appetite through texture and warmth.",
        customerEmotion: "craving",
        headlineDirection: "Crave the crunch",
        visualConcept: "Close food texture moment.",
        cta: "See More",
        targetAudience: "Food lovers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "Burger Ritual",
        coreIdea: "Build a recurring burger-night memory.",
        customerEmotion: "belonging",
        headlineDirection: "Burger night",
        visualConcept: "Premium repeatable food world.",
        cta: "Visit Us",
        targetAudience: "Local diners",
        expectedStrength: 8,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "Strongest conversion route.",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available on Uber Eats",
      cta: "Order on Uber Eats",
      visualDirection: "A believable crispy chicken burger hero with strong appetite appeal.",
      composition: "Large food hero with protected upper-left and upper-right overlay zones.",
      lighting: "Warm directional studio light that reveals texture.",
      photographyStyle: "Premium commercial food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy Chicken Burger on Uber Eats.",
    imageGeneration: {
      basePrompt: "Professional food photograph of a crispy chicken burger on a dark neutral surface.",
      negativePrompt: "text, logos, watermarks, app screens",
      visualConstraints: ["clean background", "believable serving scale"],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available on Uber Eats",
      price: { amount: 1090, currency: "LKR", display: "LKR 1,090" },
      cta: "Order on Uber Eats",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
        price: "upper-right",
        cta: "lower-right",
        logo: "omit",
      },
    },
    factualQaNotes: [],
  };
}

const format: CampaignProductionFormat = {
  channel: "instagram",
  assetType: "poster",
  aspectRatio: "4:5",
  width: 1080,
  height: 1350,
};

const layout = ATTHAS_LAYOUTS.find(
  (item) => item.id === "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
)!;

function plan(useStructuredBrief: boolean, previousQa?: VisualQaResult): PlannedImagePromptPlan {
  return buildPlannedImagePrompt({
    campaignId: "M2-WIRING-001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    creative: creative(),
    format,
    layout,
    useStructuredBrief,
    ...(previousQa ? { previousQa } : {}),
  });
}

test("structured image brief rollout preserves the exact legacy rollback path", () => {
  const result = plan(false);
  assert.equal(result.mode, "legacy");
  assert.equal(result.structuredBrief, undefined);
  assert.match(result.prompt, /^Professional food photograph/);
  assert.match(result.prompt, /Layout composition requirements:/);
  assert.doesNotMatch(result.prompt, /STRUCTURED IMAGE BRIEF v2/);
});

test("structured image brief feature path exposes the roadmap v2 production contract", () => {
  const result = plan(true);
  assert.equal(result.mode, "structured-brief");
  assert.ok(result.structuredBrief);
  assert.equal(result.structuredBrief.version, 2);
  assert.equal(result.structuredBrief.scope.brandId, "ATTHAS_BURGER");
  assert.equal(result.structuredBrief.scope.branchId, "BURGER_WELLAMPITIYA");
  assert.equal(result.structuredBrief.format.width, 1080);
  assert.equal(result.structuredBrief.photography.preset, "QSR_MACRO_HERO");
  assert.ok(result.structuredBrief.composition.quietZones.length > 0);
  assert.equal(result.structuredBrief.constraints.noPrices, true);
  assert.equal(result.structuredBrief.constraints.noPrintedPackaging, true);
  assert.match(result.prompt, /^STRUCTURED IMAGE BRIEF v2/);
  assert.match(result.prompt, /SUBJECT/);
  assert.match(result.prompt, /PHOTOGRAPHY/);
  assert.match(result.prompt, /COMPOSITION/);
  assert.match(result.prompt, /ENVIRONMENT/);
  assert.match(result.prompt, /CONSTRAINTS/);
  assert.doesNotMatch(result.prompt, /LKR 1,090/);
});

test("structured regeneration carries QA issues into a new validated brief", () => {
  const qa: VisualQaResult = {
    provider: "mock-qa",
    model: "mock-qa-model",
    decision: "REGENERATE",
    scores: {
      productTruth: 90,
      brandFit: 90,
      realism: 80,
      foodTexture: 78,
      composition: 60,
      copyZoneSuitability: 58,
      governance: 95,
      rights: 100,
    },
    issues: ["upper-left message zone is visually cluttered"],
    observedIngredients: [],
    unexpectedVisibleElements: [],
    notes: [],
  };

  const result = plan(true, qa);
  assert.equal(result.mode, "structured-brief");
  assert.deepEqual(result.structuredBrief?.correction?.previousQaIssues, qa.issues);
  assert.match(result.prompt, /PREVIOUS VISUAL QA CORRECTIONS REQUIRED:/);
  assert.match(result.prompt, /upper-left message zone is visually cluttered/);
});
