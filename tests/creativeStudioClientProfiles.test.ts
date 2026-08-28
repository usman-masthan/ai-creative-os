import assert from "node:assert/strict";
import test from "node:test";

import { ATTHAS_TOKENS } from "../src/atthasTokens.js";
import { generateCreativeDesign } from "../src/commands/generateCreativeDesign.js";
import { getCreativeBrandTheme, listCreativeClientProfiles } from "../src/creativeStudio/clientProfiles/registry.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";
import { ATTHAS_LAYOUTS } from "../src/layouts/atthas.js";

const restaurantCreative: CampaignCreativeOutput = {
  concepts: [{
    id: "restaurant-concept",
    strategicRole: "conversion",
    campaignName: "Dinner",
    coreIdea: "Food hero",
    customerEmotion: "comfort",
    headlineDirection: "premium",
    visualConcept: "restaurant food hero",
    cta: "Visit Today",
    targetAudience: "families",
    expectedStrength: 9,
    risks: [],
  }],
  recommendedConceptId: "restaurant-concept",
  recommendationReason: "Strong restaurant fit.",
  creativeBrief: {
    headline: "Authentic Flavour",
    supportingCopy: "",
    cta: "Visit Today",
    visualDirection: "Premium restaurant food hero",
    composition: "Editorial food hero",
    lighting: "Warm natural light",
    photographyStyle: "Editorial",
    aspectRatio: "4:5",
  },
  caption: "Authentic flavour.",
  imageGeneration: {
    basePrompt: "Premium restaurant food photography without text.",
    negativePrompt: "logos, text, prices",
    visualConstraints: ["real food"],
    textPolicy: "NO_TEXT_OR_LOGOS",
  },
  overlaySpec: {
    headline: "Authentic Flavour",
    supportingCopy: "",
    price: { amount: 1490, currency: "LKR", display: "LKR 1,490" },
    cta: "Visit Today",
    logoUsage: "APPROVED_ONLY",
    placementHints: {
      headline: "upper left",
      supportingCopy: "none",
      price: "near CTA",
      cta: "lower left",
      logo: "lower right",
    },
  },
  factualQaNotes: [],
};

test("Creative Studio client profile registry exposes ATTHAS without hard-coding theme selection in assembler", () => {
  const profiles = listCreativeClientProfiles();
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0]?.clientId, "T001");
  assert.equal(getCreativeBrandTheme("T001", "ATTHAS_BURGER").defaultPriceStyle, "BRAND_YELLOW");
  assert.equal(getCreativeBrandTheme("T001", "ATTHAS_RESTAURANT").defaultPriceStyle, "BRAND_RED");
  assert.throws(() => getCreativeBrandTheme("UNKNOWN", "ANY"), /CREATIVE_CLIENT_PROFILE_NOT_FOUND/);
});

test("Restaurant assembler uses M3-compatible red default price style and omits blank supporting text", () => {
  const layout = ATTHAS_LAYOUTS.find((candidate) => candidate.id === "ATTHAS_RESTAURANT_FOOD_HERO_V1");
  assert.ok(layout);
  const document = generateCreativeDesign({
    designId: "restaurant-profile-design",
    campaignId: "restaurant-profile-campaign",
    truthSnapshotId: "task:restaurant-profile",
    clientId: "T001",
    brandId: "ATTHAS_RESTAURANT",
    brandKitId: "ATTHAS_WORKING_V1",
    creative: restaurantCreative,
    format: { channel: "instagram", assetType: "poster", aspectRatio: "4:5", width: 1080, height: 1350 },
    layout,
    backgroundAsset: { assetId: "restaurant-background", source: "generated", visualTruthClass: "GENERIC_CONCEPT_VISUAL" },
    logoAsset: { assetId: "restaurant-logo", source: "approved-brand" },
    createdAt: "2026-08-28T19:00:00.000Z",
  });

  assert.equal(document.layers.some((layer) => layer.id === "supporting-copy"), false);
  const priceBackground = document.layers.find((layer) => layer.id === "price-background");
  assert.ok(priceBackground?.type === "shape");
  if (priceBackground?.type === "shape") assert.equal(priceBackground.fill, ATTHAS_TOKENS.colours.primaryRed);
  const price = document.layers.find((layer) => layer.id === "price");
  assert.ok(price?.type === "text");
  if (price?.type === "text") assert.equal(price.fill, ATTHAS_TOKENS.colours.white);
  assert.equal(document.artboard.background, ATTHAS_TOKENS.colours.cream);
});
