import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { FileCampaignStore } from "../src/operations/fileStore.js";
import { CampaignWorkflow } from "../src/operations/workflow.js";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "atthas-os-"));
  const store = new FileCampaignStore(root);
  const workflow = new CampaignWorkflow(store);
  await workflow.create({
    campaignId: "CAMP-001",
    brandId: "ATTHAS_BURGER",
    truthVersion: "truth-v1",
    brandVersion: "brand-v1",
    selectedConceptId: "C2",
    now: "2026-08-25T10:00:00.000Z",
  });
  return { root, store, workflow };
}

test("approval workflow enforces review roles and production evidence", async () => {
  const { root, store, workflow } = await fixture();
  try {
    await workflow.transition({ campaignId: "CAMP-001", to: "INTERNAL_REVIEW", actorId: "op", actorRole: "operator" });
    await workflow.transition({ campaignId: "CAMP-001", to: "CLIENT_REVIEW", actorId: "reviewer", actorRole: "internal_reviewer" });
    await assert.rejects(
      workflow.transition({ campaignId: "CAMP-001", to: "APPROVED", actorId: "op", actorRole: "operator" }),
      /Only a client or admin/,
    );
    await workflow.transition({ campaignId: "CAMP-001", to: "APPROVED", actorId: "client", actorRole: "client" });
    await assert.rejects(
      workflow.transition({ campaignId: "CAMP-001", to: "PRODUCTION_READY", actorId: "op", actorRole: "operator" }),
      /requires a final asset/,
    );
    await workflow.transition({
      campaignId: "CAMP-001",
      to: "PRODUCTION_READY",
      actorId: "op",
      actorRole: "operator",
      productionEvidence: { hasFinalAsset: true, visualQaPassed: true, finalArtQaPassed: true },
    });
    const snapshot = await store.getSnapshot("CAMP-001");
    assert.equal(snapshot?.campaign.state, "PRODUCTION_READY");
    assert.equal(snapshot?.events.length, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("revision history and assets retain truth and brand versions", async () => {
  const { root, store, workflow } = await fixture();
  try {
    const revision = await workflow.addRevision({
      campaignId: "CAMP-001",
      createdBy: "op",
      summary: "First governed draft",
      visualQaDecision: "PASS",
      finalArtQaDecision: "PASS",
      now: "2026-08-25T11:00:00.000Z",
    });
    assert.equal(revision.revision, 1);
    await workflow.addAsset({
      assetId: "ASSET-1",
      campaignId: "CAMP-001",
      revision: 1,
      kind: "poster",
      path: "outputs/poster.png",
      truthVersion: "truth-v1",
      brandVersion: "brand-v1",
      createdAt: "2026-08-25T11:01:00.000Z",
    });
    await assert.rejects(
      workflow.addAsset({
        assetId: "BAD",
        campaignId: "CAMP-001",
        revision: 1,
        kind: "poster",
        path: "bad.png",
        truthVersion: "truth-v2",
        brandVersion: "brand-v1",
        createdAt: "2026-08-25T11:02:00.000Z",
      }),
      /must match the campaign record/,
    );
    const snapshot = await store.getSnapshot("CAMP-001");
    assert.equal(snapshot?.campaign.currentRevision, 1);
    assert.equal(snapshot?.revisions[0]?.revisionId, "CAMP-001-R1");
    assert.equal(snapshot?.assets.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
