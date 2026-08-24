export interface GeminiUsageTelemetry {
  inputTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
  totalTokens?: number;
  serviceTier?: string;
  estimatedCostUsd?: number;
  estimateBasis?: string;
  pricingVersion: "2026-08-13";
}

interface InteractionUsagePayload {
  total_tokens?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_thought_tokens?: number;
  service_tier?: string;
}

interface GenerateContentUsagePayload {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

const TEXT_STANDARD_RATES_PER_MILLION: Record<
  string,
  { input: number; output: number; largePromptInput?: number; largePromptOutput?: number }
> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
  "gemini-3.7-flash": { input: 0.75, output: 3.75 },
  "gemini-3.1-pro-preview": {
    input: 2,
    output: 12,
    largePromptInput: 4,
    largePromptOutput: 18,
  },
  "gemini-3.1-flash-tts-preview": { input: 1, output: 20 },
};

const IMAGE_OUTPUT_COST_USD: Record<string, Record<string, number>> = {
  "gemini-3.1-flash-lite-image": {
    "1K": 0.0336,
  },
  "gemini-3.1-flash-image": {
    "0.5K": 0.045,
    "1K": 0.067,
    "2K": 0.101,
    "4K": 0.151,
  },
  "gemini-3-pro-image": {
    "1K": 0.134,
    "2K": 0.134,
    "4K": 0.24,
  },
};

const VIDEO_COST_PER_SECOND_USD: Record<string, Record<string, number>> = {
  "veo-3.1-lite-generate-preview": {
    "720p": 0.05,
    "1080p": 0.08,
  },
  "veo-3.1-fast-generate-preview": {
    "720p": 0.1,
    "1080p": 0.12,
    "4k": 0.3,
  },
  "veo-3.1-generate-preview": {
    "720p": 0.4,
    "1080p": 0.4,
    "4k": 0.6,
  },
};

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function estimateTextCostUsd(
  model: string,
  inputTokens = 0,
  outputTokens = 0,
): number | undefined {
  const rates = TEXT_STANDARD_RATES_PER_MILLION[model];
  if (!rates) return undefined;

  const largePrompt = inputTokens > 200_000 && rates.largePromptInput !== undefined;
  const inputRate = largePrompt ? rates.largePromptInput! : rates.input;
  const outputRate = largePrompt ? rates.largePromptOutput! : rates.output;

  return roundUsd((inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate);
}

export function estimateImageOutputCostUsd(
  model: string,
  resolution: string,
): number | undefined {
  return IMAGE_OUTPUT_COST_USD[model]?.[resolution.toUpperCase()];
}

export function estimateVideoCostUsd(
  model: string,
  durationSeconds: number,
  resolution: string,
): number | undefined {
  const rate = VIDEO_COST_PER_SECOND_USD[model]?.[resolution.toLowerCase()];
  if (rate === undefined) return undefined;
  return roundUsd(rate * durationSeconds);
}

function estimatedTextCostFields(
  model: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined,
): Pick<GeminiUsageTelemetry, "estimatedCostUsd" | "estimateBasis"> | Record<string, never> {
  if (inputTokens === undefined && outputTokens === undefined) return {};
  const estimatedCostUsd = estimateTextCostUsd(model, inputTokens ?? 0, outputTokens ?? 0);
  if (estimatedCostUsd === undefined) return {};
  return {
    estimatedCostUsd,
    estimateBasis: "Google Gemini standard paid-tier token pricing; estimate only.",
  };
}

export function usageFromGenerateContent(
  model: string,
  usage: GenerateContentUsagePayload | undefined,
): GeminiUsageTelemetry | undefined {
  if (!usage) return undefined;

  const inputTokens = usage.promptTokenCount;
  const outputTokens =
    usage.candidatesTokenCount === undefined && usage.thoughtsTokenCount === undefined
      ? undefined
      : (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);

  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(usage.thoughtsTokenCount !== undefined ? { thoughtTokens: usage.thoughtsTokenCount } : {}),
    ...(usage.totalTokenCount !== undefined ? { totalTokens: usage.totalTokenCount } : {}),
    ...estimatedTextCostFields(model, inputTokens, outputTokens),
    pricingVersion: "2026-08-13",
  };
}

export function usageFromInteraction(
  model: string,
  usage: InteractionUsagePayload | undefined,
): GeminiUsageTelemetry | undefined {
  if (!usage) return undefined;

  return {
    ...(usage.total_input_tokens !== undefined ? { inputTokens: usage.total_input_tokens } : {}),
    ...(usage.total_output_tokens !== undefined ? { outputTokens: usage.total_output_tokens } : {}),
    ...(usage.total_thought_tokens !== undefined ? { thoughtTokens: usage.total_thought_tokens } : {}),
    ...(usage.total_tokens !== undefined ? { totalTokens: usage.total_tokens } : {}),
    ...(usage.service_tier ? { serviceTier: usage.service_tier } : {}),
    ...estimatedTextCostFields(model, usage.total_input_tokens, usage.total_output_tokens),
    pricingVersion: "2026-08-13",
  };
}
