import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";

import { createReusableComponent } from "../src/creativeStudio/componentLibrary.js";
import { FileCreativeComponentImpactAnalyzer } from "../src/creativeStudio/componentImpact.js";
import { FileCreativeComponentLifecycleStore } from "../src/creativeStudio/componentLifecycle.js";
import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import { createCreativeStudioComponentLifecycleGuard } from "../src/dashboard/creativeStudioComponentLifecycleGuard.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function fixtureDocument(): DesignDocument {
  const at = "2026-08-29T06:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "impact-lifecycle-design",
    version: 1,
    campaignId: "impact-lifecycle-campaign",
    truthSnapshotId: "task:impact-lifecycle-session",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      { id: "background", name: "Background", type: "background", x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0, visible: true, locked: false, aiEditable: false, fill: "#820008" },
      { id: "headline", name: "Headline", type: "text", x: 80, y: 120, width: 520, height: 130, rotation: 0, opacity: 1, zIndex: 10, visible: true, locked: false, aiEditable: true, text: "Impact Burger", role: "headline", fontFamily: "Anton", fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0, align: "left", fill: "#ffffff" },
      { id: "badge", name: "Badge", type: "shape", shape: "rect", x: 60, y: 280, width: 310, height: 140, rotation: 0, opacity: 1, zIndex: 15, visible: true, locked: false, aiEditable: false, fill: "#b50008", cornerRadius: 18 },
      { id: "group", name: "Impact Block", type: "group", x: 60, y: 120, width: 540, height: 300, rotation: 0, opacity: 1, zIndex: 40, visible: true, locked: false, aiEditable: false, childLayerIds: ["headline", "badge"] },
    ],
    history: [{ version: 1, createdAt: at, summary: "Fixture", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

function fixtureTruth(): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "impact-lifecycle-session",
    campaignId: "impact-lifecycle-campaign",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    confirmedBy: "impact-test",
    confirmedAt: "2026-08-29T06:00:00.000Z",
    facts: [{
      label: "productName:Impact Burger",
      key: "productName",
      value: "Impact Burger",
      scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", productId: "Impact Burger" },
      confirmationAction: "CONFIRM",
      updateStoredTruthRequested: false,
    }],
  };
}

function request(body: unknown): IncomingMessage {
  const stream = Readable.from([Buffer.from(JSON.stringify(body), "utf8")]);
  Object.defineProperty(stream, "method", { value: "POST" });
  return stream as unknown as IncomingMessage;
}

function responseCapture(): { response: ServerResponse; status: () => number | undefined; body: () => string } {
  let statusCode: number | undefined;
  let bodyText = "";
  const response = {
    writeHead(code: number) {
      statusCode = code;
      return this;
    },
    end(value?: string | Buffer) {
      bodyText = value === undefined ? "" : Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
      return this;
    },
  } as unknown as ServerResponse;
  return { response, status: () => statusCode, body: () => bodyText };
}

test("deprecate and archive require a fresh dependency impact token", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-component-impact-lifecycle-"));
  try {
    const document = fixtureDocument();
    const truth = fixtureTruth();
    const component = createReusableComponent({
      document,
      sourceTruth: truth,
      groupLayerId: "group",
      componentId: "impact-block",
      name: "Impact Block",
      createdAt: "2026-08-29T06:00:00.000Z",
    });
    const projects = new FileDesignProjectStore(root);
    await projects.create({ document });
    const lifecycle = new FileCreativeComponentLifecycleStore(root);
    await lifecycle.components.save(component);
    const family = await lifecycle.registerInitial(component);
    const guard = createCreativeStudioComponentLifecycleGuard({ rootDir: root });

    await assert.rejects(
      () => guard(
        request({ designId: document.id, familyId: family.familyId, status: "DEPRECATED" }),
        responseCapture().response,
        new URL("http://localhost/api/studio/components/status"),
      ),
      /COMPONENT_IMPACT_PREVIEW_REQUIRED/,
    );

    const analyzer = new FileCreativeComponentImpactAnalyzer(root);
    const report = await analyzer.analyze({ family, targetComponent: component, targetVersion: 1, generatedAt: "2026-08-29T06:01:00.000Z" });
    const captured = responseCapture();
    const handled = await guard(
      request({ designId: document.id, familyId: family.familyId, status: "DEPRECATED", impactToken: report.impactToken }),
      captured.response,
      new URL("http://localhost/api/studio/components/status"),
    );
    assert.equal(handled, true);
    assert.equal(captured.status(), 200);
    assert.match(captured.body(), /verifiedImpactToken/);
    assert.equal((await lifecycle.get("T001", "ATTHAS_BURGER", family.familyId))?.status, "DEPRECATED");

    const reactivated = responseCapture();
    await guard(
      request({ designId: document.id, familyId: family.familyId, status: "ACTIVE" }),
      reactivated.response,
      new URL("http://localhost/api/studio/components/status"),
    );
    assert.equal((await lifecycle.get("T001", "ATTHAS_BURGER", family.familyId))?.status, "ACTIVE");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
