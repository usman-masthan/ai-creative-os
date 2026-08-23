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
  });

  const rawOutput = await provider.generate(prompt);
  const creative = parseCampaignCreativeOutput(rawOutput);

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
