import test from "node:test";
import assert from "node:assert/strict";

import { assertCreativeBrief, type CreativeBrief } from "../src/creativeStudio/contracts/creativeBrief.js";
import { generateCreativeDesign } from "../src/commands/generateCreativeDesign.js";
import { applyDesignOperation } from "../src/designDocument/operations.js";
import { validateDesignDocument } from "../src/designDocument/validator.js";
import { safeAreaRect, rectWithin } from "../src/layoutEngine/geometry.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";
import { ATTHAS_LAYOUTS } from "../src/layouts/atthas.js";

const creative: CampaignCreativeOutput = {
  concepts: [{
    id: "concept-1",
    strategicRole: "conversion",
    campaignName: "Tikka",
    coreIdea: "Product hero",
    customerEmotion: "craving",
    headlineDirection: "short",
    visualConcept: "food hero",
    cta: "Order Now",
    targetAudience: "Gen Z",
    expectedStrength: 9,
    risks: [],
  }],
  recommendedConceptId: "concept-1",
  recommendationReason: "Strongest product focus.",
  creativeBrief: {
    headline: "Crave the Tikka",
    supportingCopy: "Big flavour. Wrapped fresh.",
    cta: "Order Now",
    visualDirection: "Premium food hero",
    composition: "Product lower right",
    lighting: "Natural warm light",
    photographyStyle: "Editorial",
    aspectRatio: "4:5",
  },
  caption: "Crave the Tikka.",
  imageGeneration: {
    basePrompt: "A believable premium food setting without text.",
    negativePrompt: "logos, text, prices",
    visualConstraints: ["realistic shadows"],
    textPolicy: "NO_TEXT_OR_LOGOS",
  },
  overlaySpec: {
    headline: "Crave the Tikka",
    supportingCopy: "Big flavour. Wrapped fresh.",
    price: { amount: 990, currency: "LKR", display: "LKR 990", priceStyle: "BRAND_YELLOW" },
    cta: "Order Now",
    logoUsage: "APPROVED_ONLY",
    placementHints: {
      headline: "upper left",
      supportingCopy: "under headline",
      price: "near CTA",
      cta: "lower left",
      logo: "lower right",
    },
  },
  factualQaNotes: [],
};

const layout = ATTHAS_LAYOUTS.find((candidate) => candidate.id === "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1")!;

test("CreativeBrief normalizes structured intake and validates dimensions", () => {
  const brief: CreativeBrief = {
    schemaVersion: 1,
    id: " brief-1 ",
    clientId: " T001 ",
    brandId: " ATTHAS_BURGER ",
    goal: " Promote product ",
    description: " Promote the Chicken Tikka Wrap. ",
    product: { name: " Chicken Tikka Wrap " },
    branchId: " BURGER_BAMBALAPITIYA ",
    audience: [" Gen Z ", "Gen Z", "students"],
    vibe: [" bold ", "premium"],
    format: { preset: "instagram-portrait", width: 1080, height: 1350 },
    contentRequirements: {
      showPrice: true,
      showOffer: false,
      showCTA: true,
      showProductName: true,
      showBranch: false,
      showContactDetails: false,
      showCampaignDates: false,
    },
    brandKitId: " atthas-v1 ",
    createdAt: "2026-08-28T15:00:00.000Z",
  };
  const normalized = assertCreativeBrief(brief);
  assert.equal(normalized.id, "brief-1");
  assert.deepEqual(normalized.audience, ["Gen Z", "students"]);
  assert.throws(() => assertCreativeBrief({ ...brief, format: { preset: "custom", width: 1, height: 1350 } }), /CREATIVE_BRIEF_INVALID/);
});

test("governed campaign output becomes separate editable native layers", () => {
  const document = generateCreativeDesign({
    designId: "design-1",
    campaignId: "campaign-1",
    truthSnapshotId: "task-snapshot-1",
    clientId: "T001",
    brandId: "ATTHAS_BURGER",
    brandKitId: "ATTHAS_WORKING_V1",
    creative,
    format: { channel: "instagram", assetType: "poster", aspectRatio: "4:5", width: 1080, height: 1350 },
    layout,
    backgroundAsset: { assetId: "background-1", source: "generated", visualTruthClass: "GENERIC_CONCEPT_VISUAL" },
    logoAsset: { assetId: "approved-atthas-logo", source: "approved-brand" },
    createdAt: "2026-08-28T15:00:00.000Z",
  });
  assert.equal(validateDesignDocument(document).valid, true);
  assert.equal(document.layers.find((layer) => layer.id === "headline")?.type, "text");
  assert.equal(document.layers.find((layer) => layer.id === "price")?.type, "text");
  assert.equal(document.layers.find((layer) => layer.id === "logo")?.type, "logo");
  assert.equal(document.layers.find((layer) => layer.id === "background")?.type, "background");
  assert.equal(document.layers.find((layer) => layer.id === "logo")?.locked, true);
});

test("manual layer edits change only the selected layer and cost no AI call", () => {
  const document = generateCreativeDesign({
    designId: "design-2",
    campaignId: "campaign-2",
    truthSnapshotId: "task-snapshot-2",
    clientId: "T001",
    brandId: "ATTHAS_BURGER",
    brandKitId: "ATTHAS_WORKING_V1",
    creative,
    format: { channel: "instagram", assetType: "poster", aspectRatio: "4:5", width: 1080, height: 1350 },
    layout,
    backgroundAsset: { assetId: "background-2", source: "generated" },
    logoAsset: { assetId: "logo-2", source: "approved-brand" },
    createdAt: "2026-08-28T15:00:00.000Z",
  });
  const backgroundBefore = document.layers.find((layer) => layer.id === "background");
  const changed = applyDesignOperation(document, { type: "MOVE_LAYER", layerId: "headline", x: 120, y: 250 }, "2026-08-28T15:01:00.000Z");
  const headline = changed.layers.find((layer) => layer.id === "headline");
  assert.equal(headline?.x, 120);
  assert.equal(headline?.y, 250);
  assert.deepEqual(changed.layers.find((layer) => layer.id === "background"), backgroundBefore);
  assert.equal(changed.version, 2);
  assert.equal(changed.history.at(-1)?.actor, "human");
});

test("brand governance prevents unlocking the approved logo", () => {
  const document = generateCreativeDesign({
    designId: "design-3",
    campaignId: "campaign-3",
    truthSnapshotId: "task-snapshot-3",
    clientId: "T001",
    brandId: "ATTHAS_BURGER",
    brandKitId: "ATTHAS_WORKING_V1",
    creative,
    format: { channel: "instagram", assetType: "poster", aspectRatio: "4:5", width: 1080, height: 1350 },
    layout,
    backgroundAsset: { assetId: "background-3", source: "uploaded" },
    logoAsset: { assetId: "logo-3", source: "approved-brand" },
    createdAt: "2026-08-28T15:00:00.000Z",
  });
  assert.throws(() => applyDesignOperation(document, { type: "SET_LOCK", layerId: "logo", locked: false }), /BRAND_GOVERNANCE_BLOCK/);
});

test("safe-area geometry remains inside the artboard", () => {
  const safe = safeAreaRect({ width: 1080, height: 1350 });
  assert.equal(rectWithin(safe, { x: 0, y: 0, width: 1080, height: 1350 }), true);
});
