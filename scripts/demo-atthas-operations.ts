import { randomUUID } from "node:crypto";

import { FileCampaignStore } from "../src/operations/fileStore.js";
import { CampaignWorkflow } from "../src/operations/workflow.js";
import { assertCampaignSpendAllowed } from "../src/spendLedger.js";

const rootDir = process.env.ATTHAS_STORE_DIR?.trim() || ".atthas-os";
const store = new FileCampaignStore(rootDir);
const workflow = new CampaignWorkflow(store);
const campaignId = process.env.OPS_CAMPAIGN_ID?.trim() || `ATTHAS-OPS-${Date.now()}`;

await workflow.create({
  campaignId,
  brandId: "ATTHAS_BURGER",
  truthVersion: "owner-branch-master-2026-08-25",
  brandVersion: "atthas-brand-v0.1",
  selectedConceptId: "C2",
});
await workflow.addRevision({
  campaignId,
  createdBy: "operator",
  summary: "Initial governed creative draft",
  visualQaDecision: "PASS",
  finalArtQaDecision: "PASS",
});
await workflow.transition({ campaignId, to: "INTERNAL_REVIEW", actorId: "operator", actorRole: "operator" });
await workflow.transition({ campaignId, to: "CLIENT_REVIEW", actorId: "reviewer", actorRole: "internal_reviewer" });
await workflow.transition({ campaignId, to: "APPROVED", actorId: "atthas-client", actorRole: "client" });

const snapshotBeforeSpend = await store.getSnapshot(campaignId);
const spend = {
  spendId: randomUUID(),
  campaignId,
  createdAt: new Date().toISOString(),
  category: "image" as const,
  provider: "gemini",
  model: "gemini-3.1-flash-lite-image",
  amountUsd: 0.0336,
  description: "Draft image generation",
};
assertCampaignSpendAllowed(snapshotBeforeSpend?.spend ?? [], spend, {
  campaignCapUsd: 1,
  imageCapUsd: 0.25,
  videoCapUsd: 0.5,
  premiumSingleActionApprovalUsd: 0.25,
});
await workflow.addSpend(spend);

console.log(JSON.stringify(await store.getSnapshot(campaignId), null, 2));
console.error(`Persisted ATTHA’S operations demo to ${rootDir}`);
