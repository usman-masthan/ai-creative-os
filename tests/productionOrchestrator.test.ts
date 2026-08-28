import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  producePlannedCampaign,
  type ProducePlannedCampaignRequest,
} from "../src/commands/producePlannedCampaign.js";
import type { ProducePosterRequest, ProducePosterResult } from "../src/commands/producePoster.js";
import { ATTHAS_LAYOUTS } from "../src/layouts/atthas.js";
import type { MarketingCalendarEntry } from "../src/marketingPlannerTypes.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import type { TruthRecord } from "../src/types.js";
import type { VisualQaDecision, VisualQaProvider, VisualQaResult } from "../src/visualQa/types.js";
import type { ImageDraftProvider } from "../src/imageProviders/types.js";

const branchTruth: TruthRecord[] = [
  {
    key: "branchPhysicalAddress",
    value: "Urban City Food Court, Ambagaha Junction Rd, Kotikawatta",
    status: "VERIFIED",
    sourceId: "OWNER_BRANCH_MASTER_2026_08_25",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
    },
  },
  {
    key: "physicalOpeningHours",
    value: "17:00-00:00",
    status: "VERIFIED",
    sourceId: "OWNER_BRANCH_MASTER_2026_08_25",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
    },
  },
];

function readyEntry(): MarketingCalendarEntry {
  return {
    slotId: "S01",
    date: "2026-09-01",
    brandId: "ATTHAS_BURGER",
    branchScope: "BURGER_WELLAMPITIYA",
    campaignType: "DINE_IN",
    objective: "Increase consideration for the Wellampitiya physical branch",
    audience: "Nearby diners",
    channel: "instagram",
    assetType: "poster",
    priority: "P1",
    conceptDirection: "Build a clear branch invitation using only verified location and hours.",
    additionalTruthNeeded: [],
    requiredTruth: ["branchPhysicalAddress", "physicalOpeningHours"],
    missingTruth: [],
    truthReadiness: "READY_WITH_CURRENT_TRUTH",
  };
}

function blockedEntry(): MarketingCalendarEntry {
  return {
    ...readyEntry(),
    campaignType: "PRODUCT_PUSH",
    requiredTruth: ["productName", "branchAvailability", "approvedProductVisual"],
    missingTruth: ["branchAvailability", "approvedProductVisual"],
    truthReadiness: "NEEDS_TRUTH_BEFORE_PRODUCTION",
  };
}

function creativeObject() {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Find Your Table",
        coreIdea: "Make the verified branch location and opening hours easy to act on.",
        customerEmotion: "clarity",
        headlineDirection: "Visit ATTHA'S Burger Wellampitiya",
        visualConcept: "Bold branch-led hospitality composition with protected copy space.",
        cta: "Visit Us",
        targetAudience: "Nearby diners",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Your Evening Stop",
        coreIdea: "Create a warm arrival moment around the verified physical branch.",
        customerEmotion: "anticipation",
        headlineDirection: "ATTHA'S Burger Wellampitiya",
        visualConcept: "Energetic restaurant ambience without product-specific claims.",
        cta: "Visit Us",
        targetAudience: "Evening diners",
        expectedStrength: 9,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "Know the Place",
        coreIdea: "Build branch familiarity with a simple repeatable location-led message.",
        customerEmotion: "familiarity",
        headlineDirection: "Wellampitiya",
        visualConcept: "Minimal branch atmosphere with generous negative space.",
        cta: "Visit Us",
        targetAudience: "Local customers",
        expectedStrength: 7,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "The clearest location-led route.",
    creativeBrief: {
      headline: "Visit ATTHA'S Burger Wellampitiya",
      supportingCopy: "Urban City Food Court · 17:00–00:00",
      cta: "Visit Us",
      visualDirection: "Branch-led evening ambience with no product-specific depiction.",
      composition: "Strong environmental focal point with clean overlay zones.",
      lighting: "Warm evening lighting.",
      photographyStyle: "Believable commercial restaurant photography.",
      aspectRatio: "4:5",
    },
    caption: "ATTHA'S Burger Wellampitiya · Urban City Food Court · 17:00–00:00.",
    imageGeneration: {
      basePrompt: "Warm commercial restaurant ambience concept for ATTHA'S Burger, no product-specific food claims, realistic evening setting and clean space for later deterministic copy.",
      negativePrompt: "No text, numbers, signs, logos, badges, menus, labels or watermarks.",
      visualConstraints: [
        "restaurant ambience concept only",
        "no generated signage",
        "preserve copy-safe negative space",
      ],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Visit ATTHA'S Burger Wellampitiya",
      supportingCopy: "Urban City Food Court · 17:00–00:00",
      cta: "Visit Us",
      logoUsage: "OMIT",
      placementHints: {
        headline: "top-left",
        supportingCopy: "below headline",
        cta: "bottom-right",
        logo: "omit",
      },
    },
    factualQaNotes: ["Address and physical hours are owner-confirmed branch facts."],
  };
}

