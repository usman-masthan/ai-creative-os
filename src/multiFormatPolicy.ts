import { resolveProductionFormat } from "./platformFormat.js";
import type {
  AtthasAdaptationTarget,
  AtthasAdaptationTargetId,
} from "./multiFormatTypes.js";

const whatsappStatusFormat = {
  channel: "whatsapp",
  assetType: "status",
  aspectRatio: "9:16",
  width: 1080,
  height: 1920,
} as const;

export const ATTHAS_ADAPTATION_TARGETS: readonly AtthasAdaptationTarget[] = [
  {
    id: "INSTAGRAM_FEED_4X5",
    channel: "instagram",
    assetType: "poster",
    format: resolveProductionFormat("instagram", "poster"),
    headlineMaxChars: 72,
    supportingCopyMaxChars: 120,
    captionMaxChars: 1200,
    ctaMaxChars: 40,
  },
  {
    id: "INSTAGRAM_STORY_9X16",
    channel: "instagram",
    assetType: "story",
    format: resolveProductionFormat("instagram", "story"),
    headlineMaxChars: 64,
    supportingCopyMaxChars: 96,
    captionMaxChars: 500,
    ctaMaxChars: 32,
  },
  {
    id: "INSTAGRAM_REEL_COVER_9X16",
    channel: "instagram",
    assetType: "reel_cover",
    format: resolveProductionFormat("instagram", "reel_cover"),
    headlineMaxChars: 48,
    supportingCopyMaxChars: 72,
    captionMaxChars: 500,
    ctaMaxChars: 28,
  },
  {
    id: "FACEBOOK_FEED_4X5",
    channel: "facebook",
    assetType: "poster",
    format: resolveProductionFormat("facebook", "poster"),
    headlineMaxChars: 72,
    supportingCopyMaxChars: 120,
    captionMaxChars: 1500,
    ctaMaxChars: 40,
  },
  {
    id: "WHATSAPP_STATUS_9X16",
    channel: "whatsapp",
    assetType: "status",
    format: whatsappStatusFormat,
    headlineMaxChars: 56,
    supportingCopyMaxChars: 80,
    captionMaxChars: 320,
    ctaMaxChars: 28,
  },
] as const;

export const DEFAULT_ATTHAS_ADAPTATION_TARGET_IDS: readonly AtthasAdaptationTargetId[] = [
  "INSTAGRAM_FEED_4X5",
  "INSTAGRAM_STORY_9X16",
  "INSTAGRAM_REEL_COVER_9X16",
  "FACEBOOK_FEED_4X5",
  "WHATSAPP_STATUS_9X16",
] as const;

export function getAtthasAdaptationTarget(id: AtthasAdaptationTargetId): AtthasAdaptationTarget {
  const target = ATTHAS_ADAPTATION_TARGETS.find((candidate) => candidate.id === id);
  if (!target) throw new Error(`Unknown ATTHA'S adaptation target: ${id}.`);
  return target;
}

export function resolveAtthasAdaptationTargets(
  ids: AtthasAdaptationTargetId[] | undefined,
): AtthasAdaptationTarget[] {
  const requested = ids ?? [...DEFAULT_ATTHAS_ADAPTATION_TARGET_IDS];
  if (!requested.length) throw new Error("At least one ATTHA'S adaptation target is required.");
  const unique = [...new Set(requested)];
  if (unique.length !== requested.length) {
    throw new Error("ATTHA'S adaptation targets must be unique.");
  }
  return unique.map(getAtthasAdaptationTarget);
}
