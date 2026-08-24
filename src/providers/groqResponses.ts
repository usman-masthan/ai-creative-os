import type { CampaignGenerationProvider } from "./types.js";

export interface GroqResponsesProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  maxRateLimitRetries?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (milliseconds: number) => Promise<void>;
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

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseRetryAfterMilliseconds(response: Response, detail: string): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number.parseFloat(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1000) + 250;
    }
  }

  const messageMatch = detail.match(/try again in\s+([0-9.]+)s/i);
  if (messageMatch?.[1]) {
    const seconds = Number.parseFloat(messageMatch[1]);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1000) + 250;
    }
  }

  return 60_000;
}

export class GroqResponsesProvider implements CampaignGenerationProvider {
  readonly providerName = "groq";
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly maxRateLimitRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (milliseconds: number) => Promise<void>;

  constructor(options: GroqResponsesProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error("GROQ_API_KEY is required to use GroqResponsesProvider.");
    }

    this.apiKey = apiKey;
    this.model =
      options.model ?? process.env.GROQ_CAMPAIGN_MODEL ?? "openai/gpt-oss-120b";
    this.baseUrl = options.baseUrl ?? "https://api.groq.com/openai/v1";
    this.maxOutputTokens = options.maxOutputTokens ?? 3000;
    this.maxRateLimitRetries = options.maxRateLimitRetries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepImpl = options.sleepImpl ?? defaultSleep;
  }

  async generate(prompt: string): Promise<string> {
    let rateLimitRetries = 0;

    while (true) {
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

        if (response.status === 429 && rateLimitRetries < this.maxRateLimitRetries) {
          rateLimitRetries += 1;
          const waitMilliseconds = parseRetryAfterMilliseconds(response, detail);
          console.error(
            `Groq rate limit reached. Waiting ${Math.ceil(waitMilliseconds / 1000)}s before retry ${rateLimitRetries}/${this.maxRateLimitRetries}...`,
          );
          await this.sleepImpl(waitMilliseconds);
          continue;
        }

        throw new Error(`Groq Responses API request failed: ${detail}`);
      }

      const outputText = extractOutputText(body);

      if (!outputText) {
        throw new Error("Groq Responses API returned no output text.");
      }

      return outputText;
    }
  }
}
