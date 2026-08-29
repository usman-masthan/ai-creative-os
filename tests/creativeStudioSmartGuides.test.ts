import assert from "node:assert/strict";
import test from "node:test";

import { computeSmartMoveSnap } from "../src/creativeStudio/smartGuides.js";

test("smart guides snap moving layer edges and centres to nearby layers", () => {
  const result = computeSmartMoveSnap({
    moving: { id: "moving", x: 95, y: 210, width: 100, height: 80 },
    others: [{ id: "target", x: 200, y: 100, width: 100, height: 120 }],
    deltaX: 4,
    deltaY: -10,
    tolerance: 8,
  });
  assert.equal(result.deltaX, 5);
  assert.equal(result.deltaY, -10);
  assert.ok(result.guides.some((guide) => guide.kind === "alignment" && guide.axis === "x" && guide.position === 200));
});

test("smart guides prefer an equal-gap snap when a moving layer is nearly centred between neighbours", () => {
  const result = computeSmartMoveSnap({
    moving: { id: "moving", x: 205, y: 100, width: 100, height: 80 },
    others: [
      { id: "left", x: 0, y: 100, width: 100, height: 80 },
      { id: "right", x: 400, y: 100, width: 100, height: 80 },
    ],
    deltaX: 0,
    deltaY: 0,
    tolerance: 10,
  });
  assert.equal(result.deltaX, -5);
  const spacing = result.guides.find((guide) => guide.kind === "spacing" && guide.axis === "horizontal");
  assert.ok(spacing && spacing.kind === "spacing");
  assert.equal(spacing.gap, 100);
  assert.deepEqual(spacing.neighborIds, ["left", "right"]);
});

test("smart-guide math fails closed on invalid movement values", () => {
  assert.throws(
    () => computeSmartMoveSnap({
      moving: { id: "moving", x: 0, y: 0, width: 100, height: 100 },
      others: [],
      deltaX: Number.NaN,
      deltaY: 0,
      tolerance: 8,
    }),
    /Smart-guide movement values/,
  );
});
