import test from "node:test";
import assert from "node:assert/strict";

import { autoPolishDesign } from "../src/creativeStudio/autoPolish.js";
import { runDesignQa } from "../src/creativeStudio/designQa.js";
import type { DesignDocument } from "../src/designDocument/types.js";

test("auto-polish fixes only deterministic layout/brand issues without changing truth copy or assets", () => {
  const at = "2026-08-28T18:00:00.000Z";
  const document: DesignDocument = {
    schemaVersion: 1,
    id: "auto-polish-design",
    version: 1,
    campaignId: "auto-polish-campaign",
    truthSnapshotId: "task:auto-polish",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    layers: [
      {
        id: "background", name: "Background", type: "background",
        x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0,
        visible: true, locked: false, aiEditable: true, fill: "#820008",
      },
      {
        id: "headline", name: "Headline", type: "text", role: "headline",
        x: 0, y: 0, width: 320, height: 90, rotation: 0, opacity: 1, zIndex: 20,
        visible: true, locked: false, aiEditable: true,
        text: "A very long headline that must remain exactly the same while layout polish reduces overflow risk",
        fontFamily: "Comic Sans MS", fontSize: 72, fontWeight: 800, lineHeight: 1,
        letterSpacing: 0, align: "left", fill: "#FFFFFF",
      },
      {
        id: "price", name: "Price", type: "text", role: "price",
        x: 700, y: 100, width: 250, height: 90, rotation: 0, opacity: 1, zIndex: 30,
        visible: true, locked: false, aiEditable: false,
        text: "LKR 1,250", fontFamily: "Oswald", fontSize: 48, fontWeight: 700,
        lineHeight: 1, letterSpacing: 0, align: "center", fill: "#FFD21A",
      },
      {
        id: "logo", name: "Approved Logo", type: "logo",
        x: 1060, y: 1330, width: 20, height: 20, rotation: 0, opacity: 1, zIndex: 50,
        visible: true, locked: true, aiEditable: false,
        asset: { assetId: "ATTHAS_MASTER_SYMBOL_A_FORK", source: "approved-brand", uri: "/tmp/logo.svg", mimeType: "image/svg+xml" },
        preserveAspectRatio: true, clearSpacePx: 10,
      },
    ],
    history: [{ version: 1, createdAt: at, summary: "Initial", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };

  const before = runDesignQa({ document, checkedAt: at });
  assert.ok(before.issues.some((item) => item.code === "NON_BRAND_FONT" && item.layerId === "headline"));
  assert.ok(before.issues.some((item) => item.code === "TEXT_OVERFLOW_RISK" && item.layerId === "headline"));
  assert.ok(before.issues.some((item) => item.code === "LOGO_TOO_SMALL" && item.layerId === "logo"));

  const originalHeadline = document.layers.find((layer) => layer.id === "headline");
  assert.ok(originalHeadline?.type === "text");
  if (originalHeadline?.type !== "text") throw new Error("Fixture headline must be a text layer.");

  const polished = autoPolishDesign({ document, qa: before, timestamp: "2026-08-28T18:01:00.000Z" });
  assert.ok(polished.applied.length >= 3);
  assert.equal(polished.document.version, 2);

  const headline = polished.document.layers.find((layer) => layer.id === "headline");
  assert.ok(headline?.type === "text");
  if (headline?.type === "text") {
    assert.equal(headline.text, originalHeadline.text);
    assert.equal(headline.fontFamily, "Oswald");
    assert.ok(headline.fontSize < 72);
    assert.ok(headline.x >= 54 && headline.y >= 68);
  }

  const price = polished.document.layers.find((layer) => layer.id === "price");
  assert.ok(price?.type === "text");
  if (price?.type === "text") assert.equal(price.text, "LKR 1,250");

  const logo = polished.document.layers.find((layer) => layer.id === "logo");
  assert.ok(logo?.type === "logo");
  if (logo?.type === "logo") {
    assert.equal(logo.asset.assetId, "ATTHAS_MASTER_SYMBOL_A_FORK");
    assert.equal(logo.locked, true);
    assert.ok(Math.min(logo.width, logo.height) >= 32);
    assert.ok(logo.x + logo.width <= 1026);
    assert.ok(logo.y + logo.height <= 1282);
  }
});
