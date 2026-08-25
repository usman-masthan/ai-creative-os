import assert from "node:assert/strict";
import test from "node:test";

import { assertCampaignSpendAllowed, evaluateCampaignSpend } from "../src/spendLedger.js";
import type { CampaignSpendEntry } from "../src/operations/types.js";

const existing: CampaignSpendEntry[] = [
  {
    spendId: "1",
    campaignId: "C1",
    createdAt: "2026-08-25T00:00:00Z",
    category: "image",
    provider: "gemini",
    model: "image-model",
    amountUsd: 0.04,
  },
  {
    spendId: "2",
    campaignId: "C1",
    createdAt: "2026-08-25T00:00:01Z",
    category: "text",
    provider: "gemini",
    model: "text-model",
    amountUsd: 0.01,
  },
];

test("spend ledger blocks campaign and category cap overruns", () => {
  const decision = evaluateCampaignSpend(
    existing,
    { category: "image", amountUsd: 0.08 },
    { campaignCapUsd: 0.2, imageCapUsd: 0.1 },
  );
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(" "), /Image cap exceeded/);
});

test("spend ledger requires explicit approval above threshold", () => {
  assert.throws(
    () =>
      assertCampaignSpendAllowed(
        existing,
        { category: "video", amountUsd: 0.5 },
        { campaignCapUsd: 1, videoCapUsd: 0.8, premiumSingleActionApprovalUsd: 0.25 },
      ),
    /requires explicit approval/,
  );
  const approved = assertCampaignSpendAllowed(
    existing,
    { category: "video", amountUsd: 0.5 },
    { campaignCapUsd: 1, videoCapUsd: 0.8, premiumSingleActionApprovalUsd: 0.25 },
    true,
  );
  assert.equal(approved.allowed, true);
});
