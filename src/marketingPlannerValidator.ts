import { deriveTruthReadiness } from "./marketingPlannerPolicy.js";
import type {
  AtthasMarketingPlan,
  AtthasPlanningBrandId,
  MarketingCalendarEntry,
  MarketingCalendarSlot,
  MarketingCampaignType,
  MarketingContentPillar,
  MarketingPriority,
  MarketingWeeklyPlan,
  PlanningBranch,
} from "./marketingPlannerTypes.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid marketing plan: provider did not return a JSON object.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch (error) {
    throw new Error(`Invalid marketing plan: malformed JSON (${error instanceof Error ? error.message : String(error)}).`);
  }
  if (!isRecord(parsed)) throw new Error("Invalid marketing plan: root must be an object.");
  return parsed;
}

function stringValue(object: Record<string, unknown>, key: string, path: string): string {
  const value = object[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid marketing plan: ${path}.${key} must be a non-empty string.`);
  }
  return value;
}

function stringArray(object: Record<string, unknown>, key: string, path: string): string[] {
  const value = object[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim())) {
    throw new Error(`Invalid marketing plan: ${path}.${key} must be a non-empty string array or empty array.`);
  }
  return value as string[];
}

function numberValue(object: Record<string, unknown>, key: string, path: string): number {
  const value = object[key];
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    throw new Error(`Invalid marketing plan: ${path}.${key} must be an integer from 0 to 100.`);
  }
  return value as number;
}

const allowedBrands: AtthasPlanningBrandId[] = ["ATTHAS_BURGER", "ATTHAS_RESTAURANT"];
const allowedCampaignTypes: MarketingCampaignType[] = [
  "PRODUCT_PUSH",
  "DINE_IN",
  "DELIVERY",
  "BRAND_BUILDING",
  "ENGAGEMENT",
  "SEASONAL",
  "OFFER",
];
const allowedPriorities: MarketingPriority[] = ["P1", "P2", "P3"];

function validatePillars(value: unknown, activeBrands: AtthasPlanningBrandId[]): MarketingContentPillar[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) {
    throw new Error("Invalid marketing plan: contentPillars must contain 2 to 8 entries.");
  }
  const pillars = value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Invalid marketing plan: contentPillars[${index}] must be an object.`);
    const businessUnits = stringArray(item, "businessUnits", `contentPillars[${index}]`) as AtthasPlanningBrandId[];
    if (!businessUnits.length || businessUnits.some((brand) => !activeBrands.includes(brand))) {
      throw new Error(`Invalid marketing plan: contentPillars[${index}].businessUnits must use active ATTHA'S brands.`);
    }
    const weightPercent = numberValue(item, "weightPercent", `contentPillars[${index}]`);
    if (weightPercent < 1) throw new Error("Invalid marketing plan: content pillar weights must be at least 1.");
    return {
      id: stringValue(item, "id", `contentPillars[${index}]`),
      name: stringValue(item, "name", `contentPillars[${index}]`),
      purpose: stringValue(item, "purpose", `contentPillars[${index}]`),
      weightPercent,
      businessUnits,
    };
  });
  const total = pillars.reduce((sum, pillar) => sum + pillar.weightPercent, 0);
  if (total !== 100) throw new Error(`Invalid marketing plan: contentPillar weights must total 100; received ${total}.`);
  return pillars;
}

function validateMonthlyBalance(value: unknown): AtthasMarketingPlan["monthlyBalance"] {
  if (!isRecord(value)) throw new Error("Invalid marketing plan: monthlyBalance must be an object.");
  const result = {
    brandBuilding: numberValue(value, "brandBuilding", "monthlyBalance"),
    productPush: numberValue(value, "productPush", "monthlyBalance"),
    dineIn: numberValue(value, "dineIn", "monthlyBalance"),
    delivery: numberValue(value, "delivery", "monthlyBalance"),
    engagement: numberValue(value, "engagement", "monthlyBalance"),
    seasonalOrOffer: numberValue(value, "seasonalOrOffer", "monthlyBalance"),
  };
  const total = Object.values(result).reduce((sum, item) => sum + item, 0);
  if (total !== 100) throw new Error(`Invalid marketing plan: monthlyBalance must total 100; received ${total}.`);
  return result;
}

