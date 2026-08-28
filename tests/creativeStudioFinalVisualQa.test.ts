import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { reviewLayeredFinalVisual } from "../src/creativeStudio/finalVisualQa.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { FinalArtQaProvider, FinalArtQaRequest, FinalArtQaResult } from "../src/finalArtQa/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function passResult(): FinalArtQaResult {
  const dimension = { status: "PASS" as const, observations: [] as string[] };
  return {
    provider: "mock-final-qa",
    model: "mock-final-qa",
    decision: "PASS",
    scores: { brandVisibility: 95, headlineHierarchy: 95, ctaHierarchyPlacement: 95, priceVisibility: 95, safeAreas: 95, contrastLegibility: 95, productDominance: 95, platformReadability: 95, decorativeCoherence: 95 },
    checks: { brandVisibility: "PASS", headlineHierarchy: "PASS", ctaHierarchyPlacement: "PASS", priceVisibility: "PASS", safeAreas: "PASS", contrastLegibility: "PASS", productDominance: "PASS", platformReadability: "PASS", decorativeCoherence: "PASS" },
    evidence: { brandVisibility: dimension, headlineHierarchy: dimension, ctaHierarchyPlacement: dimension, priceVisibility: dimension, safeAreas: dimension, contrastLegibility: dimension, productDominance: dimension, platformReadability: dimension, decorativeCoherence: dimension },
    issues: [],
    notes: [],
  };
}

function documentFixture(): DesignDocument {
  const at = "2026-08-28T20:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "final-visual-design",
    version: 2,
    campaignId: "final-visual-campaign",
    truthSnapshotId: "task:final-visual",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    layers: [
      { id: "headline", name: "Headline", type: "text", role: "headline", x: 60, y: 70, width: 550, height: 200, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: true, text: "CRAVE THE TIKKA", fontFamily: "Oswald", fontSize: 80, fontWeight: 800, lineHeight: 1, letterSpacing: -1, align: "left", fill: "#FFFFFF" },
      { id: "supporting", name: "Supporting", type: "text", role: "supporting", x: 60, y: 290, width: 550, height: 100, rotation: 0, opacity: 1, zIndex: 21, visible: true, locked: false, aiEditable: true, text: "CHICKEN TIKKA WRAP", fontFamily: "Inter", fontSize: 30, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0, align: "left", fill: "#FFF8E8" },
      { id: "cta", name: "CTA", type: "text", role: "cta", x: 60, y: 420, width: 240, height: 70, rotation: 0, opacity: 1, zIndex: 30, visible: true, locked: false, aiEditable: true, text: "ORDER NOW", fontFamily: "Inter", fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#171717" },
      { id: "price", name: "Price", type: "text", role: "price", x: 720, y: 100, width: 250, height: 90, rotation: 0, opacity: 1, zIndex: 32, visible: true, locked: false, aiEditable: false, text: "LKR 1,250", fontFamily: "Oswald", fontSize: 48, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#171717" },
      { id: "logo", name: "Logo", type: "logo", x: 850, y: 1180, width: 130, height: 62, rotation: 0, opacity: 1, zIndex: 50, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand", uri: "/tmp/logo.svg", mimeType: "image/svg+xml" }, preserveAspectRatio: true, clearSpacePx: 16 },
    ],
    history: [{ version: 2, createdAt: at, summary: "Working", actor: "human" }],
    createdAt: at,
    updatedAt: at,
  };
}

function truthFixture(): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "final-visual",
    campaignId: "final-visual-campaign",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "owner",
    confirmedAt: "2026-08-28T20:00:00.000Z",
    facts: [
      { label: "productName", key: "productName", value: "Chicken Tikka Wrap", scope: { tenantId: "T001", brandId: "ATTHAS_BURGER" }, confirmationAction: "PROVIDE", updateStoredTruthRequested: false },
      { label: "deliveryChannel", key: "deliveryChannel", value: ["Uber Eats", "PickMe"], scope: { tenantId: "T001", brandId: "ATTHAS_BURGER" }, confirmationAction: "PROVIDE", updateStoredTruthRequested: false },
    ],
  };
}

test("flattened final visual QA sends native layered expectations to existing provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "final-visual-qa-"));
  try {
    const pngPath = join(root, "preview.png");
    await writeFile(pngPath, Buffer.alloc(1800, 3));
    let request: FinalArtQaRequest | undefined;
    const provider: FinalArtQaProvider = {
      providerName: "mock-final-qa",
      model: "mock-final-qa",
      review: async (input) => {
        request = input;
        return passResult();
      },
    };
    const result = await reviewLayeredFinalVisual({
      document: documentFixture(),
      truthSnapshot: truthFixture(),
      format: { channel: "instagram", assetType: "poster", aspectRatio: "4:5", width: 1080, height: 1350 },
      pngPath,
      provider,
    });
    assert.equal(result.decision, "PASS");
    assert.ok(request);
    assert.equal(request?.expectedHeadline, "CRAVE THE TIKKA");
    assert.equal(request?.expectedSupportingCopy, "CHICKEN TIKKA WRAP");
    assert.equal(request?.expectedCta, "ORDER NOW");
    assert.equal(request?.expectedPrice, "LKR 1,250");
    assert.equal(request?.expectedProductName, "Chicken Tikka Wrap");
    assert.deepEqual(request?.expectedPlatforms, ["Uber Eats", "PickMe"]);
    assert.equal(request?.logoExpected, true);
    assert.equal(request?.width, 1080);
    assert.equal(request?.height, 1350);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
