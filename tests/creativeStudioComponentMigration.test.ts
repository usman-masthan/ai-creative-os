import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AiTraceSession } from "../src/aiTrace.js";
import { createReusableComponent, instantiateReusableComponent } from "../src/creativeStudio/componentLibrary.js";
import { FileCreativeComponentLifecycleStore } from "../src/creativeStudio/componentLifecycle.js";
import { FileCreativeComponentMigrationPlanner } from "../src/creativeStudio/componentMigration.js";
import { CreativeStudioGovernanceStore } from "../src/creativeStudio/governanceStore.js";
import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import { applyDesignOperation } from "../src/designDocument/operations.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function truth(campaignId: string, sessionId: string, productName: string, price: number): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId,
    campaignId,
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "migration-test",
    confirmedAt: "2026-08-29T06:20:00.000Z",
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
  const at = "2026-08-29T06:20:00.000Z";
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
  const trace = new AiTraceSession(snapshot.campaignId, "2026-08-29T06:20:00.000Z");
  trace.setTruth({ snapshot });
  await trace.persist(join(root, "outputs", snapshot.campaignId));
}

async function dependent(input: {
  root: string;
  component: ReturnType<typeof createReusableComponent>;
  id: string;
  approved?: boolean;
}): Promise<void> {
  const campaignId = `campaign-${input.id}`;
  const sessionId = `session-${input.id}`;
  const snapshot = truth(campaignId, sessionId, `${input.id} Burger`, 1550);
  await persistTruth(input.root, snapshot);
  const base = document({
    id: input.id,
    campaignId,
    sessionId,
    headline: `${input.id} Burger`,
    price: "LKR 1,550",
    includeGroup: false,
  });
  const withInstance = instantiateReusableComponent({
    document: base,
    destinationTruth: snapshot,
    component: input.component,
    instanceId: `${input.id}-instance`,
    timestamp: "2026-08-29T06:21:00.000Z",
  });
  const projects = new FileDesignProjectStore(input.root);
  await projects.create({ document: withInstance });
  if (input.approved) {
    const governance = new CreativeStudioGovernanceStore(input.root);
    await governance.saveApproval({
      schemaVersion: 1,
      designId: withInstance.id,
      designVersion: withInstance.version,
      approvedAt: "2026-08-29T06:22:00.000Z",
      approvedBy: "migration-test",
      deterministicDecision: "PASS",
      finalVisualQaDecision: "PASS",
    });
  }
}

