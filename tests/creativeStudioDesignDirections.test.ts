import test from "node:test";
import assert from "node:assert/strict";

import { generateDesignDirections } from "../src/commands/generateDesignDirections.js";
import type { DesignDocument } from "../src/designDocument/types.js";

function fixture(): DesignDocument {
  const at = "2026-08-28T19:30:00.000Z";
  return {
    schemaVersion: 1,
    id: "direction-source",
    version: 4,
    campaignId: "direction-campaign",
    truthSnapshotId: "task:direction",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    layers: [
      { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: true, asset: { assetId: "bg", source: "generated", uri: "data:image/png;base64,ZmFrZQ==", mimeType: "image/png", visualTruthClass: "GENERIC_CONCEPT_VISUAL" }, fit: "cover" },
      { id: "product-subject", name: "Product", type: "image", x: 360, y: 420, width: 650, height: 700, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: true, aiEditable: false, asset: { assetId: "product", source: "verified-product", uri: "data:image/png;base64,ZmFrZQ==", mimeType: "image/png", visualTruthClass: "VERIFIED_PRODUCT_VISUAL" }, fit: "contain" },
      { id: "headline", name: "Headline", type: "text", role: "headline", x: 65, y: 75, width: 560, height: 210, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: true, text: "CRAVE THE TIKKA", fontFamily: "Oswald", fontSize: 82, fontWeight: 800, lineHeight: 1, letterSpacing: -1, align: "left", fill: "#FFFFFF" },
      { id: "supporting-copy", name: "Supporting", type: "text", role: "supporting", x: 65, y: 310, width: 530, height: 110, rotation: 0, opacity: 1, zIndex: 21, visible: true, locked: false, aiEditable: true, text: "CHICKEN TIKKA WRAP", fontFamily: "Inter", fontSize: 31, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0, align: "left", fill: "#FFF8E8" },
      { id: "cta", name: "CTA", type: "text", role: "cta", x: 65, y: 450, width: 250, height: 70, rotation: 0, opacity: 1, zIndex: 30, visible: true, locked: false, aiEditable: true, text: "ORDER NOW", fontFamily: "Inter", fontSize: 28, fontWeight: 800, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#171717" },
      { id: "price", name: "Price", type: "text", role: "price", x: 65, y: 540, width: 250, height: 90, rotation: 0, opacity: 1, zIndex: 32, visible: true, locked: false, aiEditable: false, text: "LKR 1,250", fontFamily: "Oswald", fontSize: 48, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#171717" },
      { id: "logo", name: "Logo", type: "logo", x: 850, y: 1180, width: 130, height: 62, rotation: 0, opacity: 1, zIndex: 50, visible: true, locked: true, aiEditable: false, asset: { assetId: "ATTHAS_MASTER_SYMBOL_A_FORK", source: "approved-brand", uri: "data:image/svg+xml;base64,PHN2Zy8+", mimeType: "image/svg+xml" }, preserveAspectRatio: true, clearSpacePx: 16 },
    ],
    history: [{ version: 4, createdAt: at, summary: "Working", actor: "human" }],
    createdAt: at,
    updatedAt: at,
  };
}

function text(document: DesignDocument, role: string): string | undefined {
  const layer = document.layers.find((candidate) => candidate.type === "text" && candidate.role === role);
  return layer?.type === "text" ? layer.text : undefined;
}

test("three design directions vary composition while preserving governed content and provenance", () => {
  const source = fixture();
  const directions = generateDesignDirections({
    document: source,
    newDesignPrefix: "direction-set",
    createdAt: "2026-08-28T19:31:00.000Z",
  });
  assert.equal(directions.length, 3);
  assert.deepEqual(directions.map((direction) => direction.id), ["A", "B", "C"]);
  assert.equal(new Set(directions.map((direction) => direction.document.layoutId)).size, 3);

  for (const direction of directions) {
    assert.equal(direction.document.version, 1);
    assert.equal(direction.document.campaignId, source.campaignId);
    assert.equal(direction.document.truthSnapshotId, source.truthSnapshotId);
    assert.equal(text(direction.document, "headline"), "CRAVE THE TIKKA");
    assert.equal(text(direction.document, "price"), "LKR 1,250");
    const product = direction.document.layers.find((layer) => layer.id === "product-subject");
    const logo = direction.document.layers.find((layer) => layer.id === "logo");
    assert.ok(product?.type === "image");
    assert.ok(logo?.type === "logo");
    if (product?.type === "image") {
      assert.equal(product.asset.assetId, "product");
      assert.equal(product.asset.visualTruthClass, "VERIFIED_PRODUCT_VISUAL");
      assert.equal(product.locked, true);
    }
    if (logo?.type === "logo") assert.equal(logo.asset.assetId, "ATTHAS_MASTER_SYMBOL_A_FORK");
  }

  const headlinePositions = directions.map((direction) => {
    const layer = direction.document.layers.find((candidate) => candidate.id === "headline");
    return `${layer?.x}:${layer?.y}`;
  });
  assert.equal(new Set(headlinePositions).size, 3);
  assert.equal(source.version, 4);
  assert.equal(source.id, "direction-source");
});
