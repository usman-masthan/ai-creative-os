import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import type { BrandGovernance } from "../brandGovernance.js";
import type { ClaimGovernance } from "../claimGovernance.js";
import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../creativeTypes.js";
import {
  resolveCreativeFeatureFlags,
  type CreativeFeatureFlags,
} from "../featureFlags.js";
import type { ImageDraftProvider, ImageDraftResult } from "../imageProviders/types.js";
import {
  evaluateImageQualityGate,
  type ImageQualityGateResult,
  type ImageQualityTier,
  type ImageQualityTierProviders,
} from "../imageQualityEscalation.js";
import {
  selectAtthasLayout,
  type AtthasLayoutDefinition,
  type AtthasLayoutId,
} from "../layouts/atthas.js";
import { truthRequirementsForCampaign } from "../marketingPlannerPolicy.js";
import type { MarketingCalendarEntry } from "../marketingPlannerTypes.js";
import {
  composeDeterministicFoodSubjectFromFacts,
  type DeterministicFoodComposition,
} from "../physicalFoodComposer.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import {
  buildStructuredImageBrief,
  compileStructuredImagePrompt,
  type StructuredImageBrief,
} from "../structuredImageBrief.js";
import {
  governStructuredImageBrief,
  type StructuredBriefGovernanceIssue,
} from "../structuredBriefGovernance.js";
import type { TruthRecord, TruthRequirement, VerifiedFact } from "../types.js";
import { compositionExpectationFromBrief } from "../visualQa/compositionExpectation.js";
import type {
  VisualQaProvider,
  VisualQaRequest,
  VisualQaResult,
} from "../visualQa/types.js";
import {
  directGeneratedCampaign,
  type CreativeDirectorProviders,
  type DirectedCampaign,
} from "./directCampaign.js";
import {
  generateCampaign,
  type GenerateCampaignRequest,
  type GenerateCampaignResult,
} from "./generateCampaign.js";
import {
  producePoster,
  type ProducePosterRequest,
  type ProducePosterResult,
} from "./producePoster.js";

export type PlannedProductionMode = "DRAFT" | "FINAL";
export type PlannedImagePromptMode = "legacy" | "structured-brief";

export interface PlannedStructuredBriefGovernanceTrace {
  status: "VALID" | "REPAIRED";
  repairs: number;
  issuesBeforeRepair: StructuredBriefGovernanceIssue[];
}

export interface PlannedImagePromptPlan {
  mode: PlannedImagePromptMode;
  prompt: string;
  structuredBrief?: StructuredImageBrief;
  foodComposition?: DeterministicFoodComposition;
  briefGovernance?: PlannedStructuredBriefGovernanceTrace;
}

export interface PlannedTruthRequirementScope {
  productId?: string;
  salesChannel?: string;
}

export interface PlannedCampaignProductionProviders extends CreativeDirectorProviders {
  generation: CampaignGenerationProvider;
  image?: ImageDraftProvider | undefined;
  imageTiers?: ImageQualityTierProviders | undefined;
  visualQa?: VisualQaProvider | undefined;
}

export type PlannedVisualQaContext = Omit<
  VisualQaRequest,
  | "imageBase64"
  | "mimeType"
  | "brandId"
  | "branchId"
  | "compositionRequirements"
  | "compositionExpectation"
> & {
  compositionRequirements?: string[];
};

export interface ProducePlannedCampaignRequest {
  campaignId: string;
  entry: MarketingCalendarEntry;
  truthRecords: TruthRecord[];
  brandContext: string;
  providers: PlannedCampaignProductionProviders;
  outputDir: string;
  mode?: PlannedProductionMode;
  requirementScopes?: Record<string, PlannedTruthRequirementScope>;
  allowSourceVerified?: boolean;
  brandGovernance?: BrandGovernance;
  claimGovernance?: ClaimGovernance;
  baseImagePath?: string;
  visualQaContext?: PlannedVisualQaContext | undefined;
  preferredLayoutId?: AtthasLayoutId;
  maxCampaignRepairAttempts?: number;
  maxDirectorRepairAttempts?: number;
  maxFinalizerRepairAttempts?: number;
  maxImageRegenerations?: number;
  maxStructuredBriefRepairAttempts?: number;
  featureFlags?: Partial<CreativeFeatureFlags>;
  chromePath?: string;
  fetchFn?: typeof fetch;
  posterProducer?: (request: ProducePosterRequest) => Promise<ProducePosterResult>;
}

