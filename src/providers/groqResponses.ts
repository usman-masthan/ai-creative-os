import type { CampaignGenerationProvider } from "./types.js";

export interface GroqResponsesProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

interface ResponsesApiBody {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

function extractOutputText(body: ResponsesApiBody): string {
  const chunks: string[] = [];

  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

export class GroqResponsesProvider implements CampaignGenerationProvider {
  readonly providerName = "groq";
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GroqResponsesProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error("GROQ_API_KEY is required to use GroqResponsesProvider.");
    }

    this.apiKey = apiKey;
    this.model =
      options.model ?? process.env.GROQ_CAMPAIGN_MODEL ?? "openai/gpt-oss-120b";
    this.baseUrl = options.baseUrl ?? "https://api.groq.com/openai/v1";
    this.maxOutputTokens = options.maxOutputTokens ?? 3500;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(prompt: string): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt,
        max_output_tokens: this.maxOutputTokens,
      }),
    });

    const body = (await response.json()) as ResponsesApiBody;

    if (!response.ok) {
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Groq Responses API request failed: ${detail}`);
    }

    const outputText = extractOutputText(body);

    if (!outputText) {
      throw new Error("Groq Responses API returned no output text.");
    }

    return outputText;
  }
}
