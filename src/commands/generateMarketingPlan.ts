import { buildCampaignRepairPrompt } from "../repairPrompt.js";
import { buildMarketingPlannerPrompt } from "../marketingPlannerPrompt.js";
import { buildMonthlyCalendarSlots } from "../marketingPlannerPolicy.js";
import type {
  AtthasMarketingPlan,
  AtthasPlanningBrandId,
  MarketingPlanTrace,
  PlanningBranch,
} from "../marketingPlannerTypes.js";
import { parseAtthasMarketingPlan } from "../marketingPlannerValidator.js";
import type { CampaignGenerationProvider } from "../providers/types.js";

export const DEFERRED_ATTHAS_FACT_AREAS = [
  "dine-in and takeaway prices",
  "Uber prices and merchant-export freshness",
  "PickMe prices and merchant export",
  "complete ingredients and descriptions",
  "allergens",
  "offers and validity dates",
  "product availability by branch",
  "real product photographs, rights and SKU mapping",
] as const;

export interface GenerateMarketingPlanRequest {
  month: string;
  objectives: string[];
  brandContext: string;
  branches: PlanningBranch[];
  businessUnits?: AtthasPlanningBrandId[];
  channels?: string[];
  assetTypes?: string[];
  postsPerWeek?: number;
  postingWeekdays?: number[];
  availableTruthKeys?: string[];
  deferredFactAreas?: string[];
  maxRepairAttempts?: number;
}

export interface GenerateMarketingPlanResult {
  status: "PLANNED";
  plan: AtthasMarketingPlan;
  trace: MarketingPlanTrace;
}

function uniqueNonEmpty(values: string[], label: string): string[] {
  const cleaned = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (!cleaned.length) throw new Error(`${label} must contain at least one value.`);
  return cleaned;
}

function normalizeBrands(values: AtthasPlanningBrandId[] | undefined): AtthasPlanningBrandId[] {
  const brands = values ?? ["ATTHAS_BURGER", "ATTHAS_RESTAURANT"];
  const unique = [...new Set(brands)];
  if (!unique.length || unique.some((brand) => brand !== "ATTHAS_BURGER" && brand !== "ATTHAS_RESTAURANT")) {
    throw new Error("businessUnits must contain ATTHAS_BURGER and/or ATTHAS_RESTAURANT.");
  }
  return unique;
}

function normalizeRepairs(value: number | undefined): number {
  if (value === undefined) return 2;
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error("maxRepairAttempts must be an integer from 0 to 3.");
  }
  return value;
}

export async function generateAtthasMarketingPlan(
  request: GenerateMarketingPlanRequest,
  provider: CampaignGenerationProvider,
): Promise<GenerateMarketingPlanResult> {
  const objectives = uniqueNonEmpty(request.objectives, "objectives");
  const businessUnits = normalizeBrands(request.businessUnits);
  const channels = uniqueNonEmpty(request.channels ?? ["instagram", "facebook"], "channels");
  const assetTypes = uniqueNonEmpty(
    request.assetTypes ?? ["poster", "story", "reel_cover"],
    "assetTypes",
  );
  const activeBranches = request.branches.filter((branch) => businessUnits.includes(branch.brandId));
  if (!activeBranches.length) throw new Error("No owner-confirmed branches are available for the active business units.");
  const branchIds = new Set<string>();
  for (const branch of activeBranches) {
    if (branchIds.has(branch.branchId)) throw new Error(`Duplicate branchId ${branch.branchId} in planning branch catalog.`);
    branchIds.add(branch.branchId);
  }

  const availableTruthKeys = uniqueNonEmpty(
    request.availableTruthKeys ?? ["branchPhysicalAddress", "physicalOpeningHours", "officialPhone"],
    "availableTruthKeys",
  );
  const deferredFactAreas = uniqueNonEmpty(
    request.deferredFactAreas ?? [...DEFERRED_ATTHAS_FACT_AREAS],
    "deferredFactAreas",
  );
  const slots = buildMonthlyCalendarSlots({
    month: request.month,
    postsPerWeek: request.postsPerWeek ?? 3,
    ...(request.postingWeekdays ? { postingWeekdays: request.postingWeekdays } : {}),
  });
  if (!slots.length) throw new Error("Marketing planner produced no deterministic calendar slots.");

  const originalPrompt = buildMarketingPlannerPrompt({
    month: request.month,
    objectives,
    channels,
    assetTypes,
    businessUnits,
    branches: activeBranches,
    slots,
    brandContext: request.brandContext,
    availableTruthKeys,
    deferredFactAreas,
  });
  const maxRepairs = normalizeRepairs(request.maxRepairAttempts);
  let prompt = originalPrompt;
  let attempts = 0;
  let repairs = 0;

  while (true) {
    attempts += 1;
    const raw = await provider.generate(prompt);
    try {
      const plan = parseAtthasMarketingPlan(raw, {
        month: request.month,
        slots,
        branches: activeBranches,
        activeBrands: businessUnits,
        channels,
        assetTypes,
        availableTruthKeys,
      });
      const readyForProduction = plan.calendar.filter(
        (entry) => entry.truthReadiness === "READY_WITH_CURRENT_TRUTH",
      ).length;
      return {
        status: "PLANNED",
        plan,
        trace: {
          provider: provider.providerName,
          model: provider.model,
          attempts,
          repairs,
          generatedSlots: slots.length,
          readyForProduction,
          blockedPendingTruth: slots.length - readyForProduction,
        },
      };
    } catch (error) {
      const violation = error instanceof Error ? error.message : String(error);
      if (repairs >= maxRepairs) {
        throw new Error(
          `ATTHA'S marketing planning failed validation after ${attempts} attempt(s): ${violation}`,
        );
      }
      repairs += 1;
      prompt = buildCampaignRepairPrompt({
        originalPrompt,
        previousOutput: raw,
        violation,
        repairAttempt: repairs,
      });
    }
  }
}
