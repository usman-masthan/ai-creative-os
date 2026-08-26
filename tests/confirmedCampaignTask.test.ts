import assert from "node:assert/strict";
import test from "node:test";

import { runConfirmedCampaignTask } from "../src/commands/runConfirmedCampaignTask.js";
import type { ProducePlannedCampaignRequest } from "../src/commands/producePlannedCampaign.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";

const neverProvider: CampaignGenerationProvider = {
  providerName: "never",
  model: "never",
  async generate() {
    throw new Error("AI must not run before task truth confirmation");
  },
};

function request(): ProducePlannedCampaignRequest {
  return {
    campaignId: "TASK-1",
    entry: {
      slotId: "S01",
      date: "2026-09-01",
      brandId: "ATTHAS_BURGER",
      branchScope: "BURGER_WELLAMPITIYA",
      campaignType: "DINE_IN",
      objective: "Increase dine-in visits",
      audience: "Nearby diners",
      channel: "instagram",
      assetType: "poster",
      priority: "P1",
      conceptDirection: "Branch-led dine-in invitation",
      additionalTruthNeeded: [],
      requiredTruth: ["branchPhysicalAddress", "physicalOpeningHours"],
      missingTruth: [],
      truthReadiness: "READY_WITH_CURRENT_TRUTH",
    },
    truthRecords: [
      {
        key: "branchPhysicalAddress",
        value: "Urban City Food Court, Ambagaha Junction Rd, Kotikawatta",
        status: "VERIFIED",
        scope: {
          tenantId: "T001",
          brandId: "ATTHAS_BURGER",
          branchId: "BURGER_WELLAMPITIYA",
        },
      },
      {
        key: "physicalOpeningHours",
        value: "17:00-00:00",
        status: "VERIFIED",
        scope: {
          tenantId: "T001",
          brandId: "ATTHAS_BURGER",
          branchId: "BURGER_WELLAMPITIYA",
        },
      },
    ],
    brandContext: "ATTHA'S Burger",
    providers: {
      generation: neverProvider,
      director: neverProvider,
      finalizer: neverProvider,
    },
    outputDir: "unused-before-confirmation",
  };
}

test("user-facing campaign gateway asks for all task facts before any AI production", async () => {
  const result = await runConfirmedCampaignTask({
    productionRequest: request(),
    sessionId: "TASK-SESSION-1",
  });

  assert.equal(result.status, "TASK_CONFIRMATION_REQUIRED");
  if (result.status !== "TASK_CONFIRMATION_REQUIRED") return;
  assert.equal(result.questionnaire.questions.length, 2);
  assert.equal(
    result.questionnaire.questions.every((question) => question.kind === "CONFIRM_STORED"),
    true,
  );
  assert.deepEqual(
    result.questionnaire.questions.map((question) => question.requirement.key).sort(),
    ["branchPhysicalAddress", "physicalOpeningHours"].sort(),
  );
});
