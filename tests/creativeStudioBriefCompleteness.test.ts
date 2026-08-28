import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCreativeBrief,
  type CreativeBrief,
} from "../src/creativeStudio/contracts/creativeBrief.js";
import { createCreativeOrchestrationPlan } from "../src/creativeStudio/orchestrator.js";
import { creativeStudioProfiledHtml } from "../src/dashboard/creativeStudioProfiledHtml.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

const createdAt = "2026-08-29T00:30:00.000Z";

function completeBrief(): CreativeBrief {
  return {
    schemaVersion: 1,
    id: "brief-complete-intake",
    clientId: "T001",
    brandId: "ATTHAS_BURGER",
    goal: "Special offer",
    description: "Promote the Chicken Tikka Wrap campaign.",
    product: { id: "Chicken Tikka Wrap", name: "Chicken Tikka Wrap" },
    branchId: "BURGER_WELLAMPITIYA",
    salesChannel: "DINE_IN",
    audience: ["students", "Gen Z"],
    vibe: ["bold", "premium"],
    format: { preset: "instagram-portrait", width: 1080, height: 1350 },
    contentRequirements: {
      showPrice: true,
      showOffer: true,
      showCTA: true,
      showProductName: true,
      showBranch: true,
      showContactDetails: true,
      showCampaignDates: true,
      headlineDirection: "Short, bold and craving-led",
      customInstructions: "Keep the composition restrained and premium",
    },
    brandKitId: "ATTHAS_WORKING_V1",
    truthSnapshotId: "task:brief-complete-truth",
    createdAt,
  };
}

function snapshot(): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "brief-complete-truth",
    campaignId: "campaign-complete-intake",
    tenantId: "T001" as TaskTruthSnapshot["tenantId"],
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    confirmedBy: "creative-studio-user",
    confirmedAt: "2026-08-29T00:31:00.000Z",
    facts: [
      {
        label: "offerTerms|branch=BURGER_WELLAMPITIYA",
        key: "offerTerms",
        value: "Owner-confirmed offer terms",
        scope: {
          tenantId: "T001" as TaskTruthSnapshot["tenantId"],
          brandId: "ATTHAS_BURGER",
          branchId: "BURGER_WELLAMPITIYA",
        },
        confirmationAction: "PROVIDE",
        updateStoredTruthRequested: false,
      },
    ],
  };
}

test("active Studio exposes every CreativeBrief content requirement as an explicit control", () => {
  const html = creativeStudioProfiledHtml();
  for (const id of [
    "showPrice",
    "showOffer",
    "showProduct",
    "showBranch",
    "showCta",
    "showContactDetails",
    "showCampaignDates",
    "headlineDirection",
    "customInstructions",
  ]) {
    assert.match(html, new RegExp(`id=\\"${id}\\"`));
  }

  assert.match(html, /showOffer:\$\('showOffer'\)\.checked\|\|\$\('goal'\)\.value\.toLowerCase\(\)\.indexOf\('offer'\)>=0/);
  assert.match(html, /showContactDetails:\$\('showContactDetails'\)\.checked/);
  assert.match(html, /showCampaignDates:\$\('showCampaignDates'\)\.checked/);
  assert.match(html, /headlineDirection:\$\('headlineDirection'\)\.value\.trim\(\)\|\|undefined/);
  assert.match(html, /customInstructions:\$\('customInstructions'\)\.value\.trim\(\)\|\|undefined/);
  assert.match(html, /campaignType\(brief\.goal,product,brief\.contentRequirements\.showOffer\)/);
  assert.match(html, /show only a confirmed offer/);
  assert.match(html, /include only confirmed branch contact details/);
  assert.match(html, /include only confirmed campaign dates/);
});

test("CreativeBrief normalization preserves explicit content direction", () => {
  const normalized = assertCreativeBrief({
    ...completeBrief(),
    contentRequirements: {
      ...completeBrief().contentRequirements,
      headlineDirection: "  Short, bold and craving-led  ",
      customInstructions: "  Keep the composition restrained and premium  ",
    },
  });

  assert.equal(normalized.contentRequirements.showOffer, true);
  assert.equal(normalized.contentRequirements.showContactDetails, true);
  assert.equal(normalized.contentRequirements.showCampaignDates, true);
  assert.equal(normalized.contentRequirements.headlineDirection, "Short, bold and craving-led");
  assert.equal(normalized.contentRequirements.customInstructions, "Keep the composition restrained and premium");
});

test("Creative Orchestrator carries the complete content requirement set into creative strategy", () => {
  const plan = createCreativeOrchestrationPlan({
    campaignId: "campaign-complete-intake",
    brief: completeBrief(),
    truthSnapshot: snapshot(),
    createdAt: "2026-08-29T00:32:00.000Z",
  });

  assert.deepEqual(plan.creativeStrategy.contentRequirements, completeBrief().contentRequirements);
  assert.equal(plan.creativeStrategy.contentRequirements.showOffer, true);
  assert.equal(plan.creativeStrategy.contentRequirements.showContactDetails, true);
  assert.equal(plan.creativeStrategy.contentRequirements.showCampaignDates, true);
  assert.equal(plan.creativeStrategy.contentRequirements.headlineDirection, "Short, bold and craving-led");
  assert.equal(plan.creativeStrategy.contentRequirements.customInstructions, "Keep the composition restrained and premium");
});
