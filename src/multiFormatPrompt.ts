import type { DirectedCampaign } from "./commands/directCampaign.js";
import type { AtthasBrandId } from "./layouts/atthas.js";
import type { AtthasAdaptationTarget } from "./multiFormatTypes.js";

function compactFacts(campaign: DirectedCampaign): string {
  return campaign.preflight.facts
    .map((fact) => `${fact.key}=${typeof fact.value === "string" ? fact.value : JSON.stringify(fact.value)}`)
    .join("\n");
}

export function buildAtthasMultiFormatPrompt(input: {
  campaignId: string;
  brandId: AtthasBrandId;
  campaign: DirectedCampaign;
  targets: AtthasAdaptationTarget[];
  truthVersion: string;
  brandVersion: string;
}): string {
  const source = input.campaign.creative;
  const price = source.overlaySpec.price?.display ?? "NONE";
  const targetLines = input.targets.map((target) =>
    [
      target.id,
      `channel=${target.channel}`,
      `assetType=${target.assetType}`,
      `format=${target.format.aspectRatio} ${target.format.width}x${target.format.height}`,
      `headline<=${target.headlineMaxChars}`,
      `supportingCopy<=${target.supportingCopyMaxChars}`,
      `caption<=${target.captionMaxChars}`,
      `cta<=${target.ctaMaxChars}`,
    ].join(" | "),
  );

  return [
    "You are adapting one already-selected ATTHA’S campaign concept into platform-specific copy/composition variants.",
    "This is adaptation, not a new campaign. Do not invent new concepts, products, offers, prices, ingredients, availability, branch facts, delivery promises, slogans or brand claims.",
    `Campaign ID: ${input.campaignId}`,
    `Brand: ${input.brandId}`,
    `Source concept ID: ${source.recommendedConceptId}`,
    `Truth version: ${input.truthVersion}`,
    `Brand version: ${input.brandVersion}`,
    `Deterministic price overlay, if any: ${price}. Do not output a price field; the application preserves verified price data itself.`,
    "Verified facts available to this campaign:",
    compactFacts(input.campaign) || "NONE",
    "Source creative (semantic direction must remain the same):",
    JSON.stringify({
      recommendedConceptId: source.recommendedConceptId,
      recommendationReason: source.recommendationReason,
      creativeBrief: source.creativeBrief,
      caption: source.caption,
      overlaySpec: source.overlaySpec,
      imageGeneration: source.imageGeneration,
    }, null, 2),
    "Targets:",
    ...targetLines,
    "Return exactly one variant for every requested target and no others.",
    "For each variant adapt only headline, supportingCopy, CTA, caption, composition and deterministic overlay placement hints to the target format.",
    "Keep the same customer promise and selected concept. Shorter platform copy is preferred over adding new claims.",
    "Do not include hashtags unless they already exist in the source creative.",
    "Do not write numeric claims that are absent from the source creative or verified facts.",
    "Do not put price/offer text into composition instructions.",
    "Return only JSON with this shape:",
    JSON.stringify({
      variants: input.targets.map((target) => ({
        targetId: target.id,
        headline: "string",
        supportingCopy: "string",
        cta: "string",
        caption: "string",
        composition: "string",
        placementHints: {
          headline: "string",
          supportingCopy: "string",
          ...(source.overlaySpec.price ? { price: "string" } : {}),
          cta: "string",
          logo: "string",
        },
      })),
      adaptationNotes: ["string"],
    }, null, 2),
  ].join("\n\n");
}