function finalCreative() {
  const creative = structuredClone(creativeObject());
  creative.recommendedConceptId = "C2";
  creative.recommendationReason = "Creative Director selected the strongest branch-led emotional route.";
  creative.creativeBrief.headline = "Your Evening Stop";
  creative.overlaySpec.headline = "Your Evening Stop";
  return creative;
}

function directorReview() {
  return {
    reviews: [
      {
        conceptId: "C1",
        scores: {
          strategicFit: 8,
          brandFit: 8,
          originality: 6,
          emotionalStrength: 6,
          conversionPotential: 8,
          visualPotential: 7,
          factualSafety: 10,
          productionEfficiency: 9,
        },
        strengths: ["Clear location route"],
        weaknesses: ["Less emotional"],
        risks: [],
      },
      {
        conceptId: "C2",
        scores: {
          strategicFit: 9,
          brandFit: 9,
          originality: 8,
          emotionalStrength: 9,
          conversionPotential: 8,
          visualPotential: 9,
          factualSafety: 10,
          productionEfficiency: 9,
        },
        strengths: ["Strong branch atmosphere"],
        weaknesses: [],
        risks: [],
      },
      {
        conceptId: "C3",
        scores: {
          strategicFit: 7,
          brandFit: 8,
          originality: 7,
          emotionalStrength: 6,
          conversionPotential: 6,
          visualPotential: 7,
          factualSafety: 10,
          productionEfficiency: 9,
        },
        strengths: ["Reusable brand structure"],
        weaknesses: ["Lower action intent"],
        risks: [],
      },
    ],
    winnerConceptId: "C2",
    winnerRationale: "C2 best balances branch fit, atmosphere and production potential.",
    improvementDirectives: [
      "Keep owner-confirmed location and hours explicit",
      "Preserve clean overlay zones",
    ],
    escalation: { recommended: false, reasons: [] },
  };
}

function provider(name: string, outputs: unknown[]): CampaignGenerationProvider {
  let index = 0;
  return {
    providerName: name,
    model: `${name}-model`,
    async generate() {
      const output = outputs[Math.min(index, outputs.length - 1)];
      index += 1;
      return typeof output === "string" ? output : JSON.stringify(output);
    },
  };
}

function imageProvider(prompts: string[]): ImageDraftProvider {
  return {
    providerName: "mock-image",
    model: "mock-image-model",
    async generate(request) {
      prompts.push(request.prompt);
      return {
        provider: "mock-image",
        model: "mock-image-model",
        dataBase64: Buffer.alloc(2_000, prompts.length).toString("base64"),
        mimeType: "image/jpeg",
        costUsd: 0.01,
      };
    },
  };
}

function qaResult(decision: VisualQaDecision, issue = ""): VisualQaResult {
  return {
    provider: "mock-qa",
    model: "mock-qa-model",
    decision,
    scores: {
      productTruth: decision === "PASS" ? 95 : 70,
      brandFit: 90,
      realism: decision === "PASS" ? 90 : 70,
      foodTexture: decision === "PASS" ? 88 : 68,
      composition: decision === "PASS" ? 92 : 60,
      copyZoneSuitability: decision === "PASS" ? 90 : 62,
      governance: 95,
      rights: 100,
    },
    issues: issue ? [issue] : [],
    observedIngredients: [],
    unexpectedVisibleElements: [],
    notes: [],
  };
}

function qaProvider(decisions: VisualQaResult[]): VisualQaProvider {
  let index = 0;
  return {
    providerName: "mock-qa",
    model: "mock-qa-model",
    async review() {
      const result = decisions[Math.min(index, decisions.length - 1)];
      index += 1;
      if (!result) throw new Error("Missing mock QA result");
      return result;
    },
  };
}

async function posterProducer(request: ProducePosterRequest): Promise<ProducePosterResult> {
  const layout = ATTHAS_LAYOUTS.find((item) => item.id === request.layoutId);
  if (!layout) throw new Error("Expected selected layout in poster request");
  if (!request.baseImagePath) throw new Error("Expected persisted base image path");
  return {
    status: "POSTER_RENDERED",
    outputDir: request.outputDir,
    baseImagePath: request.baseImagePath,
    htmlPath: join(request.outputDir, "poster.html"),
    pngPath: join(request.outputDir, "poster.png"),
    layout,
    qa: {
      pass: true,
      width: request.campaign.production.format.width,
      height: request.campaign.production.format.height,
      bytes: 50_000,
      checks: ["mock"],
    },
  };
}

