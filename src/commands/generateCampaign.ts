import {
  assertCreativeRespectsBrandGovernance,
  type BrandGovernance,
} from "../brandGovernance.js";
import {
  assertCreativeRespectsClaimGovernance,
  findUnsupportedClaimTermsInText,
  type ClaimGovernance,
} from "../claimGovernance.js";
import { buildCampaignGenerationPrompt } from "../campaignPrompt.js";
import { assertConceptDifferentiation } from "../conceptDifferentiation.js";
import { parseCampaignCreativeOutput } from "../creativeValidator.js";
import type {
  CampaignCreativeOutput,
  CampaignProductionComplexity,
  CampaignProductionFormat,
} from "../creativeTypes.js";
import { assertCreativeProductionFormat } from "../creativeStudio/contracts/outputFormat.js";
import { formatLkr } from "../money.js";
import type { MarketingCampaignType } from "../marketingPlannerTypes.js";
import { resolveProductionFormat } from "../platformFormat.js";
import { evaluateProductionComplexity } from "../productionComplexity.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import { buildCampaignRepairPrompt } from "../repairPrompt.js";
import {
  createCampaignPreflight,
  type CampaignPreflight,
  type CreateCampaignRequest,
} from "./createCampaign.js";

export interface GenerateCampaignRequest extends CreateCampaignRequest {
  brandContext: string;
  campaignType?: MarketingCampaignType;
  brandGovernance?: BrandGovernance;
  claimGovernance?: ClaimGovernance;
  productionFormat?: CampaignProductionFormat;
  maxRepairAttempts?: number;
}

export type GenerateCampaignResult =
  | {
      status: "BLOCKED_MISSING_VERIFIED_DATA";
      preflight: CampaignPreflight;
    }
  | {
      status: "GENERATED";
      preflight: CampaignPreflight;
      provider: {
        name: string;
        model: string;
      };
      generation: {
        attempts: number;
        repairs: number;
      };
      production: {
        format: CampaignProductionFormat;
        complexity: CampaignProductionComplexity;
      };
      creative: CampaignCreativeOutput;
    };

function collectCustomerFacingPriceText(creative: CampaignCreativeOutput): string[] {
  return [
    ...creative.concepts.flatMap((concept) => [
      concept.campaignName,
      concept.coreIdea,
      concept.headlineDirection,
      concept.cta,
    ]),
    creative.creativeBrief.headline,
    creative.creativeBrief.supportingCopy,
    creative.creativeBrief.cta,
    creative.caption,
    creative.overlaySpec.headline,
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
  ];
}

