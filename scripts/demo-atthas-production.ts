import { readFile } from "node:fs/promises";

import type { BrandGovernance } from "../src/brandGovernance.js";
import { producePlannedCampaign } from "../src/commands/producePlannedCampaign.js";
import { GeminiImageProvider } from "../src/imageProviders/gemini.js";
import type { MarketingCalendarEntry } from "../src/marketingPlannerTypes.js";
import { createGeminiCampaignProvider } from "../src/providers/gemini.js";
import type { TruthRecord } from "../src/types.js";
import { GeminiVisualQaProvider } from "../src/visualQa/gemini.js";

interface BranchMaster {
  sourceId: string;
  status: "VERIFIED";
  branches: Array<{
    branchId: string;
    brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
    name: string;
    canonicalPhysicalAddress: string;
    officialPhone: string;
    physicalOpeningHours: { daily: string };
  }>;
}

const campaignId = process.env.PRODUCTION_CAMPAIGN_ID?.trim() || "T001-PLANNED-DINEIN-DEMO";
const mode = process.env.PRODUCTION_MODE?.trim().toUpperCase() === "FINAL" ? "FINAL" : "DRAFT";
const branchMaster = JSON.parse(
  await readFile("clients/T001-atthas/truth/branch-master.json", "utf8"),
) as BranchMaster;
const branchId = process.env.PRODUCTION_BRANCH_ID?.trim() || "BURGER_WELLAMPITIYA";
const branch = branchMaster.branches.find((item) => item.branchId === branchId);
if (!branch) throw new Error(`Branch ${branchId} was not found in the owner-confirmed branch master.`);

const brandRulesPath =
  branch.brandId === "ATTHAS_BURGER"
    ? "clients/T001-atthas/brands/burger/rules.md"
    : "clients/T001-atthas/brands/restaurant/rules.md";
const [brandRules, masterPositioning] = await Promise.all([
  readFile(brandRulesPath, "utf8"),
  readFile("clients/T001-atthas/brands/master/positioning.md", "utf8"),
]);
const brandGovernance = JSON.parse(
  await readFile("clients/T001-atthas/brands/master/governance.json", "utf8"),
) as BrandGovernance;

const entry: MarketingCalendarEntry = {
  slotId: "DEMO-S01",
  date: new Date().toISOString().slice(0, 10),
  brandId: branch.brandId,
  branchScope: branch.branchId,
  campaignType: "DINE_IN",
  objective: `Increase consideration for ${branch.name}`,
  audience: "Nearby diners",
  channel: "instagram",
  assetType: "poster",
  priority: "P1",
  conceptDirection:
    "Create a branch invitation using only the owner-confirmed physical address and opening hours; do not invent food, offer or availability claims.",
  additionalTruthNeeded: [],
  requiredTruth: ["branchPhysicalAddress", "physicalOpeningHours"],
  missingTruth: [],
  truthReadiness: "READY_WITH_CURRENT_TRUTH",
};

const truthRecords: TruthRecord[] = [
  {
    key: "branchPhysicalAddress",
    value: branch.canonicalPhysicalAddress,
    status: branchMaster.status,
    sourceId: branchMaster.sourceId,
    scope: {
      tenantId: "T001",
      brandId: branch.brandId,
      branchId: branch.branchId,
    },
  },
  {
    key: "physicalOpeningHours",
    value: branch.physicalOpeningHours.daily,
    status: branchMaster.status,
    sourceId: branchMaster.sourceId,
    scope: {
      tenantId: "T001",
      brandId: branch.brandId,
      branchId: branch.branchId,
    },
  },
];

const generationProvider = createGeminiCampaignProvider({ role: "default" });
const directorProvider = createGeminiCampaignProvider({ role: "creative" });
const finalizerProvider = createGeminiCampaignProvider({ role: "default" });
const baseImagePath = process.env.POSTER_BASE_IMAGE_PATH?.trim();
const paidMediaAllowed = process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true";

if (!baseImagePath && !paidMediaAllowed) {
  throw new Error(
    "Production demo needs a base image or paid Gemini image generation. Set POSTER_BASE_IMAGE_PATH or ALLOW_PAID_MEDIA=true.",
  );
}

const result = await producePlannedCampaign({
  campaignId,
  entry,
  truthRecords,
  brandContext: `${masterPositioning}\n\n${brandRules}\n\nPLANNED DIRECTION\n${entry.conceptDirection}`,
  brandGovernance,
  outputDir: `outputs/${campaignId}`,
  mode,
  providers: {
    generation: generationProvider,
    director: directorProvider,
    finalizer: finalizerProvider,
    ...(!baseImagePath ? { image: new GeminiImageProvider({ role: "draft" }) } : {}),
    ...(mode === "FINAL" ? { visualQa: new GeminiVisualQaProvider() } : {}),
  },
  ...(baseImagePath ? { baseImagePath } : {}),
  ...(mode === "FINAL"
    ? {
        visualQaContext: {
          visualClass: "GENERIC_CONCEPT_VISUAL",
          rightsStatus: baseImagePath ? "unknown" : "cleared",
          mustNotInclude: [
            "generated ATTHA'S signage",
            "generated menu text",
            "unverified product-specific food presentation",
          ],
        },
      }
    : {}),
  ...(process.env.CHROME_PATH?.trim() ? { chromePath: process.env.CHROME_PATH.trim() } : {}),
});

console.log(
  JSON.stringify(
    {
      status: result.status,
      campaignId: result.campaignId,
      slotId: result.slotId,
      mode: result.mode,
      layout: result.layout,
      imageAttempts: result.imageAttempts,
      ...("campaign" in result && result.campaign.status === "GENERATED"
        ? {
            creativeDirector: result.campaign.creativeDirector,
            overlay: result.campaign.creative.overlaySpec,
          }
        : {}),
      ...(result.status === "FINAL_RENDERED" || result.status === "DRAFT_RENDERED"
        ? { poster: result.poster }
        : {}),
      ...(result.status === "HUMAN_REVIEW_REQUIRED" ||
      result.status === "BLOCKED_VISUAL_QA" ||
      result.status === "REGENERATION_EXHAUSTED" ||
      result.status === "REGENERATION_UNAVAILABLE"
        ? { visualQa: result.visualQa, draftImagePath: result.draftImagePath }
        : {}),
    },
    null,
    2,
  ),
);
