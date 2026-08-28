import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AiTraceDocument, AiTraceStage } from "../src/aiTrace.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";
import type { CreativeBrief } from "../src/creativeStudio/contracts/creativeBrief.js";
import { createCreativeOrchestrationPlan } from "../src/creativeStudio/orchestrator.js";
import { buildCreativeOrchestrationExecution } from "../src/creativeStudio/orchestrationExecution.js";
import { FileCreativeOrchestrationStore } from "../src/creativeStudio/orchestrationStore.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

const AT = "2026-08-28T18:10:00.000Z";

function brief(): CreativeBrief {
  return {
    schemaVersion: 1,
    id: "brief-execution-1",
    clientId: "T001",
    brandId: "ATTHAS_BURGER",
    goal: "Promote product",
    description: "Promote the Chicken Tikka Wrap.",
    product: { id: "Chicken Tikka Wrap", name: "Chicken Tikka Wrap" },
    branchId: "BURGER_WELLAMPITIYA",
    audience: ["Gen Z"],
    vibe: ["bold", "premium"],
    format: { preset: "instagram-portrait", width: 1080, height: 1350 },
    contentRequirements: {
      showPrice: false,
      showOffer: false,
      showCTA: true,
      showProductName: true,
      showBranch: false,
      showContactDetails: false,
      showCampaignDates: false,
    },
    brandKitId: "ATTHAS_WORKING_V1",
    truthSnapshotId: "task:execution-truth-1",
    createdAt: AT,
  };
}

function truth(): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "execution-truth-1",
    campaignId: "campaign-execution-1",
    tenantId: "T001" as TaskTruthSnapshot["tenantId"],
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    confirmedBy: "creative-studio-user",
    confirmedAt: "2026-08-28T18:10:30.000Z",
    facts: [{
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
    }],
  };
}

const creative: CampaignCreativeOutput = {
  concepts: [{
    id: "hero",
    strategicRole: "conversion",
    campaignName: "Tikka Hero",
    coreIdea: "Craveable product hero",
    customerEmotion: "craving",
    headlineDirection: "short and bold",
    visualConcept: "premium food hero",
    cta: "Order Now",
    targetAudience: "Gen Z",
    expectedStrength: 9,
    risks: [],
  }],
  recommendedConceptId: "hero",
  recommendationReason: "Strong conversion hierarchy.",
  creativeBrief: {
    headline: "Crave the Tikka",
    supportingCopy: "Big flavour. Wrapped fresh.",
    cta: "Order Now",
    visualDirection: "Warm premium product hero",
    composition: "Product dominant with protected copy field",
    lighting: "Warm directional light",
    photographyStyle: "Editorial food photography",
    aspectRatio: "4:5",
  },
  caption: "Crave the Tikka.",
  imageGeneration: {
    basePrompt: "Premium Chicken Tikka Wrap food photography without text.",
    negativePrompt: "text, logos, prices, watermarks",
    visualConstraints: ["realistic food", "clean negative space"],
    textPolicy: "NO_TEXT_OR_LOGOS",
  },
  overlaySpec: {
    headline: "Crave the Tikka",
    supportingCopy: "Big flavour. Wrapped fresh.",
    cta: "Order Now",
    logoUsage: "APPROVED_ONLY",
    placementHints: {
      headline: "upper left",
      supportingCopy: "below headline",
      cta: "lower left",
      logo: "lower right",
    },
  },
  factualQaNotes: ["Product name is confirmed task truth."],
};

function stage(status: AiTraceStage["status"], calls: AiTraceStage["calls"] = [], summary?: unknown): AiTraceStage {
  return { status, calls, ...(summary !== undefined ? { summary } : {}) };
}

function trace(): AiTraceDocument {
  return {
    version: 1,
    campaignId: "campaign-execution-1",
    createdAt: AT,
    updatedAt: AT,
    strategist: stage("COMPLETED", [{
      attempt: 1,
      provider: "gemini",
      model: "strategy-model",
      startedAt: AT,
      completedAt: AT,
    }]),
    creativeDirector: stage("COMPLETED", [{
      attempt: 1,
      provider: "gemini",
      model: "director-model",
      startedAt: AT,
      completedAt: AT,
    }], { decision: "APPROVED" }),
    finalizer: stage("COMPLETED", [{
      attempt: 1,
      provider: "gemini",
      model: "creative-model",
      startedAt: AT,
      completedAt: AT,
    }], { output: creative }),
    briefCompiler: stage("NOT_IMPLEMENTED"),
    image: stage("COMPLETED", [{
      attempt: 1,
      provider: "gemini-image",
      model: "image-model",
      startedAt: AT,
      completedAt: AT,
    }]),
    visualQa: stage("COMPLETED"),
    renderer: stage("COMPLETED", [{
      attempt: 1,
      provider: "deterministic",
      model: "html-css-poster-renderer",
      startedAt: AT,
      completedAt: AT,
    }]),
    finalArtQa: stage("SKIPPED"),
  };
}

