import { truthRequirementsForCampaign } from "../marketingPlannerPolicy.js";
import type {
  AtthasPlanningBrandId,
  MarketingCalendarEntry,
  MarketingCampaignType,
} from "../marketingPlannerTypes.js";
import type { PlannedTruthRequirementScope } from "../commands/producePlannedCampaign.js";

export interface AtthasBranchOption {
  branchId: string;
  brandId: AtthasPlanningBrandId;
  name: string;
  aliases: string[];
}

export const ATTHAS_BRANCH_OPTIONS: AtthasBranchOption[] = [
  {
    branchId: "BURGER_WELLAMPITIYA",
    brandId: "ATTHAS_BURGER",
    name: "ATTHA'S Burger — Wellampitiya",
    aliases: ["wellampitiya", "wellampitya", "kotikawatta", "urban city"],
  },
  {
    branchId: "BURGER_BAMBALAPITIYA",
    brandId: "ATTHAS_BURGER",
    name: "ATTHA'S Burger — Bambalapitiya",
    aliases: ["bambalapitiya", "bambalapitya", "bamba", "pink beach"],
  },
  {
    branchId: "BURGER_KOLLUPITIYA",
    brandId: "ATTHAS_BURGER",
    name: "ATTHA'S Burger — Kollupitiya",
    aliases: ["kollupitiya", "kollupitya", "colpetty", "hey marine"],
  },
  {
    branchId: "RESTAURANT_WELLAWATTE",
    brandId: "ATTHAS_RESTAURANT",
    name: "ATTHA'S Restaurant — Wellawatte",
    aliases: ["wellawatte", "hampden", "colombo 06", "colombo 6"],
  },
];

export type TaskProductionMode = "DRAFT" | "FINAL";

export interface AtthasTaskIntent {
  rawRequest: string;
  brandId?: AtthasPlanningBrandId;
  branchScope?: "BRAND_WIDE" | string;
  campaignType?: MarketingCampaignType;
  objective: string;
  audience: string;
  channel: string;
  assetType: string;
  productId?: string;
  salesChannel?: string;
  showPrice: boolean;
  mode: TaskProductionMode;
  assumptions: string[];
  missingFields: string[];
}

const CAMPAIGN_TYPES: MarketingCampaignType[] = [
  "PRODUCT_PUSH",
  "DINE_IN",
  "DELIVERY",
  "BRAND_BUILDING",
  "ENGAGEMENT",
  "SEASONAL",
  "OFFER",
];

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function inferBranch(text: string): AtthasBranchOption | undefined {
  return ATTHAS_BRANCH_OPTIONS.find((branch) => branch.aliases.some((alias) => text.includes(alias)));
}

function inferCampaignType(text: string): MarketingCampaignType {
  if (includesAny(text, ["offer", "discount", "% off", "deal", "promotion", "promo"])) return "OFFER";
  if (includesAny(text, ["uber", "pickme", "delivery", "deliver", "order online"])) return "DELIVERY";
  if (includesAny(text, ["poll", "vote", "comment", "engagement", "question", "tag a friend"])) return "ENGAGEMENT";
  if (includesAny(text, ["eid", "ramadan", "christmas", "new year", "seasonal", "festival", "festive"])) return "SEASONAL";
  if (includesAny(text, ["dine", "visit", "footfall", "come in", "tonight", "family dinner", "table", "walk in"])) return "DINE_IN";
  if (includesAny(text, ["promote", "feature", "product", "menu item", "dish", "meal", "burger"])) return "PRODUCT_PUSH";
  return "BRAND_BUILDING";
}

function inferChannel(text: string): { channel: string; assetType: string } {
  if (includesAny(text, ["whatsapp", "status"])) return { channel: "whatsapp", assetType: "status" };
  if (includesAny(text, ["facebook", " fb "])) return { channel: "facebook", assetType: "poster" };
  if (includesAny(text, ["reel cover", "reel-cover"])) return { channel: "instagram", assetType: "reel-cover" };
  if (includesAny(text, ["story", "stories"])) return { channel: "instagram", assetType: "story" };
  return { channel: "instagram", assetType: "poster" };
}

function inferSalesChannel(text: string): string | undefined {
  if (text.includes("uber")) return "UBER_EATS";
  if (text.includes("pickme")) return "PICKME";
  if (text.includes("takeaway") || text.includes("take away")) return "TAKEAWAY";
  if (text.includes("dine-in") || text.includes("dine in")) return "DINE_IN";
  return undefined;
}

function inferProduct(text: string): string | undefined {
  const quoted = text.match(/["“”']([^"“”']{2,80})["“”']/)?.[1]?.trim();
  if (quoted) return quoted;

  const promote = text.match(/(?:promote|feature)\s+(?:our\s+)?(.+?)(?:\s+(?:at|in|for|on|this|tonight|across)\b|[.!?]|$)/i)?.[1]?.trim();
  if (promote && promote.length <= 80) return promote;
  return undefined;
}

function branchRequired(type: MarketingCampaignType): boolean {
  return ["PRODUCT_PUSH", "DINE_IN", "DELIVERY", "OFFER"].includes(type);
}

