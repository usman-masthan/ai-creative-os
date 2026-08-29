import assert from "node:assert/strict";
import test from "node:test";

import { parseDesignOperation } from "../src/creativeStudio/operationValidation.js";
import { applyDesignOperation } from "../src/designDocument/operations.js";
import type { DesignDocument } from "../src/designDocument/types.js";

function documentFixture(): DesignDocument {
  const at = "2026-08-29T00:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "design-arrange",
    version: 1,
    campaignId: "campaign-arrange",
    truthSnapshotId: "task:arrange",
    artboard: { width: 1000, height: 1000, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      {
        id: "a",
        name: "A",
        type: "shape",
        shape: "rect",
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 10,
        visible: true,
        locked: false,
        aiEditable: false,
        fill: "#FFFFFF",
      },
      {
        id: "b",
        name: "B",
        type: "shape",
        shape: "rect",
        x: 300,
        y: 200,
        width: 100,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 11,
        visible: true,
        locked: false,
        aiEditable: false,
        fill: "#FFD21A",
      },
      {
        id: "c",
        name: "C",
        type: "text",
        role: "body",
        x: 600,
        y: 300,
        width: 200,
        height: 80,
        rotation: 0,
        opacity: 1,
        zIndex: 12,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "Body",
        fontFamily: "Inter",
        fontSize: 28,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: 0,
        align: "left",
        fill: "#FFFFFF",
      },
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

test("alignment and distribution are one-version deterministic multi-layer operations", () => {
  const source = documentFixture();
  const aligned = applyDesignOperation(
    source,
    { type: "ALIGN_LAYERS", layerIds: ["a", "b", "c"], alignment: "left" },
    "2026-08-29T00:01:00.000Z",
  );
  assert.equal(aligned.version, 2);
  assert.deepEqual([layer(aligned, "a").x, layer(aligned, "b").x, layer(aligned, "c").x], [100, 100, 100]);
  assert.match(aligned.history.at(-1)?.summary ?? "", /Aligned 3 layers left/);

  const distributed = applyDesignOperation(
    source,
    { type: "DISTRIBUTE_LAYERS", layerIds: ["a", "b", "c"], axis: "horizontal" },
    "2026-08-29T00:02:00.000Z",
  );
  assert.equal(distributed.version, 2);
  assert.equal(layer(distributed, "a").x, 100);
  assert.equal(layer(distributed, "b").x, 350);
  assert.equal(layer(distributed, "c").x, 600);
});

test("grouping creates a validated selection container and moving it translates every child", () => {
  const grouped = applyDesignOperation(
    documentFixture(),
    { type: "GROUP_LAYERS", layerIds: ["a", "b"], groupLayerId: "group-1", name: "Offer block" },
    "2026-08-29T00:03:00.000Z",
  );
  const group = layer(grouped, "group-1");
  assert.equal(group.type, "group");
  assert.deepEqual(group.type === "group" ? group.childLayerIds : [], ["a", "b"]);
  assert.deepEqual({ x: group.x, y: group.y, width: group.width, height: group.height }, { x: 100, y: 100, width: 300, height: 200 });

  const moved = applyDesignOperation(
    grouped,
    { type: "MOVE_LAYER", layerId: "group-1", x: 200, y: 250 },
    "2026-08-29T00:04:00.000Z",
  );
  assert.deepEqual({ x: layer(moved, "a").x, y: layer(moved, "a").y }, { x: 200, y: 250 });
  assert.deepEqual({ x: layer(moved, "b").x, y: layer(moved, "b").y }, { x: 400, y: 350 });
  assert.deepEqual({ x: layer(moved, "group-1").x, y: layer(moved, "group-1").y }, { x: 200, y: 250 });

  const ungrouped = applyDesignOperation(
    moved,
    { type: "UNGROUP_LAYERS", layerId: "group-1" },
    "2026-08-29T00:05:00.000Z",
  );
  assert.equal(ungrouped.layers.some((candidate) => candidate.id === "group-1"), false);
  assert.deepEqual({ x: layer(ungrouped, "a").x, y: layer(ungrouped, "a").y }, { x: 200, y: 250 });
  assert.deepEqual({ x: layer(ungrouped, "b").x, y: layer(ungrouped, "b").y }, { x: 400, y: 350 });
});

test("multi-layer movement creates one revision and group membership prevents ambiguous regrouping", () => {
  const moved = applyDesignOperation(
    documentFixture(),
    { type: "MOVE_LAYERS", layerIds: ["a", "b", "c"], deltaX: 25, deltaY: -15 },
    "2026-08-29T00:06:00.000Z",
  );
  assert.equal(moved.version, 2);
  assert.deepEqual({ x: layer(moved, "a").x, y: layer(moved, "a").y }, { x: 125, y: 85 });
  assert.deepEqual({ x: layer(moved, "c").x, y: layer(moved, "c").y }, { x: 625, y: 285 });

  const grouped = applyDesignOperation(documentFixture(), { type: "GROUP_LAYERS", layerIds: ["a", "b"], groupLayerId: "group-1" });
  assert.throws(
    () => applyDesignOperation(grouped, { type: "GROUP_LAYERS", layerIds: ["b", "c"], groupLayerId: "group-2" }),
    /already belongs to group-1/,
  );
});

test("runtime operation parser validates multi-layer operation shapes", () => {
  assert.deepEqual(
    parseDesignOperation({ type: "ALIGN_LAYERS", layerIds: ["a", "b"], alignment: "horizontal-center" }),
    { type: "ALIGN_LAYERS", layerIds: ["a", "b"], alignment: "horizontal-center" },
  );
  assert.deepEqual(
    parseDesignOperation({ type: "MOVE_LAYERS", layerIds: ["a", "b"], deltaX: 10, deltaY: -5 }),
    { type: "MOVE_LAYERS", layerIds: ["a", "b"], deltaX: 10, deltaY: -5 },
  );
  assert.throws(
    () => parseDesignOperation({ type: "DISTRIBUTE_LAYERS", layerIds: ["a", "b", "c"], axis: "diagonal" }),
    /operation\.axis is invalid/,
  );
});
