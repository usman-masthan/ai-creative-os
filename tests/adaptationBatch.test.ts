import assert from "node:assert/strict";
import test from "node:test";

import { produceAdaptationBatch } from "../src/commands/produceAdaptationBatch.js";
import type { DirectedCampaign } from "../src/commands/directCampaign.js";
import type { AtthasMultiFormatAdaptationBundle } from "../src/multiFormatTypes.js";

const campaign = {
  status: "GENERATED",
  preflight: { status: "READY_FOR_CREATIVE", facts: [], missing: [], conflicts: [], factGate: "PASS", riskLevel: "LOW", humanApprovalRequired: false },
  provider: { name: "test", model: "test" },
  generation: { attempts: 1, repairs: 0 },
  production: { format: { channel: "instagram", assetType: "poster", aspectRatio: "4:5", width: 1080, height: 1350 }, complexity: { score: 0, level: "low", reasons: [] } },
  creative: {
    concepts: [{ id: "C1", strategicRole: "conversion", campaignName: "x", coreIdea: "x", customerEmotion: "x", headlineDirection: "x", visualConcept: "x", cta: "x", targetAudience: "x", expectedStrength: 8, risks: [] }],
    recommendedConceptId: "C1",
    recommendationReason: "x",
    creativeBrief: { headline: "x", supportingCopy: "x", cta: "x", visualDirection: "x", composition: "x", lighting: "x", photographyStyle: "x", aspectRatio: "4:5" },
    caption: "x",
    imageGeneration: { basePrompt: "x", negativePrompt: "", visualConstraints: [], textPolicy: "NO_TEXT_OR_LOGOS" },
    overlaySpec: { headline: "x", supportingCopy: "x", cta: "x", logoUsage: "OMIT", placementHints: { headline: "x", supportingCopy: "x", cta: "x", logo: "x" } },
    factualQaNotes: [],
  },
  creativeDirector: {
    director: { provider: "x", model: "x" }, finalizer: { provider: "x", model: "x" },
    review: { reviews: [], winnerConceptId: "C1", winnerRationale: "x", improvementDirectives: [], escalation: { recommended: false, reasons: [] } },
    finalization: { attempts: 1, repairs: 0 },
  },
} as unknown as DirectedCampaign;

const bundle: AtthasMultiFormatAdaptationBundle = {
  adaptationSetId: "C1-MF-V1",
  campaignId: "C1",
  brandId: "ATTHAS_BURGER",
  sourceConceptId: "C1",
  truthVersion: "t1",
  brandVersion: "b1",
  variants: [],
  adaptationNotes: [],
  trace: { provider: "x", model: "x", attempts: 1, repairs: 0, targetCount: 0 },
};

test("FINAL adaptation batch requires both image and final-art QA gates", async () => {
  await assert.rejects(
    produceAdaptationBatch({ campaignId: "C1", sourceCampaign: campaign, bundle, outputDir: "out", mode: "FINAL", baseImagePath: "image.jpg" }),
    /requires visual QA provider and context/,
  );
});

test("adaptation batch rejects a different selected concept", async () => {
  await assert.rejects(
    produceAdaptationBatch({ campaignId: "C1", sourceCampaign: campaign, bundle: { ...bundle, sourceConceptId: "C2" }, outputDir: "out", mode: "DRAFT", baseImagePath: "image.jpg" }),
    /selected concept does not match/,
  );
});

test("adaptation batch rejects campaign identity mismatch", async () => {
  await assert.rejects(
    produceAdaptationBatch({ campaignId: "OTHER", sourceCampaign: campaign, bundle, outputDir: "out", mode: "DRAFT", baseImagePath: "image.jpg" }),
    /campaign ID does not match/,
  );
});
