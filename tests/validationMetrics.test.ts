import assert from "node:assert/strict";
import test from "node:test";

import { computeAtthasValidationMetrics } from "../src/validationMetrics.js";
import type { CampaignSnapshot } from "../src/operations/types.js";

const snapshot: CampaignSnapshot = {
  campaign: {
    campaignId: "C1",
    brandId: "ATTHAS_BURGER",
    state: "PRODUCTION_READY",
    truthVersion: "t1",
    brandVersion: "b1",
    currentRevision: 1,
    createdAt: "2026-08-25T00:00:00Z",
    updatedAt: "2026-08-25T01:00:00Z",
  },
  revisions: [{
    revisionId: "C1-R1",
    campaignId: "C1",
    revision: 1,
    createdAt: "2026-08-25T01:00:00Z",
    createdBy: "op",
    summary: "ready",
    assetIds: ["A1"],
    visualQaDecision: "PASS",
    finalArtQaDecision: "PASS",
  }],
  events: [],
  assets: [],
  spend: [{
    spendId: "S1",
    campaignId: "C1",
    createdAt: "2026-08-25T00:30:00Z",
    category: "image",
    provider: "gemini",
    model: "image",
    amountUsd: 0.05,
  }],
  publications: [],
  performance: [],
};

test("validation metrics summarize production readiness and spend", () => {
  const metrics = computeAtthasValidationMetrics([snapshot]);
  assert.equal(metrics.campaigns, 1);
  assert.equal(metrics.productionReadyRate, 1);
  assert.equal(metrics.totalSpendUsd, 0.05);
  assert.equal(metrics.visualQaPassRevisions, 1);
  assert.equal(metrics.finalArtQaPassRevisions, 1);
});
