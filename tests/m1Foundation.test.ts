import assert from "node:assert/strict";
import test from "node:test";

import { ATTHAS_TOKENS, atthasBrandIdentifier, atthasCssVariables } from "../src/atthasTokens.js";
import { assertConceptDifferentiation } from "../src/conceptDifferentiation.js";
import {
  DEFAULT_CREATIVE_FEATURE_FLAGS,
  resolveCreativeFeatureFlags,
} from "../src/featureFlags.js";
import { confirmTaskTruth, type TaskTruthQuestionnaire } from "../src/taskTruth.js";
import { classifyTaskTruthValue } from "../src/taskTruthValidation.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";

function creativeWithCoreIdeas(c1: string, c2: string, c3: string): CampaignCreativeOutput {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Act Now",
        coreIdea: c1,
        customerEmotion: "urgency",
        headlineDirection: c1,
        visualConcept: c1,
        cta: "Order Now",
        targetAudience: "customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Crave It",
        coreIdea: c2,
        customerEmotion: "desire",
        headlineDirection: c2,
        visualConcept: c2,
        cta: "Try It",
        targetAudience: "customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "Memory Territory",
        coreIdea: c3,
        customerEmotion: "belonging",
        headlineDirection: c3,
        visualConcept: c3,
        cta: "Discover ATTHA'S",
        targetAudience: "customers",
        expectedStrength: 8,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "test",
    creativeBrief: {
      headline: "test",
      supportingCopy: "test",
      cta: "test",
      visualDirection: "test",
      composition: "test",
      lighting: "test",
      photographyStyle: "test",
      aspectRatio: "4:5",
    },
    caption: "test",
    imageGeneration: {
      basePrompt: "test image",
      negativePrompt: "text logos",
      visualConstraints: [],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "test",
      supportingCopy: "test",
      cta: "test",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper left",
        supportingCopy: "upper left",
        cta: "lower right",
        logo: "omit",
      },
    },
    factualQaNotes: [],
  };
}

test("ATTHA'S tokens expose the approved palette and deterministic identifiers", () => {
  assert.equal(ATTHAS_TOKENS.colours.primaryRed, "#B50008");
  assert.equal(ATTHAS_TOKENS.colours.primaryYellow, "#FFD21A");
  assert.equal(ATTHAS_TOKENS.typography.burgerDisplay, "Oswald");
  assert.equal(ATTHAS_TOKENS.typography.restaurantDisplay, "Libre Baskerville");
  assert.equal(atthasBrandIdentifier("ATTHAS_BURGER"), "ATTHA'S BURGER");
  assert.match(atthasCssVariables(), /--atthas-red-deep: #B50008;/);
});

test("creative feature flags default to legacy paths and can be enabled explicitly", () => {
  assert.deepEqual(DEFAULT_CREATIVE_FEATURE_FLAGS, {
    useStructuredBrief: false,
    useFoodComposer: false,
    useNewRenderer: false,
  });
  assert.deepEqual(
    resolveCreativeFeatureFlags({
      AI_CREATIVE_USE_STRUCTURED_BRIEF: "true",
      AI_CREATIVE_USE_FOOD_COMPOSER: "1",
      AI_CREATIVE_USE_NEW_RENDERER: "off",
    }),
    {
      useStructuredBrief: true,
      useFoodComposer: true,
      useNewRenderer: false,
    },
  );
});

test("task truth semantic guard separates facts from instructions", () => {
  assert.equal(classifyTaskTruthValue("LKR 1,290").classification, "FACT");
  assert.equal(classifyTaskTruthValue("Please provide the current price").classification, "INSTRUCTION");
  assert.equal(classifyTaskTruthValue("TBD").classification, "INSTRUCTION");
});

test("instructional task answers cannot be frozen into an immutable snapshot", () => {
  const questionnaire: TaskTruthQuestionnaire = {
    schemaVersion: 1,
    sessionId: "M1-SESSION",
    campaignId: "M1-CAMPAIGN",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    createdAt: "2026-08-26T00:00:00.000Z",
    questions: [
      {
        label: "price",
        requirement: { key: "price" },
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER" },
        kind: "PROVIDE_MISSING",
        prompt: "Please provide the current price.",
      },
    ],
  };

  assert.throws(
    () =>
      confirmTaskTruth({
        questionnaire,
        confirmedBy: "owner",
        answers: [{ label: "price", action: "PROVIDE", value: "Please provide price" }],
      }),
    /instruction rather than a confirmed fact/,
  );
});

test("concept differentiation rejects CTA variants of the same central idea", () => {
  const creative = creativeWithCoreIdeas(
    "Chicken tikka wrap hero encouraging an immediate order",
    "Chicken tikka wrap hero encouraging an immediate order",
    "Make ATTHA'S the familiar flavour ritual people remember",
  );
  assert.throws(() => assertConceptDifferentiation(creative), /FAIL_CONCEPT_DIFFERENTIATION/);
});

test("concept differentiation accepts genuinely separate strategic territories", () => {
  const creative = creativeWithCoreIdeas(
    "Make ordering frictionless with a direct product action",
    "Build appetite through a close product craving moment",
    "Create a recurring ATTHA'S ritual associated with belonging",
  );
  assert.doesNotThrow(() => assertConceptDifferentiation(creative));
});