export interface ProductionImageAttempt {
  attempt: number;
  source: "local" | "generated";
  path: string;
  provider: string;
  model: string;
  costUsd?: number;
  promptMode?: PlannedImagePromptMode;
  structuredBrief?: StructuredImageBrief;
  foodComposition?: DeterministicFoodComposition;
  briefGovernance?: PlannedStructuredBriefGovernanceTrace;
  qualityTier?: ImageQualityTier;
  qualityGate?: ImageQualityGateResult;
  visualQa?: VisualQaResult;
}

interface ProductionTraceBase {
  campaignId: string;
  slotId: string;
  mode: PlannedProductionMode;
  layout?: AtthasLayoutDefinition;
  imageAttempts: ProductionImageAttempt[];
}

export type ProducePlannedCampaignResult =
  | (ProductionTraceBase & {
      status: "BLOCKED_PLANNED_TRUTH";
      missingTruth: string[];
    })
  | (ProductionTraceBase & {
      status: "BLOCKED_FACT_GATE";
      campaign: Extract<GenerateCampaignResult, { status: "BLOCKED_MISSING_VERIFIED_DATA" }>;
    })
  | (ProductionTraceBase & {
      status: "BLOCKED_FOOD_COMPOSER_TRUTH";
      campaign: Extract<GenerateCampaignResult, { status: "GENERATED" }>;
      productName: string;
      missingTruth: string[];
    })
  | (ProductionTraceBase & {
      status: "HUMAN_REVIEW_STRUCTURED_BRIEF_REQUIRED";
      campaign: DirectedCampaign;
      structuredBrief: StructuredImageBrief;
      issues: StructuredBriefGovernanceIssue[];
      repairs: number;
      draftImagePath?: string;
    })
  | (ProductionTraceBase & {
      status: "BLOCKED_MEDIA_INPUT" | "BLOCKED_VISUAL_QA_REQUIRED";
      campaign: DirectedCampaign;
    })
  | (ProductionTraceBase & {
      status:
        | "HUMAN_REVIEW_REQUIRED"
        | "BLOCKED_VISUAL_QA"
        | "REGENERATION_EXHAUSTED"
        | "REGENERATION_UNAVAILABLE";
      campaign: DirectedCampaign;
      visualQa: VisualQaResult;
      draftImagePath: string;
    })
  | (ProductionTraceBase & {
      status: "DRAFT_RENDERED" | "FINAL_RENDERED";
      campaign: DirectedCampaign;
      poster: ProducePosterResult;
      visualQa?: VisualQaResult;
    });

function normalizeImageRegenerations(value: number | undefined): number {
  if (value === undefined) return 2;
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error("maxImageRegenerations must be an integer from 0 to 3.");
  }
  return value;
}

function assertEntryShape(entry: MarketingCalendarEntry): void {
  const baseline = truthRequirementsForCampaign(entry.campaignType);
  for (const key of baseline) {
    if (!entry.requiredTruth.includes(key)) {
      throw new Error(
        `Planned campaign ${entry.slotId} is missing deterministic required truth key ${key}.`,
      );
    }
  }
  for (const key of entry.missingTruth) {
    if (!entry.requiredTruth.includes(key)) {
      throw new Error(
        `Planned campaign ${entry.slotId} lists missing truth ${key} outside requiredTruth.`,
      );
    }
  }
  if (entry.truthReadiness === "READY_WITH_CURRENT_TRUTH" && entry.missingTruth.length > 0) {
    throw new Error(
      `Planned campaign ${entry.slotId} cannot be READY_WITH_CURRENT_TRUTH while missing truth remains.`,
    );
  }
  if (entry.branchScope !== "BRAND_WIDE" && !entry.branchScope.trim()) {
    throw new Error("Planned campaign branchScope cannot be empty.");
  }
}

function requirementsFromEntry(
  entry: MarketingCalendarEntry,
  scopes: Record<string, PlannedTruthRequirementScope> | undefined,
): TruthRequirement[] {
  return entry.requiredTruth.map((key) => {
    const scope = scopes?.[key];
    return {
      key,
      ...(scope?.productId ? { productId: scope.productId } : {}),
      ...(scope?.salesChannel ? { salesChannel: scope.salesChannel } : {}),
    };
  });
}

