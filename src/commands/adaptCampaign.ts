import {
  assertCreativeRespectsBrandGovernance,
  type BrandGovernance,
} from "../brandGovernance.js";
import {
  assertCreativeRespectsClaimGovernance,
  type ClaimGovernance,
} from "../claimGovernance.js";
import type { CampaignCreativeOutput } from "../creativeTypes.js";
import { selectAtthasLayout, type AtthasBrandId } from "../layouts/atthas.js";
import {
  resolveAtthasAdaptationTargets,
} from "../multiFormatPolicy.js";
import { buildAtthasMultiFormatPrompt } from "../multiFormatPrompt.js";
import type {
  AtthasAdaptationTargetId,
  AtthasFormatVariant,
  AtthasMultiFormatAdaptationBundle,
  RawAtthasFormatVariant,
} from "../multiFormatTypes.js";
import { parseAtthasMultiFormatOutput } from "../multiFormatValidator.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import { buildCampaignRepairPrompt } from "../repairPrompt.js";
import type { DirectedCampaign } from "./directCampaign.js";

export interface AdaptDirectedCampaignRequest {
  campaignId: string;
  brandId: AtthasBrandId;
  campaign: DirectedCampaign;
  provider: CampaignGenerationProvider;
  truthVersion: string;
  brandVersion: string;
  targetIds?: AtthasAdaptationTargetId[];
  brandGovernance?: BrandGovernance;
  claimGovernance?: ClaimGovernance;
  maxRepairAttempts?: number;
}

function normalizeRepairs(value: number | undefined): number {
  if (value === undefined) return 2;
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error("ATTHA'S adaptation maxRepairAttempts must be an integer from 0 to 3.");
  }
  return value;
}

function sourceCustomerFacingText(creative: CampaignCreativeOutput): string {
  return [
    creative.creativeBrief.headline,
    creative.creativeBrief.supportingCopy,
    creative.creativeBrief.cta,
    creative.caption,
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
    creative.overlaySpec.price?.display ?? "",
  ].join("\n");
}

function numericTokens(text: string): string[] {
  return [...text.matchAll(/\d[\d,.]*/g)].map((match) => match[0]!.replace(/,/g, ""));
}

function allowedNumericTokens(campaign: DirectedCampaign): Set<string> {
  const allowed = new Set(numericTokens(sourceCustomerFacingText(campaign.creative)));
  for (const fact of campaign.preflight.facts) {
    const value = typeof fact.value === "string" ? fact.value : JSON.stringify(fact.value);
    for (const token of numericTokens(value)) allowed.add(token);
  }
  return allowed;
}

function assertNoNewNumericClaims(
  raw: RawAtthasFormatVariant,
  campaign: DirectedCampaign,
): void {
  const text = [raw.headline, raw.supportingCopy, raw.cta, raw.caption].join("\n");
  const allowed = allowedNumericTokens(campaign);
  for (const token of numericTokens(text)) {
    if (!allowed.has(token)) {
      throw new Error(`ATTHA'S adaptation introduced unverified numeric claim ${token}.`);
    }
  }

  const price = campaign.creative.overlaySpec.price;
  if (price) {
    const amount = String(price.amount);
    const normalized = text.replace(/,/g, "");
    const amountPattern = new RegExp(`(^|\\D)${amount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\D|$)`);
    if (amountPattern.test(normalized) && !text.includes(price.display)) {
      throw new Error(
        `ATTHA'S adaptation must format verified price exactly as ${price.display}.`,
      );
    }
  }
}