export function interpretAtthasTaskRequest(rawRequest: string): AtthasTaskIntent {
  const request = rawRequest.trim();
  if (!request) throw new Error("Campaign request cannot be empty.");
  const text = ` ${request.toLowerCase()} `;
  const branch = inferBranch(text);
  const campaignType = inferCampaignType(text);
  const channel = inferChannel(text);
  const salesChannel = inferSalesChannel(text);
  const productId = inferProduct(request);
  const showPrice = includesAny(text, ["price", "rs.", "rs ", "lkr", "rupee", "cost"]) || campaignType === "OFFER";

  let brandId: AtthasPlanningBrandId | undefined = branch?.brandId;
  if (!brandId && includesAny(text, ["restaurant", "multi cuisine", "wellawatte"])) brandId = "ATTHAS_RESTAURANT";
  if (!brandId && includesAny(text, ["burger", "wellampitiya", "bambalapitiya", "kollupitiya"])) brandId = "ATTHAS_BURGER";

  const assumptions: string[] = [];
  if (!branch && !branchRequired(campaignType)) assumptions.push("No branch was specified, so the task can remain brand-wide.");
  if (!salesChannel && showPrice) assumptions.push("A price is requested but the sales channel still needs user confirmation.");
  if (campaignType === "BRAND_BUILDING") assumptions.push("No explicit conversion/product intent was detected, so brand-building was selected.");

  const missingFields: string[] = [];
  if (!brandId) missingFields.push("brandId");
  if (branchRequired(campaignType) && !branch) missingFields.push("branchScope");
  if (campaignType === "PRODUCT_PUSH" && !productId) missingFields.push("productId");
  if (showPrice && !salesChannel) missingFields.push("salesChannel");

  return {
    rawRequest: request,
    ...(brandId ? { brandId } : {}),
    branchScope: branch?.branchId ?? "BRAND_WIDE",
    campaignType,
    objective: request,
    audience: "Relevant ATTHA'S customers",
    channel: channel.channel,
    assetType: channel.assetType,
    ...(productId ? { productId } : {}),
    ...(salesChannel ? { salesChannel } : {}),
    showPrice,
    mode: "DRAFT",
    assumptions,
    missingFields,
  };
}

export interface NormalizedAtthasTask {
  intent: AtthasTaskIntent & {
    brandId: AtthasPlanningBrandId;
    branchScope: "BRAND_WIDE" | string;
    campaignType: MarketingCampaignType;
  };
  entry: MarketingCalendarEntry;
  requirementScopes: Record<string, PlannedTruthRequirementScope>;
}

export function normalizeAtthasTaskIntent(input: AtthasTaskIntent): NormalizedAtthasTask {
  if (!input.brandId) throw new Error("Please select ATTHA'S Burger or ATTHA'S Restaurant.");
  if (!input.campaignType || !CAMPAIGN_TYPES.includes(input.campaignType)) {
    throw new Error("Please select a valid campaign type.");
  }
  const branchScope = input.branchScope ?? "BRAND_WIDE";
  if (branchRequired(input.campaignType) && branchScope === "BRAND_WIDE") {
    throw new Error(`${input.campaignType} requires a specific branch for safe truth scoping.`);
  }
  const branch = branchScope === "BRAND_WIDE"
    ? undefined
    : ATTHAS_BRANCH_OPTIONS.find((item) => item.branchId === branchScope);
  if (branch && branch.brandId !== input.brandId) {
    throw new Error(`Branch ${branchScope} does not belong to ${input.brandId}.`);
  }
  if (input.campaignType === "PRODUCT_PUSH" && !input.productId?.trim()) {
    throw new Error("Product campaigns require the product/item name.");
  }
  if (input.showPrice && !input.salesChannel?.trim()) {
    throw new Error("Price-bearing campaigns require a sales channel (dine-in, takeaway, Uber Eats or PickMe).");
  }

  const additionalTruthNeeded = input.showPrice ? ["price"] : [];
  const requiredTruth = [
    ...new Set([
      ...truthRequirementsForCampaign(input.campaignType),
      ...additionalTruthNeeded,
    ]),
  ];

  const requirementScopes: Record<string, PlannedTruthRequirementScope> = {};
  const productId = input.productId?.trim();
  for (const key of ["productName", "branchAvailability", "approvedProductVisual", "price"]) {
    if (!requiredTruth.includes(key)) continue;
    requirementScopes[key] = {
      ...(productId ? { productId } : {}),
      ...(key === "price" && input.salesChannel ? { salesChannel: input.salesChannel } : {}),
    };
  }
  if (requiredTruth.includes("deliveryChannel") && input.salesChannel) {
    requirementScopes.deliveryChannel = { salesChannel: input.salesChannel };
  }

  const normalizedIntent = {
    ...input,
    brandId: input.brandId,
    branchScope,
    campaignType: input.campaignType,
    ...(productId ? { productId } : {}),
    missingFields: [],
  };
  const entry: MarketingCalendarEntry = {
    slotId: "USER-TASK",
    date: new Date().toISOString().slice(0, 10),
    brandId: input.brandId,
    branchScope,
    campaignType: input.campaignType,
    objective: input.objective.trim() || input.rawRequest,
    audience: input.audience.trim() || "Relevant ATTHA'S customers",
    channel: input.channel.trim() || "instagram",
    assetType: input.assetType.trim() || "poster",
    priority: "P1",
    conceptDirection: `Fulfil the user's task: ${input.rawRequest}. Use only task-confirmed customer-facing facts.`,
    additionalTruthNeeded,
    requiredTruth,
    missingTruth: [],
    truthReadiness: "READY_WITH_CURRENT_TRUTH",
  };

  return { intent: normalizedIntent, entry, requirementScopes };
}