function buildGenerationRequest(request: ProducePlannedCampaignRequest): GenerateCampaignRequest {
  const entry = request.entry;
  const plannedContext = [
    request.brandContext,
    "",
    "PLANNED CAMPAIGN CONTEXT",
    `Calendar slot: ${entry.slotId} on ${entry.date}`,
    `Audience: ${entry.audience}`,
    `Campaign type: ${entry.campaignType}`,
    `Priority: ${entry.priority}`,
    `Concept direction: ${entry.conceptDirection}`,
    "Treat the planned direction as creative guidance only. It does not create new verified facts.",
  ].join("\n");

  return {
    campaignId: request.campaignId,
    tenantId: "T001",
    brandId: entry.brandId,
    ...(entry.branchScope !== "BRAND_WIDE" ? { branchId: entry.branchScope } : {}),
    objective: entry.objective,
    channel: entry.channel,
    assetType: entry.assetType,
    requirements: requirementsFromEntry(entry, request.requirementScopes),
    truthRecords: request.truthRecords,
    brandContext: plannedContext,
    ...(request.allowSourceVerified !== undefined
      ? { allowSourceVerified: request.allowSourceVerified }
      : {}),
    ...(request.brandGovernance ? { brandGovernance: request.brandGovernance } : {}),
    ...(request.claimGovernance ? { claimGovernance: request.claimGovernance } : {}),
    ...(request.maxCampaignRepairAttempts !== undefined
      ? { maxRepairAttempts: request.maxCampaignRepairAttempts }
      : {}),
  };
}

