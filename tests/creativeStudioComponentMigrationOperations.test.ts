import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AiTraceSession } from "../src/aiTrace.js";
import { createReusableComponent, instantiateReusableComponent } from "../src/creativeStudio/componentLibrary.js";
import { FileCreativeComponentLifecycleStore } from "../src/creativeStudio/componentLifecycle.js";
import { FileCreativeComponentMigrationPlanner } from "../src/creativeStudio/componentMigration.js";
import { FileCreativeComponentMigrationOperations } from "../src/creativeStudio/componentMigrationOperations.js";
import { CreativeStudioGovernanceStore } from "../src/creativeStudio/governanceStore.js";
import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import { DesignVersionService } from "../src/creativeStudio/versioning.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function truth(campaignId: string, sessionId: string, productName: string, price: number): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId,
    campaignId,
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "migration-operations-test",
    confirmedAt: "2026-08-29T07:00:00.000Z",
    facts: [
      {
        label: `productName:${productName}`,
        key: "productName",
        value: productName,
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", productId: productName },
        confirmationAction: "CONFIRM",
        updateStoredTruthRequested: false,
      },
      {
        label: `price:${price}`,
        key: "price",
        value: price,
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", salesChannel: "DINE_IN" },
        confirmationAction: "CONFIRM",
        updateStoredTruthRequested: false,
      },
    ],
  };
}

