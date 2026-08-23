import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCampaignReadiness } from "../src/orchestrator.js";

test("passes a commercial campaign when required facts are verified", () => {
  const result = evaluateCampaignReadiness({
    campaignId: "C001",
    tenantId: "T001",
    brandId: "ATTHAS_RESTAURANT",
    objective: "Promote a verified menu item",
    channel: "instagram",
    assetType: "poster",
    requiredFactKeys: ["itemName", "price"],
    facts: [
      { key: "itemName", value: "Example item", verified: true },
      { key: "price", value: 1000, verified: true },
    ],
  });

  assert.equal(result.factGate.pass, true);
  assert.equal(result.canContinue, true);
  assert.equal(result.riskLevel, "low");
});

test("blocks a campaign when a required price is missing", () => {
  const result = evaluateCampaignReadiness({
    campaignId: "C002",
    tenantId: "T002",
    brandId: "SKK_MEAT_GOODIES",
    objective: "Product promotion",
    channel: "facebook",
    assetType: "poster",
    requiredFactKeys: ["productName", "price"],
    facts: [
      { key: "productName", value: "Example product", verified: true },
    ],
  });

  assert.equal(result.factGate.pass, false);
  assert.deepEqual(result.factGate.missing, ["price"]);
  assert.equal(result.canContinue, false);
});

test("treats sensitive Lifeline content as high risk requiring approval", () => {
  const result = evaluateCampaignReadiness({
    campaignId: "C003",
    tenantId: "T003",
    brandId: "LIFELINE",
    objective: "Humanitarian story",
    channel: "instagram",
    assetType: "story",
    requiredFactKeys: ["projectName"],
    facts: [
      { key: "projectName", value: "Verified project", verified: true },
    ],
    sensitiveStory: true,
  });

  assert.equal(result.factGate.pass, true);
  assert.equal(result.riskLevel, "high");
  assert.equal(result.humanApprovalRequired, true);
});

test("rejects cross-tenant brand usage", () => {
  assert.throws(
    () =>
      evaluateCampaignReadiness({
        campaignId: "C004",
        tenantId: "T001",
        brandId: "LIFELINE",
        objective: "Invalid test",
        channel: "instagram",
        assetType: "poster",
        requiredFactKeys: [],
        facts: [],
      }),
    /TENANT_ISOLATION_VIOLATION/,
  );
});
