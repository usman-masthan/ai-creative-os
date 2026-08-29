import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { DesignQaResult } from "../src/creativeStudio/designQa.js";
import { assertApprovedExportEligible } from "../src/creativeStudio/exportGovernance.js";
import {
  CreativeStudioGovernanceStore,
  type DesignApprovalRecord,
  type FinalVisualQaRecord,
} from "../src/creativeStudio/governanceStore.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { FinalArtQaResult } from "../src/finalArtQa/types.js";

function document(version: number): DesignDocument {
  const at = "2026-08-28T18:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "approval-design",
    version,
    campaignId: "approval-campaign",
    truthSnapshotId: "task:approval",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [],
    history: [{ version, createdAt: at, summary: "Approval test", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

function deterministic(decision: DesignQaResult["decision"]): DesignQaResult {
  return {
    checkedAt: "2026-08-28T18:01:00.000Z",
    decision,
    issues: decision === "BLOCK"
      ? [{ code: "BLOCK", severity: "HIGH", message: "blocked", blocker: true }]
      : [],
    scores: { structure: 10, brand: 10, layout: 10, factual: 10 },
  };
}

function visualResult(decision: FinalArtQaResult["decision"]): FinalArtQaResult {
  const scores = {
    brandVisibility: 100,
    headlineHierarchy: 100,
    ctaHierarchyPlacement: 100,
    priceVisibility: 100,
    safeAreas: 100,
    contrastLegibility: 100,
    productDominance: 100,
    platformReadability: 100,
    decorativeCoherence: 100,
  };
  const checks = {
    brandVisibility: "PASS" as const,
    headlineHierarchy: "PASS" as const,
    ctaHierarchyPlacement: "PASS" as const,
    priceVisibility: "PASS" as const,
    safeAreas: "PASS" as const,
    contrastLegibility: "PASS" as const,
    productDominance: "PASS" as const,
    platformReadability: "PASS" as const,
    decorativeCoherence: "PASS" as const,
  };
  const evidenceItem = { status: "PASS" as const, observations: [] as string[] };
  return {
    provider: "mock-vision",
    model: "mock-model",
    decision,
    scores,
    checks,
    evidence: {
      brandVisibility: evidenceItem,
      headlineHierarchy: evidenceItem,
      ctaHierarchyPlacement: evidenceItem,
      priceVisibility: evidenceItem,
      safeAreas: evidenceItem,
      contrastLegibility: evidenceItem,
      productDominance: evidenceItem,
      platformReadability: evidenceItem,
      decorativeCoherence: evidenceItem,
    },
    issues: [],
    notes: [],
  };
}

function visual(version: number, decision: FinalArtQaResult["decision"] = "PASS"): FinalVisualQaRecord {
  return {
    schemaVersion: 1,
    designId: "approval-design",
    designVersion: version,
    checkedAt: "2026-08-28T18:02:00.000Z",
    deterministicDecision: "PASS",
    renderedPngPath: "/tmp/approval.png",
    result: visualResult(decision),
  };
}

function approval(version: number): DesignApprovalRecord {
  return {
    schemaVersion: 1,
    designId: "approval-design",
    designVersion: version,
    approvedAt: "2026-08-28T18:03:00.000Z",
    approvedBy: "creative-studio-user",
    deterministicDecision: "PASS",
    finalVisualQaDecision: "PASS",
  };
}

test("approved export requires PASS visual QA and explicit approval for the exact current version", () => {
  const eligible = assertApprovedExportEligible({
    document: document(3),
    deterministicQa: deterministic("PASS"),
    finalVisualQa: visual(3),
    approval: approval(3),
  });
  assert.equal(eligible.designVersion, 3);
  assert.equal(eligible.approvedBy, "creative-studio-user");

  assert.throws(
    () => assertApprovedExportEligible({
      document: document(4),
      deterministicQa: deterministic("PASS"),
      finalVisualQa: visual(3),
      approval: approval(3),
    }),
    /current design version has no final visual QA record/,
  );

  assert.throws(
    () => assertApprovedExportEligible({
      document: document(3),
      deterministicQa: deterministic("PASS"),
      finalVisualQa: visual(3, "HUMAN_REVIEW"),
      approval: approval(3),
    }),
    /final visual QA is HUMAN_REVIEW, not PASS/,
  );

  assert.throws(
    () => assertApprovedExportEligible({
      document: document(3),
      deterministicQa: deterministic("BLOCK"),
      finalVisualQa: visual(3),
      approval: approval(3),
    }),
    /deterministic QA has blocking issues/,
  );
});

test("governance store keeps final visual QA, approval and approved exports version-specific", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-studio-governance-"));
  try {
    const store = new CreativeStudioGovernanceStore(root);
    await store.saveFinalVisualQa(visual(2));
    await store.saveApproval(approval(2));
    await store.appendApprovedExport({
      schemaVersion: 1,
      designId: "approval-design",
      designVersion: 2,
      approvedAt: "2026-08-28T18:03:00.000Z",
      exportedAt: "2026-08-28T18:04:00.000Z",
      format: "png",
      preset: "high-resolution",
      path: "/tmp/approved.png",
      width: 2160,
      height: 2700,
    });

    assert.equal((await store.getFinalVisualQa("approval-design", 2))?.result.decision, "PASS");
    assert.equal((await store.getApproval("approval-design", 2))?.approvedBy, "creative-studio-user");
    assert.equal(await store.getApproval("approval-design", 3), undefined);
    const exports = await store.listApprovedExports("approval-design");
    assert.equal(exports.length, 1);
    assert.equal(exports[0]?.designVersion, 2);
    assert.equal(exports[0]?.preset, "high-resolution");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
