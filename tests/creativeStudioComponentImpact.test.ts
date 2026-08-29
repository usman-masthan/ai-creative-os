import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AiTraceSession } from "../src/aiTrace.js";
import {
  assertReusableComponent,
  createReusableComponent,
  instantiateReusableComponent,
  type CreativeComponentTextTemplate,
} from "../src/creativeStudio/componentLibrary.js";
import { FileCreativeComponentImpactAnalyzer } from "../src/creativeStudio/componentImpact.js";
import { FileCreativeComponentLifecycleStore } from "../src/creativeStudio/componentLifecycle.js";
import { CreativeStudioGovernanceStore } from "../src/creativeStudio/governanceStore.js";
import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import { applyDesignOperation } from "../src/designDocument/operations.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function truth(input: { campaignId: string; sessionId: string; productName: string; price: number; offerTerms?: string }): TaskTruthSnapshot {
  const facts: TaskTruthSnapshot["facts"] = [
    {
      label: `productName:${input.productName}`,
      key: "productName",
      value: input.productName,
      scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", productId: input.productName },
      confirmationAction: "CONFIRM",
      updateStoredTruthRequested: false,
    },
    {
      label: `price:${input.price}`,
      key: "price",
      value: input.price,
      scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", salesChannel: "DINE_IN" },
      confirmationAction: "CONFIRM",
      updateStoredTruthRequested: false,
    },
  ];
  if (input.offerTerms) {
    facts.push({
      label: `offerTerms:${input.offerTerms}`,
      key: "offerTerms",
      value: input.offerTerms,
      scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", salesChannel: "DINE_IN" },
      confirmationAction: "CONFIRM",
      updateStoredTruthRequested: false,
    });
  }
  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    campaignId: input.campaignId,
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "impact-test",
    confirmedAt: "2026-08-29T05:40:00.000Z",
    facts,
  };
}

