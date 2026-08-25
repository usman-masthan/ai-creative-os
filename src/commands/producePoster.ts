import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import type { GenerateCampaignResult } from "./generateCampaign.js";
import type { ImageDraftProvider, ImageDraftResult } from "../imageProviders/types.js";
import { buildPosterHtml } from "../posterTemplate.js";
import { assertPosterHtmlContract, qaPosterPng, type PosterQaResult } from "../posterQa.js";
import { renderPosterPng } from "../posterRenderer.js";
import type {
  VisualQaProvider,
  VisualQaRequest,
  VisualQaResult,
} from "../visualQa/types.js";

export type GeneratedCampaign = Extract<GenerateCampaignResult, { status: "GENERATED" }>;
export type ImageGenerationSummary = Omit<ImageDraftResult, "dataBase64"> & {
  hasInlineData?: boolean;
};

export interface PosterVisualQaConfig {
  provider: VisualQaProvider;
  request: Omit<VisualQaRequest, "imageBase64" | "mimeType">;
}

export interface ProducePosterRequest {
  campaignId: string;
  campaign: GeneratedCampaign;
  outputDir: string;
  imageProvider?: ImageDraftProvider;
  baseImagePath?: string;
  visualQa?: PosterVisualQaConfig;
  chromePath?: string;
  fetchFn?: typeof fetch;
}

export interface ProducePosterResult {
  status: "POSTER_RENDERED";
  outputDir: string;
  baseImagePath: string;
  htmlPath: string;
  pngPath: string;
  imageGeneration?: ImageGenerationSummary;
  visualQa?: VisualQaResult;
  qa: PosterQaResult;
}

function mimeFromPath(path: string): string {
  switch (extname(path).toLocaleLowerCase()) {
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

function summarizeImageGeneration(result: ImageDraftResult): ImageGenerationSummary {
  const { dataBase64, ...summary } = result;
  return {
    ...summary,
    ...(dataBase64 ? { hasInlineData: true } : {}),
  };
}

function buildDraftPrompt(campaign: GeneratedCampaign): string {
  const image = campaign.creative.imageGeneration;
  const constraints = image.visualConstraints.join("; ");
  return [
    image.basePrompt,
    constraints ? `Visual constraints: ${constraints}.` : "",
    image.negativePrompt ? `Avoid: ${image.negativePrompt}.` : "",
    "Return an image only. Do not render promotional copy, numbers, prices, logos, badges, labels or watermarks.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function downloadImage(url: string, destination: string, fetchFn: typeof fetch): Promise<void> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error(`Image download returned unexpected content type: ${contentType}.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000) {
    throw new Error(`Image download returned unexpectedly small payload (${bytes.length} bytes).`);
  }
  await writeFile(destination, bytes);
}

async function persistGeneratedImage(
  imageGeneration: ImageDraftResult,
  outputDir: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const destination = join(outputDir, `base-image${extensionForMime(imageGeneration.mimeType)}`);

  if (imageGeneration.dataBase64) {
    const bytes = Buffer.from(imageGeneration.dataBase64, "base64");
    if (bytes.length < 1_000) {
      throw new Error(`Generated image payload is unexpectedly small (${bytes.length} bytes).`);
    }
    await writeFile(destination, bytes);
    return destination;
  }

  if (imageGeneration.imageUrl) {
    await downloadImage(imageGeneration.imageUrl, destination, fetchFn);
    return destination;
  }

  throw new Error("Image provider returned neither inline image data nor an image URL.");
}

async function imageToDataUri(path: string): Promise<string> {
  const bytes = await readFile(path);
  return `data:${mimeFromPath(path)};base64,${bytes.toString("base64")}`;
}

async function runVisualQa(
  config: PosterVisualQaConfig,
  baseImagePath: string,
  outputDir: string,
): Promise<VisualQaResult> {
  const bytes = await readFile(baseImagePath);
  const result = await config.provider.review({
    ...config.request,
    imageBase64: bytes.toString("base64"),
    mimeType: mimeFromPath(baseImagePath),
  });

  await writeFile(join(outputDir, "visual-qa.json"), JSON.stringify(result, null, 2), "utf8");

  if (result.decision !== "PASS") {
    throw new Error(
      `Poster production blocked by visual QA (${result.decision}): ${result.issues.join("; ") || "review required"}`,
    );
  }

  return result;
}

export async function producePoster(request: ProducePosterRequest): Promise<ProducePosterResult> {
  if (!request.baseImagePath && !request.imageProvider) {
    throw new Error("Poster production requires either baseImagePath or an imageProvider.");
  }

  const outputDir = resolve(request.outputDir);
  await mkdir(outputDir, { recursive: true });

  let baseImagePath: string;
  let imageGeneration: ImageDraftResult | undefined;

  if (request.baseImagePath) {
    baseImagePath = resolve(request.baseImagePath);
    await readFile(baseImagePath);
  } else {
    const imageProvider = request.imageProvider!;
    imageGeneration = await imageProvider.generate({
      prompt: buildDraftPrompt(request.campaign),
      aspectRatio: request.campaign.production.format.aspectRatio,
      resolution: process.env.GEMINI_IMAGE_RESOLUTION?.trim() || "1K",
      outputFormat: "jpeg",
    });
    baseImagePath = await persistGeneratedImage(
      imageGeneration,
      outputDir,
      request.fetchFn ?? fetch,
    );
  }

  const visualQa = request.visualQa
    ? await runVisualQa(request.visualQa, baseImagePath, outputDir)
    : undefined;

  const baseImageDataUri = await imageToDataUri(baseImagePath);
  const html = buildPosterHtml({
    creative: request.campaign.creative,
    format: request.campaign.production.format,
    baseImageDataUri,
  });
  assertPosterHtmlContract(html, request.campaign.creative, request.campaign.production.format);

  const htmlPath = join(outputDir, "poster.html");
  const pngPath = join(outputDir, "poster.png");
  await writeFile(htmlPath, html, "utf8");

  await renderPosterPng({
    htmlPath,
    outputPath: pngPath,
    width: request.campaign.production.format.width,
    height: request.campaign.production.format.height,
    ...(request.chromePath ? { chromePath: request.chromePath } : {}),
  });

  const qa = await qaPosterPng(pngPath, request.campaign.production.format);
  const imageGenerationSummary = imageGeneration
    ? summarizeImageGeneration(imageGeneration)
    : undefined;
  const manifest = {
    campaignId: request.campaignId,
    renderedAt: new Date().toISOString(),
    provider: request.campaign.provider,
    generation: request.campaign.generation,
    production: request.campaign.production,
    overlay: request.campaign.creative.overlaySpec,
    imageGeneration: imageGenerationSummary ?? { provider: "local", model: "existing-image" },
    ...(visualQa ? { visualQa } : {}),
    files: {
      baseImagePath,
      htmlPath,
      pngPath,
    },
    qa,
  };
  await writeFile(join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return {
    status: "POSTER_RENDERED",
    outputDir,
    baseImagePath,
    htmlPath,
    pngPath,
    ...(imageGenerationSummary ? { imageGeneration: imageGenerationSummary } : {}),
    ...(visualQa ? { visualQa } : {}),
    qa,
  };
}
