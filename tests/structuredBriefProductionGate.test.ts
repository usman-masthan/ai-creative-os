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
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";
import { ATTHAS_LAYOUTS } from "../src/layouts/atthas.js";
import type { MarketingCalendarEntry } from "../src/marketingPlannerTypes.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import type { ImageDraftProvider } from "../src/imageProviders/types.js";

function entry(): MarketingCalendarEntry {
  return {
    slotId: "S-GOV-01",
    date: "2026-09-03",
    brandId: "ATTHAS_BURGER",
    branchScope: "BRAND_WIDE",
    campaignType: "BRAND_BUILDING",
    objective: "Build ATTHA'S Burger recognition without inventing product facts",
    audience: "Local burger customers",
    channel: "instagram",
    assetType: "poster",
    priority: "P1",
    conceptDirection: "Create a simple brand-memory route.",
    additionalTruthNeeded: [],
    requiredTruth: [],
    missingTruth: [],
    truthReadiness: "READY_WITH_CURRENT_TRUTH",
  };
}

function baseCreative(): CampaignCreativeOutput {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Choose ATTHA'S",
        coreIdea: "Turn brand recognition into a simple visit action.",
        customerEmotion: "clarity",
        headlineDirection: "Choose ATTHA'S Burger",
        visualConcept: "Single bold hospitality focal point.",
        cta: "Visit Us",
        targetAudience: "Local diners",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Burger Mood",
        coreIdea: "Build anticipation through an energetic brand atmosphere rather than a product claim.",
        customerEmotion: "anticipation",
        headlineDirection: "ATTHA'S Burger Mood",
        visualConcept: "Energetic restaurant atmosphere with negative space.",
        cta: "See More",
        targetAudience: "Burger-category customers",
        expectedStrength: 9,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "Remember ATTHA'S",
        coreIdea: "Own a repeatable red-and-yellow memory structure around the ATTHA'S Burger name.",
        customerEmotion: "familiarity",
        headlineDirection: "Remember ATTHA'S Burger",
        visualConcept: "Minimal repeatable brand atmosphere.",
        cta: "Visit Us",
        targetAudience: "Local diners",
        expectedStrength: 8,
        risks: [],
      },
    ],
    recommendedConceptId: "C3",
    recommendationReason: "The third route best builds repeatable brand memory.",
    creativeBrief: {
      headline: "Remember ATTHA'S Burger",
      supportingCopy: "A simple brand-memory moment.",
      cta: "Visit Us",
      visualDirection: "A restrained commercial hospitality atmosphere with a clear focal subject.",
      composition: "Keep the focal subject centre-right and preserve upper-left negative space.",
      lighting: "Controlled commercial lighting.",
      photographyStyle: "Believable commercial hospitality photography.",
      aspectRatio: "4:5",
    },
    caption: "Remember ATTHA'S Burger.",
    imageGeneration: {
      basePrompt: "Commercial brand-atmosphere photograph with no product-specific depiction.",
      negativePrompt: "text, logos, prices, labels, watermarks",
      visualConstraints: ["no product-specific food claims", "clean negative space"],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Remember ATTHA'S Burger",
      supportingCopy: "A simple brand-memory moment.",
      cta: "Visit Us",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
        cta: "lower-right",
        logo: "omit",
      },
    },
    factualQaNotes: [],
  };
}

function invalidFinalCreative(): CampaignCreativeOutput {
  const value = structuredClone(baseCreative());
  value.creativeBrief.composition =
    "Keep the focal subject centre-right with a red rectangle and CTA box in the upper-left.";
  return value;
}

function directorReview() {
  return {
    reviews: [
      {
        conceptId: "C1",
        scores: {
          strategicFit: 7,
          brandFit: 8,
          originality: 6,
          emotionalStrength: 6,
          conversionPotential: 8,
          visualPotential: 7,
          factualSafety: 10,
          productionEfficiency: 9,
        },
        strengths: ["Clear action"],
        weaknesses: ["Less distinctive"],
        risks: [],
      },
      {
        conceptId: "C2",
        scores: {
          strategicFit: 8,
          brandFit: 8,
          originality: 7,
          emotionalStrength: 8,
          conversionPotential: 6,
          visualPotential: 8,
          factualSafety: 10,
          productionEfficiency: 9,
        },
        strengths: ["Strong atmosphere"],
        weaknesses: ["Less memory ownership"],
        risks: [],
      },
      {
        conceptId: "C3",
        scores: {
          strategicFit: 9,
          brandFit: 9,
          originality: 8,
          emotionalStrength: 8,
          conversionPotential: 7,
          visualPotential: 9,
          factualSafety: 10,
          productionEfficiency: 9,
        },
        strengths: ["Strongest brand-memory route"],
        weaknesses: [],
        risks: [],
      },
    ],
    winnerConceptId: "C3",
    winnerRationale: "C3 creates the strongest repeatable brand territory.",
    improvementDirectives: ["Keep the scene simple and production-safe"],
    escalation: { recommended: false, reasons: [] },
  };
}