function document(input: {
  id: string;
  campaignId: string;
  sessionId: string;
  headline: string;
  price: string;
  supporting?: string;
  includeGroup?: boolean;
}): DesignDocument {
  const at = "2026-08-29T05:40:00.000Z";
  const layers: DesignDocument["layers"] = [
    { id: `${input.id}-background`, name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
    { id: `${input.id}-headline`, name: "Headline", type: "text", x: 80, y: 120, width: 520, height: 130, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: true, text: input.headline, role: "headline", fontFamily: "Anton", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0, align: "left", fill: "#ffffff" },
    { id: `${input.id}-price`, name: "Price", type: "text", x: 80, y: 300, width: 260, height: 100, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: false, text: input.price, role: "price", fontFamily: "Anton", fontSize: 58, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#ffd21a" },
    { id: `${input.id}-badge`, name: "Badge", type: "shape", shape: "rect", x: 60, y: 280, width: 310, height: 140, rotation: 0, opacity: 1, zIndex: 15, visible: true, locked: false, aiEditable: false, fill: "#b50008", cornerRadius: 18 },
    { id: `${input.id}-logo`, name: "Approved Logo", type: "logo", x: 890, y: 60, width: 110, height: 110, rotation: 0, opacity: 1, zIndex: 100, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand" }, preserveAspectRatio: true, clearSpacePx: 20 },
  ];
  if (input.supporting !== undefined) {
    layers.push({ id: `${input.id}-supporting`, name: "Supporting", type: "text", x: 80, y: 455, width: 520, height: 80, rotation: 0, opacity: 1, zIndex: 25, visible: true, locked: false, aiEditable: true, text: input.supporting, role: "supporting", fontFamily: "Inter", fontSize: 34, fontWeight: 500, lineHeight: 1.15, letterSpacing: 0, align: "left", fill: "#ffffff" });
  }
  if (input.includeGroup !== false) {
    layers.push({ id: `${input.id}-group`, name: "Offer Block", type: "group", x: 60, y: 120, width: 540, height: 300, rotation: 0, opacity: 1, zIndex: 40, visible: true, locked: false, aiEditable: false, childLayerIds: [`${input.id}-headline`, `${input.id}-badge`, `${input.id}-price`] });
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
  const trace = new AiTraceSession(snapshot.campaignId, "2026-08-29T05:40:00.000Z");
  trace.setTruth({ snapshot });
  await trace.persist(join(root, "outputs", snapshot.campaignId));
}

async function createDependentDesign(input: {
  root: string;
  component: ReturnType<typeof createReusableComponent>;
  id: string;
  campaignId: string;
  sessionId: string;
  offerTerms?: string;
  includeSupporting: boolean;
  approved?: boolean;
}): Promise<void> {
  const snapshot = truth({
    campaignId: input.campaignId,
    sessionId: input.sessionId,
    productName: `${input.id} Burger`,
    price: 1550,
    ...(input.offerTerms ? { offerTerms: input.offerTerms } : {}),
  });
  await persistTruth(input.root, snapshot);
  const base = document({
    id: input.id,
    campaignId: input.campaignId,
    sessionId: input.sessionId,
    headline: `${input.id} Burger`,
    price: "Rs. 1,550",
    ...(input.includeSupporting ? { supporting: input.offerTerms ?? "Limited time" } : {}),
    includeGroup: false,
  });
  const instanceId = `${input.id}-instance`;
  const withInstance = instantiateReusableComponent({
    document: base,
    destinationTruth: snapshot,
    component: input.component,
    instanceId,
    timestamp: "2026-08-29T05:41:00.000Z",
  });
  const projects = new FileDesignProjectStore(input.root);
  await projects.create({ document: withInstance });
  if (input.approved) {
    const governance = new CreativeStudioGovernanceStore(input.root);
    await governance.saveApproval({
      schemaVersion: 1,
      designId: withInstance.id,
      designVersion: withInstance.version,
      approvedAt: "2026-08-29T05:42:00.000Z",
      approvedBy: "impact-test",
      deterministicDecision: "PASS",
      finalVisualQaDecision: "PASS",
    });
  }
}

test("component impact analysis finds upgradeable, blocked and approved/frozen dependencies", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-component-impact-"));
  try {
    const sourceTruth = truth({ campaignId: "source-campaign", sessionId: "source-session", productName: "Source Burger", price: 1000, offerTerms: "Source offer" });
    const source = document({ id: "source-design", campaignId: "source-campaign", sessionId: "source-session", headline: "Source Burger", price: "Rs. 1,000", supporting: "Source offer" });
    const component = createReusableComponent({
      document: source,
      sourceTruth,
      groupLayerId: "source-design-group",
      componentId: "offer-block",
      name: "Offer Block",
      createdAt: "2026-08-29T05:40:00.000Z",
    });
    const lifecycle = new FileCreativeComponentLifecycleStore(root);
    await lifecycle.components.save(component);
    const family = await lifecycle.registerInitial(component);

    const headline = component.templates.find((template): template is CreativeComponentTextTemplate => template.type === "text" && template.role === "headline");
    assert.ok(headline);
    const target = assertReusableComponent({
      ...component,
      id: "offer-block.v2",
      createdAt: "2026-08-29T05:45:00.000Z",
      templates: [
        ...component.templates,
        {
          ...headline,
          templateLayerId: "template-supporting",
          name: "Component supporting",
          role: "supporting",
          offsetY: headline.offsetY + 320,
          fontSize: 34,
          fontFamily: "Inter",
          requiredTruthKeys: ["offerTerms"],
        },
      ],
      requiredTruthKeys: [...new Set([...component.requiredTruthKeys, "offerTerms"])].sort(),
    });

    await createDependentDesign({ root, component, id: "upgradeable", campaignId: "campaign-upgradeable", sessionId: "session-upgradeable", offerTerms: "Buy one get one", includeSupporting: true });
    await createDependentDesign({ root, component, id: "missing-truth", campaignId: "campaign-missing-truth", sessionId: "session-missing-truth", includeSupporting: true });
    await createDependentDesign({ root, component, id: "missing-role", campaignId: "campaign-missing-role", sessionId: "session-missing-role", offerTerms: "Weekend offer", includeSupporting: false });
    await createDependentDesign({ root, component, id: "approved", campaignId: "campaign-approved", sessionId: "session-approved", offerTerms: "Approved offer", includeSupporting: true, approved: true });

    const analyzer = new FileCreativeComponentImpactAnalyzer(root);
    const report = await analyzer.analyze({ family, targetComponent: target, targetVersion: 2, generatedAt: "2026-08-29T05:50:00.000Z" });

    assert.equal(report.totals.designs, 4);
    assert.equal(report.totals.instances, 4);
    assert.equal(report.totals.upgradeable, 2);
    assert.equal(report.totals.blocked, 2);
    assert.equal(report.totals.frozenApproved, 1);
    assert.match(report.impactToken, /^[a-f0-9]{64}$/);

    const impacts = new Map(report.designs.map((entry) => [entry.designId, entry.instances[0]!));
    assert.equal(impacts.get("upgradeable")?.upgradeReadiness, "UPGRADEABLE");
    assert.equal(impacts.get("upgradeable")?.governance, "EDITABLE");
    assert.equal(impacts.get("missing-truth")?.upgradeReadiness, "BLOCKED_TRUTH");
    assert.deepEqual(impacts.get("missing-truth")?.missingTruthKeys, ["offerTerms"]);
    assert.equal(impacts.get("missing-role")?.upgradeReadiness, "BLOCKED_TEXT_ROLE");
    assert.deepEqual(impacts.get("missing-role")?.missingTextRoles, ["supporting:0"]);
    assert.equal(impacts.get("approved")?.upgradeReadiness, "UPGRADEABLE");
    assert.equal(impacts.get("approved")?.governance, "FROZEN_APPROVED");
    assert.match(impacts.get("approved")?.reason ?? "", /approved.*frozen/i);

    const projects = new FileDesignProjectStore(root);
    const before = await projects.get("upgradeable");
    assert.ok(before);
    const headlineLayer = before.document.layers.find((layer) => layer.type === "text" && layer.role === "headline" && !layer.componentInstance);
    assert.ok(headlineLayer);
    const edited = applyDesignOperation(before.document, {
      type: "MOVE_LAYER",
      layerId: headlineLayer.id,
      x: headlineLayer.x + 5,
      y: headlineLayer.y,
    }, "2026-08-29T05:51:00.000Z");
    await projects.save(edited);
    const after = await analyzer.analyze({ family, targetComponent: target, targetVersion: 2, generatedAt: "2026-08-29T05:52:00.000Z" });
    assert.notEqual(after.impactToken, report.impactToken);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