function buildVariant(
  raw: RawAtthasFormatVariant,
  request: AdaptDirectedCampaignRequest,
): AtthasFormatVariant {
  const target = resolveAtthasAdaptationTargets([raw.targetId])[0]!;
  assertNoNewNumericClaims(raw, request.campaign);
  const source = request.campaign.creative;
  const placementHints = {
    headline: raw.placementHints.headline,
    supportingCopy: raw.placementHints.supportingCopy,
    cta: raw.placementHints.cta,
    logo: raw.placementHints.logo,
    ...(source.overlaySpec.price && raw.placementHints.price
      ? { price: raw.placementHints.price }
      : {}),
  };

  let creative: CampaignCreativeOutput = {
    ...source,
    concepts: structuredClone(source.concepts),
    creativeBrief: {
      ...source.creativeBrief,
      headline: raw.headline,
      supportingCopy: raw.supportingCopy,
      cta: raw.cta,
      composition: raw.composition,
      aspectRatio: target.format.aspectRatio,
    },
    caption: raw.caption,
    imageGeneration: {
      ...source.imageGeneration,
      visualConstraints: [...source.imageGeneration.visualConstraints],
    },
    overlaySpec: {
      ...source.overlaySpec,
      headline: raw.headline,
      supportingCopy: raw.supportingCopy,
      cta: raw.cta,
      placementHints,
      ...(source.overlaySpec.price ? { price: structuredClone(source.overlaySpec.price) } : {}),
    },
    factualQaNotes: [
      ...source.factualQaNotes,
      `Multi-format adaptation ${raw.targetId}; concept and verified facts preserved.`,
    ],
  };

  const layout = selectAtthasLayout({
    brandId: request.brandId,
    creative,
    format: target.format,
  });
  creative = {
    ...creative,
    imageGeneration: {
      ...creative.imageGeneration,
      visualConstraints: [
        ...new Set([
          ...creative.imageGeneration.visualConstraints,
          ...layout.imageCompositionRequirements,
        ]),
      ],
    },
  };

  if (JSON.stringify(creative.concepts) !== JSON.stringify(source.concepts)) {
    throw new Error("ATTHA'S adaptation must preserve source campaign concepts exactly.");
  }
  if (creative.recommendedConceptId !== source.recommendedConceptId) {
    throw new Error("ATTHA'S adaptation must preserve the selected source concept.");
  }

  assertCreativeRespectsClaimGovernance(
    creative,
    request.campaign.preflight,
    request.claimGovernance ?? {},
  );
  assertCreativeRespectsBrandGovernance(creative, request.brandGovernance);

  return { target, layout, creative };
}

export async function adaptDirectedCampaign(
  request: AdaptDirectedCampaignRequest,
): Promise<AtthasMultiFormatAdaptationBundle> {
  if (!request.campaignId.trim()) throw new Error("campaignId is required for ATTHA'S adaptation.");
  if (!request.truthVersion.trim()) throw new Error("truthVersion is required for ATTHA'S adaptation.");
  if (!request.brandVersion.trim()) throw new Error("brandVersion is required for ATTHA'S adaptation.");

  const targets = resolveAtthasAdaptationTargets(request.targetIds);
  const originalPrompt = buildAtthasMultiFormatPrompt({
    campaignId: request.campaignId,
    brandId: request.brandId,
    campaign: request.campaign,
    targets,
    truthVersion: request.truthVersion,
    brandVersion: request.brandVersion,
  });
  const maxRepairs = normalizeRepairs(request.maxRepairAttempts);
  let prompt = originalPrompt;
  let attempts = 0;
  let repairs = 0;

  while (true) {
    attempts += 1;
    const rawOutput = await request.provider.generate(prompt);
    try {
      const parsed = parseAtthasMultiFormatOutput(
        rawOutput,
        targets,
        Boolean(request.campaign.creative.overlaySpec.price),
      );
      const variants = parsed.variants.map((variant) => buildVariant(variant, request));
      return {
        adaptationSetId: `${request.campaignId}-MF-V1`,
        campaignId: request.campaignId,
        brandId: request.brandId,
        sourceConceptId: request.campaign.creative.recommendedConceptId,
        truthVersion: request.truthVersion,
        brandVersion: request.brandVersion,
        variants,
        adaptationNotes: parsed.adaptationNotes,
        trace: {
          provider: request.provider.providerName,
          model: request.provider.model,
          attempts,
          repairs,
          targetCount: targets.length,
        },
      };
    } catch (error) {
      const violation = error instanceof Error ? error.message : String(error);
      if (repairs >= maxRepairs) {
        throw new Error(
          `ATTHA'S multi-format adaptation failed validation after ${attempts} attempt(s): ${violation}`,
        );
      }
      repairs += 1;
      prompt = buildCampaignRepairPrompt({
        originalPrompt,
        previousOutput: rawOutput,
        violation,
        repairAttempt: repairs,
      });
    }
  }
}
