import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  FileCreativeComponentAuthoringStore,
  previewReusableComponentVersion,
} from "../src/creativeStudio/componentAuthoring.js";
import { createReusableComponent } from "../src/creativeStudio/componentLibrary.js";
import { FileCreativeComponentLifecycleStore } from "../src/creativeStudio/componentLifecycle.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

const AT = "2026-08-29T06:00:00.000Z";

function truth(campaignId = "campaign-author", sessionId = "truth-author"): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId,
    campaignId,
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "authoring-test",
    confirmedAt: AT,
    facts: [
      {
        label: "productName:burger",
        key: "productName",
        value: "Fire Burger",
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", productId: "burger" },
        confirmationAction: "CONFIRM",
        updateStoredTruthRequested: false,
      },
      {
        label: "price:1450",
        key: "price",
        value: 1450,
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", salesChannel: "DINE_IN" },
        confirmationAction: "CONFIRM",
        updateStoredTruthRequested: false,
      },
    ],
  };
}

function design(input: { version?: number; headlineX?: number; headlineText?: string; addSupporting?: boolean }): DesignDocument {
  const version = input.version ?? 1;
  const layers: DesignDocument["layers"] = [
    { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
    { id: "headline", name: "Fire Burger", type: "text", x: input.headlineX ?? 90, y: 120, width: 520, height: 120, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: true, text: input.headlineText ?? "Fire Burger", role: "headline", fontFamily: "Anton", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0, align: "left", fill: "#ffffff" },
    { id: "badge", name: "Badge", type: "shape", shape: "rect", x: 70, y: 270, width: 320, height: 145, rotation: 0, opacity: 1, zIndex: 15, visible: true, locked: false, aiEditable: false, fill: "#b50008", cornerRadius: 18 },
    { id: "price", name: "Rs 1450", type: "text", x: 95, y: 292, width: 270, height: 90, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: false, text: "Rs. 1,450", role: "price", fontFamily: "Anton", fontSize: 58, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#ffd21a" },
    { id: "logo", name: "Approved Logo", type: "logo", x: 880, y: 60, width: 120, height: 120, rotation: 0, opacity: 1, zIndex: 100, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand" }, preserveAspectRatio: true, clearSpacePx: 20 },
  ];
  const childLayerIds = ["headline", "badge", "price"];
  if (input.addSupporting) {
    layers.push({ id: "supporting", name: "Supporting", type: "text", x: 90, y: 235, width: 430, height: 52, rotation: 0, opacity: 1, zIndex: 12, visible: true, locked: false, aiEditable: true, text: "Limited drop", role: "supporting", fontFamily: "Inter", fontSize: 28, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0, align: "left", fill: "#ffffff" });
    childLayerIds.splice(1, 0, "supporting");
  }
  layers.push({ id: "group", name: "Offer Block", type: "group", x: 70, y: 120, width: 540, height: 295, rotation: 0, opacity: 1, zIndex: 40, visible: true, locked: false, aiEditable: false, childLayerIds });
  return {
    schemaVersion: 1,
    id: "design-author",
    version,
    campaignId: "campaign-author",
    truthSnapshotId: "task:truth-author",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers,
    history: [{ version, createdAt: AT, summary: "Fixture", actor: "system" }],
    createdAt: AT,
    updatedAt: AT,
  };
}

async function setup(root: string) {
  const lifecycle = new FileCreativeComponentLifecycleStore(root);
  const baseDocument = design({});
  const base = createReusableComponent({
    document: baseDocument,
    sourceTruth: truth(),
    groupLayerId: "group",
    componentId: "offer-family",
    name: "Offer Family",
    createdAt: AT,
  });
  await lifecycle.components.save(base);
  const family = await lifecycle.registerInitial(base);
  return { lifecycle, base, family };
}

test("component authoring preview classifies geometry-only changes as compatible", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-authoring-preview-"));
  try {
    const { base, family } = await setup(root);
    const result = previewReusableComponentVersion({
      document: design({ version: 2, headlineX: 130 }),
      sourceTruth: truth(),
      groupLayerId: "group",
      family,
      baseComponent: base,
    });
    assert.equal(result.preview.compatibility, "COMPATIBLE");
    assert.deepEqual(result.preview.diff.textRoles.styleOrGeometryChanged, ["headline"]);
    assert.deepEqual(result.preview.diff.truthDependencies.added, []);
    assert.deepEqual(result.preview.diff.truthDependencies.removed, []);
    assert.match(result.preview.previewToken, /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("component authoring requires review for role or truth-dependency changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-authoring-review-"));
  try {
    const { base, family } = await setup(root);
    const roleChange = previewReusableComponentVersion({
      document: design({ version: 2, addSupporting: true }),
      sourceTruth: truth(),
      groupLayerId: "group",
      family,
      baseComponent: base,
    }).preview;
    assert.equal(roleChange.compatibility, "REVIEW_REQUIRED");
    assert.deepEqual(roleChange.diff.textRoles.added, ["supporting"]);

    const truthChange = previewReusableComponentVersion({
      document: design({ version: 2, headlineText: "Freshly made" }),
      sourceTruth: truth(),
      groupLayerId: "group",
      family,
      baseComponent: base,
    }).preview;
    assert.equal(truthChange.compatibility, "REVIEW_REQUIRED");
    assert.deepEqual(truthChange.diff.truthDependencies.removed, ["productName"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("component authoring rejects stale previews and requires notes", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-authoring-stale-"));
  try {
    const { base, family } = await setup(root);
    const authoring = new FileCreativeComponentAuthoringStore(root);
    const candidate = design({ version: 2, headlineX: 130 });
    const preview = previewReusableComponentVersion({ document: candidate, sourceTruth: truth(), groupLayerId: "group", family, baseComponent: base }).preview;
    await assert.rejects(
      () => authoring.publish({
        document: design({ version: 3, headlineX: 150 }),
        sourceTruth: truth(),
        groupLayerId: "group",
        familyId: family.familyId,
        expectedBaseComponentId: preview.baseComponentId,
        expectedPreviewToken: preview.previewToken,
        versionNotes: "Moved the headline.",
        acceptReviewRequired: false,
      }),
      /COMPONENT_AUTHORING_STALE_PREVIEW/,
    );
    await assert.rejects(
      () => authoring.publish({
        document: candidate,
        sourceTruth: truth(),
        groupLayerId: "group",
        familyId: family.familyId,
        expectedBaseComponentId: preview.baseComponentId,
        expectedPreviewToken: preview.previewToken,
        versionNotes: "no",
        acceptReviewRequired: false,
      }),
      /COMPONENT_VERSION_NOTES_REQUIRED/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("successful component authoring publishes one immutable next version with audit notes", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-authoring-publish-"));
  try {
    const { base, family } = await setup(root);
    const authoring = new FileCreativeComponentAuthoringStore(root);
    const candidate = design({ version: 2, headlineX: 132 });
    const preview = previewReusableComponentVersion({ document: candidate, sourceTruth: truth(), groupLayerId: "group", family, baseComponent: base }).preview;
    const published = await authoring.publish({
      document: candidate,
      sourceTruth: truth(),
      groupLayerId: "group",
      familyId: family.familyId,
      expectedBaseComponentId: preview.baseComponentId,
      expectedPreviewToken: preview.previewToken,
      versionNotes: "Shifted the headline to improve visual balance.",
      acceptReviewRequired: false,
      createdAt: "2026-08-29T06:05:00.000Z",
    });
    assert.equal(published.family.latestVersion, 2);
    assert.equal(published.family.latestComponentId, "offer-family.v2");
    assert.equal(published.record.version, 2);
    assert.equal(published.record.versionNotes, "Shifted the headline to improve visual balance.");
    assert.ok(await authoring.lifecycle.components.get("T001", "ATTHAS_BURGER", "offer-family"));
    assert.ok(await authoring.lifecycle.components.get("T001", "ATTHAS_BURGER", "offer-family.v2"));
    const audit = await authoring.getAudit("T001", "ATTHAS_BURGER", "offer-family");
    assert.equal(audit.records.length, 1);
    assert.equal(audit.records[0]?.componentId, "offer-family.v2");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("review-required authoring needs acknowledgement and inactive families are blocked", async () => {
  const root = await mkdtemp(join(tmpdir(), "component-authoring-guard-"));
  try {
    const { lifecycle, base, family } = await setup(root);
    const authoring = new FileCreativeComponentAuthoringStore(root);
    const candidate = design({ version: 2, addSupporting: true });
    const preview = previewReusableComponentVersion({ document: candidate, sourceTruth: truth(), groupLayerId: "group", family, baseComponent: base }).preview;
    assert.equal(preview.compatibility, "REVIEW_REQUIRED");
    await assert.rejects(
      () => authoring.publish({
        document: candidate,
        sourceTruth: truth(),
        groupLayerId: "group",
        familyId: family.familyId,
        expectedBaseComponentId: preview.baseComponentId,
        expectedPreviewToken: preview.previewToken,
        versionNotes: "Added a supporting copy slot.",
        acceptReviewRequired: false,
      }),
      /COMPONENT_AUTHORING_REVIEW_REQUIRED/,
    );
    await lifecycle.setStatus({ clientId: "T001", brandId: "ATTHAS_BURGER", familyId: family.familyId, status: "ARCHIVED" });
    const archived = await lifecycle.get("T001", "ATTHAS_BURGER", family.familyId);
    assert.ok(archived);
    const blocked = previewReusableComponentVersion({ document: candidate, sourceTruth: truth(), groupLayerId: "group", family: archived!, baseComponent: base }).preview;
    assert.equal(blocked.compatibility, "BLOCKED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