function document(generatedTruthClass: "GENERIC_CONCEPT_VISUAL" | "VERIFIED_PRODUCT_VISUAL" = "GENERIC_CONCEPT_VISUAL"): DesignDocument {
  return {
    schemaVersion: 1,
    id: "design-execution-1",
    version: 1,
    campaignId: "campaign-execution-1",
    creativeBriefId: "brief-execution-1",
    truthSnapshotId: "task:execution-truth-1",
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
        asset: {
          assetId: "generated-background",
          source: "generated",
          visualTruthClass: generatedTruthClass,
          generation: { provider: "gemini-image", model: "image-model" },
        },
        fit: "cover",
      },
      {
        id: "headline",
        name: "Headline",
        type: "text",
        role: "headline",
        x: 65,
        y: 75,
        width: 520,
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
      {
        id: "logo",
        name: "Approved Logo",
        type: "logo",
        x: 850,
        y: 1180,
        width: 130,
        height: 62,
        rotation: 0,
        opacity: 1,
        zIndex: 50,
        visible: true,
        locked: true,
        aiEditable: false,
        asset: { assetId: "ATTHAS_MASTER_SYMBOL_A_FORK", source: "approved-brand" },
        preserveAspectRatio: true,
        clearSpacePx: 16,
      },
    ],
    history: [{ version: 1, createdAt: AT, summary: "Initial", actor: "system" }],
    createdAt: AT,
    updatedAt: AT,
  };
}

function plan() {
  return createCreativeOrchestrationPlan({
    campaignId: "campaign-execution-1",
    brief: brief(),
    truthSnapshot: truth(),
    createdAt: "2026-08-28T18:11:00.000Z",
  });
}

test("execution audit derives specialist outputs from the existing governed pipeline with zero extra model calls", () => {
  const execution = buildCreativeOrchestrationExecution({
    plan: plan(),
    trace: trace(),
    document: document(),
    deterministicDesignQa: "PASS",
    completedAt: "2026-08-28T18:12:00.000Z",
  });
  assert.equal(execution.extraModelCallsAddedByOrchestrator, 0);
  assert.deepEqual(execution.specialistExecutions.map((item) => item.role), [
    "COPY_CONTENT",
    "ASSET_DIRECTION",
    "LAYOUT_ART_DIRECTION",
  ]);

  const copy = execution.specialistExecutions[0]!;
  assert.equal(copy.output.headline, "Crave the Tikka");
  assert.equal(copy.output.typographyRenderedAsNativeLayers, true);
  assert.equal(copy.modelCalls, 2);

  const assets = execution.specialistExecutions[1]!;
  assert.equal(assets.output.textPolicy, "NO_TEXT_OR_LOGOS");
  assert.equal(assets.modelCalls, 1);
  assert.ok(Array.isArray(assets.output.mediaAssets));

  const layout = execution.specialistExecutions[2]!;
  assert.equal(layout.output.layoutId, "ATTHAS_BURGER_HERO_PRODUCT_V1");
  assert.equal(layout.output.geometryProfile, "STANDARD_HERO");
  assert.equal(layout.output.deterministicGeometryApplied, true);

  assert.equal(execution.creativeDirector.status, "COMPLETED");
  assert.equal(execution.creativeDirector.reviewPresent, true);
  assert.equal(execution.qa.deterministicDesignQa, "PASS");
  assert.equal(execution.renderer.deterministic, true);
});

test("generated media can never be audited as verified product truth", () => {
  assert.throws(
    () => buildCreativeOrchestrationExecution({
      plan: plan(),
      trace: trace(),
      document: document("VERIFIED_PRODUCT_VISUAL"),
    }),
    /cannot classify a generated asset as VERIFIED_PRODUCT_VISUAL|ORCHESTRATION_EXECUTION_PROVENANCE_BLOCK/,
  );
});

test("execution audit persistence is immutable and bound to the orchestration plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "orchestration-execution-store-"));
  try {
    const store = new FileCreativeOrchestrationStore(root);
    const orchestration = await store.create(plan());
    const execution = buildCreativeOrchestrationExecution({
      plan: orchestration,
      trace: trace(),
      document: document(),
      completedAt: "2026-08-28T18:13:00.000Z",
    });
    const first = await store.saveExecution(execution);
    const second = await store.saveExecution(execution);
    assert.deepEqual(second, first);
    assert.equal((await store.getExecution(orchestration.id))?.designId, "design-execution-1");

    await assert.rejects(
      () => store.saveExecution({ ...execution, completedAt: "2026-08-28T18:14:00.000Z" }),
      /ORCHESTRATION_EXECUTION_CONFLICT/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
