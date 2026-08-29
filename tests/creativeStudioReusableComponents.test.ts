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
import type { DesignDocument, DesignTextLayer } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function truth(input: { campaignId: string; sessionId: string; productName?: string; price?: number; brandId?: string }): TaskTruthSnapshot {
  const brandId = input.brandId ?? "ATTHAS_BURGER";
  const facts: TaskTruthSnapshot["facts"] = [];
  if (input.productName) {
    facts.push({
      label: `productName:${input.productName}`,
      key: "productName",
      value: input.productName,
      scope: { tenantId: "T001", brandId, productId: input.productName },
      confirmationAction: "CONFIRM",
      updateStoredTruthRequested: false,
    });
  }
  if (input.price !== undefined) {
    facts.push({
      label: `price:${input.price}`,
      key: "price",
      value: input.price,
      scope: { tenantId: "T001", brandId, salesChannel: "DINE_IN" },
      confirmationAction: "CONFIRM",
      updateStoredTruthRequested: false,
    });
  }
  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    campaignId: input.campaignId,
    tenantId: "T001",
    brandId,
    confirmedBy: "component-test",
    confirmedAt: "2026-08-29T05:00:00.000Z",
    facts,
  };
}

function document(input: {
  campaignId: string;
  sessionId: string;
  headline: string;
  price: string;
  brandId?: string;
  includeGroup?: boolean;
}): DesignDocument {
  const brandId = input.brandId ?? "ATTHAS_BURGER";
  const at = "2026-08-29T05:00:00.000Z";
  const layers: DesignDocument["layers"] = [
    { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
    { id: "headline", name: "Headline", type: "text", x: 90, y: 130, width: 500, height: 140, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: true, text: input.headline, role: "headline", fontFamily: "Anton", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0, align: "left", fill: "#ffffff" },
    { id: "price", name: "Price", type: "text", x: 90, y: 300, width: 280, height: 110, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: false, text: input.price, role: "price", fontFamily: "Anton", fontSize: 60, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "center", fill: "#ffd21a" },
    { id: "badge", name: "Badge", type: "shape", shape: "rect", x: 70, y: 280, width: 330, height: 150, rotation: 0, opacity: 1, zIndex: 15, visible: true, locked: false, aiEditable: false, fill: "#b50008", cornerRadius: 18 },
    { id: "logo", name: "Approved Logo", type: "logo", x: 880, y: 70, width: 120, height: 120, rotation: 0, opacity: 1, zIndex: 100, visible: true, locked: true, aiEditable: false, asset: { assetId: "logo", source: "approved-brand" }, preserveAspectRatio: true, clearSpacePx: 20 },
  ];
  if (input.includeGroup !== false) {
    layers.push({ id: "group-source", name: "Offer Block", type: "group", x: 70, y: 130, width: 520, height: 300, rotation: 0, opacity: 1, zIndex: 40, visible: true, locked: false, aiEditable: false, childLayerIds: ["headline", "badge", "price"] });
  }
  return {
    schemaVersion: 1,
    id: `design-${input.campaignId}`,
    version: 1,
    campaignId: input.campaignId,
    truthSnapshotId: `task:${input.sessionId}`,
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId, brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers,
    history: [{ version: 1, createdAt: at, summary: "Fixture", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

function textByInstance(documentValue: DesignDocument, instanceId: string, role: DesignTextLayer["role"]): DesignTextLayer {
  const layer = documentValue.layers.find(
    (candidate): candidate is DesignTextLayer => candidate.type === "text"
      && candidate.role === role
      && candidate.componentInstance?.instanceId === instanceId,
  );
  assert.ok(layer, `Expected component text role ${role}.`);
  return layer;
}

test("component save strips source campaign copy and records truth dependencies", () => {
  const source = document({ campaignId: "source", sessionId: "source-session", headline: "Chicken Tikka Wrap", price: "Rs. 1,250" });
  const sourceTruth = truth({ campaignId: "source", sessionId: "source-session", productName: "Chicken Tikka Wrap", price: 1250 });
  const component = createReusableComponent({
    document: source,
    sourceTruth,
    groupLayerId: "group-source",
    componentId: "offer-block-v1",
    name: "Offer Block",
    createdAt: "2026-08-29T05:01:00.000Z",
  });

  assert.deepEqual(component.requiredTruthKeys, ["price", "productName"]);
  assert.equal(component.portability, "STRUCTURE_STYLE_WITH_DESTINATION_TEXT_REBIND");
  const serialized = JSON.stringify(component);
  assert.doesNotMatch(serialized, /Chicken Tikka Wrap/);
  assert.doesNotMatch(serialized, /Rs\. 1,250/);
  assert.equal(component.templates.some((template) => template.type === "text" && "text" in template), false);
});

test("component insertion rebinds native destination text and preserves provenance in one revision", () => {
  const source = document({ campaignId: "source", sessionId: "source-session", headline: "Chicken Tikka Wrap", price: "Rs. 1,250" });
  const component = createReusableComponent({
    document: source,
    sourceTruth: truth({ campaignId: "source", sessionId: "source-session", productName: "Chicken Tikka Wrap", price: 1250 }),
    groupLayerId: "group-source",
    componentId: "offer-block-v1",
    name: "Offer Block",
  });
  const destination = document({ campaignId: "destination", sessionId: "destination-session", headline: "Spicy Beef Burger", price: "Rs. 1,550", includeGroup: false });
  const next = instantiateReusableComponent({
    document: destination,
    destinationTruth: truth({ campaignId: "destination", sessionId: "destination-session", productName: "Spicy Beef Burger", price: 1550 }),
    component,
    instanceId: "instance-1",
    timestamp: "2026-08-29T05:02:00.000Z",
  });

  assert.equal(next.version, 2);
  assert.equal(next.history.at(-1)?.summary.includes("destination text rebinding"), true);
  assert.equal(textByInstance(next, "instance-1", "headline").text, "Spicy Beef Burger");
  assert.equal(textByInstance(next, "instance-1", "price").text, "Rs. 1,550");
  assert.equal(textByInstance(next, "instance-1", "headline").componentInstance?.componentId, "offer-block-v1");
  const group = next.layers.find((layer) => layer.id === "instance-1.group");
  assert.equal(group?.type, "group");
  assert.equal(group?.componentInstance?.instanceId, "instance-1");
  assert.equal(next.layers.find((layer) => layer.id === "logo")?.zIndex, 100);
});

test("component insertion fails closed when destination confirmed truth is missing", () => {
  const source = document({ campaignId: "source", sessionId: "source-session", headline: "Chicken Tikka Wrap", price: "Rs. 1,250" });
  const component = createReusableComponent({
    document: source,
    sourceTruth: truth({ campaignId: "source", sessionId: "source-session", productName: "Chicken Tikka Wrap", price: 1250 }),
    groupLayerId: "group-source",
    componentId: "offer-block-v1",
    name: "Offer Block",
  });
  const destination = document({ campaignId: "destination", sessionId: "destination-session", headline: "Spicy Beef Burger", price: "Rs. 1,550", includeGroup: false });
  assert.throws(
    () => instantiateReusableComponent({
      document: destination,
      destinationTruth: truth({ campaignId: "destination", sessionId: "destination-session", productName: "Spicy Beef Burger" }),
      component,
      instanceId: "instance-1",
    }),
    /COMPONENT_DESTINATION_TRUTH_MISSING.*price/,
  );
});

test("components cannot cross brand boundaries or carry asset-backed children", () => {
  const source = document({ campaignId: "source", sessionId: "source-session", headline: "Chicken Tikka Wrap", price: "Rs. 1,250" });
  const sourceTruth = truth({ campaignId: "source", sessionId: "source-session", productName: "Chicken Tikka Wrap", price: 1250 });
  const component = createReusableComponent({ document: source, sourceTruth, groupLayerId: "group-source", componentId: "offer-block-v1", name: "Offer Block" });
  const otherBrand = document({ campaignId: "other", sessionId: "other-session", headline: "Dining Together", price: "Rs. 1,550", brandId: "ATTHAS_RESTAURANT", includeGroup: false });
  assert.throws(
    () => instantiateReusableComponent({
      document: otherBrand,
      destinationTruth: truth({ campaignId: "other", sessionId: "other-session", productName: "Dining Together", price: 1550, brandId: "ATTHAS_RESTAURANT" }),
      component,
      instanceId: "instance-1",
    }),
    /COMPONENT_BRAND_BOUNDARY_BLOCK/,
  );

  const withImage = document({ campaignId: "source", sessionId: "source-session", headline: "Chicken Tikka Wrap", price: "Rs. 1,250" });
  withImage.layers.push({ id: "photo", name: "Photo", type: "image", x: 500, y: 500, width: 300, height: 300, rotation: 0, opacity: 1, zIndex: 25, visible: true, locked: false, aiEditable: true, asset: { assetId: "photo", source: "generated", visualTruthClass: "GENERIC_CONCEPT_VISUAL" }, fit: "cover" });
  const group = withImage.layers.find((layer) => layer.id === "group-source");
  assert.equal(group?.type, "group");
  if (group?.type === "group") group.childLayerIds = ["badge", "photo"];
  assert.throws(
    () => createReusableComponent({ document: withImage, sourceTruth, groupLayerId: "group-source", componentId: "bad-block", name: "Bad Block" }),
    /COMPONENT_ASSET_BOUNDARY_BLOCK/,
  );
});

test("component store is brand-scoped and immutable", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-components-"));
  try {
    const source = document({ campaignId: "source", sessionId: "source-session", headline: "Chicken Tikka Wrap", price: "Rs. 1,250" });
    const component = createReusableComponent({
      document: source,
      sourceTruth: truth({ campaignId: "source", sessionId: "source-session", productName: "Chicken Tikka Wrap", price: 1250 }),
      groupLayerId: "group-source",
      componentId: "offer-block-v1",
      name: "Offer Block",
    });
    const store = new FileCreativeComponentStore(root);
    await store.save(component);
    const list = await store.list("T001", "ATTHAS_BURGER");
    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, "offer-block-v1");
    assert.equal((await store.list("T001", "ATTHAS_RESTAURANT")).length, 0);
    await assert.rejects(() => store.save(component), /CREATIVE_COMPONENT_IMMUTABLE/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
