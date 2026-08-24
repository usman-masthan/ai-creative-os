import { GroqResponsesProvider } from "./groqResponses.js";
import { OpenAIResponsesProvider } from "./openaiResponses.js";
import { OpenRouterResponsesProvider } from "./openrouterResponses.js";
import type { CampaignGenerationProvider } from "./types.js";

export type CampaignProviderName = "openrouter" | "groq" | "openai";

export interface CampaignProviderRouterOptions {
  provider?: CampaignProviderName;
  openrouterApiKey?: string;
  openrouterModel?: string;
  groqApiKey?: string;
  groqModel?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  fetchImpl?: typeof fetch;
}

function resolveProviderName(options: CampaignProviderRouterOptions): CampaignProviderName {
  if (options.provider) return options.provider;

  const fromEnv = process.env.AI_CAMPAIGN_PROVIDER?.trim().toLowerCase();
  if (fromEnv === "openrouter" || fromEnv === "groq" || fromEnv === "openai") {
    return fromEnv;
  }
  if (fromEnv) {
    throw new Error(
      `Unsupported AI_CAMPAIGN_PROVIDER '${fromEnv}'. Supported providers: openrouter, groq, openai.`,
    );
  }

  if (options.openrouterApiKey ?? process.env.OPENROUTER_API_KEY) return "openrouter";
  if (options.groqApiKey ?? process.env.GROQ_API_KEY) return "groq";
  if (options.openaiApiKey ?? process.env.OPENAI_API_KEY) return "openai";

  throw new Error(
    "No campaign AI provider is configured. Export OPENROUTER_API_KEY for free-model routing, GROQ_API_KEY for Groq, or OPENAI_API_KEY for OpenAI. Optionally set AI_CAMPAIGN_PROVIDER=openrouter|groq|openai.",
  );
}

export function createCampaignProvider(
  options: CampaignProviderRouterOptions = {},
): CampaignGenerationProvider {
  const provider = resolveProviderName(options);

  if (provider === "openrouter") {
    return new OpenRouterResponsesProvider({
      ...(options.openrouterApiKey ? { apiKey: options.openrouterApiKey } : {}),
      ...(options.openrouterModel ? { model: options.openrouterModel } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  }

  if (provider === "groq") {
    return new GroqResponsesProvider({
      ...(options.groqApiKey ? { apiKey: options.groqApiKey } : {}),
      ...(options.groqModel ? { model: options.groqModel } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  }

  return new OpenAIResponsesProvider({
    ...(options.openaiApiKey ? { apiKey: options.openaiApiKey } : {}),
    ...(options.openaiModel ? { model: options.openaiModel } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
}