function baseRequest(outputDir: string, prompts: string[]): ProducePlannedCampaignRequest {
  return {
    campaignId: "ATTHAS-PLANNED-S01",
    entry: readyEntry(),
    truthRecords: branchTruth,
    brandContext: "ATTHA'S Burger is bold, energetic, uncomplicated and branch-truth governed.",
    outputDir,
    mode: "FINAL",
    providers: {
      generation: provider("generator", [creativeObject()]),
      director: provider("director", [directorReview()]),
      finalizer: provider("finalizer", [finalCreative()]),
      image: imageProvider(prompts),
      visualQa: qaProvider([qaResult("PASS")]),
    },
    visualQaContext: {
      visualClass: "CONSTRAINED_PRODUCT_GENERATION",
      rightsStatus: "cleared",
    },
    posterProducer,
  };
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "atthas-production-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("planned campaigns blocked by deferred truth stop before any AI call", async () => {
  await withTempDir(async (dir) => {
    let called = false;
    const never: CampaignGenerationProvider = {
      providerName: "never",
      model: "never",
      async generate() {
        called = true;
        throw new Error("should not run");
      },
    };

    const result = await producePlannedCampaign({
      campaignId: "BLOCKED",
      entry: blockedEntry(),
      truthRecords: [],
      brandContext: "ATTHA'S",
      outputDir: dir,
      providers: { generation: never, director: never, finalizer: never },
    });

    assert.equal(result.status, "BLOCKED_PLANNED_TRUTH");
    assert.equal(called, false);
  });
});

test("final production requires visual QA before paid/generated media is created", async () => {
  await withTempDir(async (dir) => {
    const prompts: string[] = [];
    const request = baseRequest(dir, prompts);
    request.providers.visualQa = undefined;
    request.visualQaContext = undefined;

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "BLOCKED_VISUAL_QA_REQUIRED");
    assert.equal(prompts.length, 0);
  });
});

test("REGENERATE feeds QA issues and layout composition back into a bounded image retry", async () => {
  await withTempDir(async (dir) => {
    const prompts: string[] = [];
    const request = baseRequest(dir, prompts);
    request.providers.visualQa = qaProvider([
      qaResult("REGENERATE", "message zone is visually cluttered"),
      qaResult("PASS"),
    ]);

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "FINAL_RENDERED");
    if (result.status !== "FINAL_RENDERED") return;

    assert.equal(result.imageAttempts.length, 2);
    assert.equal(prompts.length, 2);
    assert.match(prompts[0]!, /Layout composition requirements:/);
    assert.match(prompts[0]!, /large uninterrupted area for minimal headline treatment/);
    assert.doesNotMatch(prompts[0]!, /main food subject/);
    assert.match(prompts[1]!, /message zone is visually cluttered/);
    assert.equal(result.visualQa?.decision, "PASS");
    assert.equal(result.poster.layout.brandId, "ATTHAS_BURGER");
  });
});

test("HUMAN_REVIEW prevents final poster rendering and preserves the draft for review", async () => {
  await withTempDir(async (dir) => {
    const prompts: string[] = [];
    const request = baseRequest(dir, prompts);
    let rendered = false;
    request.providers.visualQa = qaProvider([
      qaResult("HUMAN_REVIEW", "concept imagery needs human confirmation"),
    ]);
    request.posterProducer = async (posterRequest) => {
      rendered = true;
      return posterProducer(posterRequest);
    };

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "HUMAN_REVIEW_REQUIRED");
    assert.equal(rendered, false);
    if (result.status === "HUMAN_REVIEW_REQUIRED") {
      assert.match(result.draftImagePath, /draft-attempt-01\.jpg$/);
    }
  });
});

test("draft mode can render a clearly non-final proof without visual QA", async () => {
  await withTempDir(async (dir) => {
    const prompts: string[] = [];
    const request = baseRequest(dir, prompts);
    request.mode = "DRAFT";
    request.providers.visualQa = undefined;
    request.visualQaContext = undefined;

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "DRAFT_RENDERED");
    if (result.status === "DRAFT_RENDERED") {
      assert.equal(result.poster.status, "POSTER_RENDERED");
      assert.equal(result.imageAttempts.length, 1);
    }
  });
});


function tierImageProvider(label: string, calls: string[]): ImageDraftProvider {
  return {
    providerName: "mock-image",
    model: `mock-${label}`,
    async generate() {
      calls.push(label);
      return {
        provider: "mock-image",
        model: `mock-${label}`,
        dataBase64: Buffer.alloc(2_000, calls.length).toString("base64"),
        mimeType: "image/jpeg",
        costUsd: label === "flash-lite" ? 0.01 : label === "flash" ? 0.02 : 0.05,
      };
    },
  };
}

function passQaWithScore(
  dimension: keyof VisualQaResult["scores"],
  score: number,
): VisualQaResult {
  const result = qaResult("PASS");
  result.scores[dimension] = score;
  return result;
}

