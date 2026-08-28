import { assertCreativeRespectsBrandGovernance } from "../brandGovernance.js";
import { assertCreativeRespectsClaimGovernance } from "../claimGovernance.js";
import {
  assertCampaignTypeCopyRules,
  type CampaignCopyPolicyId,
} from "../campaignCopyRules.js";
import {
  buildCreativeDirectorPrompt,
  buildDirectedCreativePrompt,
} from "../creativeDirectorPrompt.js";
import type { CreativeDirectorReview, CreativeDirectorTrace } from "../creativeDirectorTypes.js";
import { parseCreativeDirectorReview } from "../creativeDirectorValidator.js";
import { parseCampaignCreativeOutput } from "../creativeValidator.js";
import type { CampaignCreativeOutput } from "../creativeTypes.js";
import { formatLkr } from "../money.js";
import { evaluateProductionComplexity } from "../productionComplexity.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import { buildCampaignRepairPrompt } from "../repairPrompt.js";
import {
  generateCampaign,
  type GenerateCampaignRequest,
  type GenerateCampaignResult,
} from "./generateCampaign.js";

export type GeneratedCampaign = Extract<GenerateCampaignResult, { status: "GENERATED" }>;
export type DirectedCampaign = GeneratedCampaign & { creativeDirector: CreativeDirectorTrace };

export interface CreativeDirectorProviders {
  director: CampaignGenerationProvider;
  finalizer: CampaignGenerationProvider;
}

export interface DirectCampaignRequest {
  request: GenerateCampaignRequest;
  campaign: GeneratedCampaign;
  maxDirectorRepairAttempts?: number;
  maxFinalizerRepairAttempts?: number;
}

function normalizeRepairs(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error("Creative Director repair attempts must be an integer from 0 to 3.");
  }
  return value;
}

function conceptsMatch(original: CampaignCreativeOutput, candidate: CampaignCreativeOutput): boolean {
  return JSON.stringify(original.concepts) === JSON.stringify(candidate.concepts);
}

function assertDirectedCreative(
  creative: CampaignCreativeOutput,
  original: CampaignCreativeOutput,
  review: CreativeDirectorReview,
  campaign: GeneratedCampaign,
  request: GenerateCampaignRequest,
): CampaignCopyPolicyId | undefined {
  if (!conceptsMatch(original, creative)) {
    throw new Error("Creative Director finalization violation: concepts must remain exactly unchanged.");
  }
  if (creative.recommendedConceptId !== review.winnerConceptId) {
    throw new Error(
      `Creative Director finalization violation: recommendedConceptId must be ${review.winnerConceptId}.`,
    );
  }
  if (creative.creativeBrief.aspectRatio !== campaign.production.format.aspectRatio) {
    throw new Error(
      `Creative Director finalization violation: aspect ratio must remain ${campaign.production.format.aspectRatio}.`,
    );
  }

  const priceFacts = campaign.preflight.facts.filter((fact) => fact.key.startsWith("price|"));
  for (const fact of priceFacts) {
    const amount = Number(fact.value);
    if (!Number.isFinite(amount)) {
      throw new Error("Creative Director finalization violation: verified price is not numeric.");
    }
    const display = formatLkr(amount);
    if (creative.imageGeneration.basePrompt.includes(String(amount))) {
      throw new Error("Creative Director finalization violation: price leaked into image prompt.");
    }
    if (
      !creative.overlaySpec.price ||
      creative.overlaySpec.price.amount !== amount ||
      creative.overlaySpec.price.display !== display
    ) {
      throw new Error(
        `Creative Director finalization violation: deterministic price must remain ${display}.`,
      );
    }
  }

  assertCreativeRespectsClaimGovernance(
    creative,
    campaign.preflight,
    request.claimGovernance ?? {},
  );
  assertCreativeRespectsBrandGovernance(creative, request.brandGovernance);
  return assertCampaignTypeCopyRules(creative, {
    campaignType: request.campaignType,
    brandId: request.brandId,
    facts: campaign.preflight.facts,
  });
}

