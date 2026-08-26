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
    branchId: "BURGER_MARINE_DRIVE_C04",
    brandId: "ATTHAS_BURGER",
    name: "ATTHA'S Burger — Bambalapitiya",
    aliases: ["bambalapitiya", "bambalapitya", "bamba", "pink beach", "colombo 04", "colombo 4"],
  },
  {
    branchId: "BURGER_HEY_MARINE_C03",
    brandId: "ATTHAS_BURGER",
    name: "ATTHA'S Burger — Kollupitiya",
    aliases: ["kollupitiya", "kollupitya", "colpetty", "hey marine", "colombo 03", "colombo 3"],
  },
  {
    branchId: "RESTAURANT_COLOMBO_06",
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
  productId?: string | undefined;
  salesChannel?: string | undefined;
  showPrice: boolean;
  mode: TaskProductionMode;
  assumptions: string[];
  missingFields: string[];
  requestedProductClaims?: string[];
  lockedHeadline?: string;
  lockedSubheadline?: string;
  packagingDirectionRequested?: boolean;
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

function removeNegatedOfferLanguage(text: string): string {
  return text
    .replace(/\bno\s+(?:special\s+)?offers?\b/g, " ")
    .replace(/\bno\s+discounts?\b/g, " ")
    .replace(/\bno\s+(?:special\s+)?promotions?\b/g, " ")
    .replace(/\bwithout\s+(?:an?\s+)?offers?\b/g, " ")
    .replace(/\bwithout\s+(?:a\s+)?discount\b/g, " ")
    .replace(/\bwithout\s+(?:a\s+)?promotion\b/g, " ")
    .replace(/\bdo\s+not\s+(?:make|use|include|mention)\s+(?:it\s+)?(?:an?\s+)?offers?\b/g, " ")
    .replace(/\bdon['’]?t\s+(?:make|use|include|mention)\s+(?:it\s+)?(?:an?\s+)?offers?\b/g, " ");
}

function inferCampaignType(text: string, productId?: string): MarketingCampaignType {
  const positiveText = removeNegatedOfferLanguage(text);
  if (includesAny(positiveText, ["offer", "discount", "% off", "deal", "promotion"])) return "OFFER";
  if (productId) return "PRODUCT_PUSH";
  if (includesAny(text, ["uber", "pickme", "delivery", "deliver", "order online"])) return "DELIVERY";
  if (includesAny(text, ["poll", "vote", "comment", "engagement", "question", "tag a friend"])) return "ENGAGEMENT";
  if (includesAny(text, ["eid", "ramadan", "christmas", "new year", "seasonal", "festival", "festive"])) return "SEASONAL";
  if (includesAny(text, ["promote", "feature", "product", "menu item", "dish", "meal"])) return "PRODUCT_PUSH";
  if (includesAny(text, ["dine", "family-dining", "family dining", "visit", "footfall", "come in", "tonight", "family dinner", "table", "walk in"])) return "DINE_IN";
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

function cleanCandidateProduct(value: string | undefined): string | undefined {
  const candidate = value?.trim().replace(/\s+/g, " ");
  if (!candidate || candidate.length > 80) return undefined;
  if (/^(burger|restaurant)\b/i.test(candidate)) return undefined;
  if (!/\b(wrap|burger|pizza|shawarma|sandwich|kottu|rice|noodles|pasta|meal|platter|dish)\b/i.test(candidate)) {
    return undefined;
  }
  return candidate;
}

function inferProduct(text: string): string | undefined {
  const quoted = text.match(/["“”']([^"“”']{2,80})["“”']/)?.[1]?.trim();
  if (quoted && /\b(wrap|burger|pizza|shawarma|sandwich|kottu|rice|noodles|pasta|meal|platter|dish)\b/i.test(quoted)) {
    return quoted;
  }

  const promote = text.match(/(?:promote|feature)\s+(?:our\s+)?(.+?)(?:\s+(?:at|in|for|on|this|tonight|across)\b|[.!?]|$)/i)?.[1]?.trim();
  const promoted = cleanCandidateProduct(promote);
  if (promoted) return promoted;

  const branded = text.match(/ATTHA[’']S\s+(.+?)(?:,\s*(?:using|with|for)|\s+(?:using|with)\b|[.!?]|$)/i)?.[1];
  return cleanCandidateProduct(branded);
}

function extractProductClaimClause(request: string): string[] {
  const match = request.match(/\bwrap\s+with\s+(.+?)\s*,?\s*presented\b/i);
  if (!match?.[1]) return [];
  const normalized = match[1]
    .replace(/\band\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 80);
  return [...new Set(normalized)];
}

function extractCreativeLocks(request: string): { headline?: string; subheadline?: string } {
  const headlineMatch = request.match(/headline\s+[“"]([^”"]{2,120})[”"]/i);
  const subheadlineMatch = request.match(/headline\s+[“"][^”"]+[”"]\s+with\s+[“"]([^”"]{2,120})[”"]\s+(?:clearly\s+)?beneath/i);
  return {
    ...(headlineMatch?.[1] ? { headline: headlineMatch[1].trim() } : {}),
    ...(subheadlineMatch?.[1] ? { subheadline: subheadlineMatch[1].trim() } : {}),
  };
}

function branchRequired(type: MarketingCampaignType): boolean {
  return ["PRODUCT_PUSH", "DINE_IN", "DELIVERY", "OFFER"].includes(type);
}

function explicitlyRejectsPrice(text: string): boolean {
  return /\bno\s+(?:visible\s+)?price\b/.test(text)
    || /\bwithout\s+(?:a\s+|the\s+)?price\b/.test(text)
    || /\bdo\s+not\s+(?:show|include|mention|use)\s+(?:a\s+|the\s+)?price\b/.test(text)
    || /\bdon['’]?t\s+(?:show|include|mention|use)\s+(?:a\s+|the\s+)?price\b/.test(text);
}

function explicitlyRequestsPrice(text: string): boolean {
  if (explicitlyRejectsPrice(text)) return false;
  return /\bprice\b/.test(text)
    || /\blkr\b/.test(text)
    || /\brupees?\b/.test(text)
    || /\brs\.?\s*\d/i.test(text);
}

export function interpretAtthasTaskRequest(rawRequest: string): AtthasTaskIntent {
  const request = rawRequest.trim();
  if (!request) throw new Error("Campaign request cannot be empty.");
  const text = ` ${request.toLowerCase()} `;
  const branch = inferBranch(text);
  const productId = inferProduct(request);
  const campaignType = inferCampaignType(text, productId);
  const channel = inferChannel(text);
  const salesChannel = inferSalesChannel(text);
  const showPrice = explicitlyRequestsPrice(text) || (campaignType === "OFFER" && !explicitlyRejectsPrice(text));
  const requestedProductClaims = productId ? extractProductClaimClause(request) : [];
  const locks = extractCreativeLocks(request);
  const packagingDirectionRequested = /\bATTHA[’']S[- ]branded\s+(?:wrapping|wrapper|packaging)\b/i.test(request)
    || /\bbranded\s+(?:wrapping|wrapper|packaging)\b/i.test(request);

  let brandId: AtthasPlanningBrandId | undefined = branch?.brandId;
  if (!brandId && includesAny(text, ["attha's restaurant", "attha’s restaurant", "multi cuisine", "wellawatte"])) brandId = "ATTHAS_RESTAURANT";
  if (!brandId && includesAny(text, ["attha's burger", "attha’s burger", "wellampitiya", "bambalapitiya", "kollupitiya"])) brandId = "ATTHAS_BURGER";

  const assumptions: string[] = [];
  if (!branch && !branchRequired(campaignType)) assumptions.push("No branch was specified, so the task can remain brand-wide.");
  if (!salesChannel && showPrice) assumptions.push("A price is requested but the sales channel still needs user confirmation.");
  if (campaignType === "BRAND_BUILDING") assumptions.push("No explicit conversion/product intent was detected, so brand-building was selected.");
  if (requestedProductClaims.length) assumptions.push("Product details written in the brief will be treated as claims that require task confirmation before generation.");
  if (packagingDirectionRequested) assumptions.push("Branded packaging was requested and must be explicitly confirmed for this product before generation.");

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
    ...(requestedProductClaims.length ? { requestedProductClaims } : {}),
    ...(locks.headline ? { lockedHeadline: locks.headline } : {}),
    ...(locks.subheadline ? { lockedSubheadline: locks.subheadline } : {}),
    ...(packagingDirectionRequested ? { packagingDirectionRequested: true } : {}),
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

  const requestedProductClaims = input.requestedProductClaims?.map((value) => value.trim()).filter(Boolean) ?? [];
  const additionalTruthNeeded = [
    ...(input.showPrice ? ["price"] : []),
    ...(requestedProductClaims.length ? ["requestedProductClaims"] : []),
    ...(input.packagingDirectionRequested ? ["approvedPackagingDirection"] : []),
  ];
  const requiredTruth = [
    ...new Set([
      ...truthRequirementsForCampaign(input.campaignType),
      ...additionalTruthNeeded,
    ]),
  ];

  const requirementScopes: Record<string, PlannedTruthRequirementScope> = {};
  const productId = input.productId?.trim();
  for (const key of [
    "productName",
    "branchAvailability",
    "approvedProductVisual",
    "price",
    "requestedProductClaims",
    "approvedPackagingDirection",
  ]) {
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
    ...(requestedProductClaims.length ? { requestedProductClaims } : {}),
    missingFields: [],
  };

  const creativeLocks = [
    input.lockedHeadline ? `LOCKED HEADLINE — use exactly: ${input.lockedHeadline}` : "",
    input.lockedSubheadline ? `LOCKED SUBHEADLINE — use exactly: ${input.lockedSubheadline}` : "",
  ].filter(Boolean);
  const productClaimDirection = requestedProductClaims.length
    ? `The brief requested these product depictions: ${requestedProductClaims.join("; ")}. They are not facts until the task-confirmed requestedProductClaims value authorizes them.`
    : "";
  const packagingDirection = input.packagingDirectionRequested
    ? "Branded packaging is requested. Follow only the task-confirmed approvedPackagingDirection; never invent a logo, label or packaging design."
    : "";

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
    conceptDirection: [
      `Fulfil the user's task: ${input.rawRequest}.`,
      "Use only task-confirmed customer-facing facts; task-confirmed values override unconfirmed wording in the raw brief.",
      ...creativeLocks,
      productClaimDirection,
      packagingDirection,
    ].filter(Boolean).join("\n"),
    additionalTruthNeeded,
    requiredTruth,
    missingTruth: [],
    truthReadiness: "READY_WITH_CURRENT_TRUTH",
    truthConfirmationHints: {
      ...(productId ? { productName: productId } : {}),
      ...(requestedProductClaims.length ? { requestedProductClaims: requestedProductClaims.join("; ") } : {}),
      ...(input.packagingDirectionRequested
        ? { approvedPackagingDirection: "ATTHA'S-branded wrapping requested — confirm an approved packaging reference/direction or replace with neutral unbranded wrapping." }
        : {}),
    },
  };

  return { intent: normalizedIntent, entry, requirementScopes };
}
