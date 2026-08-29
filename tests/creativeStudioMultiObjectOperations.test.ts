import assert from "node:assert/strict";
import test from "node:test";

import { applyMultiObjectDesignOperation } from "../src/designDocument/multiObjectOperations.js";
import type { DesignDocument } from "../src/designDocument/types.js";

function fixture(): DesignDocument {
  const at = "2026-08-29T03:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "design-multi-object",
    version: 1,
    campaignId: "campaign-multi-object",
    truthSnapshotId: "task:multi-object",
    artboard: { width: 1000, height: 1000, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      { id: "a", name: "A", type: "shape", shape: "rect", x: 100, y: 100, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 1, visible: true, locked: false, aiEditable: false, fill: "#fff" },
      { id: "b", name: "B", type: "shape", shape: "rect", x: 300, y: 100, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 2, visible: true, locked: false, aiEditable: false, fill: "#ffd21a" },
      { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1000, height: 1000, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
      { id: "logo", name: "Logo", type: "logo", x: 800, y: 50, width: 120, height: 120, rotation: 0, opacity: 1, zIndex: 5, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand" }, preserveAspectRatio: true, clearSpacePx: 20 },
    ],
    history: [{ version: 1, createdAt: at, summary: "Fixture", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

test("multi duplicate creates all copies in one revision with caller-supplied stable ids", () => {
  const next = applyMultiObjectDesignOperation(
    fixture(),
    { type: "DUPLICATE_LAYERS", layerIds: ["a", "b"], newLayerIds: ["a-copy", "b-copy"], offsetX: 20, offsetY: 30 },
    "2026-08-29T03:01:00.000Z",
  );
  assert.equal(next.version, 2);
  assert.equal(next.history.at(-1)?.summary, "Duplicated 2 selected layers.");
  const a = next.layers.find((layer) => layer.id === "a-copy");
  const b = next.layers.find((layer) => layer.id === "b-copy");
  assert.deepEqual(a && { x: a.x, y: a.y }, { x: 120, y: 130 });
  assert.deepEqual(b && { x: b.x, y: b.y }, { x: 320, y: 130 });
});

test("multi delete removes eligible layers in one revision", () => {
  const next = applyMultiObjectDesignOperation(
    fixture(),
    { type: "DELETE_LAYERS", layerIds: ["a", "b"] },
    "2026-08-29T03:02:00.000Z",
  );
  assert.equal(next.version, 2);
  assert.equal(next.layers.some((layer) => layer.id === "a" || layer.id === "b"), false);
  assert.equal(next.history.at(-1)?.summary, "Deleted 2 selected layers.");
});

test("multi object operations cannot bypass logo or background governance", () => {
  assert.throws(
    () => applyMultiObjectDesignOperation(fixture(), { type: "DUPLICATE_LAYERS", layerIds: ["a", "logo"], newLayerIds: ["a-copy", "logo-copy"] }),
    /DESIGN_LAYER_LOCKED: logo|logo layers cannot be duplicated/,
  );
  assert.throws(
    () => applyMultiObjectDesignOperation(fixture(), { type: "DELETE_LAYERS", layerIds: ["a", "background"] }),
    /primary background cannot be deleted/,
  );
});

test("multi delete refuses grouped children until the group is removed", () => {
  const source = fixture();
  source.layers.push({ id: "group-1", name: "Group", type: "group", x: 100, y: 100, width: 300, height: 100, rotation: 0, opacity: 1, zIndex: 4, visible: true, locked: false, aiEditable: false, childLayerIds: ["a", "b"] });
  assert.throws(
    () => applyMultiObjectDesignOperation(source, { type: "DELETE_LAYERS", layerIds: ["a", "b"] }),
    /ungroup group-1 before deleting/,
  );
});
