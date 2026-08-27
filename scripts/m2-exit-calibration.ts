import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { BrandGovernance } from "../src/brandGovernance.js";
import { producePlannedCampaign } from "../src/commands/producePlannedCampaign.js";
import { GeminiImageProvider } from "../src/imageProviders/gemini.js";
import {
  assertM2ExitSyntheticCalibrationAllowed,
  createM2ExitSyntheticTruthRecords,
  M2_EXIT_CALIBRATION_BRANCH_ID,
  M2_EXIT_CALIBRATION_INGREDIENTS,
  M2_EXIT_CALIBRATION_PRODUCT_ID,
  M2_EXIT_CALIBRATION_PRODUCT_NAME,
  M2_EXIT_CALIBRATION_SOURCE,
  summarizeM2ExitVisualQa,
} from "../src/m2ExitCalibration.js";
import type { MarketingCalendarEntry } from "../src/marketingPlannerTypes.js";
import { createGeminiCampaignProvider } from "../src/providers/gemini.js";
import { GeminiVisualQaProvider } from "../src/visualQa/gemini.js";

assertM2ExitSyntheticCalibrationAllowed();

const campaignId =
  process.env.M2_CALIBRATION_CAMPAIGN_ID?.trim() ||
  `M2-EXIT-CHICKEN-TIKKA-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const outputDir = resolve(process.env.M2_CALIBRATION_OUTPUT_DIR?.trim() || `output/m2-exit-calibration/${campaignId}`);
const baselineImagePath = process.env.M2_BASELINE_IMAGE_PATH?.trim() || null;
await mkdir(outputDir, { recursive: true });

const [masterPositioning, restaurantRules, governanceRaw] = await Promise.all([
  readFile("clients/T001-atthas/brands/master/positioning.md", "utf8"),
  readFile("clients/T001-atthas/brands/restaurant/rules.md", "utf8"),
  readFile("clients/T001-atthas/brands/master/governance.json", "utf8"),
]);
const brandGovernance = JSON.parse(governanceRaw) as BrandGovernance;

const entry: MarketingCalendarEntry = {
  slotId: "M2-EXIT-SYNTHETIC",
  date: new Date().toISOString().slice(0, 10),
  brandId: "ATTHAS_RESTAURANT",
  branchScope: M2_EXIT_CALIBRATION_BRANCH_ID,
  campaignType: "PRODUCT_PUSH",
  objective:
    "Exercise the M2 image-production pipeline on a synthetic Chicken Tikka Wrap case. This output is calibration-only and must not be published.",
  audience: "Internal Creative OS calibration reviewers",
  channel: "instagram",
  assetType: "poster",
  priority: "P0",
  conceptDirection:
    "Calibration only: create a restrained product-led visual using only the synthetic confirmed ingredients. Protect copy space and avoid generated text, logos, prices, badges, packaging, dark rectangles and graphic-design panels.",
  additionalTruthNeeded: ["ingredients"],
  requiredTruth: ["productName", "branchAvailability", "approvedProductVisual", "ingredients"],
  missingTruth: [],
  truthReadiness: "READY_WITH_CURRENT_TRUTH",
};

const productScope = { productId: M2_EXIT_CALIBRATION_PRODUCT_ID };
const result = await producePlannedCampaign({
  campaignId,
  entry,
  truthRecords: createM2ExitSyntheticTruthRecords(),
  requirementScopes: {
    productName: productScope,
    branchAvailability: productScope,
    approvedProductVisual: productScope,
    ingredients: productScope,
  },
  brandContext: [
    masterPositioning,
    restaurantRules,
    "",
    "M2 EXIT CALIBRATION SAFETY BOUNDARY",
    `Source: ${M2_EXIT_CALIBRATION_SOURCE}`,
    "This is synthetic test data, not ATTHA'S business truth and not a publishable campaign.",
    "Do not invent ingredients, preparation methods, packaging, prices, offers, availability language, quality claims, logos or signage.",
  ].join("\n"),
  brandGovernance,
  outputDir,
  mode: "FINAL",
  featureFlags: {
    useStructuredBrief: true,
    useFoodComposer: true,
    useNewRenderer: false,
  },
  providers: {
    generation: createGeminiCampaignProvider({ role: "default" }),
    director: createGeminiCampaignProvider({ role: "creative" }),
    finalizer: createGeminiCampaignProvider({ role: "default" }),
    imageTiers: {
      FLASH_LITE: new GeminiImageProvider({ role: "draft" }),
      FLASH: new GeminiImageProvider({ role: "production" }),
      PRO: new GeminiImageProvider({ role: "premium" }),
    },
    visualQa: new GeminiVisualQaProvider(),
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
      "dark rectangular panels",
      "CTA panels",
      "headline panels",
      "badges",
      "decorative graphic strips",
    ],
    compositionRequirements: [
      "preserve a genuinely quiet copy-safe area",
      "keep the food hero clear of the intended copy zone",
      "use a crop that remains safe for deterministic poster overlay",
    ],
  },
  maxStructuredBriefRepairAttempts: 1,
  ...(process.env.CHROME_PATH?.trim() ? { chromePath: process.env.CHROME_PATH.trim() } : {}),
});

const finalAttempt = result.imageAttempts.at(-1);
const finalQa = finalAttempt?.visualQa;
const qaSummary = finalQa ? summarizeM2ExitVisualQa(finalQa) : null;
const renderedPoster =
  result.status === "FINAL_RENDERED" || result.status === "DRAFT_RENDERED"
    ? result.poster.pngPath
    : null;
const finalRawImagePath = finalAttempt?.path ?? null;
const structuredBriefReview =
  result.status === "HUMAN_REVIEW_STRUCTURED_BRIEF_REQUIRED"
    ? {
        repairs: result.repairs,
        issues: result.issues,
        structuredBrief: result.structuredBrief,
      }
    : null;

const report = {
  generatedAt: new Date().toISOString(),
  campaignId,
  status: result.status,
  calibrationOnly: true,
  publishable: false,
  syntheticSource: M2_EXIT_CALIBRATION_SOURCE,
  truthWriteBackPerformed: false,
  product: {
    productId: M2_EXIT_CALIBRATION_PRODUCT_ID,
    productName: M2_EXIT_CALIBRATION_PRODUCT_NAME,
    ingredients: [...M2_EXIT_CALIBRATION_INGREDIENTS],
  },
  featureFlags: {
    useStructuredBrief: true,
    useFoodComposer: true,
    useNewRenderer: false,
  },
  selectedLayout: result.layout ?? null,
  structuredBriefReview,
  imageAttempts: result.imageAttempts.map((attempt) => ({
    attempt: attempt.attempt,
    model: attempt.model,
    qualityTier: attempt.qualityTier ?? null,
    qualityGate: attempt.qualityGate ?? null,
    costUsd: attempt.costUsd ?? null,
    rawImagePath: attempt.path,
    structuredBrief: attempt.structuredBrief ?? null,
    foodComposition: attempt.foodComposition ?? null,
    visualQa: attempt.visualQa ?? null,
  })),
  finalRawImagePath,
  renderedPoster,
  baselineComparison: {
    baselineImagePath,
    status: baselineImagePath ? "MANUAL_COMPARISON_REQUIRED" : "NO_BASELINE_PATH_SUPPLIED",
  },
  automatedQa: qaSummary,
  m2ExitManualChecklist: [
    "Compare the new raw draft with the old/baseline raw image if M2_BASELINE_IMAGE_PATH is available.",
    "Confirm there are no dark rectangles, accidental panels, badges, labels or other graphic elements baked into the image.",
    "Confirm only the synthetic calibration ingredients are visible; do not use this result as evidence of real ATTHA'S ingredients.",
    "Inspect food texture and lighting for photographic credibility without relying only on the numeric QA score.",
    "Inspect the four copy-zone ratings and confirm the rendered poster places copy only where the image is genuinely suitable.",
    "Do not publish, post, advertise, or write any calibration fact back into client truth.",
  ],
};

await writeFile(`${outputDir}/m2-exit-calibration-report.json`, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));

if (!qaSummary?.automatedPass || result.status !== "FINAL_RENDERED") {
  process.exitCode = 1;
}
