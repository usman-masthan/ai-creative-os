export type AtthasPlanningBrandId = "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";

export type MarketingCampaignType =
  | "PRODUCT_PUSH"
  | "DINE_IN"
  | "DELIVERY"
  | "BRAND_BUILDING"
  | "ENGAGEMENT"
  | "SEASONAL"
  | "OFFER";

export type MarketingPriority = "P1" | "P2" | "P3";
export type MarketingTruthReadiness =
  | "READY_WITH_CURRENT_TRUTH"
  | "NEEDS_TRUTH_BEFORE_PRODUCTION";

export interface PlanningBranch {
  branchId: string;
  brandId: AtthasPlanningBrandId;
  name: string;
}

export interface MarketingCalendarSlot {
  slotId: string;
  date: string;
  weekday: string;
}

export interface MarketingContentPillar {
  id: string;
  name: string;
  purpose: string;
  weightPercent: number;
  businessUnits: AtthasPlanningBrandId[];
}

export interface MarketingCalendarEntry {
  slotId: string;
  date: string;
  brandId: AtthasPlanningBrandId;
  branchScope: "BRAND_WIDE" | string;
  campaignType: MarketingCampaignType;
  objective: string;
  audience: string;
  channel: string;
  assetType: string;
  priority: MarketingPriority;
  conceptDirection: string;
  additionalTruthNeeded: string[];
  requiredTruth: string[];
  missingTruth: string[];
  truthReadiness: MarketingTruthReadiness;
  truthConfirmationHints?: Record<string, unknown>;
}

export interface MarketingWeeklyPlan {
  weekId: string;
  startDate: string;
  endDate: string;
  focus: string;
  slotIds: string[];
}

export interface AtthasMarketingPlan {
  month: string;
  northStar: string;
  strategicObjectives: string[];
  audiencePriorities: string[];
  contentPillars: MarketingContentPillar[];
  monthlyBalance: {
    brandBuilding: number;
    productPush: number;
    dineIn: number;
    delivery: number;
    engagement: number;
    seasonalOrOffer: number;
  };
  weeklyPlans: MarketingWeeklyPlan[];
  calendar: MarketingCalendarEntry[];
  planningNotes: string[];
}

export interface MarketingPlanTrace {
  provider: string;
  model: string;
  attempts: number;
  repairs: number;
  generatedSlots: number;
  readyForProduction: number;
  blockedPendingTruth: number;
}
