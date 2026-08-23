import assert from "node:assert/strict";
import test from "node:test";

import { resolveTruth } from "../src/truthResolver.js";
import type { TruthRecord } from "../src/types.js";

const uberPrice: TruthRecord = {
  key: "price",
  value: 950,
  status: "SOURCE_VERIFIED",
  sourceId: "UBER_BURGER_WELLAMPITIYA",
  scope: {
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    productId: "CRISPY_CHICKEN_BURGER",
    salesChannel: "UBER_EATS",
  },
};

test("does not treat an external platform price as official by default", () => {
  const result = resolveTruth({
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    requirements: [
      { key: "price", productId: "CRISPY_CHICKEN_BURGER", salesChannel: "UBER_EATS" },
    ],
    records: [uberPrice],
  });

  assert.equal(result.pass, false);
  assert.equal(result.missing.length, 1);
});

test("allows a source-verified fact for an explicitly platform-specific campaign", () => {
  const result = resolveTruth({
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    requirements: [
      { key: "price", productId: "CRISPY_CHICKEN_BURGER", salesChannel: "UBER_EATS" },
    ],
    records: [uberPrice],
    allowSourceVerified: true,
  });

  assert.equal(result.pass, true);
  assert.equal(result.facts[0]?.value, 950);
  assert.equal(result.facts[0]?.status, "SOURCE_VERIFIED");
});

test("blocks a fact explicitly marked as conflicting", () => {
  const conflict: TruthRecord = {
    key: "openingHours",
    value: null,
    status: "CONFLICT_REQUIRES_CONFIRMATION",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_DEHIWALA",
    },
  };

  const result = resolveTruth({
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_DEHIWALA",
    requirements: [{ key: "openingHours" }],
    records: [conflict],
    allowSourceVerified: true,
  });

  assert.equal(result.pass, false);
  assert.deepEqual(result.conflicts, ["openingHours"]);
});
