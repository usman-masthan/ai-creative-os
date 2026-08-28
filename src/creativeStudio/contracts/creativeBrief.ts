export type CreativeBriefFormatPreset =
  | "instagram-square"
  | "instagram-portrait"
  | "instagram-story"
  | "facebook-post"
  | "facebook-story"
  | "digital-menu"
  | "web-banner"
  | "poster"
  | "custom";

export interface CreativeBriefFormat {
  preset: CreativeBriefFormatPreset;
  width: number;
  height: number;
}

export interface CreativeBriefProductRef {
  id?: string;
  name?: string;
}

export interface CreativeBriefContentRequirements {
  showPrice: boolean;
  showOffer: boolean;
  showCTA: boolean;
  showProductName: boolean;
  showBranch: boolean;
  showContactDetails: boolean;
  showCampaignDates: boolean;
  headlineDirection?: string;
  customInstructions?: string;
}

export interface CreativeBrief {
  schemaVersion: 1;
  id: string;
  clientId: string;
  brandId: string;
  goal: string;
  description: string;
  product?: CreativeBriefProductRef;
  branchId?: string;
  salesChannel?: string;
  audience: string[];
  vibe: string[];
  format: CreativeBriefFormat;
  contentRequirements: CreativeBriefContentRequirements;
  brandKitId: string;
  truthSnapshotId?: string;
  createdAt: string;
}

export interface CreativeBriefValidationResult {
  valid: boolean;
  issues: string[];
}

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function uniqueTrimmed(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeCreativeBrief(input: CreativeBrief): CreativeBrief {
  return {
    ...input,
    id: input.id.trim(),
    clientId: input.clientId.trim(),
    brandId: input.brandId.trim(),
    goal: input.goal.trim(),
    description: input.description.trim(),
    ...(input.product
      ? {
          product: {
            ...(input.product.id?.trim() ? { id: input.product.id.trim() } : {}),
            ...(input.product.name?.trim() ? { name: input.product.name.trim() } : {}),
          },
        }
      : {}),
    ...(input.branchId?.trim() ? { branchId: input.branchId.trim() } : {}),
    ...(input.salesChannel?.trim() ? { salesChannel: input.salesChannel.trim() } : {}),
    audience: uniqueTrimmed(input.audience),
    vibe: uniqueTrimmed(input.vibe),
    contentRequirements: {
      ...input.contentRequirements,
      ...(input.contentRequirements.headlineDirection?.trim()
        ? { headlineDirection: input.contentRequirements.headlineDirection.trim() }
        : {}),
      ...(input.contentRequirements.customInstructions?.trim()
        ? { customInstructions: input.contentRequirements.customInstructions.trim() }
        : {}),
    },
    brandKitId: input.brandKitId.trim(),
    ...(input.truthSnapshotId?.trim()
      ? { truthSnapshotId: input.truthSnapshotId.trim() }
      : {}),
  };
}

export function validateCreativeBrief(input: CreativeBrief): CreativeBriefValidationResult {
  const issues: string[] = [];
  if (input.schemaVersion !== 1) issues.push("CreativeBrief.schemaVersion must be 1.");
  if (!isNonEmpty(input.id)) issues.push("CreativeBrief.id is required.");
  if (!isNonEmpty(input.clientId)) issues.push("CreativeBrief.clientId is required.");
  if (!isNonEmpty(input.brandId)) issues.push("CreativeBrief.brandId is required.");
  if (!isNonEmpty(input.goal)) issues.push("CreativeBrief.goal is required.");
  if (!isNonEmpty(input.description)) issues.push("CreativeBrief.description is required.");
  if (!isNonEmpty(input.brandKitId)) issues.push("CreativeBrief.brandKitId is required.");
  if (!Number.isInteger(input.format.width) || input.format.width < 64 || input.format.width > 16384) {
    issues.push("CreativeBrief.format.width must be an integer from 64 to 16384.");
  }
  if (!Number.isInteger(input.format.height) || input.format.height < 64 || input.format.height > 16384) {
    issues.push("CreativeBrief.format.height must be an integer from 64 to 16384.");
  }
  if (!input.audience.length) issues.push("CreativeBrief.audience must contain at least one audience.");
  if (!input.vibe.length) issues.push("CreativeBrief.vibe must contain at least one creative direction.");
  if (input.audience.some((value) => !isNonEmpty(value))) issues.push("CreativeBrief.audience cannot contain blank values.");
  if (input.vibe.some((value) => !isNonEmpty(value))) issues.push("CreativeBrief.vibe cannot contain blank values.");
  if (input.product && !input.product.id?.trim() && !input.product.name?.trim()) {
    issues.push("CreativeBrief.product must contain an id or name when supplied.");
  }
  if (Number.isNaN(Date.parse(input.createdAt))) issues.push("CreativeBrief.createdAt must be an ISO-compatible timestamp.");
  return { valid: issues.length === 0, issues };
}

export function assertCreativeBrief(input: CreativeBrief): CreativeBrief {
  const normalized = normalizeCreativeBrief(input);
  const validation = validateCreativeBrief(normalized);
  if (!validation.valid) {
    throw new Error(`CREATIVE_BRIEF_INVALID: ${validation.issues.join(" ")}`);
  }
  return normalized;
}
