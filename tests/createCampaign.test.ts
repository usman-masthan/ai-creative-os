import assert from "node:assert/strict";
import test from "node:test";

import { createCampaignPreflight } from "../src/commands/createCampaign.js";
import type { TruthRecord } from "../src/types.js";

const records: TruthRecord[] = [
  {
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
  },
];

test("blocks a general campaign from silently using an Uber Eats price", () => {
  const result = createCampaignPreflight({
    campaignId: "T001-C001",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    objective: "Promote Crispy Chicken Burger",
    channel: "instagram",
    assetType: "poster",
    requirements: [
      { key: "price", productId: "CRISPY_CHICKEN_BURGER", salesChannel: "UBER_EATS" },
    ],
    truthRecords: records,
  });

  assert.equal(result.status, "BLOCKED_MISSING_VERIFIED_DATA");
  assert.equal(result.factGate, "FAIL");
});

test("passes the same price for an explicitly Uber Eats campaign", () => {
  const result = createCampaignPreflight({
    campaignId: "T001-C002",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    objective: "Promote Crispy Chicken Burger on Uber Eats",
    channel: "instagram",
    assetType: "poster",
    requirements: [
      { key: "price", productId: "CRISPY_CHICKEN_BURGER", salesChannel: "UBER_EATS" },
    ],
    truthRecords: records,
    allowSourceVerified: true,
  });

  assert.equal(result.status, "READY_FOR_CREATIVE");
  assert.equal(result.factGate, "PASS");
  assert.equal(result.riskLevel, "low");
});