function sequenceProvider(name: string, outputs: unknown[]): CampaignGenerationProvider {
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

function safeRepairSubject(productName = "No specific verified SKU supplied") {
  return {
    productName,
    physicalState:
      "A physically credible non-product-specific hospitality focal subject with no invented food facts.",
    compositionDescription:
      "Keep one coherent photographic focal subject centre-right and leave upper-left visually quiet.",
    textureDescription:
      "Show neutral directly visible material texture without product-quality claims.",
    ingredientInteraction:
      "Do not infer ingredients, preparation details or product construction.",
    scaleAndProportion:
      "Use believable relative scale and gravity without portion or quantity claims.",
  };
}

function imageProvider(prompts: string[], onCall?: () => void): ImageDraftProvider {
  return {
    providerName: "mock-image",
    model: "mock-image-model",
    async generate(request) {
      onCall?.();
      prompts.push(request.prompt);
      return {
        provider: "mock-image",
        model: "mock-image-model",
        dataBase64: Buffer.alloc(2_000, 7).toString("base64"),
        mimeType: "image/jpeg",
        costUsd: 0.01,
      };
    },
  };
}

async function posterProducer(request: ProducePosterRequest): Promise<ProducePosterResult> {
  const layout = ATTHAS_LAYOUTS.find((item) => item.id === request.layoutId);
  if (!layout) throw new Error("Expected selected layout.");
  if (!request.baseImagePath) throw new Error("Expected generated base image.");
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

function request(
  outputDir: string,
  prompts: string[],
  repairOutput: unknown,
  onImageCall?: () => void,
): ProducePlannedCampaignRequest {
  return {
    campaignId: "M2-BRIEF-GOV-PRODUCTION",
    entry: entry(),
    truthRecords: [],
    brandContext: "ATTHA'S Burger brand building remains fact-gated and renderer-safe.",
    outputDir,
    mode: "DRAFT",
    providers: {
      generation: sequenceProvider("generator", [baseCreative()]),
      director: sequenceProvider("director", [directorReview()]),
      finalizer: sequenceProvider("finalizer", [invalidFinalCreative(), repairOutput]),
      image: imageProvider(prompts, onImageCall),
    },
    featureFlags: {
      useStructuredBrief: true,
      useFoodComposer: false,
    },
    posterProducer,
  };
}

async function withTempDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "structured-brief-gov-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("invalid structured brief is repaired before any image prompt is spent", async () => {
  await withTempDir(async (outputDir) => {
    const prompts: string[] = [];
    let imageCalls = 0;
    const result = await producePlannedCampaign(
      request(outputDir, prompts, safeRepairSubject(), () => {
        imageCalls += 1;
      }),
    );

    assert.equal(result.status, "DRAFT_RENDERED");
    assert.equal(imageCalls, 1);
    assert.equal(prompts.length, 1);
    assert.doesNotMatch(prompts[0]!, /red rectangle|CTA box/i);
    if (result.status !== "DRAFT_RENDERED") return;
    assert.equal(result.imageAttempts[0]?.briefGovernance?.status, "REPAIRED");
    assert.equal(result.imageAttempts[0]?.briefGovernance?.repairs, 1);
    assert.ok(
      result.imageAttempts[0]?.briefGovernance?.issuesBeforeRepair.some(
        (issue) => issue.code === "FAIL_STRUCTURED_BRIEF_GRAPHIC_DESIGN_LANGUAGE",
      ),
    );
  });
});

test("failed structured brief repair routes to human review before image spend", async () => {
  await withTempDir(async (outputDir) => {
    const prompts: string[] = [];
    let imageCalls = 0;
    const result = await producePlannedCampaign(
      request(outputDir, prompts, safeRepairSubject("Different Product"), () => {
        imageCalls += 1;
      }),
    );

    assert.equal(result.status, "HUMAN_REVIEW_STRUCTURED_BRIEF_REQUIRED");
    assert.equal(imageCalls, 0);
    assert.equal(prompts.length, 0);
    assert.equal(result.imageAttempts.length, 0);
    if (result.status !== "HUMAN_REVIEW_STRUCTURED_BRIEF_REQUIRED") return;
    assert.equal(result.repairs, 1);
    assert.ok(
      result.issues.some(
        (issue) => issue.code === "FAIL_STRUCTURED_BRIEF_REPAIR_OUTPUT",
      ),
    );
  });
});
