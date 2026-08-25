import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import type { BrandGovernance } from "../brandGovernance.js";
import type { ClaimGovernance } from "../claimGovernance.js";
import type { ImageDraftProvider, ImageDraftResult } from "../imageProviders/types.js";
import {
  selectAtthasLayout,
  type AtthasLayoutDefinition,
  type AtthasLayoutId,
} from "../layouts/atthas.js";
import type { MarketingCalendarEntry } from "../marketingPlannerTypes.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import type { TruthRecord, TruthRequirement } from "../types.js";
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

export interface PlannedTruthRequirementScope {
  productId?: string;
  salesChannel?: string;
}

export interface PlannedCampaignProductionProviders extends CreativeDirectorProviders {
  generation: CampaignGenerationProvider;
  image?: ImageDraftProvider;
  visualQa?: VisualQaProvider;
}

export type PlannedVisualQaContext = Omit<
  VisualQaRequest,
  "imageBase64" | "mimeType" | "brandId" | "branchId" | "compositionRequirements"
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
  visualQaContext?: PlannedVisualQaContext;
  preferredLayoutId?: AtthasLayoutId;
  maxCampaignRepairAttempts?: number;
  maxDirectorRepairAttempts?: number;
  maxFinalizerRepairAttempts?: number;
  maxImageRegenerations?: number;
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
  if (entry.truthReadiness !== "READY_WITH_CURRENT_TRUTH" || entry.missingTruth.length > 0) {
    return;
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
    brandContext: request.brandContext,
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

function buildImagePrompt(
  campaign: DirectedCampaign,
  layout: AtthasLayoutDefinition,
  previousQa?: VisualQaResult,
): string {
  const image = campaign.creative.imageGeneration;
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
}): VisualQaRequest {
  const compositionRequirements = [
    ...input.layout.imageCompositionRequirements,
    ...(input.context.compositionRequirements ?? []),
  ];

  return {
    ...input.context,
    brandId: input.entry.brandId,
    ...(input.entry.branchScope !== "BRAND_WIDE"
      ? { branchId: input.entry.branchScope }
      : {}),
    imageBase64: input.bytes.toString("base64"),
    mimeType: input.mimeType,
    compositionRequirements: [...new Set(compositionRequirements)],
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
    ...(request.preferredLayoutId ? { preferredLayoutId: request.preferredLayoutId } : {}),
  });
  base.layout = layout;

  if (!request.baseImagePath && !request.providers.image) {
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
  let current = request.baseImagePath
    ? await localImage(request.baseImagePath)
    : await persistGeneratedImage({
        result: await request.providers.image!.generate({
          prompt: buildImagePrompt(directed, layout),
          aspectRatio: directed.production.format.aspectRatio,
          resolution: process.env.GEMINI_IMAGE_RESOLUTION?.trim() || "1K",
          outputFormat: "jpeg",
        }),
        outputDir,
        attempt: 1,
        fetchFn,
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
      }),
    );
    lastQa = qa;
    const lastAttempt = base.imageAttempts.at(-1);
    if (lastAttempt) lastAttempt.visualQa = qa;

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
    current = await persistGeneratedImage({
      result: await request.providers.image.generate({
        prompt: buildImagePrompt(directed, layout, qa),
        aspectRatio: directed.production.format.aspectRatio,
        resolution: process.env.GEMINI_IMAGE_RESOLUTION?.trim() || "1K",
        outputFormat: "jpeg",
      }),
      outputDir,
      attempt: base.imageAttempts.length + 1,
      fetchFn,
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
