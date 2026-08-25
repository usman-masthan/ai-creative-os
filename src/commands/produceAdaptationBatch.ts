import { mkdir, resolve } from "node:fs/promises";
import { join } from "node:path";

import type { FinalArtQaProvider } from "../finalArtQa/types.js";
import type { ImageDraftProvider } from "../imageProviders/types.js";
import type {
  AtthasAdaptationTargetId,
  AtthasMultiFormatAdaptationBundle,
} from "../multiFormatTypes.js";
import type { VisualQaProvider, VisualQaRequest } from "../visualQa/types.js";
import type { DirectedCampaign } from "./directCampaign.js";
import { producePoster, type ProducePosterResult } from "./producePoster.js";

export type AdaptationBatchMode = "DRAFT" | "FINAL";

export type BatchVisualQaContext = Omit<
  VisualQaRequest,
  "imageBase64" | "mimeType" | "brandId" | "compositionRequirements"
> & {
  compositionRequirements?: string[];
};

export interface ProduceAdaptationBatchRequest {
  sourceCampaign: DirectedCampaign;
  bundle: AtthasMultiFormatAdaptationBundle;
  outputDir: string;
  mode?: AdaptationBatchMode;
  imageProvider?: ImageDraftProvider;
  baseImagePath?: string;
  baseImagePaths?: Partial<Record<AtthasAdaptationTargetId, string>>;
  visualQaProvider?: VisualQaProvider;
  visualQaContext?: BatchVisualQaContext;
  finalArtQaProvider?: FinalArtQaProvider;
  chromePath?: string;
}

export interface AdaptationBatchAsset {
  targetId: AtthasAdaptationTargetId;
  status: "DRAFT_RENDERED" | "FINAL_RENDERED";
  poster: ProducePosterResult;
}

export interface ProduceAdaptationBatchResult {
  status: "BATCH_RENDERED";
  adaptationSetId: string;
  campaignId: string;
  mode: AdaptationBatchMode;
  assets: AdaptationBatchAsset[];
}

export async function produceAdaptationBatch(
  request: ProduceAdaptationBatchRequest,
): Promise<ProduceAdaptationBatchResult> {
  const mode = request.mode ?? "FINAL";
  if (request.bundle.campaignId !== request.sourceCampaign.preflight.campaignId) {
    throw new Error("Adaptation bundle campaign ID does not match source campaign.");
  }
  if (request.bundle.sourceConceptId !== request.sourceCampaign.creative.recommendedConceptId) {
    throw new Error("Adaptation bundle selected concept does not match source campaign.");
  }
  if (!request.imageProvider && !request.baseImagePath && !request.baseImagePaths) {
    throw new Error("Batch rendering requires an image provider or base image path.");
  }
  if (mode === "FINAL") {
    if (!request.visualQaProvider || !request.visualQaContext) {
      throw new Error("FINAL batch rendering requires visual QA provider and context.");
    }
    if (!request.finalArtQaProvider) {
      throw new Error("FINAL batch rendering requires final-art QA provider.");
    }
  }

  const outputDir = resolve(request.outputDir);
  await mkdir(outputDir, { recursive: true });
  const assets: AdaptationBatchAsset[] = [];

  for (const variant of request.bundle.variants) {
    const variantCampaign: DirectedCampaign = {
      ...request.sourceCampaign,
      creative: variant.creative,
      production: {
        ...request.sourceCampaign.production,
        format: variant.target.format,
      },
    };
    const targetDir = join(outputDir, variant.target.id.toLowerCase());
    const targetBaseImage = request.baseImagePaths?.[variant.target.id] ?? request.baseImagePath;
    const visualQa =
      mode === "FINAL"
        ? {
            provider: request.visualQaProvider!,
            request: {
              ...request.visualQaContext!,
              brandId: request.bundle.brandId,
              compositionRequirements: [
                ...variant.layout.imageCompositionRequirements,
                ...(request.visualQaContext?.compositionRequirements ?? []),
              ],
            },
          }
        : undefined;

    const poster = await producePoster({
      campaignId: `${request.bundle.campaignId}-${variant.target.id}`,
      campaign: variantCampaign,
      outputDir: targetDir,
      brandId: request.bundle.brandId,
      layoutId: variant.layout.id,
      ...(targetBaseImage
        ? { baseImagePath: targetBaseImage }
        : { imageProvider: request.imageProvider! }),
      ...(visualQa ? { visualQa } : {}),
      ...(mode === "FINAL" ? { finalArtQa: { provider: request.finalArtQaProvider! } } : {}),
      ...(request.chromePath ? { chromePath: request.chromePath } : {}),
    });

    assets.push({
      targetId: variant.target.id,
      status: mode === "FINAL" ? "FINAL_RENDERED" : "DRAFT_RENDERED",
      poster,
    });
  }

  return {
    status: "BATCH_RENDERED",
    adaptationSetId: request.bundle.adaptationSetId,
    campaignId: request.bundle.campaignId,
    mode,
    assets,
  };
}
