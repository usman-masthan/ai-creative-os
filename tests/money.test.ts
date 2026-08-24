import assert from "node:assert/strict";
import test from "node:test";

import { buildLkrOverlay, formatLkr } from "../src/money.js";

test("formats LKR prices deterministically", () => {
  assert.equal(formatLkr(950), "LKR 950");
  assert.equal(formatLkr(1250), "LKR 1,250");
});

test("builds structured LKR overlay metadata", () => {
  assert.deepEqual(buildLkrOverlay(950), {
    amount: 950,
    currency: "LKR",
    display: "LKR 950",
  });
});
