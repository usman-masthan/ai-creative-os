import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import type { GenerateCampaignResult } from "./generateCampaign.js";
import type { ImageDraftProvider, ImageDraftResult } from "../imageProviders/types.js";
import { buildPosterHtml } from "../posterTemplate.js";
import { assertPosterHtmlContract, qaPosterPng, type PosterQaResult } from "../posterQa.js";
import { renderPosterPng } from "../posterRenderer.js";

export type GeneratedCampaign = Extract<GenerateCampaignResult, { status: "GENERATED" }>;

export interface ProducePosterRequest {
  campaignId: string;
  campaign: GeneratedCampaign;
  outputDir: string;
  imageProvider?: ImageDraftProvider;
  baseImagePath?: string;
  chromePath?: string;
  fetchFn?: typeof fetch;
}

export interface ProducePosterResult {
  status: "POSTER_RENDERED";
  outputDir: string;
  baseImagePath: string;
  htmlPath: string;
  pngPath: string;
  imageGeneration?: ImageDraftResult;
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

async function imageToDataUri(path: string): Promise<string> {
  const bytes = await readFile(path);
  return `data:${mimeFromPath(path)};base64,${bytes.toString("base64")}`;
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
      outputFormat: "jpeg",
    });
    baseImagePath = join(outputDir, "base-image.jpg");
    await downloadImage(imageGeneration.imageUrl, baseImagePath, request.fetchFn ?? fetch);
  }

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
  const manifest = {
    campaignId: request.campaignId,
    renderedAt: new Date().toISOString(),
    provider: request.campaign.provider,
    generation: request.campaign.generation,
    production: request.campaign.production,
    overlay: request.campaign.creative.overlaySpec,
    imageGeneration: imageGeneration ?? { provider: "local", model: "existing-image" },
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
    ...(imageGeneration ? { imageGeneration } : {}),
    qa,
  };
}
