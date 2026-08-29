import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createReusableComponent,
  FileCreativeComponentStore,
  instantiateReusableComponent,
} from "../src/creativeStudio/componentLibrary.js";
import {
  detachReusableComponentInstance,
  FileCreativeComponentLifecycleStore,
  replaceReusableComponentInstance,
} from "../src/creativeStudio/componentLifecycle.js";
import { applyDesignOperation } from "../src/designDocument/operations.js";
import type { DesignDocument, DesignGroupLayer } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function truth(campaignId: string, sessionId: string, includePrice = true): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId,
    campaignId,
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "component-lifecycle-test",
    confirmedAt: "2026-08-29T05:30:00.000Z",
    facts: [
      {
        label: "productName:burger",
        key: "productName",
        value: "Destination Burger",
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER" },
        confirmationAction: "CONFIRM",
        updateStoredTruthRequested: false,
      },
      ...(includePrice ? [{
        label: "price:1550",
        key: "price",
        value: 1550,
        scope: { tenantId: "T001" as const, brandId: "ATTHAS_BURGER" },
        confirmationAction: "CONFIRM" as const,
        updateStoredTruthRequested: false,
      }] : []),
    ],
  };
}

function document(campaignId: string, sessionId: string, includeGroup = true): DesignDocument {
  const at = "2026-08-29T05:30:00.000Z";
  const layers: DesignDocument["layers"] = [
    { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
    { id: "headline", name: "Headline", type: "text", x: 90, y: 130, width: 500, height: 140, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: true, text: "Destination Burger", role: "headline", fontFamily: "Anton", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0, align: "left", fill: "#ffffff" },
    { id: "price", name: "Price", type: "text", x: 90, y: 300, width: 280, height: 110, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: false, text: "Rs. 1,550", role: "price", fontFamily: "Anton", fontSize: 60, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#ffd21a" },
    { id: "badge", name: "Badge", type: "shape", shape: "rect", x: 70, y: 280, width: 330, height: 150, rotation: 0, opacity: 1, zIndex: 15, visible: true, locked: false, aiEditable: false, fill: "#b50008", cornerRadius: 18 },
    { id: "logo", name: "Approved Logo", type: "logo", x: 880, y: 70, width: 120, height: 120, rotation: 0, opacity: 1, zIndex: 100, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand" }, preserveAspectRatio: true, clearSpacePx: 20 },
  ];
  if (includeGroup) layers.push({ id: "source-group", name: "Offer Block", type: "group", x: 70, y: 130, width: 520, height: 300, rotation: 0, opacity: 1, zIndex: 40, visible: true, locked: false, aiEditable: false, childLayerIds: ["headline", "badge", "price"] });
  return {
    schemaVersion: 1,
    id: `design-${campaignId}`,
    version: 1,
    campaignId,
    truthSnapshotId: `task:${sessionId}`,
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers,
    history: [{ version: 1, createdAt: at, summary: "Fixture", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

function instanceGroup(documentValue: DesignDocument, instanceId: string): DesignGroupLayer {
  const group = documentValue.layers.find(
    (layer): layer is DesignGroupLayer => layer.type === "group" && layer.componentInstance?.instanceId === instanceId,
  );
  assert.ok(group, `Expected instance group ${instanceId}.`);
  return group;
}

test("component families keep immutable contiguous versions and lifecycle status", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-lifecycle-"));
  try {
    const source = document("source", "source-session");
    const component = createReusableComponent({
      document: source,
      sourceTruth: truth("source", "source-session"),
      groupLayerId: "source-group",
      componentId: "offer-family",
      name: "Offer Family",
      createdAt: "2026-08-29T05:31:00.000Z",
    });
    const components = new FileCreativeComponentStore(root);
    const lifecycle = new FileCreativeComponentLifecycleStore(root);
    await components.save(component);
    const initial = await lifecycle.registerInitial(component);
    assert.equal(initial.latestVersion, 1);
    assert.equal(initial.status, "ACTIVE");

    const v2 = await lifecycle.duplicateAsNewVersion({
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      componentId: component.id,
      createdAt: "2026-08-29T05:32:00.000Z",
    });
    assert.equal(v2.component.id, "offer-family.v2");
    assert.equal(v2.family.latestVersion, 2);
    assert.deepEqual(v2.family.versions.map((entry) => entry.version), [1, 2]);
    assert.equal(v2.family.versions[1]?.derivedFromComponentId, "offer-family");

    const deprecated = await lifecycle.setStatus({ clientId: "T001", brandId: "ATTHAS_BURGER", familyId: "offer-family", status: "DEPRECATED", updatedAt: "2026-08-29T05:33:00.000Z" });
    assert.equal(deprecated.status, "DEPRECATED");
    await assert.rejects(
      () => lifecycle.duplicateAsNewVersion({ clientId: "T001", brandId: "ATTHAS_BURGER", componentId: v2.component.id }),
      /FAMILY_NOT_ACTIVE/,
    );

    await lifecycle.setStatus({ clientId: "T001", brandId: "ATTHAS_BURGER", familyId: "offer-family", status: "ACTIVE" });
    const library = await lifecycle.listLibrary("T001", "ATTHAS_BURGER");
    assert.equal(library.length, 1);
    assert.equal(library[0]?.versions.length, 2);
    assert.equal(library[0]?.versions[1]?.isLatest, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("component upgrade preserves placement, rebinds destination content and persists one revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-upgrade-"));
  try {
    const source = document("source", "source-session");
    const v1 = createReusableComponent({ document: source, sourceTruth: truth("source", "source-session"), groupLayerId: "source-group", componentId: "offer-family", name: "Offer Family" });
    const components = new FileCreativeComponentStore(root);
    const lifecycle = new FileCreativeComponentLifecycleStore(root);
    await components.save(v1);
    await lifecycle.registerInitial(v1);
    const versioned = await lifecycle.duplicateAsNewVersion({ clientId: "T001", brandId: "ATTHAS_BURGER", componentId: v1.id });

    let destination = document("destination", "destination-session", false);
    destination = instantiateReusableComponent({ document: destination, destinationTruth: truth("destination", "destination-session"), component: v1, instanceId: "instance-a", timestamp: "2026-08-29T05:34:00.000Z" });
    destination = applyDesignOperation(destination, { type: "RESIZE_LAYER", layerId: "instance-a.group", width: 416, height: 240 }, "2026-08-29T05:35:00.000Z");
    destination = applyDesignOperation(destination, { type: "ROTATE_LAYER", layerId: "instance-a.group", rotation: 15 }, "2026-08-29T05:36:00.000Z");
    const beforeMove = instanceGroup(destination, "instance-a");
    destination = applyDesignOperation(destination, { type: "MOVE_LAYER", layerId: beforeMove.id, x: 230, y: 420 }, "2026-08-29T05:37:00.000Z");
    const before = instanceGroup(destination, "instance-a");
    const versionBefore = destination.version;
    const historyBefore = destination.history.length;

    const upgraded = replaceReusableComponentInstance({
      document: destination,
      destinationTruth: truth("destination", "destination-session"),
      currentComponent: v1,
      targetComponent: versioned.component,
      instanceId: "instance-a",
      timestamp: "2026-08-29T05:38:00.000Z",
    });
    const after = instanceGroup(upgraded, "instance-a");
    assert.equal(upgraded.version, versionBefore + 1);
    assert.equal(upgraded.history.length, historyBefore + 1);
    assert.match(upgraded.history.at(-1)?.summary ?? "", /Upgraded reusable component instance/);
    assert.equal(after.rotation, before.rotation);
    assert.ok(Math.abs((after.x + after.width / 2) - (before.x + before.width / 2)) < 0.01);
    assert.ok(Math.abs((after.y + after.height / 2) - (before.y + before.height / 2)) < 0.01);
    assert.equal(after.componentInstance?.componentId, versioned.component.id);
    const text = upgraded.layers.find((layer) => layer.type === "text" && layer.componentInstance?.instanceId === "instance-a" && layer.role === "price");
    assert.equal(text?.type === "text" ? text.text : undefined, "Rs. 1,550");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("component upgrade revalidates destination truth and detach removes provenance only", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-detach-"));
  try {
    const source = document("source", "source-session");
    const v1 = createReusableComponent({ document: source, sourceTruth: truth("source", "source-session"), groupLayerId: "source-group", componentId: "offer-family", name: "Offer Family" });
    const components = new FileCreativeComponentStore(root);
    const lifecycle = new FileCreativeComponentLifecycleStore(root);
    await components.save(v1);
    await lifecycle.registerInitial(v1);
    const v2 = (await lifecycle.duplicateAsNewVersion({ clientId: "T001", brandId: "ATTHAS_BURGER", componentId: v1.id })).component;
    const destination = instantiateReusableComponent({ document: document("destination", "destination-session", false), destinationTruth: truth("destination", "destination-session"), component: v1, instanceId: "instance-b" });

    assert.throws(
      () => replaceReusableComponentInstance({
        document: destination,
        destinationTruth: truth("destination", "destination-session", false),
        currentComponent: v1,
        targetComponent: v2,
        instanceId: "instance-b",
      }),
      /COMPONENT_DESTINATION_TRUTH_MISSING.*price/,
    );

    const detached = detachReusableComponentInstance(destination, "instance-b", "2026-08-29T05:39:00.000Z");
    assert.equal(detached.version, destination.version + 1);
    const formerMembers = detached.layers.filter((layer) => layer.id.startsWith("instance-b."));
    assert.ok(formerMembers.length >= 3);
    assert.equal(formerMembers.every((layer) => layer.componentInstance === undefined), true);
    assert.equal(formerMembers.some((layer) => layer.type === "group"), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