function validateCalendar(input: {
  value: unknown;
  slots: MarketingCalendarSlot[];
  branches: PlanningBranch[];
  activeBrands: AtthasPlanningBrandId[];
  channels: string[];
  assetTypes: string[];
  availableTruthKeys: string[];
}): MarketingCalendarEntry[] {
  if (!Array.isArray(input.value) || input.value.length !== input.slots.length) {
    throw new Error(`Invalid marketing plan: calendar must contain exactly ${input.slots.length} entries.`);
  }
  const slotMap = new Map(input.slots.map((slot) => [slot.slotId, slot]));
  const branchMap = new Map(input.branches.map((branch) => [branch.branchId, branch]));
  const seen = new Set<string>();

  return input.value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Invalid marketing plan: calendar[${index}] must be an object.`);
    const slotId = stringValue(item, "slotId", `calendar[${index}]`);
    const slot = slotMap.get(slotId);
    if (!slot || seen.has(slotId)) throw new Error(`Invalid marketing plan: calendar slot ${slotId} is unknown or duplicated.`);
    seen.add(slotId);
    const date = stringValue(item, "date", `calendar[${index}]`);
    if (date !== slot.date) throw new Error(`Invalid marketing plan: ${slotId} date must remain ${slot.date}.`);

    const brandId = stringValue(item, "brandId", `calendar[${index}]`) as AtthasPlanningBrandId;
    if (!allowedBrands.includes(brandId) || !input.activeBrands.includes(brandId)) {
      throw new Error(`Invalid marketing plan: ${slotId} uses inactive or unknown brand ${brandId}.`);
    }

    const branchScope = stringValue(item, "branchScope", `calendar[${index}]`);
    if (branchScope !== "BRAND_WIDE") {
      const branch = branchMap.get(branchScope);
      if (!branch || branch.brandId !== brandId) {
        throw new Error(`Invalid marketing plan: ${slotId} branchScope does not belong to ${brandId}.`);
      }
    }

    const campaignType = stringValue(item, "campaignType", `calendar[${index}]`) as MarketingCampaignType;
    if (!allowedCampaignTypes.includes(campaignType)) {
      throw new Error(`Invalid marketing plan: ${slotId} has unsupported campaignType ${campaignType}.`);
    }
    const channel = stringValue(item, "channel", `calendar[${index}]`);
    if (!input.channels.includes(channel)) throw new Error(`Invalid marketing plan: ${slotId} uses disallowed channel ${channel}.`);
    const assetType = stringValue(item, "assetType", `calendar[${index}]`);
    if (!input.assetTypes.includes(assetType)) throw new Error(`Invalid marketing plan: ${slotId} uses disallowed assetType ${assetType}.`);
    const priority = stringValue(item, "priority", `calendar[${index}]`) as MarketingPriority;
    if (!allowedPriorities.includes(priority)) throw new Error(`Invalid marketing plan: ${slotId} has invalid priority ${priority}.`);

    const conceptDirection = stringValue(item, "conceptDirection", `calendar[${index}]`);
    if (/\bLKR\b|\bRs\.?\s*\d|\b\d+\s*%\s*off\b|buy\s*1\s*get\s*1/i.test(conceptDirection)) {
      throw new Error(`Invalid marketing plan: ${slotId} conceptDirection contains customer-facing price/offer claims.`);
    }

    const additionalTruthNeeded = stringArray(item, "additionalTruthNeeded", `calendar[${index}]`);
    const readiness = deriveTruthReadiness({
      campaignType,
      availableTruthKeys: input.availableTruthKeys,
      additionalTruthNeeded,
    });

    return {
      slotId,
      date,
      brandId,
      branchScope,
      campaignType,
      objective: stringValue(item, "objective", `calendar[${index}]`),
      audience: stringValue(item, "audience", `calendar[${index}]`),
      channel,
      assetType,
      priority,
      conceptDirection,
      additionalTruthNeeded,
      ...readiness,
    };
  });
}

function validateWeeklyPlans(value: unknown, slots: MarketingCalendarSlot[]): MarketingWeeklyPlan[] {
  if (!Array.isArray(value) || value.length < 4 || value.length > 6) {
    throw new Error("Invalid marketing plan: weeklyPlans must contain 4 to 6 planning weeks.");
  }
  const validSlots = new Set(slots.map((slot) => slot.slotId));
  const covered: string[] = [];
  const weeks = value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Invalid marketing plan: weeklyPlans[${index}] must be an object.`);
    const slotIds = stringArray(item, "slotIds", `weeklyPlans[${index}]`);
    if (!slotIds.length || slotIds.some((slotId) => !validSlots.has(slotId))) {
      throw new Error(`Invalid marketing plan: weeklyPlans[${index}] contains invalid or empty slot coverage.`);
    }
    covered.push(...slotIds);
    return {
      weekId: stringValue(item, "weekId", `weeklyPlans[${index}]`),
      startDate: stringValue(item, "startDate", `weeklyPlans[${index}]`),
      endDate: stringValue(item, "endDate", `weeklyPlans[${index}]`),
      focus: stringValue(item, "focus", `weeklyPlans[${index}]`),
      slotIds,
    };
  });
  if (covered.length !== slots.length || new Set(covered).size !== slots.length) {
    throw new Error("Invalid marketing plan: weeklyPlans must cover every calendar slot exactly once.");
  }
  return weeks;
}

export function parseAtthasMarketingPlan(raw: string, input: {
  month: string;
  slots: MarketingCalendarSlot[];
  branches: PlanningBranch[];
  activeBrands: AtthasPlanningBrandId[];
  channels: string[];
  assetTypes: string[];
  availableTruthKeys: string[];
}): AtthasMarketingPlan {
  const root = parseJsonObject(raw);
  if (stringValue(root, "month", "root") !== input.month) {
    throw new Error(`Invalid marketing plan: month must remain ${input.month}.`);
  }

  const strategicObjectives = stringArray(root, "strategicObjectives", "root");
  const audiencePriorities = stringArray(root, "audiencePriorities", "root");
  if (!strategicObjectives.length || !audiencePriorities.length) {
    throw new Error("Invalid marketing plan: strategicObjectives and audiencePriorities cannot be empty.");
  }

  const contentPillars = validatePillars(root.contentPillars, input.activeBrands);
  const monthlyBalance = validateMonthlyBalance(root.monthlyBalance);
  const calendar = validateCalendar({
    value: root.calendar,
    slots: input.slots,
    branches: input.branches,
    activeBrands: input.activeBrands,
    channels: input.channels,
    assetTypes: input.assetTypes,
    availableTruthKeys: input.availableTruthKeys,
  });
  const weeklyPlans = validateWeeklyPlans(root.weeklyPlans, input.slots);

  return {
    month: input.month,
    northStar: stringValue(root, "northStar", "root"),
    strategicObjectives,
    audiencePriorities,
    contentPillars,
    monthlyBalance,
    weeklyPlans,
    calendar,
    planningNotes: stringArray(root, "planningNotes", "root"),
  };
}