function containsNumericAmount(text: string, numericPrice: number): boolean {
  const normalized = text.replace(/,/g, "");
  const amount = String(numericPrice).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\D)${amount}(\\D|$)`).test(normalized);
}

function assertDeterministicFactPlacement(
  creative: CampaignCreativeOutput,
  preflight: CampaignPreflight,
): void {
  const priceFacts = preflight.facts.filter((fact) => fact.key.startsWith("price|"));

  for (const fact of priceFacts) {
    const numericPrice = Number(fact.value);
    if (!Number.isFinite(numericPrice)) {
      throw new Error(`Production safety violation: verified price ${String(fact.value)} is not numeric.`);
    }

    const expectedPrice = String(numericPrice);
    const expectedDisplay = formatLkr(numericPrice);
    if (creative.imageGeneration.basePrompt.includes(expectedPrice)) {
      throw new Error(
        `Production safety violation: verified price ${expectedPrice} appeared inside imageGeneration.basePrompt. Prices must be deterministic overlays.`,
      );
    }

    if (!creative.overlaySpec.price) {
      throw new Error(
        `Production safety violation: overlaySpec.price is required for verified price ${expectedPrice}.`,
      );
    }

    if (creative.overlaySpec.price.amount !== numericPrice) {
      throw new Error(
        `Production safety violation: overlaySpec.price.amount must preserve verified price ${expectedPrice}.`,
      );
    }

    if (creative.overlaySpec.price.currency !== "LKR") {
      throw new Error(
        "Production safety violation: overlaySpec.price.currency must be LKR for this client configuration.",
      );
    }

    if (creative.overlaySpec.price.display !== expectedDisplay) {
      throw new Error(
        `Production safety violation: overlaySpec.price.display must equal deterministic display ${expectedDisplay}.`,
      );
    }

    for (const text of collectCustomerFacingPriceText(creative)) {
      if (containsNumericAmount(text, numericPrice) && !text.includes(expectedDisplay)) {
        throw new Error(
          `Production safety violation: customer-facing price ${expectedPrice} must be formatted exactly as ${expectedDisplay}.`,
        );
      }
    }
  }
}

function assertProductionFormat(
  creative: CampaignCreativeOutput,
  format: CampaignProductionFormat,
): void {
  if (creative.creativeBrief.aspectRatio !== format.aspectRatio) {
    throw new Error(
      `Production format violation: creativeBrief.aspectRatio must be ${format.aspectRatio} for ${format.channel} ${format.assetType}; received ${creative.creativeBrief.aspectRatio}.`,
    );
  }
}

function validateCreative(
  rawOutput: string,
  preflight: CampaignPreflight,
  format: CampaignProductionFormat,
  request: GenerateCampaignRequest,
): CampaignCreativeOutput {
  const creative = parseCampaignCreativeOutput(rawOutput);

  assertConceptDifferentiation(creative);
  assertDeterministicFactPlacement(creative, preflight);
  assertProductionFormat(creative, format);
  assertCreativeRespectsClaimGovernance(
    creative,
    preflight,
    request.claimGovernance ?? {},
  );
  assertCreativeRespectsBrandGovernance(creative, request.brandGovernance);

  return creative;
}

function normalizeRepairCount(value: number | undefined): number {
  if (value === undefined) return 2;
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error("maxRepairAttempts must be an integer from 0 to 3.");
  }
  return value;
}

export async function generateCampaign(
  request: GenerateCampaignRequest,
  provider: CampaignGenerationProvider,
): Promise<GenerateCampaignResult> {
  const preflight = createCampaignPreflight(request);

  if (preflight.status !== "READY_FOR_CREATIVE") {
    return {
      status: "BLOCKED_MISSING_VERIFIED_DATA",
      preflight,
    };
  }

  const unconfirmedBriefTerms = findUnsupportedClaimTermsInText(
    request.objective,
    preflight,
    request.claimGovernance ?? {},
  );
  if (unconfirmedBriefTerms.length) {
    throw new Error(
      `Campaign request contains unconfirmed product/service claim or depiction \"${unconfirmedBriefTerms[0]}\". Return to task confirmation and confirm or remove the requested detail before creative generation.`,
    );
  }

  const productionFormat = request.productionFormat
    ? assertCreativeProductionFormat(request.productionFormat)
    : resolveProductionFormat(request.channel, request.assetType);
  const maxRepairAttempts = normalizeRepairCount(request.maxRepairAttempts);
  const originalPrompt = buildCampaignGenerationPrompt({
    request,
    preflight,
    brandContext: request.brandContext,
    productionFormat,
    ...(request.brandGovernance ? { brandGovernance: request.brandGovernance } : {}),
  });

  let attempts = 0;
  let repairs = 0;
  let prompt = originalPrompt;
  let previousOutput = "";

  while (true) {
    attempts += 1;
    const rawOutput = await provider.generate(prompt);
    previousOutput = rawOutput;

    try {
      const creative = validateCreative(
        rawOutput,
        preflight,
        productionFormat,
        request,
      );
      const complexity = evaluateProductionComplexity(creative);

      return {
        status: "GENERATED",
        preflight,
        provider: {
          name: provider.providerName,
          model: provider.model,
        },
        generation: {
          attempts,
          repairs,
        },
        production: {
          format: productionFormat,
          complexity,
        },
        creative,
      };
    } catch (error) {
      const violation = error instanceof Error ? error.message : String(error);

      if (repairs >= maxRepairAttempts) {
        throw new Error(
          `Campaign generation failed validation after ${attempts} attempt(s): ${violation}`,
        );
      }

      repairs += 1;
      prompt = buildCampaignRepairPrompt({
        originalPrompt,
        previousOutput,
        violation,
        repairAttempt: repairs,
      });
    }
  }
}
