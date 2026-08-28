import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { AiTraceSession } from "../src/aiTrace.js";
import type { BrandGovernance } from "../src/brandGovernance.js";
import {
  producePlannedCampaign,
  type PlannedTruthRequirementScope,
  type PlannedVisualQaContext,
  type ProducePlannedCampaignResult,
} from "../src/commands/producePlannedCampaign.js";
import { producePoster } from "../src/commands/producePoster.js";
import { GeminiFinalArtQaProvider } from "../src/finalArtQa/gemini.js";
import type { FinalArtQaResult } from "../src/finalArtQa/types.js";
import { GeminiImageProvider } from "../src/imageProviders/gemini.js";
import {
  createM2ExitSyntheticTruthRecords,
  M2_EXIT_CALIBRATION_BRANCH_ID,
  M2_EXIT_CALIBRATION_INGREDIENTS,
  M2_EXIT_CALIBRATION_PRODUCT_ID,
  M2_EXIT_CALIBRATION_PRODUCT_NAME,
  M2_EXIT_CALIBRATION_SOURCE,
} from "../src/m2ExitCalibration.js";
import {
  assertM3ExitCalibrationAllowed,
  createM3ExitBranchTruthRecords,
  M3_EXIT_BRAND_AWARENESS_REQUEST,
  M3_EXIT_FAMILY_DINING_REQUEST,
  M3_EXIT_VISIT_TONIGHT_REQUEST,
  scoreM3ExitScenario,
  type M3ExitBranchMaster,
} from "../src/m3ExitCalibration.js";
import type { MarketingCalendarEntry } from "../src/marketingPlannerTypes.js";
import { createGeminiCampaignProvider } from "../src/providers/gemini.js";
import type { TruthRecord } from "../src/types.js";
import {
  interpretAtthasTaskRequest,
  normalizeAtthasTaskIntent,
} from "../src/ui/taskIntent.js";
import { GeminiVisualQaProvider } from "../src/visualQa/gemini.js";

assertM3ExitCalibrationAllowed();

