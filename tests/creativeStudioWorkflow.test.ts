import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { editCreativeImageLayer, editCreativeTextLayer } from "../src/commands/editCreativeLayer.js";
import { runDesignQa } from "../src/creativeStudio/designQa.js";
import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import { buildDesignDocumentHtml } from "../src/creativeStudio/renderDesignDocument.js";
import { applyDesignOperation } from "../src/designDocument/operations.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { ImageDraftProvider } from "../src/imageProviders/types.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function documentFixture(): DesignDocument {
  const now = "2026-08-28T16:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "design-test",
    version: 1,
    campaignId: "campaign-test",
    truthSnapshotId: "task:truth-test",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      {
        id: "background",
        name: "Background",
        type: "background",
        x: 0,
        y: 0,
        width: 1080,
        height: 1350,
        rotation: 0,
        opacity: 1,
        zIndex: 0,
        visible: true,
        locked: false,
        aiEditable: true,
        fill: "#820008",
      },
      {
        id: "headline",
        name: "Headline",
        type: "text",
        role: "headline",
        x: 90,
        y: 100,
        width: 560,
        height: 210,
        rotation: 0,
        opacity: 1,
        zIndex: 20,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "Crave the Tikka",
        fontFamily: "Oswald",
        fontSize: 82,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: -1,
        align: "left",
        fill: "#FFFFFF",
      },
      {
        id: "price",
        name: "Price",
        type: "text",
        role: "price",
        x: 720,
        y: 100,
        width: 240,
        height: 100,
        rotation: 0,
        opacity: 1,
        zIndex: 30,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "LKR 1,250",
        fontFamily: "Oswald",
        fontSize: 48,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0,
        align: "center",
        fill: "#FFD21A",
      },
      {
        id: "logo",
        name: "Approved Logo",
        type: "logo",
        x: 850,
        y: 1180,
        width: 120,
        height: 80,
        rotation: 0,
        opacity: 1,
        zIndex: 50,
        visible: true,
        locked: true,
        aiEditable: false,
        asset: { assetId: "ATTHAS_MASTER_SYMBOL_A_FORK", source: "approved-brand", uri: "/tmp/logo.svg", mimeType: "image/svg+xml" },
        preserveAspectRatio: true,
        clearSpacePx: 16,
      },
    ],
    history: [{ version: 1, createdAt: now, summary: "Initial", actor: "system" }],
    createdAt: now,
    updatedAt: now,
  };
}

function truthFixture(price = 1250): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "truth-test",
    campaignId: "campaign-test",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "owner",
    confirmedAt: "2026-08-28T16:00:00.000Z",
    facts: [
      {
        label: "price",
        key: "price",
        value: price,
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER" },
        confirmationAction: "PROVIDE",
        updateStoredTruthRequested: false,
      },
      {
        label: "productName",
        key: "productName",
        value: "Chicken Tikka Wrap",
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER" },
        confirmationAction: "PROVIDE",
        updateStoredTruthRequested: false,
      },
    ],
  };
}

test("Creative Studio store persists versions and supports undo/redo", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-studio-"));
  try {
    const store = new FileDesignProjectStore(root);
    const first = await store.create({ document: documentFixture() });
    assert.equal(first.state.currentVersion, 1);
    const moved = applyDesignOperation(first.document, { type: "MOVE_LAYER", layerId: "headline", x: 120, y: 160 }, "2026-08-28T16:01:00.000Z");
    const second = await store.save(moved);
    assert.equal(second.document.version, 2);
    assert.equal(second.document.layers.find((layer) => layer.id === "headline")?.x, 120);
    const undone = await store.undo("design-test");
    assert.equal(undone.state.currentVersion, 1);
    assert.equal(undone.document.layers.find((layer) => layer.id === "headline")?.x, 90);
    const redone = await store.redo("design-test");
    assert.equal(redone.state.currentVersion, 2);
    assert.equal(redone.document.layers.find((layer) => layer.id === "headline")?.x, 120);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deterministic design QA blocks price truth mismatch", () => {
  const qa = runDesignQa({ document: documentFixture(), truthSnapshot: truthFixture(999) });
  assert.equal(qa.decision, "BLOCK");
  assert.ok(qa.issues.some((item) => item.code === "PRICE_TRUTH_MISMATCH" && item.blocker));
});

test("AI text edit changes only selected text and blocks invented numbers", async () => {
  const provider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-text",
    generate: async () => JSON.stringify({ text: "Tikka Worth Craving" }),
  };
  const original = documentFixture();
  const edited = await editCreativeTextLayer({
    document: original,
    layerId: "headline",
    instruction: "Make it punchier",
    truthSnapshot: truthFixture(),
    provider,
    timestamp: "2026-08-28T16:02:00.000Z",
  });
  const headline = edited.layers.find((layer) => layer.id === "headline");
  const price = edited.layers.find((layer) => layer.id === "price");
  assert.equal(headline?.type === "text" ? headline.text : undefined, "Tikka Worth Craving");
  assert.equal(price?.type === "text" ? price.text : undefined, "LKR 1,250");
  const unsafe: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-text",
    generate: async () => JSON.stringify({ text: "Now only 777" }),
  };
  await assert.rejects(
    editCreativeTextLayer({
      document: original,
      layerId: "headline",
      instruction: "Make it stronger",
      truthSnapshot: truthFixture(),
      provider: unsafe,
    }),
    /FACT_GOVERNANCE_BLOCK/,
  );
});

test("AI background editing refuses an unsegmented composite", async () => {
  let called = false;
  const provider: ImageDraftProvider = {
    providerName: "mock-image",
    model: "mock-image",
    generate: async () => {
      called = true;
      return { provider: "mock-image", model: "mock-image", dataBase64: "AA==", mimeType: "image/jpeg" };
    },
  };
  await assert.rejects(
    editCreativeImageLayer({
      document: documentFixture(),
      layerId: "background",
      instruction: "Change to a beach at sunset",
      truthSnapshot: truthFixture(),
      provider,
      outputDir: "/tmp/unused-creative-studio-test",
    }),
    /LAYER_ISOLATION_REQUIRED/,
  );
  assert.equal(called, false);
});

test("manual operations protect logo governance and support eligible duplication", () => {
  const document = documentFixture();
  assert.throws(
    () => applyDesignOperation(document, { type: "ROTATE_LAYER", layerId: "logo", rotation: 10 }),
    /DESIGN_LAYER_LOCKED|BRAND_GOVERNANCE_BLOCK/,
  );
  const duplicated = applyDesignOperation(document, {
    type: "DUPLICATE_LAYER",
    layerId: "headline",
    newLayerId: "headline-copy",
  });
  assert.ok(duplicated.layers.some((layer) => layer.id === "headline-copy"));
  assert.equal(duplicated.version, 2);
});

test("DesignDocument renderer emits native text instead of image-generated copy", async () => {
  const document = documentFixture();
  document.layers = document.layers.filter((layer) => layer.type !== "logo");
  const html = await buildDesignDocumentHtml(document);
  assert.match(html, /Crave the Tikka/);
  assert.match(html, /font-family/);
  assert.doesNotMatch(html, /selection-box|safe-guide|editor-ui/);
});