function document(input: {
  id: string;
  campaignId: string;
  sessionId: string;
  headline: string;
  price: string;
  includeGroup: boolean;
}): DesignDocument {
  const at = "2026-08-29T07:00:00.000Z";
  const layers: DesignDocument["layers"] = [
    { id: `${input.id}-background`, name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
    { id: `${input.id}-headline`, name: "Headline", type: "text", x: 90, y: 140, width: 520, height: 140, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: true, text: input.headline, role: "headline", fontFamily: "Oswald", fontSize: 70, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0, align: "left", fill: "#FFFFFF" },
    { id: `${input.id}-badge`, name: "Badge", type: "shape", shape: "rect", x: 80, y: 310, width: 330, height: 135, rotation: 0, opacity: 1, zIndex: 15, visible: true, locked: false, aiEditable: false, fill: "#B50008", cornerRadius: 16 },
    { id: `${input.id}-price`, name: "Price", type: "text", x: 100, y: 325, width: 280, height: 95, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: false, text: input.price, role: "price", fontFamily: "Oswald", fontSize: 56, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#FFD21A" },
    { id: `${input.id}-logo`, name: "Approved Logo", type: "logo", x: 875, y: 70, width: 110, height: 110, rotation: 0, opacity: 1, zIndex: 100, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand" }, preserveAspectRatio: true, clearSpacePx: 20 },
  ];
  if (input.includeGroup) {
    layers.push({ id: `${input.id}-group`, name: "Promo Block", type: "group", x: 80, y: 140, width: 530, height: 305, rotation: 0, opacity: 1, zIndex: 30, visible: true, locked: false, aiEditable: false, childLayerIds: [`${input.id}-headline`, `${input.id}-badge`, `${input.id}-price`] });
  }
  return {
    schemaVersion: 1,
    id: input.id,
    version: 1,
    campaignId: input.campaignId,
    truthSnapshotId: `task:${input.sessionId}`,
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers,
    history: [{ version: 1, createdAt: at, summary: "Fixture", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

async function persistTruth(root: string, snapshot: TaskTruthSnapshot): Promise<void> {
  const trace = new AiTraceSession(snapshot.campaignId, "2026-08-29T07:00:00.000Z");
  trace.setTruth({ snapshot });
  await trace.persist(join(root, "outputs", snapshot.campaignId));
}

async function fixture(root: string, designId: string) {
  const sourceTruth = truth("source-campaign", "source-session", "Source Burger", 1000);
  const source = document({ id: "source-design", campaignId: "source-campaign", sessionId: "source-session", headline: "Source Burger", price: "LKR 1,000", includeGroup: true });
  const componentV1 = createReusableComponent({
    document: source,
    sourceTruth,
    groupLayerId: "source-design-group",
    componentId: "promo-block",
    name: "Promo Block",
    createdAt: "2026-08-29T07:00:00.000Z",
  });
  const lifecycle = new FileCreativeComponentLifecycleStore(root);
  await lifecycle.components.save(componentV1);
  await lifecycle.registerInitial(componentV1);
  const versioned = await lifecycle.duplicateAsNewVersion({
    clientId: "T001",
    brandId: "ATTHAS_BURGER",
    componentId: componentV1.id,
    createdAt: "2026-08-29T07:01:00.000Z",
  });

  const campaignId = `campaign-${designId}`;
  const sessionId = `session-${designId}`;
  const snapshot = truth(campaignId, sessionId, `${designId} Burger`, 1550);
  await persistTruth(root, snapshot);
  const base = document({ id: designId, campaignId, sessionId, headline: `${designId} Burger`, price: "LKR 1,550", includeGroup: false });
  const withInstance = instantiateReusableComponent({
    document: base,
    destinationTruth: snapshot,
    component: componentV1,
    instanceId: `${designId}-instance`,
    timestamp: "2026-08-29T07:02:00.000Z",
  });
  const projects = new FileDesignProjectStore(root);
  await projects.create({ document: withInstance });
  const planner = new FileCreativeComponentMigrationPlanner(root);
  const plan = await planner.createPlan({
    family: versioned.family,
    targetComponent: versioned.component,
    targetVersion: 2,
    createdAt: "2026-08-29T07:03:00.000Z",
  });
  const item = plan.eligibleDesigns.find((entry) => entry.designId === designId);
  assert.ok(item);
  const execution = await planner.execute({
    plan,
    selectedItemIds: [item.itemId],
    createdAt: "2026-08-29T07:04:00.000Z",
  });
  return { plan, item, execution, componentV1, componentV2: versioned.component };
}

test("migration operations reconciles audited execution and restores pre-migration content as a new revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-migration-operations-"));
  try {
    const data = await fixture(root, "recoverable-design");
    const operations = new FileCreativeComponentMigrationOperations(root);
    const history = await operations.listHistory({ clientId: "T001", brandId: "ATTHAS_BURGER", familyId: data.plan.familyId });
    assert.equal(history.plans.length, 1);
    const operationalItem = history.plans[0]?.items[0];
    assert.equal(operationalItem?.status, "RECORDED_EXECUTION");
    assert.equal(operationalItem?.executionIds[0], data.execution.executionId);

    const preview = await operations.previewRecovery({
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      planId: data.plan.planId,
      itemId: data.item.itemId,
      generatedAt: "2026-08-29T07:05:00.000Z",
    });
    assert.equal(preview.restorable, true);
    assert.equal(preview.currentVersionApproved, false);
    assert.equal(preview.restoreSourceVersion, data.item.sourceDesignVersion);
    assert.equal(preview.proposedRecoveryVersion, data.item.targetDesignVersion + 1);
    assert.ok(preview.comparison.layerChanges.length > 0);
    assert.match(preview.previewToken, /^[a-f0-9]{64}$/);

    const restored = await operations.restorePreMigration({
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      planId: data.plan.planId,
      itemId: data.item.itemId,
      expectedPreviewToken: preview.previewToken,
      acknowledgeApprovedCurrent: false,
      createdAt: "2026-08-29T07:06:00.000Z",
    });
    assert.equal(restored.document.version, preview.proposedRecoveryVersion);
    assert.equal(restored.record.restoredContentFromVersion, data.item.sourceDesignVersion);
    assert.equal(restored.qa.decision === "PASS" || restored.qa.decision === "WARN", true);
    const rootLayer = restored.document.layers.find((layer) => layer.type === "group" && layer.componentInstance?.templateLayerId === "group-root");
    assert.equal(rootLayer?.componentInstance?.componentId, data.componentV1.id);

    const projects = new FileDesignProjectStore(root);
    const migrationVersion = await new DesignVersionService(root).readVersion(
      data.item.designId,
      data.item.targetDesignVersion,
    );
    const migratedRoot = migrationVersion.layers.find((layer) => layer.type === "group" && layer.componentInstance?.templateLayerId === "group-root");
    assert.equal(migratedRoot?.componentInstance?.componentId, data.componentV2.id);
    const current = await projects.get(data.item.designId);
    assert.equal(current?.document.version, preview.proposedRecoveryVersion);

    const afterHistory = await operations.listHistory({ clientId: "T001", brandId: "ATTHAS_BURGER" });
    assert.equal(afterHistory.recoveries.length, 1);
    assert.equal(afterHistory.recoveries[0]?.recoveryVersion, preview.proposedRecoveryVersion);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("migration operations detects persisted-without-audit interruption and still permits governed recovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-migration-interrupted-"));
  try {
    const data = await fixture(root, "interrupted-design");
    await rm(
      join(root, "components", "T001", "ATTHAS_BURGER", "_migrations", "executions", `${data.execution.executionId}.json`),
      { force: true },
    );
    const operations = new FileCreativeComponentMigrationOperations(root);
    const history = await operations.listHistory({ clientId: "T001", brandId: "ATTHAS_BURGER" });
    const item = history.plans[0]?.items.find((entry) => entry.itemId === data.item.itemId);
    assert.equal(item?.status, "PERSISTED_WITHOUT_EXECUTION_AUDIT");
    assert.match(item?.reason ?? "", /interrupted file-backed batch/i);

    const preview = await operations.previewRecovery({
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      planId: data.plan.planId,
      itemId: data.item.itemId,
      generatedAt: "2026-08-29T07:05:00.000Z",
    });
    assert.equal(preview.operationalStatus, "PERSISTED_WITHOUT_EXECUTION_AUDIT");
    assert.equal(preview.restorable, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("approved current migration version requires explicit recovery acknowledgement and preserves approval history", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-migration-approved-recovery-"));
  try {
    const data = await fixture(root, "approved-recovery-design");
    const projects = new FileDesignProjectStore(root);
    const current = await projects.get(data.item.designId);
    assert.ok(current);
    const governance = new CreativeStudioGovernanceStore(root);
    await governance.saveApproval({
      schemaVersion: 1,
      designId: current.document.id,
      designVersion: current.document.version,
      approvedAt: "2026-08-29T07:05:00.000Z",
      approvedBy: "migration-operations-test",
      deterministicDecision: "PASS",
      finalVisualQaDecision: "PASS",
    });

    const operations = new FileCreativeComponentMigrationOperations(root);
    const preview = await operations.previewRecovery({
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      planId: data.plan.planId,
      itemId: data.item.itemId,
      generatedAt: "2026-08-29T07:06:00.000Z",
    });
    assert.equal(preview.currentVersionApproved, true);
    assert.equal(preview.requiresApprovedRevisionAcknowledgement, true);

    await assert.rejects(
      () => operations.restorePreMigration({
        clientId: "T001",
        brandId: "ATTHAS_BURGER",
        planId: data.plan.planId,
        itemId: data.item.itemId,
        expectedPreviewToken: preview.previewToken,
        acknowledgeApprovedCurrent: false,
        createdAt: "2026-08-29T07:07:00.000Z",
      }),
      /COMPONENT_MIGRATION_RECOVERY_APPROVED_ACK_REQUIRED/,
    );

    const restored = await operations.restorePreMigration({
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      planId: data.plan.planId,
      itemId: data.item.itemId,
      expectedPreviewToken: preview.previewToken,
      acknowledgeApprovedCurrent: true,
      createdAt: "2026-08-29T07:07:00.000Z",
    });
    assert.equal(restored.record.currentVersionWasApproved, true);
    assert.equal(restored.record.approvedRevisionAcknowledged, true);
    const oldApproval = await governance.getApproval(current.document.id, current.document.version);
    const newApproval = await governance.getApproval(restored.document.id, restored.document.version);
    assert.ok(oldApproval);
    assert.equal(newApproval, undefined);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
