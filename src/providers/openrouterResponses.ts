import type { CampaignGenerationProvider } from "./types.js";

export interface OpenRouterResponsesProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  maxRateLimitRetries?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
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

function parseRetryAfterMs(response: Response): number | undefined {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const timestamp = Date.parse(retryAfter);
  if (Number.isFinite(timestamp)) {
    return Math.max(0, timestamp - Date.now());
  }

  return undefined;
}

export class OpenRouterResponsesProvider implements CampaignGenerationProvider {
  readonly providerName = "openrouter";
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly maxRateLimitRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;

  constructor(options: OpenRouterResponsesProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required to use OpenRouterResponsesProvider.",
      );
    }

    this.apiKey = apiKey;
    this.model =
      options.model ?? process.env.OPENROUTER_CAMPAIGN_MODEL ?? "openrouter/free";
    this.baseUrl = options.baseUrl ?? "https://openrouter.ai/api/v1";
    this.maxOutputTokens = options.maxOutputTokens ?? 3000;
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl =
      options.sleepImpl ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async generate(prompt: string): Promise<string> {
    let rateLimitRetries = 0;

    while (true) {
      const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/usman-masthan/ai-creative-os",
          "X-Title": "AI Creative OS",
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

        if (response.status === 429 && rateLimitRetries < this.maxRateLimitRetries) {
          rateLimitRetries += 1;
          const waitMs = parseRetryAfterMs(response) ?? 5000;
          console.error(
            `OpenRouter rate limit reached. Waiting ${Math.ceil(waitMs / 1000)}s before retry ${rateLimitRetries}/${this.maxRateLimitRetries}...`,
          );
          await this.sleepImpl(waitMs);
          continue;
        }

        throw new Error(`OpenRouter Responses API request failed: ${detail}`);
      }

      const outputText = extractOutputText(body);

      if (!outputText) {
        throw new Error("OpenRouter Responses API returned no output text.");
      }

      return outputText;
    }
  }
}
