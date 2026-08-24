import { readFile, stat } from "node:fs/promises";

import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "./creativeTypes.js";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export interface PosterQaResult {
  pass: boolean;
  width: number;
  height: number;
  bytes: number;
  checks: string[];
}

export function assertPosterHtmlContract(
  html: string,
  creative: CampaignCreativeOutput,
  format: CampaignProductionFormat,
): void {
  const required = [
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
    creative.overlaySpec.price?.display ?? "",
    `data-width=\"${format.width}\"`,
    `data-height=\"${format.height}\"`,
  ].filter(Boolean);

  for (const value of required) {
    if (!html.includes(value.replaceAll("&", "&amp;"))) {
      throw new Error(`Poster QA failed: deterministic HTML is missing required value ${value}.`);
    }
  }

  if (creative.overlaySpec.logoUsage === "OMIT" && /<img[^>]+logo/i.test(html)) {
    throw new Error("Poster QA failed: logo markup exists while overlaySpec.logoUsage is OMIT.");
  }
}

export function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(pngSignature)) {
    throw new Error("Poster QA failed: output is not a valid PNG header.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

export async function qaPosterPng(
  outputPath: string,
  format: CampaignProductionFormat,
): Promise<PosterQaResult> {
  const [buffer, metadata] = await Promise.all([readFile(outputPath), stat(outputPath)]);
  const dimensions = readPngDimensions(buffer);
  const checks: string[] = [];

  if (dimensions.width !== format.width || dimensions.height !== format.height) {
    throw new Error(
      `Poster QA failed: expected ${format.width}x${format.height}, received ${dimensions.width}x${dimensions.height}.`,
    );
  }
  checks.push("dimensions_match_campaign_format");

  if (metadata.size < 10_000) {
    throw new Error(`Poster QA failed: PNG is unexpectedly small (${metadata.size} bytes).`);
  }
  checks.push("png_has_nontrivial_file_size");

  return {
    pass: true,
    width: dimensions.width,
    height: dimensions.height,
    bytes: metadata.size,
    checks,
  };
}
