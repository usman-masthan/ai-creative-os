import assert from "node:assert/strict";
import test from "node:test";

import { generateCampaign } from "../src/commands/generateCampaign.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import type { TruthRecord } from "../src/types.js";

test("unconfirmed claim language in the user brief stops before any AI generation call", async () => {
  let called = false;
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-model",
    async generate() {
      called = true;
      return "{}";
    },
  };
  const truthRecords: TruthRecord[] = [
    {
      key: "productName",
      value: "Chicken Tikka Wrap",
      status: "VERIFIED",
      sourceId: "TASK_CONFIRMATION:test",
      scope: {
        tenantId: "T001",
        brandId: "ATTHAS_RESTAURANT",
        branchId: "RESTAURANT_COLOMBO_06",
        productId: "Chicken Tikka Wrap",
      },
    },
  ];

  await assert.rejects(
    () => generateCampaign({
      campaignId: "TEST-BRIEF-CLAIM-GUARD",
      tenantId: "T001",
      brandId: "ATTHAS_RESTAURANT",
      branchId: "RESTAURANT_COLOMBO_06",
      objective: "Promote Chicken Tikka Wrap with lettuce and tomato.",
      channel: "instagram",
      assetType: "poster",
      requirements: [
        {
          key: "productName",
          branchId: "RESTAURANT_COLOMBO_06",
          productId: "Chicken Tikka Wrap",
        },
      ],
      truthRecords,
      brandContext: "ATTHA'S Restaurant working brand context.",
      maxRepairAttempts: 2,
    }, provider),
    /unconfirmed product\/service claim or depiction \"lettuce\"/i,
  );

  assert.equal(called, false);
});
