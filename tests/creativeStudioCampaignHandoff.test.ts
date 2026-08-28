import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { handoffApprovedDesignToCampaign } from "../src/creativeStudio/campaignHandoff.js";
import { CreativeStudioGovernanceStore } from "../src/creativeStudio/governanceStore.js";
import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { FinalArtQaResult } from "../src/finalArtQa/types.js";
import { FileCampaignStore } from "../src/operations/fileStore.js";
import { CampaignWorkflow } from "../src/operations/workflow.js";

function passFinalArt(): FinalArtQaResult {
  return {
    provider: "mock",
    model: "mock",
    decision: "PASS",
    scores: {
      brandVisibility: 100, headlineHierarchy: 100, ctaHierarchyPlacement: 100,
      priceVisibility: 100, safeAreas: 100, contrastLegibility: 100,
      productDominance: 100, platformReadability: 100, decorativeCoherence: 100,
    },
    checks: {
      brandVisibility: "PASS", headlineHierarchy: "PASS", ctaHierarchyPlacement: "PASS",
      priceVisibility: "PASS", safeAreas: "PASS", contrastLegibility: "PASS",
      productDominance: "PASS", platformReadability: "PASS", decorativeCoherence: "PASS",
    },
    evidence: {
      brandVisibility: { status: "PASS", observations: [] },
      headlineHierarchy: { status: "PASS", observations: [] },
      ctaHierarchyPlacement: { status: "PASS", observations: [] },
      priceVisibility: { status: "PASS", observations: [] },
      safeAreas: { status: "PASS", observations: [] },
      contrastLegibility: { status: "PASS", observations: [] },
      productDominance: { status: "PASS", observations: [] },
      platformReadability: { status: "PASS", observations: [] },
      decorativeCoherence: { status: "PASS", observations: [] },
    },
    issues: [],
    notes: [],
  };
}

test("approved Studio export registers as a campaign asset/revision without changing lifecycle state", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-studio-handoff-"));
  try {
    const campaigns = new FileCampaignStore(root);
    const workflow = new CampaignWorkflow(campaigns);
    await workflow.create({
      campaignId: "campaign-handoff",
      brandId: "ATTHAS_BURGER",
      truthVersion: "TASK:handoff-session",
      brandVersion: "ATTHAS_WORKING_V1",
      now: "2026-08-28T18:00:00.000Z",
    });

    const document: DesignDocument = {
      schemaVersion: 1,
      id: "design-handoff",
      version: 1,
      campaignId: "campaign-handoff",
      truthSnapshotId: "task:handoff-session",
      artboard: { width: 1080, height: 1350, background: "#820008" },
      brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
      layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
      layers: [],
      history: [{ version: 1, createdAt: "2026-08-28T18:00:00.000Z", summary: "Initial", actor: "system" }],
      createdAt: "2026-08-28T18:00:00.000Z",
      updatedAt: "2026-08-28T18:00:00.000Z",
    };
    const projects = new FileDesignProjectStore(root);
    await projects.create({ document });

    const governance = new CreativeStudioGovernanceStore(root);
    await governance.saveFinalVisualQa({
      schemaVersion: 1,
      designId: document.id,
      designVersion: 1,
      checkedAt: "2026-08-28T18:01:00.000Z",
      deterministicDecision: "PASS",
      renderedPngPath: "/tmp/final-qa.png",
      result: passFinalArt(),
    });
    await governance.saveApproval({
      schemaVersion: 1,
      designId: document.id,
      designVersion: 1,
      approvedAt: "2026-08-28T18:02:00.000Z",
      approvedBy: "studio-reviewer",
      deterministicDecision: "PASS",
      finalVisualQaDecision: "PASS",
    });
    await governance.appendApprovedExport({
      schemaVersion: 1,
      designId: document.id,
      designVersion: 1,
      approvedAt: "2026-08-28T18:02:00.000Z",
      exportedAt: "2026-08-28T18:03:00.000Z",
      format: "png",
      preset: "standard",
      path: "/tmp/design-approved.png",
      width: 1080,
      height: 1350,
    });

    const result = await handoffApprovedDesignToCampaign({
      rootDir: root,
      designId: document.id,
      registeredBy: "studio-reviewer",
      now: "2026-08-28T18:04:00.000Z",
    });
    assert.equal(result.alreadyRegistered, false);
    assert.equal(result.campaignState, "DRAFT");

    const snapshot = await campaigns.getSnapshot("campaign-handoff");
    assert.ok(snapshot);
    assert.equal(snapshot.campaign.state, "DRAFT");
    assert.equal(snapshot.campaign.currentRevision, 1);
    assert.equal(snapshot.assets.length, 1);
    assert.equal(snapshot.revisions.length, 1);
    assert.equal(snapshot.assets[0]?.metadata?.studioApprovedAsset, true);
    assert.equal(snapshot.assets[0]?.metadata?.designId, "design-handoff");
    assert.equal(snapshot.assets[0]?.truthVersion, "TASK:handoff-session");
    assert.equal(snapshot.revisions[0]?.finalArtQaDecision, "PASS");

    const second = await handoffApprovedDesignToCampaign({
      rootDir: root,
      designId: document.id,
      registeredBy: "studio-reviewer",
      now: "2026-08-28T18:05:00.000Z",
    });
    assert.equal(second.alreadyRegistered, true);
    const afterSecond = await campaigns.getSnapshot("campaign-handoff");
    assert.equal(afterSecond?.assets.length, 1);
    assert.equal(afterSecond?.revisions.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
