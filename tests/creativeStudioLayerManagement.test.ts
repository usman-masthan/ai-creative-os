import assert from "node:assert/strict";
import test from "node:test";

import { applyMultiObjectDesignOperation } from "../src/designDocument/multiObjectOperations.js";
import type { DesignDocument } from "../src/designDocument/types.js";

function fixture(): DesignDocument {
  const at = "2026-08-29T04:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "design-layer-management",
    version: 1,
    campaignId: "campaign-layer-management",
    truthSnapshotId: "task:layer-management",
    artboard: { width: 1000, height: 1000, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1000, height: 1000, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
      { id: "a", name: "Headline block", type: "shape", shape: "rect", x: 100, y: 100, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: false, fill: "#fff" },
      { id: "b", name: "CTA block", type: "shape", shape: "rect", x: 240, y: 100, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: false, fill: "#ffd21a" },
      { id: "c", name: "Decorative block", type: "shape", shape: "rect", x: 380, y: 100, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 30, visible: true, locked: false, aiEditable: false, fill: "#b50008" },
      { id: "group-1", name: "Offer Group", type: "group", x: 100, y: 100, width: 240, height: 100, rotation: 0, opacity: 1, zIndex: 40, visible: true, locked: false, aiEditable: false, childLayerIds: ["a", "b"] },
      { id: "logo", name: "Approved Logo", type: "logo", x: 820, y: 50, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 100, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand" }, preserveAspectRatio: true, clearSpacePx: 20 },
    ],
    history: [{ version: 1, createdAt: at, summary: "Fixture", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

function layer(document: DesignDocument, id: string) {
  const found = document.layers.find((candidate) => candidate.id === id);
  assert.ok(found, `Expected layer ${id}.`);
  return found;
}

test("layer and group rename is metadata-only and creates one revision", () => {
  const renamed = applyMultiObjectDesignOperation(
    fixture(),
    { type: "RENAME_LAYER", layerId: "group-1", name: "Primary Offer Cluster" },
    "2026-08-29T04:01:00.000Z",
  );
  assert.equal(renamed.version, 2);
  const renamedGroup = layer(renamed, "group-1");
  assert.equal(renamedGroup.name, "Primary Offer Cluster");
  assert.equal(renamedGroup.type, "group");
  assert.deepEqual(renamedGroup.type === "group" ? renamedGroup.childLayerIds : [], ["a", "b"]);
  assert.match(renamed.history.at(-1)?.summary ?? "", /Renamed group-1/);
});

test("group z-order selection moves its children as a block without moving protected structure", () => {
  const reordered = applyMultiObjectDesignOperation(
    fixture(),
    { type: "REORDER_LAYERS", layerIds: ["group-1"], placement: "FRONT" },
    "2026-08-29T04:02:00.000Z",
  );
  assert.equal(reordered.version, 2);
  assert.equal(layer(reordered, "background").zIndex, 0);
  assert.equal(layer(reordered, "logo").zIndex, 100);
  assert.equal(layer(reordered, "group-1").zIndex, 40);
  assert.equal(layer(reordered, "c").zIndex, 10);
  assert.equal(layer(reordered, "a").zIndex, 20);
  assert.equal(layer(reordered, "b").zIndex, 30);
});

test("whole-group duplication copies native children and creates one new validated group", () => {
  const duplicated = applyMultiObjectDesignOperation(
    fixture(),
    {
      type: "DUPLICATE_GROUP",
      groupLayerId: "group-1",
      newGroupLayerId: "group-copy",
      newChildLayerIds: ["a-copy", "b-copy"],
      offsetX: 25,
      offsetY: 30,
    },
    "2026-08-29T04:03:00.000Z",
  );
  assert.equal(duplicated.version, 2);
  const copy = layer(duplicated, "group-copy");
  assert.equal(copy.type, "group");
  assert.deepEqual(copy.type === "group" ? copy.childLayerIds : [], ["a-copy", "b-copy"]);
  assert.deepEqual({ x: layer(duplicated, "a-copy").x, y: layer(duplicated, "a-copy").y }, { x: 125, y: 130 });
  assert.deepEqual({ x: layer(duplicated, "b-copy").x, y: layer(duplicated, "b-copy").y }, { x: 265, y: 130 });
  assert.equal(layer(duplicated, "logo").zIndex, 100);
});

test("whole-group duplication fails closed when a child participates in a mask", () => {
  const source = fixture();
  source.layers.push({ id: "mask-1", name: "Mask", type: "mask", x: 100, y: 100, width: 100, height: 100, rotation: 0, opacity: 1, zIndex: 50, visible: true, locked: false, aiEditable: false, targetLayerIds: ["a"], shape: "rect" });
  assert.throws(
    () => applyMultiObjectDesignOperation(source, { type: "DUPLICATE_GROUP", groupLayerId: "group-1", newGroupLayerId: "group-copy", newChildLayerIds: ["a-copy", "b-copy"] }),
    /participates in a mask/,
  );
});

test("protected logo cannot be moved through multi-layer z-order tooling", () => {
  assert.throws(
    () => applyMultiObjectDesignOperation(fixture(), { type: "REORDER_LAYERS", layerIds: ["logo"], placement: "BACK" }),
    /protected from layer-order changes|DESIGN_LAYER_LOCKED/,
  );
});