const runId =
  process.env.M3_CALIBRATION_RUN_ID?.trim() ||
  `M3-EXIT-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outputRoot = resolve(
  process.env.M3_CALIBRATION_OUTPUT_DIR?.trim() || `output/m3-exit-calibration/${runId}`,
);
await mkdir(outputRoot, { recursive: true });

const [
  branchMasterRaw,
  masterPositioning,
  burgerRules,
  restaurantRules,
  governanceRaw,
] = await Promise.all([
  readFile("clients/T001-atthas/truth/branch-master.json", "utf8"),
  readFile("clients/T001-atthas/brands/master/positioning.md", "utf8"),
  readFile("clients/T001-atthas/brands/burger/rules.md", "utf8"),
  readFile("clients/T001-atthas/brands/restaurant/rules.md", "utf8"),
  readFile("clients/T001-atthas/brands/master/governance.json", "utf8"),
]);
const branchMaster = JSON.parse(branchMasterRaw) as M3ExitBranchMaster;
const brandGovernance = JSON.parse(governanceRaw) as BrandGovernance;

interface ScenarioConfig {
  id: string;
  label: string;
  rawRequest: string;
  entry: MarketingCalendarEntry;
  truthRecords: TruthRecord[];
  requirementScopes?: Record<string, PlannedTruthRequirementScope>;
  visualQaContext: PlannedVisualQaContext;
  synthetic: boolean;
}

function normalizedScenario(input: {
  id: string;
  label: string;
  rawRequest: string;
  visualQaContext: PlannedVisualQaContext;
}): ScenarioConfig {
  const normalized = normalizeAtthasTaskIntent(interpretAtthasTaskRequest(input.rawRequest));
  const truthRecords = normalized.entry.branchScope === "BRAND_WIDE"
    ? []
    : createM3ExitBranchTruthRecords(branchMaster, normalized.entry.branchScope);
  return {
    id: input.id,
    label: input.label,
    rawRequest: input.rawRequest,
    entry: { ...normalized.entry, slotId: input.id },
    truthRecords,
    requirementScopes: normalized.requirementScopes,
    visualQaContext: input.visualQaContext,
    synthetic: false,
  };
}

const genericVisualQa: PlannedVisualQaContext = {
  visualClass: "GENERIC_CONCEPT_VISUAL",
  rightsStatus: "cleared",
  mustNotInclude: [
    "generated promotional text",
    "generated ATTHA'S logo or signage",
    "invented menu items or product claims",
    "prices or offer mechanics inside the generated image",
    "badges, graphic rails, banners or arbitrary decorative panels",
  ],
  compositionRequirements: [
    "preserve a genuinely quiet copy-safe area for deterministic M3 rendering",
    "keep the primary visual subject clear of the intended copy zone",
    "use a crop that remains safe for Instagram 4:5 deterministic overlay",
  ],
};

const originalScenarios: ScenarioConfig[] = [
  normalizedScenario({
    id: "01-brand-awareness",
    label: "Original Calibration A — Burger brand awareness, no offer, no price",
    rawRequest: M3_EXIT_BRAND_AWARENESS_REQUEST,
    visualQaContext: genericVisualQa,
  }),
  normalizedScenario({
    id: "02-visit-tonight-wellampitiya",
    label: "Original Calibration B — visit tonight, Wellampitiya",
    rawRequest: M3_EXIT_VISIT_TONIGHT_REQUEST,
    visualQaContext: genericVisualQa,
  }),
  normalizedScenario({
    id: "03-family-dining-wellawatte",
    label: "Original Calibration C — Restaurant family dining, Wellawatte",
    rawRequest: M3_EXIT_FAMILY_DINING_REQUEST,
    visualQaContext: genericVisualQa,
  }),
];

const wrapEntry: MarketingCalendarEntry = {
  slotId: "04-chicken-tikka-wrap",
  date: new Date().toISOString().slice(0, 10),
  brandId: "ATTHAS_RESTAURANT",
  branchScope: M2_EXIT_CALIBRATION_BRANCH_ID,
  campaignType: "PRODUCT_PUSH",
  objective:
    "Re-run the governed synthetic Chicken Tikka Wrap calibration through the complete M3 poster-production pipeline. This output is calibration-only and must not be published.",
  audience: "Internal Creative OS calibration reviewers",
  channel: "instagram",
  assetType: "poster",
  priority: "P1",
  conceptDirection:
    "Calibration only: create a restrained product-led visual using only the synthetic confirmed ingredients. Protect copy space and avoid generated text, logos, prices, offers, badges, packaging, dark rectangles and graphic-design panels.",
  additionalTruthNeeded: ["ingredients"],
  requiredTruth: ["productName", "branchAvailability", "approvedProductVisual", "ingredients"],
  missingTruth: [],
  truthReadiness: "READY_WITH_CURRENT_TRUTH",
};

const scenarios: ScenarioConfig[] = [
  ...originalScenarios,
  {
    id: "04-chicken-tikka-wrap",
    label: "M2/M3 synthetic Chicken Tikka Wrap product calibration",
    rawRequest: "Synthetic Chicken Tikka Wrap M3 exit calibration — do not publish.",
    entry: wrapEntry,
    truthRecords: createM2ExitSyntheticTruthRecords(),
    requirementScopes: {
      productName: { productId: M2_EXIT_CALIBRATION_PRODUCT_ID },
      branchAvailability: { productId: M2_EXIT_CALIBRATION_PRODUCT_ID },
      approvedProductVisual: { productId: M2_EXIT_CALIBRATION_PRODUCT_ID },
      ingredients: { productId: M2_EXIT_CALIBRATION_PRODUCT_ID },
    },
    visualQaContext: {
      productId: M2_EXIT_CALIBRATION_PRODUCT_ID,
      productName: M2_EXIT_CALIBRATION_PRODUCT_NAME,
      visualClass: "CONSTRAINED_PRODUCT_GENERATION",
      rightsStatus: "cleared",
      verifiedVisibleIngredients: [...M2_EXIT_CALIBRATION_INGREDIENTS],
      mustInclude: ["one coherent wrap-style food hero"],
      mustNotInclude: [
        "unverified ingredients",
        "generated text",
        "ATTHA'S logo or signage",
        "price or offer text",
        "branded packaging",
        "separate side salad, dip ramekin or duplicate serving components",
        "unverified grill, griddle, toast, sear or char preparation cues",
        "dark rectangular panels",
        "CTA panels",
        "headline panels",
        "badges",
        "decorative graphic strips",
      ],
      compositionRequirements: [
        "preserve a genuinely quiet copy-safe area",
        "keep the food hero clear of the intended copy zone",
        "use a crop that remains safe for deterministic M3 poster overlay",
      ],
    },
    synthetic: true,
  },
];

function brandContext(scenario: ScenarioConfig): string {
  const rules = scenario.entry.brandId === "ATTHAS_BURGER" ? burgerRules : restaurantRules;
  return [
    masterPositioning,
    rules,
    "",
    "M3 EXIT CALIBRATION BOUNDARY",
    `Calibration case: ${scenario.label}`,
    `Original request: ${scenario.rawRequest}`,
    "This is an internal calibration run. Do not publish, advertise, or write any calibration result back into stored truth.",
    ...(scenario.synthetic
      ? [
          `Synthetic source: ${M2_EXIT_CALIBRATION_SOURCE}`,
          "The Chicken Tikka Wrap facts are synthetic calibration data, not ATTHA'S business truth.",
        ]
      : []),
  ].join("\n");
}

function finalCreativeInvariantIssues(
  scenario: ScenarioConfig,
  result: ProducePlannedCampaignResult,
): string[] {
  if (result.status !== "FINAL_RENDERED") return [];
  const issues: string[] = [];
  const creative = result.campaign.creative;
  const customerCopy = [
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
    creative.caption,
  ].join(" ");

  if (!result.poster.rendererPlan) {
    issues.push("M3 renderer plan is missing; calibration did not exercise the M3_V2 renderer contract.");
  }
  if (!result.poster.finalArtQa || result.poster.finalArtQa.decision !== "PASS") {
    issues.push("M3.3 Final Art QA did not produce PASS on the finished poster.");
  }
  if (!scenario.entry.requiredTruth.includes("price") && creative.overlaySpec.price) {
    issues.push("A price appeared even though this calibration brief did not verify or request price truth.");
  }

  if (scenario.id === "01-brand-awareness") {
    if (/\b(?:offer|discount|deal|promotion|%\s*off)\b/i.test(customerCopy)) {
      issues.push("Brand-awareness calibration introduced offer/deal language despite the exact no-offer request.");
    }
    if (creative.overlaySpec.price) {
      issues.push("Brand-awareness calibration introduced a price despite the exact no-price request.");
    }
  }
  if (scenario.synthetic && creative.overlaySpec.price) {
    issues.push("Synthetic Chicken Tikka Wrap calibration introduced an unverified price.");
  }
  return [...new Set(issues)];
}

async function readFinalArtQaIfPresent(outputDir: string): Promise<FinalArtQaResult | undefined> {
  try {
    return JSON.parse(await readFile(join(outputDir, "final-art-qa.json"), "utf8")) as FinalArtQaResult;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function existingFiles(outputDir: string): Promise<string[]> {
  try {
    return (await readdir(outputDir)).sort().map((name) => join(outputDir, name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function runScenario(scenario: ScenarioConfig) {
  const campaignId = `M3-EXIT-${scenario.id.toUpperCase()}-${runId}`;
  const outputDir = join(outputRoot, scenario.id);
  await mkdir(outputDir, { recursive: true });
  const trace = new AiTraceSession(campaignId);
  trace.setRequest({
    calibration: "M3_EXIT_FULL_ROUND_2",
    campaignId,
    label: scenario.label,
    rawRequest: scenario.rawRequest,
    featureFlags: {
      useStructuredBrief: true,
      useFoodComposer: true,
      useNewRenderer: true,
    },
  });
  trace.setIntent(scenario.entry);
  trace.setTruth({
    synthetic: scenario.synthetic,
    truthSourceIds: [...new Set(scenario.truthRecords.map((record) => record.sourceId).filter(Boolean))],
    records: scenario.truthRecords,
  });

  const generation = trace.wrapCampaignProvider(
    "strategist",
    createGeminiCampaignProvider({ role: "default" }),
  );
  const director = trace.wrapCampaignProvider(
    "creativeDirector",
    createGeminiCampaignProvider({ role: "creative" }),
  );
  const finalizer = trace.wrapCampaignProvider(
    "finalizer",
    createGeminiCampaignProvider({ role: "default" }),
  );
  const imageTiers = {
    FLASH_LITE: trace.wrapImageProvider(new GeminiImageProvider({ role: "draft" })),
    FLASH: trace.wrapImageProvider(new GeminiImageProvider({ role: "production" })),
    PRO: trace.wrapImageProvider(new GeminiImageProvider({ role: "premium" })),
  };
  const visualQa = trace.wrapVisualQaProvider(new GeminiVisualQaProvider());
  const finalArtQa = trace.wrapFinalArtQaProvider(new GeminiFinalArtQaProvider());

  try {
    const result = await producePlannedCampaign({
      campaignId,
      entry: scenario.entry,
      truthRecords: scenario.truthRecords,
      ...(scenario.requirementScopes ? { requirementScopes: scenario.requirementScopes } : {}),
      brandContext: brandContext(scenario),
      brandGovernance,
      outputDir,
      mode: "FINAL",
      featureFlags: {
        useStructuredBrief: true,
        useFoodComposer: true,
        useNewRenderer: true,
      },
      providers: {
        generation,
        director,
        finalizer,
        imageTiers,
        visualQa,
      },
      visualQaContext: scenario.visualQaContext,
      finalArtQa: { provider: finalArtQa },
      maxStructuredBriefRepairAttempts: 1,
      posterProducer: async (request) => {
        trace.recordRendererStart({
          campaignId: request.campaignId,
          brandId: request.brandId,
          layoutId: request.layoutId,
          rendererMode: request.rendererMode,
          copyZones: request.copyZones,
          overlaySpec: request.campaign.creative.overlaySpec,
          format: request.campaign.production.format,
        });
        try {
          const poster = await producePoster(request);
          trace.recordRendererResult({
            status: poster.status,
            layout: poster.layout,
            rendererPlan: poster.rendererPlan,
            pngPath: poster.pngPath,
            qa: poster.qa,
            finalArtQa: poster.finalArtQa,
          });
          return poster;
        } catch (error) {
          trace.recordRendererFailure(error);
          throw error;
        }
      },
      ...(process.env.CHROME_PATH?.trim() ? { chromePath: process.env.CHROME_PATH.trim() } : {}),
    });

    const additionalIssues = finalCreativeInvariantIssues(scenario, result);
    const finalArtQaResult = result.status === "FINAL_RENDERED" ? result.poster.finalArtQa : undefined;
    const score = scoreM3ExitScenario({
      status: result.status,
      ...(result.status === "FINAL_RENDERED" && result.visualQa ? { visualQa: result.visualQa } : {}),
      ...(finalArtQaResult ? { finalArtQa: finalArtQaResult } : {}),
      additionalIssues,
    });
    trace.recordOutcome({ status: result.status, score });
    const tracePath = await trace.persist(outputDir);

    const imageCostUsd = result.imageAttempts.reduce((sum, attempt) => sum + (attempt.costUsd ?? 0), 0);
    return {
      id: scenario.id,
      label: scenario.label,
      rawRequest: scenario.rawRequest,
      calibrationOnly: true,
      publishable: false,
      synthetic: scenario.synthetic,
      ...(scenario.synthetic ? { syntheticSource: M2_EXIT_CALIBRATION_SOURCE } : {}),
      status: result.status,
      score: score.score,
      targetPass: score.targetPass,
      materialIssues: score.materialIssues,
      rationale: score.rationale,
      truthWriteBackPerformed: false,
      truthSources: [...new Set(scenario.truthRecords.map((record) => record.sourceId).filter(Boolean))],
      entry: scenario.entry,
      selectedLayout: result.layout ?? null,
      imageCostUsd,
      imageAttempts: result.imageAttempts,
      ...(result.status === "FINAL_RENDERED"
        ? {
            creative: result.campaign.creative,
            visualQa: result.visualQa ?? null,
            rendererPlan: result.poster.rendererPlan ?? null,
            finalArtQa: result.poster.finalArtQa ?? null,
            renderedPoster: result.poster.pngPath,
            posterManifest: join(outputDir, "manifest.json"),
          }
        : {}),
      tracePath,
      files: await existingFiles(outputDir),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trace.recordFailure(error);
    const finalArtQaResult = await readFinalArtQaIfPresent(outputDir);
    const expectedQaStop = /blocked by final-art QA/i.test(message);
    const score = scoreM3ExitScenario({
      status: expectedQaStop ? "FINAL_ART_QA_FAILED" : "ERROR",
      ...(finalArtQaResult ? { finalArtQa: finalArtQaResult } : {}),
      ...(expectedQaStop ? {} : { error: message }),
    });
    trace.recordOutcome({ status: expectedQaStop ? "FINAL_ART_QA_FAILED" : "ERROR", score });
    const tracePath = await trace.persist(outputDir);
    return {
      id: scenario.id,
      label: scenario.label,
      rawRequest: scenario.rawRequest,
      calibrationOnly: true,
      publishable: false,
      synthetic: scenario.synthetic,
      ...(scenario.synthetic ? { syntheticSource: M2_EXIT_CALIBRATION_SOURCE } : {}),
      status: expectedQaStop ? "FINAL_ART_QA_FAILED" : "ERROR",
      score: score.score,
      targetPass: false,
      materialIssues: score.materialIssues,
      rationale: score.rationale,
      truthWriteBackPerformed: false,
      truthSources: [...new Set(scenario.truthRecords.map((record) => record.sourceId).filter(Boolean))],
      error: message,
      finalArtQa: finalArtQaResult ?? null,
      tracePath,
      files: await existingFiles(outputDir),
    };
  }
}

const scenarioResults = [];
for (const scenario of scenarios) {
  console.log(`\n=== M3 EXIT: ${scenario.label} ===`);
  scenarioResults.push(await runScenario(scenario));
}

const totalImageCostUsd = scenarioResults.reduce((sum, result) => sum + ("imageCostUsd" in result ? result.imageCostUsd : 0), 0);
const targetPassCount = scenarioResults.filter((result) => result.targetPass).length;
const report = {
  generatedAt: new Date().toISOString(),
  runId,
  calibration: "M3_EXIT_FULL_ROUND_2",
  calibrationOnly: true,
  publishable: false,
  truthWriteBackPerformed: false,
  scoringContract: {
    sourceNote:
      "The roadmap defines a 0–1 target and a 2+ diagnosis trigger but does not define the numeric scale. This harness makes the scale explicit and deterministic.",
    score0: "FINAL_RENDERED + Final Art QA PASS + zero material QA/invariant issues.",
    score1: "FINAL_RENDERED + Final Art QA PASS + exactly one material QA/invariant issue.",
    score2: "Non-passing/human-review final outcome or two-plus material issues; diagnose via AI Trace.",
    score3: "Truth/governance/infrastructure block or unexpected pipeline error; diagnose before rerun.",
  },
  target: "Every one of the four calibration cases must score 0 or 1 before the 30-campaign validation.",
  featureFlags: {
    useStructuredBrief: true,
    useFoodComposer: true,
    useNewRenderer: true,
  },
  targetPassCount,
  totalScenarios: scenarioResults.length,
  automatedTargetPass: targetPassCount === scenarioResults.length,
  totalImageCostUsd,
  scenarios: scenarioResults,
  manualReviewRequired: true,
  manualReviewChecklist: [
    "Inspect all four finished poster PNGs, not only model scores.",
    "Confirm the mandatory ATTHA'S BURGER / ATTHA'S RESTAURANT identifier is clearly visible and correctly styled.",
    "Confirm headline hierarchy, CTA hierarchy/placement, safe areas and contrast are visually convincing at social-feed size.",
    "Confirm no legacy yellow rail, bottom-left accent or arbitrary corner decoration returned in the M3 renderer.",
    "Confirm the brand-awareness poster contains no offer mechanics and no price.",
    "Confirm Wellampitiya 'tonight' language does not imply hours beyond the owner-confirmed physical opening-hours record.",
    "Confirm the Wellawatte family-dining poster feels like Restaurant hospitality and does not invent reservation capability.",
    "Confirm the Chicken Tikka Wrap remains synthetic calibration-only, uses only the synthetic ingredient fixture, and contains no unverified price, packaging or preparation/serving configuration.",
    "If any case scores 2+, inspect its ai-trace.json before changing prompts, thresholds or renderer rules.",
  ],
};

const reportPath = join(outputRoot, "m3-exit-calibration-report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(`\nM3 exit report: ${reportPath}`);
console.log(JSON.stringify({
  runId,
  targetPassCount,
  totalScenarios: scenarioResults.length,
  automatedTargetPass: report.automatedTargetPass,
  totalImageCostUsd,
  scores: scenarioResults.map((result) => ({ id: result.id, status: result.status, score: result.score })),
}, null, 2));

if (!report.automatedTargetPass) process.exitCode = 1;
