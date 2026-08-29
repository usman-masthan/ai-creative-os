import test from "node:test";
import assert from "node:assert/strict";

import type { CampaignCreativeOutput, CampaignProductionFormat } from "../src/creativeTypes.js";
import { evaluateLayeredRenderParity } from "../src/creativeStudio/renderParity.js";
import type { DesignDocument } from "../src/designDocument/types.js";

const format: CampaignProductionFormat = {
  channel: "instagram",
  assetType: "poster",
  aspectRatio: "4:5",
  width: 1080,
  height: 1350,
};

const creative: CampaignCreativeOutput = {
  concepts: [],
  recommendedConceptId: "C1",
  recommendationReason: "parity test",
  creativeBrief: {
    headline: "Crave the Tikka",
    supportingCopy: "Chicken Tikka Wrap",
    cta: "Order Now",
    visualDirection: "food hero",
    composition: "copy safe",
    lighting: "soft",
    photographyStyle: "realistic",
    aspectRatio: "4:5",
  },
  caption: "test",
  imageGeneration: {
    basePrompt: "food hero",
    negativePrompt: "no text",
    visualConstraints: [],
    textPolicy: "NO_TEXT_OR_LOGOS",
  },
  overlaySpec: {
    headline: "CRAVE THE TIKKA",
    supportingCopy: "CHICKEN TIKKA WRAP",
    price: { amount: 1250, currency: "LKR", display: "LKR 1,250", priceStyle: "BRAND_YELLOW" },
    cta: "ORDER NOW",
    logoUsage: "APPROVED_ONLY",
    placementHints: {
      headline: "upper-left",
      supportingCopy: "below headline",
      price: "conversion block",
      cta: "below copy",
      logo: "safe corner",
    },
  },
  factualQaNotes: [],
};

function documentFixture(): DesignDocument {
  const at = "2026-08-28T18:30:00.000Z";
  return {
    schemaVersion: 1,
    id: "parity-design",
    version: 1,
    campaignId: "parity-campaign",
    truthSnapshotId: "task:parity",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    layers: [
      { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: true, fill: "#820008" },
      { id: "headline", name: "Headline", type: "text", role: "headline", x: 60, y: 70, width: 550, height: 200, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: true, text: "CRAVE THE TIKKA", fontFamily: "Oswald", fontSize: 80, fontWeight: 800, lineHeight: 1, letterSpacing: -1, align: "left", fill: "#FFFFFF" },
      { id: "supporting", name: "Supporting", type: "text", role: "supporting", x: 60, y: 290, width: 550, height: 100, rotation: 0, opacity: 1, zIndex: 21, visible: true, locked: false, aiEditable: true, text: "CHICKEN TIKKA WRAP", fontFamily: "Inter", fontSize: 30, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0, align: "left", fill: "#FFF8E8" },
      { id: "cta", name: "CTA", type: "text", role: "cta", x: 60, y: 420, width: 240, height: 70, rotation: 0, opacity: 1, zIndex: 30, visible: true, locked: false, aiEditable: true, text: "ORDER NOW", fontFamily: "Inter", fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#171717" },
      { id: "price", name: "Price", type: "text", role: "price", x: 720, y: 100, width: 250, height: 90, rotation: 0, opacity: 1, zIndex: 32, visible: true, locked: false, aiEditable: false, text: "LKR 1,250", fontFamily: "Oswald", fontSize: 48, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#171717" },
      { id: "logo", name: "Logo", type: "logo", x: 850, y: 1180, width: 130, height: 62, rotation: 0, opacity: 1, zIndex: 50, visible: true, locked: true, aiEditable: false, asset: { assetId: "ATTHAS_MASTER_SYMBOL_A_FORK", source: "approved-brand", uri: "/tmp/logo.svg", mimeType: "image/svg+xml" }, preserveAspectRatio: true, clearSpacePx: 16 },
    ],
    history: [{ version: 1, createdAt: at, summary: "Initial", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

test("initial layered document passes governed M3 semantic parity", () => {
  const result = evaluateLayeredRenderParity({
    document: documentFixture(),
    creative,
    format,
    brandId: "ATTHAS_BURGER",
    expectedLayoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
  });
  assert.equal(result.decision, "PASS");
  assert.deepEqual(result.checks, {
    artboard: true,
    layout: true,
    nativeCopy: true,
    typography: true,
    logo: true,
  });
});

test("parity gate catches renderer migration drift without policing later revisions", () => {
  const document = documentFixture();
  const headlineIndex = document.layers.findIndex((layer) => layer.id === "headline");
  const headline = document.layers[headlineIndex];
  assert.ok(headline?.type === "text");
  if (headline?.type !== "text") throw new Error("Fixture headline must be text.");
  document.layers[headlineIndex] = { ...headline, text: "DRIFTED COPY", fontFamily: "Arial" };
  document.artboard = { ...document.artboard, width: 1000 };

  const result = evaluateLayeredRenderParity({
    document,
    creative,
    format,
    brandId: "ATTHAS_BURGER",
    expectedLayoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
  });
  assert.equal(result.decision, "BLOCK");
  assert.ok(result.issues.some((item) => item.code === "ARTBOARD_PARITY"));
  assert.ok(result.issues.some((item) => item.code === "COPY_PARITY_MISMATCH"));
  assert.ok(result.issues.some((item) => item.code === "TYPOGRAPHY_PARITY"));
});