function mimeFromPath(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

function extensionForMime(mimeType: string | undefined): string {
  switch (mimeType?.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

function buildLegacyImagePrompt(
  creative: CampaignCreativeOutput,
  layout: AtthasLayoutDefinition,
  previousQa?: VisualQaResult,
): string {
  const image = creative.imageGeneration;
  const blocks = [
    image.basePrompt,
    image.visualConstraints.length
      ? `Visual constraints: ${image.visualConstraints.join("; ")}.`
      : "",
    `Layout composition requirements: ${layout.imageCompositionRequirements.join("; ")}.`,
    image.negativePrompt ? `Avoid: ${image.negativePrompt}.` : "",
    previousQa
      ? `Previous visual QA required regeneration. Correct these visible issues without adding new product facts: ${previousQa.issues.join("; ") || "composition or quality did not pass"}.`
      : "",
    "Return an image only. Do not render promotional copy, numbers, prices, logos, badges, labels or watermarks.",
  ];
  return blocks.filter(Boolean).join("\n\n");
}

export function buildPlannedImagePrompt(input: {
  campaignId: string;
  brandId: string;
  branchId?: string;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  layout: AtthasLayoutDefinition;
  useStructuredBrief: boolean;
  verifiedFacts?: VerifiedFact[];
  foodComposition?: DeterministicFoodComposition;
  previousQa?: VisualQaResult;
}): PlannedImagePromptPlan {
  if (!input.useStructuredBrief) {
    return {
      mode: "legacy",
      prompt: buildLegacyImagePrompt(input.creative, input.layout, input.previousQa),
    };
  }

  const structuredBrief = buildStructuredImageBrief({
    campaignId: input.campaignId,
    brandId: input.brandId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    creative: input.creative,
    format: input.format,
    layout: input.layout,
    ...(input.verifiedFacts ? { verifiedFacts: input.verifiedFacts } : {}),
    ...(input.foodComposition ? { subject: input.foodComposition.subject } : {}),
    ...(input.previousQa?.issues.length
      ? { previousQaIssues: input.previousQa.issues }
      : {}),
  });

  return {
    mode: "structured-brief",
    prompt: compileStructuredImagePrompt(structuredBrief),
    structuredBrief,
    ...(input.foodComposition ? { foodComposition: input.foodComposition } : {}),
  };
}

type GovernPlannedImagePromptResult =
  | { status: "READY"; plan: PlannedImagePromptPlan }
  | {
      status: "HUMAN_REVIEW";
      brief: StructuredImageBrief;
      issues: StructuredBriefGovernanceIssue[];
      repairs: number;
    };

async function governPlannedImagePrompt(input: {
  plan: PlannedImagePromptPlan;
  campaign: DirectedCampaign;
  repairProvider: CampaignGenerationProvider;
  claimGovernance?: ClaimGovernance;
  maxRepairAttempts?: number;
}): Promise<GovernPlannedImagePromptResult> {
  if (!input.plan.structuredBrief) {
    return { status: "READY", plan: input.plan };
  }

  const governed = await governStructuredImageBrief({
    brief: input.plan.structuredBrief,
    preflight: input.campaign.preflight,
    creative: input.campaign.creative,
    repairProvider: input.repairProvider,
    ...(input.claimGovernance ? { claimGovernance: input.claimGovernance } : {}),
    ...(input.maxRepairAttempts !== undefined
      ? { maxRepairAttempts: input.maxRepairAttempts }
      : {}),
  });

  if (governed.status === "HUMAN_REVIEW") {
    return {
      status: "HUMAN_REVIEW",
      brief: governed.brief,
      issues: governed.issues,
      repairs: governed.repairs,
    };
  }

  return {
    status: "READY",
    plan: {
      ...input.plan,
      prompt: compileStructuredImagePrompt(governed.brief),
      structuredBrief: governed.brief,
      briefGovernance: {
        status: governed.status,
        repairs: governed.repairs,
        issuesBeforeRepair: governed.issuesBeforeRepair,
      },
    },
  };
}

async function downloadImage(
  url: string,
  destination: string,
  fetchFn: typeof fetch,
): Promise<Buffer> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`Image download returned unexpected content type: ${contentType}.`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000) {
    throw new Error(`Image download returned unexpectedly small payload (${bytes.length} bytes).`);
  }
  await writeFile(destination, bytes);
  return bytes;
}

async function persistGeneratedImage(input: {
  result: ImageDraftResult;
  outputDir: string;
  attempt: number;
  fetchFn: typeof fetch;
  promptPlan: PlannedImagePromptPlan;
  qualityTier?: ImageQualityTier;
}): Promise<{ path: string; bytes: Buffer; mimeType: string; summary: ProductionImageAttempt }> {
  const mimeType = input.result.mimeType ?? "image/jpeg";
  const path = join(
    input.outputDir,
    `draft-attempt-${String(input.attempt).padStart(2, "0")}${extensionForMime(mimeType)}`,
  );

  let bytes: Buffer;
  if (input.result.dataBase64) {
    bytes = Buffer.from(input.result.dataBase64, "base64");
    if (bytes.length < 1_000) {
      throw new Error(`Generated image payload is unexpectedly small (${bytes.length} bytes).`);
    }
    await writeFile(path, bytes);
  } else if (input.result.imageUrl) {
    bytes = await downloadImage(input.result.imageUrl, path, input.fetchFn);
  } else {
    throw new Error("Image provider returned neither inline image data nor an image URL.");
  }

  return {
    path,
    bytes,
    mimeType,
    summary: {
      attempt: input.attempt,
      source: "generated",
      path,
      provider: input.result.provider,
      model: input.result.model,
      ...(input.result.costUsd !== undefined ? { costUsd: input.result.costUsd } : {}),
      promptMode: input.promptPlan.mode,
      ...(input.promptPlan.structuredBrief
        ? { structuredBrief: input.promptPlan.structuredBrief }
        : {}),
      ...(input.promptPlan.foodComposition
        ? { foodComposition: input.promptPlan.foodComposition }
        : {}),
      ...(input.promptPlan.briefGovernance
        ? { briefGovernance: input.promptPlan.briefGovernance }
        : {}),
      ...(input.qualityTier ? { qualityTier: input.qualityTier } : {}),
    },
  };
}

async function localImage(path: string): Promise<{
  path: string;
  bytes: Buffer;
  mimeType: string;
  summary: ProductionImageAttempt;
}> {
  const resolved = resolve(path);
  const bytes = await readFile(resolved);
  if (bytes.length < 1_000) {
    throw new Error(`Local base image is unexpectedly small (${bytes.length} bytes).`);
  }
  return {
    path: resolved,
    bytes,
    mimeType: mimeFromPath(resolved),
    summary: {
      attempt: 1,
      source: "local",
      path: resolved,
      provider: "local",
      model: "existing-image",
    },
  };
}

function buildVisualQaRequest(input: {
  context: PlannedVisualQaContext;
  entry: MarketingCalendarEntry;
  layout: AtthasLayoutDefinition;
  bytes: Buffer;
  mimeType: string;
  structuredBrief?: StructuredImageBrief;
  foodComposition?: DeterministicFoodComposition;
}): VisualQaRequest {
  const compositionRequirements = [
    ...input.layout.imageCompositionRequirements,
    ...(input.context.compositionRequirements ?? []),
  ];
  const compositionExpectation = compositionExpectationFromBrief(input.structuredBrief);
  const foodTruthMustInclude =
    input.foodComposition?.templateId === "WRAP_ROLL"
      ? ["one coherent wrap-style food subject; do not convert verified ingredients into separately served side dishes"]
      : [];
  const foodTruthMustNotInclude = [
    ...(input.foodComposition?.templateId === "WRAP_ROLL"
      ? [
          "separate side salad, separate sauce or dip ramekin, extra side dish, or duplicate serving component outside the wrap unless explicitly verified",
        ]
      : []),
    ...((input.foodComposition?.confirmedCookingMethods.length ?? 0) === 0 && input.foodComposition
      ? [
          "visible preparation cues that imply an unverified cooking method, including grill marks, griddle marks, toast marks, sear marks or deliberate charring beyond neutral browning",
        ]
      : []),
  ];

  return {
    ...input.context,
    brandId: input.entry.brandId,
    ...(input.entry.branchScope !== "BRAND_WIDE"
      ? { branchId: input.entry.branchScope }
      : {}),
    imageBase64: input.bytes.toString("base64"),
    mimeType: input.mimeType,
    mustInclude: [...new Set([...(input.context.mustInclude ?? []), ...foodTruthMustInclude])],
    mustNotInclude: [...new Set([...(input.context.mustNotInclude ?? []), ...foodTruthMustNotInclude])],
    compositionRequirements: [...new Set(compositionRequirements)],
    ...(input.foodComposition
      ? {
          foodTemplateId: input.foodComposition.templateId,
          verifiedCookingMethods: [...input.foodComposition.confirmedCookingMethods],
        }
      : {}),
    ...(compositionExpectation ? { compositionExpectation } : {}),
  };
}

async function persistOrchestration(
  outputDir: string,
  result: ProducePlannedCampaignResult,
): Promise<void> {
  const serializable = {
    ...result,
    campaign:
      "campaign" in result
        ? {
            status: result.campaign.status,
            ...(result.campaign.status === "GENERATED"
              ? {
                  provider: result.campaign.provider,
                  production: result.campaign.production,
                  ...( "creativeDirector" in result.campaign
                    ? { creativeDirector: result.campaign.creativeDirector }
                    : {}),
                }
              : {}),
          }
        : undefined,
  };
  await writeFile(
    join(outputDir, "production-orchestration.json"),
    JSON.stringify(serializable, null, 2),
    "utf8",
  );
}

export async function producePlannedCampaign(
  request: ProducePlannedCampaignRequest,
): Promise<ProducePlannedCampaignResult> {
  assertEntryShape(request.entry);
  const outputDir = resolve(request.outputDir);
  await mkdir(outputDir, { recursive: true });
  const mode = request.mode ?? "FINAL";
  const featureFlags = resolveCreativeFeatureFlags(process.env, request.featureFlags);
  if (featureFlags.useFoodComposer && !featureFlags.useStructuredBrief) {
    throw new Error(
      "Feature flag configuration violation: useFoodComposer requires useStructuredBrief.",
    );
  }
  const base: ProductionTraceBase = {
    campaignId: request.campaignId,
    slotId: request.entry.slotId,
    mode,
    imageAttempts: [],
  };

  if (
    request.entry.truthReadiness !== "READY_WITH_CURRENT_TRUTH" ||
    request.entry.missingTruth.length > 0
  ) {
    const result: ProducePlannedCampaignResult = {
      ...base,
      status: "BLOCKED_PLANNED_TRUTH",
      missingTruth: [...request.entry.missingTruth],
    };
    await persistOrchestration(outputDir, result);
    return result;
  }

  const generationRequest = buildGenerationRequest(request);
  const generated = await generateCampaign(generationRequest, request.providers.generation);

  if (generated.status !== "GENERATED") {
    const result: ProducePlannedCampaignResult = {
      ...base,
      status: "BLOCKED_FACT_GATE",
      campaign: generated,
    };
    await persistOrchestration(outputDir, result);
    return result;
  }

  let foodComposition: DeterministicFoodComposition | undefined;
  if (featureFlags.useFoodComposer && !request.baseImagePath) {
    const foodComposer = composeDeterministicFoodSubjectFromFacts(generated.preflight.facts);
    if (foodComposer.status === "BLOCKED_MISSING_VERIFIED_INGREDIENTS") {
      const result: ProducePlannedCampaignResult = {
        ...base,
        status: "BLOCKED_FOOD_COMPOSER_TRUTH",
        campaign: generated,
        productName: foodComposer.productName,
        missingTruth: [...foodComposer.missingFactKeys],
      };
      await persistOrchestration(outputDir, result);
      return result;
    }
    if (foodComposer.status === "COMPOSED") {
      foodComposition = foodComposer.composition;
    }
  }

  const directed = await directGeneratedCampaign(
    {
      request: generationRequest,
      campaign: generated,
      ...(request.maxDirectorRepairAttempts !== undefined
        ? { maxDirectorRepairAttempts: request.maxDirectorRepairAttempts }
        : {}),
      ...(request.maxFinalizerRepairAttempts !== undefined
        ? { maxFinalizerRepairAttempts: request.maxFinalizerRepairAttempts }
        : {}),
    },
    {
      director: request.providers.director,
      finalizer: request.providers.finalizer,
    },
  );

  const layout = selectAtthasLayout({
    brandId: request.entry.brandId,
    creative: directed.creative,
    format: directed.production.format,
    campaignType: request.entry.campaignType,
    ...(request.preferredLayoutId ? { preferredLayoutId: request.preferredLayoutId } : {}),
  });
  base.layout = layout;

  if (!request.baseImagePath && !request.providers.image && !request.providers.imageTiers) {
    const result: ProducePlannedCampaignResult = {
      ...base,
      status: "BLOCKED_MEDIA_INPUT",
      campaign: directed,
    };
    await persistOrchestration(outputDir, result);
    return result;
  }

  if (mode === "FINAL" && (!request.providers.visualQa || !request.visualQaContext)) {
    const result: ProducePlannedCampaignResult = {
      ...base,
      status: "BLOCKED_VISUAL_QA_REQUIRED",
      campaign: directed,
    };
    await persistOrchestration(outputDir, result);
    return result;
  }

  const fetchFn = request.fetchFn ?? fetch;
  const maxRegenerations = normalizeImageRegenerations(request.maxImageRegenerations);
  const branchId =
    request.entry.branchScope !== "BRAND_WIDE" ? request.entry.branchScope : undefined;
  const initialPromptCandidate = !request.baseImagePath
    ? buildPlannedImagePrompt({
        campaignId: request.campaignId,
        brandId: request.entry.brandId,
        ...(branchId ? { branchId } : {}),
        creative: directed.creative,
        format: directed.production.format,
        layout,
        useStructuredBrief: featureFlags.useStructuredBrief,
        verifiedFacts: directed.preflight.facts,
        ...(foodComposition ? { foodComposition } : {}),
      })
    : undefined;
  const initialPromptGovernance = initialPromptCandidate
    ? await governPlannedImagePrompt({
        plan: initialPromptCandidate,
        campaign: directed,
        repairProvider: request.providers.finalizer,
        ...(request.claimGovernance ? { claimGovernance: request.claimGovernance } : {}),
        ...(request.maxStructuredBriefRepairAttempts !== undefined
          ? { maxRepairAttempts: request.maxStructuredBriefRepairAttempts }
          : {}),
      })
    : undefined;
  if (initialPromptGovernance?.status === "HUMAN_REVIEW") {
    const result: ProducePlannedCampaignResult = {
      ...base,
      status: "HUMAN_REVIEW_STRUCTURED_BRIEF_REQUIRED",
      campaign: directed,
      structuredBrief: initialPromptGovernance.brief,
      issues: initialPromptGovernance.issues,
      repairs: initialPromptGovernance.repairs,
    };
    await persistOrchestration(outputDir, result);
    return result;
  }
  const initialPromptPlan =
    initialPromptGovernance?.status === "READY" ? initialPromptGovernance.plan : undefined;
  const tieredImageProviders = !request.baseImagePath ? request.providers.imageTiers : undefined;
  const initialQualityTier: ImageQualityTier | undefined = tieredImageProviders
    ? "FLASH_LITE"
    : undefined;
  const initialImageProvider = initialQualityTier
    ? tieredImageProviders![initialQualityTier]
    : request.providers.image;
  let current = request.baseImagePath
    ? await localImage(request.baseImagePath)
    : await persistGeneratedImage({
        result: await initialImageProvider!.generate({
          prompt: initialPromptPlan!.prompt,
          aspectRatio: directed.production.format.aspectRatio,
          resolution: process.env.GEMINI_IMAGE_RESOLUTION?.trim() || "1K",
          outputFormat: "jpeg",
        }),
        outputDir,
        attempt: 1,
        fetchFn,
        promptPlan: initialPromptPlan!,
        ...(initialQualityTier ? { qualityTier: initialQualityTier } : {}),
      });
  base.imageAttempts.push(current.summary);

  const posterProducer = request.posterProducer ?? producePoster;

  if (mode === "DRAFT") {
    const poster = await posterProducer({
      campaignId: request.campaignId,
      campaign: directed,
      outputDir,
      brandId: request.entry.brandId,
      layoutId: layout.id,
      baseImagePath: current.path,
      ...(featureFlags.useNewRenderer ? { rendererMode: "M3_V2" as const } : {}),
      ...(request.chromePath ? { chromePath: request.chromePath } : {}),
      ...(request.fetchFn ? { fetchFn: request.fetchFn } : {}),
    });
    const result: ProducePlannedCampaignResult = {
      ...base,
      status: "DRAFT_RENDERED",
      campaign: directed,
      poster,
    };
    await persistOrchestration(outputDir, result);
    return result;
  }

  const qaProvider = request.providers.visualQa!;
  const qaContext = request.visualQaContext!;
  let regenerations = 0;
  let lastQa: VisualQaResult | undefined;

  while (true) {
    const qa = await qaProvider.review(
      buildVisualQaRequest({
        context: qaContext,
        entry: request.entry,
        layout,
        bytes: current.bytes,
        mimeType: current.mimeType,
        ...(current.summary.structuredBrief
          ? { structuredBrief: current.summary.structuredBrief }
          : {}),
        ...(current.summary.foodComposition
          ? { foodComposition: current.summary.foodComposition }
          : {}),
      }),
    );
    lastQa = qa;
    const lastAttempt = base.imageAttempts.at(-1);
    if (lastAttempt) lastAttempt.visualQa = qa;

    const qualityTier = lastAttempt?.qualityTier;
    if (qualityTier && tieredImageProviders) {
      const qualityGate = evaluateImageQualityGate({ tier: qualityTier, qa });
      if (lastAttempt) lastAttempt.qualityGate = qualityGate;

      if (qualityGate.action === "PASS") break;

      if (qualityGate.action === "BLOCK") {
        const result: ProducePlannedCampaignResult = {
          ...base,
          status: "BLOCKED_VISUAL_QA",
          campaign: directed,
          visualQa: qa,
          draftImagePath: current.path,
        };
        await persistOrchestration(outputDir, result);
        return result;
      }

      if (qualityGate.action === "HUMAN_REVIEW") {
        const result: ProducePlannedCampaignResult = {
          ...base,
          status: "HUMAN_REVIEW_REQUIRED",
          campaign: directed,
          visualQa: qa,
          draftImagePath: current.path,
        };
        await persistOrchestration(outputDir, result);
        return result;
      }

      const nextTier = qualityGate.nextTier;
      if (!nextTier) {
        throw new Error("Image quality escalation returned ESCALATE without a next tier.");
      }
      const escalationPromptCandidate = buildPlannedImagePrompt({
        campaignId: request.campaignId,
        brandId: request.entry.brandId,
        ...(branchId ? { branchId } : {}),
        creative: directed.creative,
        format: directed.production.format,
        layout,
        useStructuredBrief: featureFlags.useStructuredBrief,
        verifiedFacts: directed.preflight.facts,
        ...(foodComposition ? { foodComposition } : {}),
        previousQa: qa,
      });
      const escalationPromptGovernance = await governPlannedImagePrompt({
        plan: escalationPromptCandidate,
        campaign: directed,
        repairProvider: request.providers.finalizer,
        ...(request.claimGovernance ? { claimGovernance: request.claimGovernance } : {}),
        ...(request.maxStructuredBriefRepairAttempts !== undefined
          ? { maxRepairAttempts: request.maxStructuredBriefRepairAttempts }
          : {}),
      });
      if (escalationPromptGovernance.status === "HUMAN_REVIEW") {
        const result: ProducePlannedCampaignResult = {
          ...base,
          status: "HUMAN_REVIEW_STRUCTURED_BRIEF_REQUIRED",
          campaign: directed,
          structuredBrief: escalationPromptGovernance.brief,
          issues: escalationPromptGovernance.issues,
          repairs: escalationPromptGovernance.repairs,
          draftImagePath: current.path,
        };
        await persistOrchestration(outputDir, result);
        return result;
      }
      const escalationPromptPlan = escalationPromptGovernance.plan;
      current = await persistGeneratedImage({
        result: await tieredImageProviders[nextTier].generate({
          prompt: escalationPromptPlan.prompt,
          aspectRatio: directed.production.format.aspectRatio,
          resolution: process.env.GEMINI_IMAGE_RESOLUTION?.trim() || "1K",
          outputFormat: "jpeg",
        }),
        outputDir,
        attempt: base.imageAttempts.length + 1,
        fetchFn,
        promptPlan: escalationPromptPlan,
        qualityTier: nextTier,
      });
      base.imageAttempts.push(current.summary);
      continue;
    }

    if (qa.decision === "PASS") break;

    if (qa.decision === "HUMAN_REVIEW") {
      const result: ProducePlannedCampaignResult = {
        ...base,
        status: "HUMAN_REVIEW_REQUIRED",
        campaign: directed,
        visualQa: qa,
        draftImagePath: current.path,
      };
      await persistOrchestration(outputDir, result);
      return result;
    }

    if (qa.decision === "BLOCK") {
      const result: ProducePlannedCampaignResult = {
        ...base,
        status: "BLOCKED_VISUAL_QA",
        campaign: directed,
        visualQa: qa,
        draftImagePath: current.path,
      };
      await persistOrchestration(outputDir, result);
      return result;
    }

    if (!request.providers.image) {
      const result: ProducePlannedCampaignResult = {
        ...base,
        status: "REGENERATION_UNAVAILABLE",
        campaign: directed,
        visualQa: qa,
        draftImagePath: current.path,
      };
      await persistOrchestration(outputDir, result);
      return result;
    }

    if (regenerations >= maxRegenerations) {
      const result: ProducePlannedCampaignResult = {
        ...base,
        status: "REGENERATION_EXHAUSTED",
        campaign: directed,
        visualQa: qa,
        draftImagePath: current.path,
      };
      await persistOrchestration(outputDir, result);
      return result;
    }

    regenerations += 1;
    const regenerationPromptCandidate = buildPlannedImagePrompt({
      campaignId: request.campaignId,
      brandId: request.entry.brandId,
      ...(branchId ? { branchId } : {}),
      creative: directed.creative,
      format: directed.production.format,
      layout,
      useStructuredBrief: featureFlags.useStructuredBrief,
      verifiedFacts: directed.preflight.facts,
      ...(foodComposition ? { foodComposition } : {}),
      previousQa: qa,
    });
    const regenerationPromptGovernance = await governPlannedImagePrompt({
      plan: regenerationPromptCandidate,
      campaign: directed,
      repairProvider: request.providers.finalizer,
      ...(request.claimGovernance ? { claimGovernance: request.claimGovernance } : {}),
      ...(request.maxStructuredBriefRepairAttempts !== undefined
        ? { maxRepairAttempts: request.maxStructuredBriefRepairAttempts }
        : {}),
    });
    if (regenerationPromptGovernance.status === "HUMAN_REVIEW") {
      const result: ProducePlannedCampaignResult = {
        ...base,
        status: "HUMAN_REVIEW_STRUCTURED_BRIEF_REQUIRED",
        campaign: directed,
        structuredBrief: regenerationPromptGovernance.brief,
        issues: regenerationPromptGovernance.issues,
        repairs: regenerationPromptGovernance.repairs,
        draftImagePath: current.path,
      };
      await persistOrchestration(outputDir, result);
      return result;
    }
    const regenerationPromptPlan = regenerationPromptGovernance.plan;
    current = await persistGeneratedImage({
      result: await request.providers.image.generate({
        prompt: regenerationPromptPlan.prompt,
        aspectRatio: directed.production.format.aspectRatio,
        resolution: process.env.GEMINI_IMAGE_RESOLUTION?.trim() || "1K",
        outputFormat: "jpeg",
      }),
      outputDir,
      attempt: base.imageAttempts.length + 1,
      fetchFn,
      promptPlan: regenerationPromptPlan,
    });
    base.imageAttempts.push(current.summary);
  }

  const poster = await posterProducer({
    campaignId: request.campaignId,
    campaign: directed,
    outputDir,
    brandId: request.entry.brandId,
    layoutId: layout.id,
    baseImagePath: current.path,
    ...(featureFlags.useNewRenderer ? { rendererMode: "M3_V2" as const } : {}),
    ...(featureFlags.useNewRenderer && lastQa?.compositionEvidence
      ? { copyZones: lastQa.compositionEvidence.copyZones }
      : {}),
    ...(request.chromePath ? { chromePath: request.chromePath } : {}),
    ...(request.fetchFn ? { fetchFn: request.fetchFn } : {}),
  });
  const result: ProducePlannedCampaignResult = {
    ...base,
    status: "FINAL_RENDERED",
    campaign: directed,
    poster,
    ...(lastQa ? { visualQa: lastQa } : {}),
  };
  await persistOrchestration(outputDir, result);
  return result;
}
