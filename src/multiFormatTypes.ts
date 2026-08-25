import type { CampaignCreativeOutput, CampaignProductionFormat } from "./creativeTypes.js";
import type { AtthasLayoutDefinition } from "./layouts/atthas.js";

export type AtthasAdaptationTargetId =
  | "INSTAGRAM_FEED_4X5"
  | "INSTAGRAM_STORY_9X16"
  | "INSTAGRAM_REEL_COVER_9X16"
  | "FACEBOOK_FEED_4X5"
  | "WHATSAPP_STATUS_9X16";

export interface AtthasAdaptationTarget {
  id: AtthasAdaptationTargetId;
  channel: string;
  assetType: string;
  format: CampaignProductionFormat;
  headlineMaxChars: number;
  supportingCopyMaxChars: number;
  captionMaxChars: number;
  ctaMaxChars: number;
}

export interface RawAtthasFormatVariant {
  targetId: AtthasAdaptationTargetId;
  headline: string;
  supportingCopy: string;
  cta: string;
  caption: string;
  composition: string;
  placementHints: {
    headline: string;
    supportingCopy: string;
    price?: string;
    cta: string;
    logo: string;
  };
}

export interface RawAtthasAdaptationOutput {
  variants: RawAtthasFormatVariant[];
  adaptationNotes: string[];
}

export interface AtthasFormatVariant {
  target: AtthasAdaptationTarget;
  layout: AtthasLayoutDefinition;
  creative: CampaignCreativeOutput;
}

export interface AtthasMultiFormatAdaptationBundle {
  adaptationSetId: string;
  campaignId: string;
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  sourceConceptId: string;
  truthVersion: string;
  brandVersion: string;
  variants: AtthasFormatVariant[];
  adaptationNotes: string[];
  trace: {
    provider: string;
    model: string;
    attempts: number;
    repairs: number;
    targetCount: number;
  };
}
