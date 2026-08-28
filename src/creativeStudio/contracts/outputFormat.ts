import type { CampaignProductionFormat } from "../../creativeTypes.js";
import type { CreativeBriefFormatPreset } from "./creativeBrief.js";

export interface CreativeOutputFormatPreset {
  preset: Exclude<CreativeBriefFormatPreset, "custom">;
  width: number;
  height: number;
  aspectRatio: string;
  channel: string;
  assetType: string;
  label: string;
}

export const CREATIVE_OUTPUT_FORMAT_PRESETS: Readonly<Record<
  Exclude<CreativeBriefFormatPreset, "custom">,
  CreativeOutputFormatPreset
>> = Object.freeze({
  "instagram-square": {
    preset: "instagram-square",
    width: 1080,
    height: 1080,
    aspectRatio: "1:1",
    channel: "instagram",
    assetType: "square",
    label: "Instagram Square — 1:1",
  },
  "instagram-portrait": {
    preset: "instagram-portrait",
    width: 1080,
    height: 1350,
    aspectRatio: "4:5",
    channel: "instagram",
    assetType: "poster",
    label: "Instagram Portrait — 4:5",
  },
  "instagram-story": {
    preset: "instagram-story",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    channel: "instagram",
    assetType: "story",
    label: "Instagram Story — 9:16",
  },
  "facebook-post": {
    preset: "facebook-post",
    width: 1080,
    height: 1350,
    aspectRatio: "4:5",
    channel: "facebook",
    assetType: "poster",
    label: "Facebook Post — 4:5",
  },
  "facebook-story": {
    preset: "facebook-story",
    width: 1080,
    height: 1920,
    aspectRatio: "9:16",
    channel: "facebook",
    assetType: "story",
    label: "Facebook Story — 9:16",
  },
  "digital-menu": {
    preset: "digital-menu",
    width: 1920,
    height: 1080,
    aspectRatio: "16:9",
    channel: "digital-menu",
    assetType: "menu-board",
    label: "Digital Menu — 16:9",
  },
  "web-banner": {
    preset: "web-banner",
    width: 1680,
    height: 720,
    aspectRatio: "21:9",
    channel: "web",
    assetType: "banner",
    label: "Web Banner — 21:9",
  },
  poster: {
    preset: "poster",
    width: 1080,
    height: 1440,
    aspectRatio: "3:4",
    channel: "print",
    assetType: "poster",
    label: "Poster — 3:4",
  },
});

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function dimension(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 64 || value > 16384) {
    throw new Error(`${name} must be an integer from 64 to 16384.`);
  }
  return value;
}

export function aspectRatioForDimensions(width: number, height: number): string {
  const w = dimension(width, "width");
  const h = dimension(height, "height");
  const divisor = gcd(w, h);
  return `${w / divisor}:${h / divisor}`;
}

function ratioNumber(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) throw new Error(`Invalid aspect ratio: ${value}.`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid aspect ratio: ${value}.`);
  }
  return width / height;
}

export function assertCreativeProductionFormat(format: CampaignProductionFormat): CampaignProductionFormat {
  const width = dimension(format.width, "productionFormat.width");
  const height = dimension(format.height, "productionFormat.height");
  if (!format.channel.trim()) throw new Error("productionFormat.channel is required.");
  if (!format.assetType.trim()) throw new Error("productionFormat.assetType is required.");
  const declared = ratioNumber(format.aspectRatio);
  const actual = width / height;
  if (Math.abs(declared - actual) > 0.01) {
    throw new Error(
      `productionFormat.aspectRatio ${format.aspectRatio} does not match ${width}x${height}.`,
    );
  }
  return {
    channel: format.channel.trim(),
    assetType: format.assetType.trim(),
    aspectRatio: format.aspectRatio.trim(),
    width,
    height,
  };
}

export function resolveCreativeOutputFormat(input: {
  preset: CreativeBriefFormatPreset;
  customWidth?: number;
  customHeight?: number;
}): CampaignProductionFormat & { preset: CreativeBriefFormatPreset } {
  if (input.preset !== "custom") {
    const target = CREATIVE_OUTPUT_FORMAT_PRESETS[input.preset];
    return { ...target };
  }
  const width = dimension(input.customWidth ?? 0, "customWidth");
  const height = dimension(input.customHeight ?? 0, "customHeight");
  return {
    preset: "custom",
    width,
    height,
    aspectRatio: aspectRatioForDimensions(width, height),
    channel: "custom",
    assetType: `custom-${width}x${height}`,
  };
}

const GEMINI_IMAGE_ASPECT_RATIOS = [
  "1:8",
  "1:4",
  "2:3",
  "3:4",
  "4:5",
  "1:1",
  "5:4",
  "4:3",
  "3:2",
  "16:9",
  "21:9",
  "4:1",
  "8:1",
  "9:16",
] as const;

export function nearestSupportedImageAspectRatio(aspectRatio: string): string {
  if ((GEMINI_IMAGE_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) return aspectRatio;
  const requested = ratioNumber(aspectRatio);
  let nearest: string = GEMINI_IMAGE_ASPECT_RATIOS[0];
  let distance = Math.abs(ratioNumber(nearest) - requested);
  for (const candidate of GEMINI_IMAGE_ASPECT_RATIOS.slice(1)) {
    const nextDistance = Math.abs(ratioNumber(candidate) - requested);
    if (nextDistance < distance) {
      nearest = candidate;
      distance = nextDistance;
    }
  }
  return nearest;
}
