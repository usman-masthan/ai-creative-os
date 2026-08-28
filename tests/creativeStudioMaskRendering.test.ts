import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignDocumentHtml, buildDesignDocumentSvg } from "../src/creativeStudio/renderDesignDocument.js";
import type { DesignDocument } from "../src/designDocument/types.js";

function fixture(shape: "rect" | "ellipse"): DesignDocument {
  const at = "2026-08-28T19:00:00.000Z";
  return {
    schemaVersion: 1,
    id: `mask-${shape}`,
    version: 1,
    campaignId: "mask-campaign",
    truthSnapshotId: "task:mask",
    artboard: { width: 400, height: 500, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      {
        id: "subject", name: "Subject", type: "image",
        x: 50, y: 80, width: 300, height: 320, rotation: 7, opacity: 1, zIndex: 10,
        visible: true, locked: false, aiEditable: true,
        asset: { assetId: "subject", source: "runtime", uri: "data:image/png;base64,ZmFrZWltYWdl", mimeType: "image/png", visualTruthClass: "GENERIC_CONCEPT_VISUAL" },
        fit: "cover",
      },
      {
        id: "subject-mask", name: "Subject Mask", type: "mask",
        x: 100, y: 130, width: 180, height: 210, rotation: 12, opacity: 1, zIndex: 20,
        visible: true, locked: false, aiEditable: false,
        targetLayerIds: ["subject"],
        shape,
      },
    ],
    history: [{ version: 1, createdAt: at, summary: "Initial", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

for (const shape of ["rect", "ellipse"] as const) {
  test(`${shape} mask clips target in HTML/PNG and standalone SVG render paths`, async () => {
    const document = fixture(shape);
    const html = await buildDesignDocumentHtml(document);
    assert.match(html, /data-layer-id="subject"/);
    assert.match(html, /clip-path:polygon\(/);
    assert.doesNotMatch(html, /data-layer-id="subject-mask"/);

    const svg = await buildDesignDocumentSvg(document);
    assert.match(svg, /<clipPath id="clip-subject-mask-subject" clipPathUnits="objectBoundingBox">/);
    assert.match(svg, /clip-path="url\(#clip-subject-mask-subject\)"/);
    assert.doesNotMatch(svg, /data-layer-id="subject-mask"/);
  });
}

test("renderer refuses ambiguous multiple visible masks for one target", async () => {
  const document = fixture("rect");
  document.layers.push({
    id: "second-mask", name: "Second Mask", type: "mask",
    x: 120, y: 150, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 21,
    visible: true, locked: false, aiEditable: false,
    targetLayerIds: ["subject"],
    shape: "ellipse",
  });
  await assert.rejects(buildDesignDocumentHtml(document), /MASK_TARGET_AMBIGUOUS/);
  await assert.rejects(buildDesignDocumentSvg(document), /MASK_TARGET_AMBIGUOUS/);
});
