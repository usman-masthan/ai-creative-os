import type {
  MarketingCalendarSlot,
  MarketingCampaignType,
  MarketingTruthReadiness,
} from "./marketingPlannerTypes.js";

const DEFAULT_WEEKDAYS_BY_CADENCE: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [1, 3, 5, 7],
  5: [1, 2, 4, 5, 7],
  6: [1, 2, 3, 4, 5, 6],
  7: [1, 2, 3, 4, 5, 6, 7],
};

export const CAMPAIGN_REQUIRED_TRUTH: Record<MarketingCampaignType, string[]> = {
  PRODUCT_PUSH: ["productName", "branchAvailability", "approvedProductVisual"],
  DINE_IN: ["branchPhysicalAddress", "physicalOpeningHours"],
  DELIVERY: ["deliveryChannel", "branchAvailability"],
  BRAND_BUILDING: [],
  ENGAGEMENT: [],
  SEASONAL: ["seasonalContext"],
  OFFER: ["offerTerms", "offerValidity", "price", "branchAvailability"],
};

function assertMonth(month: string): void {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Marketing plan month must use YYYY-MM format.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw new Error("Marketing plan month is invalid.");
  }
}

function weekdayNumber(date: Date): number {
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function buildMonthlyCalendarSlots(input: {
  month: string;
  postsPerWeek: number;
  postingWeekdays?: number[];
}): MarketingCalendarSlot[] {
  assertMonth(input.month);
  if (!Number.isInteger(input.postsPerWeek) || input.postsPerWeek < 1 || input.postsPerWeek > 7) {
    throw new Error("postsPerWeek must be an integer from 1 to 7.");
  }

  const weekdays = input.postingWeekdays ?? DEFAULT_WEEKDAYS_BY_CADENCE[input.postsPerWeek];
  if (!weekdays || weekdays.length !== input.postsPerWeek) {
    throw new Error("postingWeekdays must contain exactly postsPerWeek unique weekdays.");
  }
  if (new Set(weekdays).size !== weekdays.length || weekdays.some((day) => day < 1 || day > 7)) {
    throw new Error("postingWeekdays must use unique ISO weekdays from 1 (Mon) to 7 (Sun).");
  }

  const [year, monthNumber] = input.month.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const allowed = new Set(weekdays);
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
  const slots: MarketingCalendarSlot[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthNumber - 1, day));
    if (!allowed.has(weekdayNumber(date))) continue;
    const isoDate = date.toISOString().slice(0, 10);
    slots.push({
      slotId: `S${String(slots.length + 1).padStart(2, "0")}`,
      date: isoDate,
      weekday: formatter.format(date),
    });
  }

  return slots;
}

export function truthRequirementsForCampaign(type: MarketingCampaignType): string[] {
  return [...CAMPAIGN_REQUIRED_TRUTH[type]];
}

export function deriveTruthReadiness(input: {
  campaignType: MarketingCampaignType;
  availableTruthKeys: string[];
  additionalTruthNeeded?: string[];
}): {
  requiredTruth: string[];
  missingTruth: string[];
  truthReadiness: MarketingTruthReadiness;
} {
  const requiredTruth = [
    ...new Set([
      ...truthRequirementsForCampaign(input.campaignType),
      ...(input.additionalTruthNeeded ?? []),
    ]),
  ];
  const available = new Set(input.availableTruthKeys);
  const missingTruth = requiredTruth.filter((key) => !available.has(key));
  return {
    requiredTruth,
    missingTruth,
    truthReadiness:
      missingTruth.length === 0
        ? "READY_WITH_CURRENT_TRUTH"
        : "NEEDS_TRUTH_BEFORE_PRODUCTION",
  };
}
