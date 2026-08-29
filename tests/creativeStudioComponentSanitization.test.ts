import assert from "node:assert/strict";
import test from "node:test";

import { createReusableComponent } from "../src/creativeStudio/componentLibrary.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

test("reusable component persistence strips source text and source layer labels", () => {
  const at = "2026-08-29T05:20:00.000Z";
  const document: DesignDocument = {
    schemaVersion: 1,
    id: "design-component-sanitize",
    version: 1,
    campaignId: "campaign-component-sanitize",
    truthSnapshotId: "task:component-sanitize-session",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      { id: "headline", name: "Chicken Tikka Wrap headline", type: "text", x: 100, y: 100, width: 500, height: 120, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: true, text: "Chicken Tikka Wrap", role: "headline", fontFamily: "Anton", fontSize: 70, fontWeight: 700, lineHeight: 1, letterSpacing: 0, align: "left", fill: "#ffffff" },
      { id: "badge", name: "Rs 1250 badge", type: "shape", shape: "rect", x: 80, y: 250, width: 340, height: 150, rotation: 0, opacity: 1, zIndex: 20, visible: true, locked: false, aiEditable: false, fill: "#b50008", cornerRadius: 18 },
      { id: "group", name: "Chicken Tikka Wrap Rs 1250 block", type: "group", x: 80, y: 100, width: 520, height: 300, rotation: 0, opacity: 1, zIndex: 30, visible: true, locked: false, aiEditable: false, childLayerIds: ["headline", "badge"] },
    ],
    history: [{ version: 1, createdAt: at, summary: "Fixture", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
  const truth: TaskTruthSnapshot = {
    schemaVersion: 1,
    sessionId: "component-sanitize-session",
    campaignId: "campaign-component-sanitize",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "component-test",
    confirmedAt: at,
    facts: [{
      label: "productName:Chicken Tikka Wrap",
      key: "productName",
      value: "Chicken Tikka Wrap",
      scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", productId: "Chicken Tikka Wrap" },
      confirmationAction: "CONFIRM",
      updateStoredTruthRequested: false,
    }],
  };

  const component = createReusableComponent({
    document,
    sourceTruth: truth,
    groupLayerId: "group",
    componentId: "sanitized-block",
    name: "Reusable Product Block",
    createdAt: at,
  });
  const serialized = JSON.stringify(component);
  assert.doesNotMatch(serialized, /Chicken Tikka Wrap/);
  assert.doesNotMatch(serialized, /1250/);
  assert.match(serialized, /Component headline/);
  assert.match(serialized, /Component shape 2/);
  assert.deepEqual(component.requiredTruthKeys, ["productName"]);
});
