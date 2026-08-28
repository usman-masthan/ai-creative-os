import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CreativeBrief } from "../src/creativeStudio/contracts/creativeBrief.js";
import {
  createCreativeOrchestrationPlan,
  type CreativeOrchestrationPlan,
} from "../src/creativeStudio/orchestrator.js";
import { FileCreativeOrchestrationStore } from "../src/creativeStudio/orchestrationStore.js";
import { FileDesignProjectStore } from "../src/creativeStudio/projectStore.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function brief(overrides: Partial<CreativeBrief> = {}): CreativeBrief {
  return {
    schemaVersion: 1,
    id: "brief-orchestrator-1",
    clientId: "T001",
    brandId: "ATTHAS_BURGER",
    goal: "Promote product",
    description: "Promote the Chicken Tikka Wrap with a bold premium treatment.",
    product: { id: "Chicken Tikka Wrap", name: "Chicken Tikka Wrap" },
    branchId: "BURGER_WELLAMPITIYA",
    salesChannel: "DINE_IN",
    audience: ["students", "Gen Z"],
    vibe: ["bold", "premium"],
    format: { preset: "instagram-portrait", width: 1080, height: 1350 },
    contentRequirements: {
      showPrice: true,
      showOffer: false,
      showCTA: true,
      showProductName: true,
      showBranch: true,
      showContactDetails: false,
      showCampaignDates: false,
    },
    brandKitId: "ATTHAS_WORKING_V1",
    truthSnapshotId: "task:truth-session-1",
    createdAt: "2026-08-28T17:00:00.000Z",
    ...overrides,
  };
}

function snapshot(overrides: Partial<TaskTruthSnapshot> = {}): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "truth-session-1",
    campaignId: "campaign-orchestrator-1",
    tenantId: "T001" as TaskTruthSnapshot["tenantId"],
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    confirmedBy: "creative-studio-user",
    confirmedAt: "2026-08-28T17:01:00.000Z",
    facts: [
      {
        label: "productName|branch=BURGER_WELLAMPITIYA|product=Chicken Tikka Wrap",
        key: "productName",
        value: "Chicken Tikka Wrap",
        scope: {
          tenantId: "T001" as TaskTruthSnapshot["tenantId"],
          brandId: "ATTHAS_BURGER",
          branchId: "BURGER_WELLAMPITIYA",
          productId: "Chicken Tikka Wrap",
        },
        confirmationAction: "CONFIRM",
        updateStoredTruthRequested: false,
      },
      {
        label: "price|branch=BURGER_WELLAMPITIYA|product=Chicken Tikka Wrap|channel=DINE_IN",
        key: "price",
        value: "LKR 1,250",
        scope: {
          tenantId: "T001" as TaskTruthSnapshot["tenantId"],
          brandId: "ATTHAS_BURGER",
          branchId: "BURGER_WELLAMPITIYA",
          productId: "Chicken Tikka Wrap",
          salesChannel: "DINE_IN",
        },
        confirmationAction: "CONFIRM",
        updateStoredTruthRequested: false,
      },
    ],
    ...overrides,
  };
}

function plan(): CreativeOrchestrationPlan {
  return createCreativeOrchestrationPlan({
    campaignId: "campaign-orchestrator-1",
    brief: brief(),
    truthSnapshot: snapshot(),
    createdAt: "2026-08-28T17:02:00.000Z",
  });
}

