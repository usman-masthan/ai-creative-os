import {
  assertCreativeRespectsBrandGovernance,
  type BrandGovernance,
} from "../brandGovernance.js";
import { buildCampaignGenerationPrompt } from "../campaignPrompt.js";
import { parseCampaignCreativeOutput } from "../creativeValidator.js";
import type { CampaignCreativeOutput } from "../creativeTypes.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import {
  createCampaignPreflight,
  type CampaignPreflight,
  type CreateCampaignRequest,
} from "./createCampaign.js";

export interface GenerateCampaignRequest extends CreateCampaignRequest {
  brandContext: string;
  brandGovernance?: BrandGovernance;
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
      creative: CampaignCreativeOutput;
    };

function assertDeterministicFactPlacement(
  creative: CampaignCreativeOutput,
  preflight: CampaignPreflight,
): void {
  const priceFacts = preflight.facts.filter((fact) => fact.key.startsWith("price|"));

  for (const fact of priceFacts) {
    const expectedPrice = String(fact.value);

    if (creative.imageGeneration.basePrompt.includes(expectedPrice)) {
      throw new Error(
        `Production safety violation: verified price ${expectedPrice} appeared inside imageGeneration.basePrompt. Prices must be deterministic overlays.`,
      );
    }

    if (!creative.overlaySpec.price?.includes(expectedPrice)) {
      throw new Error(
        `Production safety violation: overlaySpec.price must preserve verified price ${expectedPrice}.`,
      );
    }
  }
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

  const prompt = buildCampaignGenerationPrompt({
    request,
    preflight,
    brandContext: request.brandContext,
    ...(request.brandGovernance ? { brandGovernance: request.brandGovernance } : {}),
  });

  const rawOutput = await provider.generate(prompt);
  const creative = parseCampaignCreativeOutput(rawOutput);

  assertDeterministicFactPlacement(creative, preflight);
  assertCreativeRespectsBrandGovernance(creative, request.brandGovernance);

  return {
    status: "GENERATED",
    preflight,
    provider: {
      name: provider.providerName,
      model: provider.model,
    },
    creative,
  };
}