test("migration plan excludes frozen designs and executes selected editable designs one revision at a time", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-component-migration-"));
  try {
    const sourceTruth = truth("source-campaign", "source-session", "Source Burger", 1000);
    const source = document({ id: "source-design", campaignId: "source-campaign", sessionId: "source-session", headline: "Source Burger", price: "LKR 1,000", includeGroup: true });
    const componentV1 = createReusableComponent({
      document: source,
      sourceTruth,
      groupLayerId: "source-design-group",
      componentId: "promo-block",
      name: "Promo Block",
      createdAt: "2026-08-29T06:20:00.000Z",
    });
    const lifecycle = new FileCreativeComponentLifecycleStore(root);
    await lifecycle.components.save(componentV1);
    await lifecycle.registerInitial(componentV1);
    const versioned = await lifecycle.duplicateAsNewVersion({
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      componentId: componentV1.id,
      createdAt: "2026-08-29T06:23:00.000Z",
    });
    const family = versioned.family;
    const componentV2 = versioned.component;

    await dependent({ root, component: componentV1, id: "editable-a" });
    await dependent({ root, component: componentV1, id: "editable-b" });
    await dependent({ root, component: componentV1, id: "approved-c", approved: true });

    const planner = new FileCreativeComponentMigrationPlanner(root);
    const plan = await planner.createPlan({
      family,
      targetComponent: componentV2,
      targetVersion: 2,
      createdAt: "2026-08-29T06:24:00.000Z",
    });

    assert.equal(plan.totals.eligibleDesigns, 2);
    assert.equal(plan.totals.eligibleInstances, 2);
    assert.equal(plan.totals.frozenApproved, 1);
    assert.equal(plan.exclusions.length, 1);
    assert.equal(plan.exclusions[0]?.designId, "approved-c");
    assert.equal(plan.exclusions[0]?.governance, "FROZEN_APPROVED");
    assert.match(plan.planToken, /^[a-f0-9]{64}$/);

    const a = plan.eligibleDesigns.find((item) => item.designId === "editable-a");
    const b = plan.eligibleDesigns.find((item) => item.designId === "editable-b");
    assert.ok(a);
    assert.ok(b);
    assert.equal(a.targetDesignVersion, a.sourceDesignVersion + 1);

    const first = await planner.execute({
      plan,
      selectedItemIds: [a.itemId],
      createdAt: "2026-08-29T06:25:00.000Z",
    });
    assert.equal(first.executedDesigns.length, 1);
    assert.equal(first.executedDesigns[0]?.designId, "editable-a");
    assert.equal(first.executedDesigns[0]?.toVersion, a.targetDesignVersion);

    const projects = new FileDesignProjectStore(root);
    const afterA = await projects.get("editable-a");
    const beforeB = await projects.get("editable-b");
    assert.ok(afterA);
    assert.ok(beforeB);
    assert.equal(afterA.document.version, a.targetDesignVersion);
    assert.equal(beforeB.document.version, b.sourceDesignVersion);
    const aRoot = afterA.document.layers.find((layer) => layer.type === "group" && layer.componentInstance?.templateLayerId === "group-root");
    assert.equal(aRoot?.componentInstance?.componentId, componentV2.id);
    assert.equal(afterA.qa?.decision === "PASS" || afterA.qa?.decision === "WARN", true);

    const second = await planner.execute({
      plan,
      selectedItemIds: [b.itemId],
      createdAt: "2026-08-29T06:26:00.000Z",
    });
    assert.equal(second.executedDesigns[0]?.designId, "editable-b");
    const afterB = await projects.get("editable-b");
    assert.ok(afterB);
    assert.equal(afterB.document.version, b.targetDesignVersion);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("migration execution rejects a stale planned design before persisting another selected design", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-component-migration-stale-"));
  try {
    const sourceTruth = truth("source-campaign", "source-session", "Source Burger", 1000);
    const source = document({ id: "source-design", campaignId: "source-campaign", sessionId: "source-session", headline: "Source Burger", price: "LKR 1,000", includeGroup: true });
    const componentV1 = createReusableComponent({ document: source, sourceTruth, groupLayerId: "source-design-group", componentId: "promo-block", name: "Promo Block", createdAt: "2026-08-29T06:20:00.000Z" });
    const lifecycle = new FileCreativeComponentLifecycleStore(root);
    await lifecycle.components.save(componentV1);
    await lifecycle.registerInitial(componentV1);
    const versioned = await lifecycle.duplicateAsNewVersion({ clientId: "T001", brandId: "ATTHAS_BURGER", componentId: componentV1.id, createdAt: "2026-08-29T06:23:00.000Z" });
    await dependent({ root, component: componentV1, id: "stale-a" });
    await dependent({ root, component: componentV1, id: "stable-b" });

    const planner = new FileCreativeComponentMigrationPlanner(root);
    const plan = await planner.createPlan({ family: versioned.family, targetComponent: versioned.component, targetVersion: 2, createdAt: "2026-08-29T06:24:00.000Z" });
    const stale = plan.eligibleDesigns.find((item) => item.designId === "stale-a");
    const stable = plan.eligibleDesigns.find((item) => item.designId === "stable-b");
    assert.ok(stale);
    assert.ok(stable);

    const projects = new FileDesignProjectStore(root);
    const staleProject = await projects.get("stale-a");
    assert.ok(staleProject);
    const nativeHeadline = staleProject.document.layers.find((layer) => layer.type === "text" && layer.role === "headline" && !layer.componentInstance);
    assert.ok(nativeHeadline);
    const edited = applyDesignOperation(staleProject.document, { type: "MOVE_LAYER", layerId: nativeHeadline.id, x: nativeHeadline.x + 4, y: nativeHeadline.y }, "2026-08-29T06:24:30.000Z");
    await projects.save(edited);

    await assert.rejects(
      () => planner.execute({ plan, selectedItemIds: [stable.itemId, stale.itemId], createdAt: "2026-08-29T06:25:00.000Z" }),
      /COMPONENT_MIGRATION_DESIGN_STALE|COMPONENT_MIGRATION_PRECONDITION_STALE/,
    );
    const stableAfter = await projects.get("stable-b");
    assert.ok(stableAfter);
    assert.equal(stableAfter.document.version, stable.sourceDesignVersion);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