test("tiered QA escalation uses Flash Lite then Flash then Pro and stops on a qualifying Pro image", async () => {
  await withTempDir(async (dir) => {
    const legacyPrompts: string[] = [];
    const calls: string[] = [];
    const request = baseRequest(dir, legacyPrompts);
    request.providers.image = undefined;
    request.providers.imageTiers = {
      FLASH_LITE: tierImageProvider("flash-lite", calls),
      FLASH: tierImageProvider("flash", calls),
      PRO: tierImageProvider("pro", calls),
    };
    request.providers.visualQa = qaProvider([
      passQaWithScore("productTruth", 84),
      passQaWithScore("productTruth", 89),
      qaResult("PASS"),
    ]);

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "FINAL_RENDERED");
    if (result.status !== "FINAL_RENDERED") return;

    assert.deepEqual(calls, ["flash-lite", "flash", "pro"]);
    assert.equal(legacyPrompts.length, 0);
    assert.deepEqual(
      result.imageAttempts.map((attempt) => attempt.qualityTier),
      ["FLASH_LITE", "FLASH", "PRO"],
    );
    assert.deepEqual(
      result.imageAttempts.map((attempt) => attempt.qualityGate?.action),
      ["ESCALATE", "ESCALATE", "PASS"],
    );
    assert.deepEqual(
      result.imageAttempts.map((attempt) => attempt.model),
      ["mock-flash-lite", "mock-flash", "mock-pro"],
    );
  });
});

test("a failing Pro image routes to human review after exactly three paid image attempts", async () => {
  await withTempDir(async (dir) => {
    const legacyPrompts: string[] = [];
    const calls: string[] = [];
    const request = baseRequest(dir, legacyPrompts);
    let rendered = false;
    request.providers.image = undefined;
    request.providers.imageTiers = {
      FLASH_LITE: tierImageProvider("flash-lite", calls),
      FLASH: tierImageProvider("flash", calls),
      PRO: tierImageProvider("pro", calls),
    };
    request.providers.visualQa = qaProvider([
      passQaWithScore("productTruth", 84),
      passQaWithScore("productTruth", 89),
      passQaWithScore("composition", 82),
    ]);
    request.posterProducer = async (posterRequest) => {
      rendered = true;
      return posterProducer(posterRequest);
    };

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "HUMAN_REVIEW_REQUIRED");
    assert.equal(rendered, false);
    assert.deepEqual(calls, ["flash-lite", "flash", "pro"]);
    assert.equal(result.imageAttempts.length, 3);
    assert.equal(result.imageAttempts.at(-1)?.qualityTier, "PRO");
    assert.equal(result.imageAttempts.at(-1)?.qualityGate?.action, "HUMAN_REVIEW");
    assert.ok(
      result.imageAttempts.at(-1)?.qualityGate?.reasons.some((reason) => reason.includes("terminal")),
    );
  });
});

test("a qualifying Flash image prevents unnecessary Pro generation", async () => {
  await withTempDir(async (dir) => {
    const legacyPrompts: string[] = [];
    const calls: string[] = [];
    const request = baseRequest(dir, legacyPrompts);
    request.providers.image = undefined;
    request.providers.imageTiers = {
      FLASH_LITE: tierImageProvider("flash-lite", calls),
      FLASH: tierImageProvider("flash", calls),
      PRO: tierImageProvider("pro", calls),
    };
    request.providers.visualQa = qaProvider([
      passQaWithScore("productTruth", 84),
      qaResult("PASS"),
    ]);

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "FINAL_RENDERED");
    assert.deepEqual(calls, ["flash-lite", "flash"]);
    assert.equal(result.imageAttempts.length, 2);
    assert.equal(result.imageAttempts[1]?.qualityGate?.action, "PASS");
  });
});


test("new renderer receives measured Visual QA copy zones instead of relying on brief quiet zones", async () => {
  await withTempDir(async (dir) => {
    const prompts: string[] = [];
    const request = baseRequest(dir, prompts);
    request.featureFlags = { useNewRenderer: true };
    const pass = qaResult("PASS");
    pass.compositionEvidence = {
      heroPlacement: "MATCH",
      heroScale: "MATCH",
      cropQuality: "GOOD",
      copyZones: {
        upperLeft: "POOR",
        upperRight: "GOOD",
        lowerLeft: "ACCEPTABLE",
        lowerRight: "POOR",
      },
      notes: ["upper-right is the measured cleanest copy zone"],
    };
    request.providers.visualQa = qaProvider([pass]);
    let captured: ProducePosterRequest | undefined;
    request.posterProducer = async (posterRequest) => {
      captured = posterRequest;
      return posterProducer(posterRequest);
    };

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "FINAL_RENDERED");
    assert.equal(captured?.rendererMode, "M3_V2");
    assert.deepEqual(captured?.copyZones, pass.compositionEvidence.copyZones);
  });
});
