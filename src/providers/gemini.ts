import { GEMINI_MODEL_STACK } from "./geminiModels.js";
import type { CampaignGenerationProvider } from "./types.js";

interface GeminiCampaignProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
}

function extractText(body: GeminiGenerateContentResponse): string {
  const chunks: string[] = [];

  for (const candidate of body.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

export class GeminiCampaignProvider implements CampaignGenerationProvider {
  readonly providerName = "gemini";
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiCampaignProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;

    if (!apiKey?.trim()) {
      throw new Error("GEMINI_API_KEY is required to use GeminiCampaignProvider.");
    }

    this.apiKey = apiKey.trim();
    this.model =
      options.model?.trim() ||
      process.env.GEMINI_CAMPAIGN_MODEL?.trim() ||
      GEMINI_MODEL_STACK.text.default;
    this.baseUrl =
      options.baseUrl?.replace(/\/$/, "") ??
      "https://generativelanguage.googleapis.com/v1beta";
    this.maxOutputTokens = options.maxOutputTokens ?? 3500;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(prompt: string): Promise<string> {
    if (!prompt.trim()) {
      throw new Error("Gemini campaign prompt cannot be empty.");
    }

    const response = await this.fetchImpl(
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: this.maxOutputTokens,
          },
        }),
      },
    );

    let body: GeminiGenerateContentResponse;
    try {
      body = (await response.json()) as GeminiGenerateContentResponse;
    } catch {
      throw new Error(`Gemini API returned a non-JSON response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Gemini API request failed: ${detail}`);
    }

    const outputText = extractText(body);
    if (!outputText) {
      throw new Error("Gemini API returned no output text.");
    }

    return outputText;
  }
}

export function createGeminiCampaignProvider(
  options: GeminiCampaignProviderOptions = {},
): CampaignGenerationProvider {
  return new GeminiCampaignProvider(options);
}