async function runDirectorReview(
  input: DirectCampaignRequest,
  provider: CampaignGenerationProvider,
): Promise<CreativeDirectorReview> {
  const originalPrompt = buildCreativeDirectorPrompt({
    request: input.request,
    preflight: input.campaign.preflight,
    format: input.campaign.production.format,
    creative: input.campaign.creative,
  });
  const maxRepairs = normalizeRepairs(input.maxDirectorRepairAttempts, 1);
  let prompt = originalPrompt;
  let repairs = 0;

  while (true) {
    const raw = await provider.generate(prompt);
    try {
      return parseCreativeDirectorReview(raw);
    } catch (error) {
      if (repairs >= maxRepairs) throw error;
      repairs += 1;
      prompt = buildCampaignRepairPrompt({
        originalPrompt,
        previousOutput: raw,
        violation: error instanceof Error ? error.message : String(error),
        repairAttempt: repairs,
      });
    }
  }
}

async function finalizeWinner(
  input: DirectCampaignRequest,
  review: CreativeDirectorReview,
  provider: CampaignGenerationProvider,
): Promise<{
  creative: CampaignCreativeOutput;
  attempts: number;
  repairs: number;
  copyPolicy?: CampaignCopyPolicyId;
}> {
  const originalPrompt = buildDirectedCreativePrompt({
    request: input.request,
    preflight: input.campaign.preflight,
    format: input.campaign.production.format,
    originalCreative: input.campaign.creative,
    review,
  });
  const maxRepairs = normalizeRepairs(input.maxFinalizerRepairAttempts, 2);
  let prompt = originalPrompt;
  let attempts = 0;
  let repairs = 0;

  while (true) {
    attempts += 1;
    const raw = await provider.generate(prompt);
    try {
      const parsed = parseCampaignCreativeOutput(raw);
      // The three strategist concepts are immutable source material. The finalizer may
      // rewrite production copy/brief fields, but concept edits are discarded
      // deterministically instead of spending repair attempts asking the model to
      // reproduce an already-known immutable array byte-for-byte.
      const creative: CampaignCreativeOutput = {
        ...parsed,
        concepts: structuredClone(input.campaign.creative.concepts),
      };
      const copyPolicy = assertDirectedCreative(
        creative,
        input.campaign.creative,
        review,
        input.campaign,
        input.request,
      );
      return { creative, attempts, repairs, ...(copyPolicy ? { copyPolicy } : {}) };
    } catch (error) {
      if (repairs >= maxRepairs) {
        const violation = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Creative Director finalization failed validation after ${attempts} attempt(s): ${violation}`,
        );
      }
      repairs += 1;
      prompt = buildCampaignRepairPrompt({
        originalPrompt,
        previousOutput: raw,
        violation: error instanceof Error ? error.message : String(error),
        repairAttempt: repairs,
      });
    }
  }
}

export async function directGeneratedCampaign(
  input: DirectCampaignRequest,
  providers: CreativeDirectorProviders,
): Promise<DirectedCampaign> {
  const review = await runDirectorReview(input, providers.director);
  const finalization = await finalizeWinner(input, review, providers.finalizer);

  return {
    ...input.campaign,
    creative: finalization.creative,
    production: {
      ...input.campaign.production,
      complexity: evaluateProductionComplexity(finalization.creative),
    },
    creativeDirector: {
      director: {
        provider: providers.director.providerName,
        model: providers.director.model,
      },
      finalizer: {
        provider: providers.finalizer.providerName,
        model: providers.finalizer.model,
      },
      review,
      finalization: {
        attempts: finalization.attempts,
        repairs: finalization.repairs,
        ...(finalization.copyPolicy ? { copyPolicy: finalization.copyPolicy } : {}),
      },
    },
  };
}

export async function generateDirectedCampaign(
  request: GenerateCampaignRequest,
  generationProvider: CampaignGenerationProvider,
  providers: CreativeDirectorProviders,
): Promise<GenerateCampaignResult | DirectedCampaign> {
  const generated = await generateCampaign(request, generationProvider);
  if (generated.status !== "GENERATED") return generated;
  return directGeneratedCampaign({ request, campaign: generated }, providers);
}
