import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import { DesignVersionService } from "../src/creativeStudio/versioning.js";
import { applyDesignOperation } from "../src/designDocument/operations.js";
import type { DesignDocument } from "../src/designDocument/types.js";

function fixture(): DesignDocument {
  const at = "2026-08-28T18:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "versioned-design",
    version: 1,
    campaignId: "versioned-campaign",
    truthSnapshotId: "task:versioned",
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
        x: 80,
        y: 90,
        width: 600,
        height: 200,
        rotation: 0,
        opacity: 1,
        zIndex: 20,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "Original headline",
        fontFamily: "Oswald",
        fontSize: 80,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: -1,
        align: "left",
        fill: "#FFFFFF",
      },
      {
        id: "logo",
        name: "Logo",
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
        asset: { assetId: "logo", source: "approved-brand", uri: "/tmp/logo.svg", mimeType: "image/svg+xml" },
        preserveAspectRatio: true,
        clearSpacePx: 16,
      },
    ],
    history: [{ version: 1, createdAt: at, summary: "Initial", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

test("saved versions can be compared and restored as a new revision", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-versioning-"));
  try {
    const store = new FileDesignProjectStore(root);
    const versions = new DesignVersionService(root);
    const initial = await store.create({ document: fixture() });
    const moved = applyDesignOperation(
      initial.document,
      { type: "MOVE_LAYER", layerId: "headline", x: 150, y: 180 },
      "2026-08-28T18:01:00.000Z",
    );
    const v2 = await store.save(moved);
    const changed = applyDesignOperation(
      v2.document,
      { type: "UPDATE_TEXT", layerId: "headline", text: "Changed headline" },
      "2026-08-28T18:02:00.000Z",
    );
    await store.save(changed);

    const comparison = await versions.compare("versioned-design", 1, 3);
    assert.equal(comparison.fromVersion, 1);
    assert.equal(comparison.toVersion, 3);
    const headlineChange = comparison.layerChanges.find((item) => item.layerId === "headline");
    assert.equal(headlineChange?.kind, "changed");
    assert.ok(headlineChange?.fields.includes("x"));
    assert.ok(headlineChange?.fields.includes("text"));

    const restored = await versions.restore(
      "versioned-design",
      1,
      "2026-08-28T18:03:00.000Z",
    );
    assert.equal(restored.document.version, 4);
    const restoredHeadline = restored.document.layers.find((layer) => layer.id === "headline");
    assert.equal(restoredHeadline?.x, 80);
    assert.equal(restoredHeadline?.type === "text" ? restoredHeadline.text : undefined, "Original headline");
    assert.match(restored.document.history.at(-1)?.summary ?? "", /Restored design content from v1/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