function document(): DesignDocument {
  const at = "2026-08-28T17:03:00.000Z";
  return {
    schemaVersion: 1,
    id: "design-orchestrator-1",
    version: 1,
    campaignId: "campaign-orchestrator-1",
    creativeBriefId: "brief-orchestrator-1",
    truthSnapshotId: "task:truth-session-1",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: {
      clientId: "T001",
      brandId: "ATTHAS_BURGER",
      brandKitId: "ATTHAS_WORKING_V1",
    },
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
        x: 65,
        y: 75,
        width: 540,
        height: 180,
        rotation: 0,
        opacity: 1,
        zIndex: 20,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "Crave the Tikka",
        fontFamily: "Oswald",
        fontSize: 76,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: -1,
        align: "left",
        fill: "#FFFFFF",
      },
    ],
    history: [{ version: 1, createdAt: at, summary: "Initial", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

test("Creative Orchestrator is created only from confirmed truth and coordinates real specialist responsibilities", () => {
  const orchestration = plan();
  assert.equal(orchestration.status, "READY_FOR_GOVERNED_PRODUCTION");
  assert.equal(orchestration.truthSnapshotId, "task:truth-session-1");
  assert.equal(orchestration.truthConfirmation.confirmedBy, "creative-studio-user");
  assert.equal(orchestration.brandContext.typographyMode, "NATIVE_EDITABLE");
  assert.equal(orchestration.brandContext.logoPolicy, "APPROVED_SOURCE_ONLY");
  assert.equal(orchestration.brandContext.approvedLogoAssetId, "ATTHAS_MASTER_SYMBOL_A_FORK");
  assert.equal(orchestration.brandContext.availableLayoutCount, 5);
  assert.deepEqual(
    orchestration.execution.specialistTasks.map((task) => task.role),
    ["COPY_CONTENT", "ASSET_DIRECTION", "LAYOUT_ART_DIRECTION"],
  );
  assert.ok(orchestration.execution.specialistTasks.every((task) => task.canRunInParallel));
  assert.ok(orchestration.execution.specialistTasks.every((task) => task.dependsOn.includes("CONFIRMED_TRUTH")));
  assert.equal(orchestration.productionGuards.deterministicLayoutRequired, true);
  assert.equal(orchestration.productionGuards.generatedMediaCannotBecomeVerifiedProductVisual, true);
});

test("Creative Orchestrator rejects unbound or mismatched task truth", () => {
  assert.throws(
    () => createCreativeOrchestrationPlan({
      campaignId: "campaign-orchestrator-1",
      brief: brief({ truthSnapshotId: undefined }),
      truthSnapshot: snapshot(),
    }),
    /ORCHESTRATION_TRUTH_REQUIRED/,
  );
  assert.throws(
    () => createCreativeOrchestrationPlan({
      campaignId: "campaign-orchestrator-1",
      brief: brief(),
      truthSnapshot: snapshot({ brandId: "ATTHAS_RESTAURANT" }),
    }),
    /ORCHESTRATION_BRAND_MISMATCH/,
  );
  assert.throws(
    () => createCreativeOrchestrationPlan({
      campaignId: "another-campaign",
      brief: brief(),
      truthSnapshot: snapshot(),
    }),
    /ORCHESTRATION_CAMPAIGN_MISMATCH/,
  );
});

test("orchestration persistence is idempotent but immutable", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-orchestrator-store-"));
  try {
    const store = new FileCreativeOrchestrationStore(root);
    const orchestration = plan();
    const first = await store.create(orchestration);
    const second = await store.create(orchestration);
    assert.deepEqual(second, first);
    assert.equal((await store.getCurrentForCampaign(orchestration.campaignId))?.id, orchestration.id);

    await assert.rejects(
      () => store.create({ ...orchestration, createdAt: "2026-08-28T17:09:00.000Z" }),
      /ORCHESTRATION_CONFLICT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("DesignProject persists orchestration provenance bound to campaign, truth and CreativeBrief", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-orchestrator-project-"));
  try {
    const store = new FileDesignProjectStore(root);
    const orchestration = plan();
    const created = await store.create({ document: document(), brief: brief(), orchestration });
    assert.equal(created.orchestration?.id, orchestration.id);
    assert.equal(created.orchestration?.truthSnapshotId, created.document.truthSnapshotId);

    const wrong = { ...orchestration, campaignId: "wrong-campaign" };
    await assert.rejects(
      () => store.create({
        document: { ...document(), id: "design-orchestrator-wrong" },
        brief: brief(),
        orchestration: wrong,
      }),
      /DESIGN_ORCHESTRATION_MISMATCH/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
