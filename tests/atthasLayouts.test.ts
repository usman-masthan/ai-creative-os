import assert from "node:assert/strict";
import test from "node:test";

import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../src/creativeTypes.js";
import {
  ATTHAS_LAYOUTS,
  selectAtthasLayout,
} from "../src/layouts/atthas.js";

const squareish: CampaignProductionFormat = {
  channel: "instagram",
  assetType: "poster",
  aspectRatio: "4:5",
  width: 1080,
  height: 1350,
};

const story: CampaignProductionFormat = {
  channel: "instagram",
  assetType: "story",
  aspectRatio: "9:16",
  width: 1080,
  height: 1920,
};

function creative(overrides: Partial<CampaignCreativeOutput> = {}): CampaignCreativeOutput {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Product push",
        coreIdea: "Food hero",
        customerEmotion: "craving",
        headlineDirection: "direct",
        visualConcept: "hero",
        cta: "Order",
        targetAudience: "local customers",
        expectedStrength: 8,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "test",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Now on Uber Eats",
      cta: "Order on Uber Eats",
      visualDirection: "single food hero",
      composition: "centered",
      lighting: "warm",
      photographyStyle: "realistic",
      aspectRatio: "4:5",
    },
    caption: "Food hero",
    imageGeneration: {
      basePrompt: "food hero",
      negativePrompt: "no text",
      visualConstraints: [],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Now on Uber Eats",
      cta: "Order on Uber Eats",
      logoUsage: "OMIT",
      placementHints: {
        headline: "top-left",
        supportingCopy: "below",
        cta: "bottom-right",
        logo: "none",
      },
    },
    factualQaNotes: [],
    ...overrides,
  };
}

test("layout registry contains five approved families for each active ATTHAS operating brand", () => {
  assert.equal(ATTHAS_LAYOUTS.filter((item) => item.brandId === "ATTHAS_BURGER").length, 5);
  assert.equal(ATTHAS_LAYOUTS.filter((item) => item.brandId === "ATTHAS_RESTAURANT").length, 5);
});

test("Burger campaign with a deterministic price selects promotional-price layout", () => {
  const value = creative();
  value.overlaySpec.price = { amount: 1090, currency: "LKR", display: "LKR 1,090" };
  assert.equal(
    selectAtthasLayout({ brandId: "ATTHAS_BURGER", creative: value, format: squareish }).id,
    "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
  );
});

test("verified offer language selects Burger offer layout before ordinary price layout", () => {
  const value = creative();
  value.overlaySpec.price = { amount: 1390, currency: "LKR", display: "LKR 1,390" };
  value.overlaySpec.supportingCopy = "Buy 1 get 1 free";
  assert.equal(
    selectAtthasLayout({ brandId: "ATTHAS_BURGER", creative: value, format: squareish }).id,
    "ATTHAS_BURGER_OFFER_DEAL_V1",
  );
});

test("brand-building Burger creative selects minimal-premium layout without price", () => {
  const value = creative({
    concepts: [
      {
        id: "C1",
        strategicRole: "brand-building",
        campaignName: "Brand",
        coreIdea: "Brand story",
        customerEmotion: "belonging",
        headlineDirection: "minimal",
        visualConcept: "single hero",
        cta: "Discover ATTHA’S",
        targetAudience: "brand audience",
        expectedStrength: 8,
        risks: [],
      },
    ],
  });
  assert.equal(
    selectAtthasLayout({ brandId: "ATTHAS_BURGER", creative: value, format: squareish }).id,
    "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",
  );
});

test("Burger BRAND_BUILDING campaign type selects minimal-premium even when AI role drifts", () => {
  const value = creative();
  assert.equal(
    selectAtthasLayout({
      brandId: "ATTHAS_BURGER",
      creative: value,
      format: squareish,
      campaignType: "BRAND_BUILDING",
    }).id,
    "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",
  );
});

test("Restaurant shared-table language selects multi-dish layout", () => {
  const value = creative();
  value.creativeBrief.visualDirection = "A generous shared table spread with variety";
  assert.equal(
    selectAtthasLayout({ brandId: "ATTHAS_RESTAURANT", creative: value, format: squareish }).id,
    "ATTHAS_RESTAURANT_MULTI_DISH_V1",
  );
});

test("9:16 always routes to the operating brand story layout", () => {
  const value = creative();
  value.creativeBrief.aspectRatio = "9:16";
  assert.equal(
    selectAtthasLayout({ brandId: "ATTHAS_BURGER", creative: value, format: story }).id,
    "ATTHAS_BURGER_STORY_VERTICAL_V1",
  );
  assert.equal(
    selectAtthasLayout({ brandId: "ATTHAS_RESTAURANT", creative: value, format: story }).id,
    "ATTHAS_RESTAURANT_STORY_VERTICAL_V1",
  );
});

test("manual override cannot cross operating brands", () => {
  assert.throws(
    () =>
      selectAtthasLayout({
        brandId: "ATTHAS_BURGER",
        creative: creative(),
        format: squareish,
        preferredLayoutId: "ATTHAS_RESTAURANT_EDITORIAL_V1",
      }),
    /belongs to ATTHAS_RESTAURANT/,
  );
});

test("manual override cannot use an incompatible aspect ratio", () => {
  assert.throws(
    () =>
      selectAtthasLayout({
        brandId: "ATTHAS_BURGER",
        creative: creative(),
        format: squareish,
        preferredLayoutId: "ATTHAS_BURGER_STORY_VERTICAL_V1",
      }),
    /does not support aspect ratio 4:5/,
  );
});
