import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignCreativeOutput, CampaignProductionFormat } from "../src/creativeTypes.js";
import { selectAtthasLayout } from "../src/layouts/atthas.js";

function creative(role: "conversion" | "brand-building" = "conversion"): CampaignCreativeOutput {
  return {
    concepts: [{
      id: "C1",
      strategicRole: role,
      campaignName: "Food focus",
      coreIdea: "Show the product clearly.",
      customerEmotion: "interest",
      headlineDirection: "Chicken Tikka Wrap",
      visualConcept: "Single food hero.",
      cta: "Visit Us",
      targetAudience: "Diners",
      expectedStrength: 8,
      risks: [],
    }],
    recommendedConceptId: "C1",
    recommendationReason: "Fits the campaign.",
    creativeBrief: {
      headline: "Chicken Tikka Wrap",
      supportingCopy: "A focused food moment.",
      cta: "Visit Us",
      visualDirection: "Single product-led food hero.",
      composition: "Food hero with negative space.",
      lighting: "Controlled food lighting.",
      photographyStyle: "Photoreal food photography.",
      aspectRatio: "4:5",
    },
    caption: "Chicken Tikka Wrap.",
    imageGeneration: {
      basePrompt: "Photoreal food image.",
      negativePrompt: "text, logos",
      visualConstraints: ["single food hero"],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Chicken Tikka Wrap",
      supportingCopy: "A focused food moment.",
      cta: "Visit Us",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
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

test("restaurant PRODUCT_PUSH deterministically selects Food Hero", () => {
  const layout = selectAtthasLayout({
    brandId: "ATTHAS_RESTAURANT",
    campaignType: "PRODUCT_PUSH",
    creative: creative(),
    format,
  });
  assert.equal(layout.id, "ATTHAS_RESTAURANT_FOOD_HERO_V1");
});

test("restaurant DINE_IN remains Hospitality when no stronger layout signal exists", () => {
  const layout = selectAtthasLayout({
    brandId: "ATTHAS_RESTAURANT",
    campaignType: "DINE_IN",
    creative: creative(),
    format,
  });
  assert.equal(layout.id, "ATTHAS_RESTAURANT_HOSPITALITY_V1");
});

test("shared-table language still overrides PRODUCT_PUSH to Multi Dish", () => {
  const value = creative();
  value.creativeBrief.visualDirection = "A shared table spread with multiple dishes.";
  const layout = selectAtthasLayout({
    brandId: "ATTHAS_RESTAURANT",
    campaignType: "PRODUCT_PUSH",
    creative: value,
    format,
  });
  assert.equal(layout.id, "ATTHAS_RESTAURANT_MULTI_DISH_V1");
});
