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

interface OpenRouterApiBody {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  status?: string;
  error?: {
    message?: string;
  } | null;
  incomplete_details?: {
    reason?: string;
  } | null;
}

function extractOutputText(body: OpenRouterApiBody): string {
  // Chat Completions is the primary OpenRouter path because response_format
  // is mature there and lets the free router select structured-output-capable
  // models/providers. Keep Responses shapes as defensive compatibility fallbacks.
  const chunks: string[] = [];

  for (const choice of body.choices ?? []) {
    const content = choice.message?.content;

    if (typeof content === "string" && content.trim()) {
      chunks.push(content);
      continue;
    }

    if (Array.isArray(content)) {
      for (const part of content) {
        if (typeof part.text === "string" && part.text.trim()) {
          chunks.push(part.text);
        }
      }
    }
  }

  if (chunks.length > 0) {
    return chunks.join("\n").trim();
  }

  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }

  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        (content.type === "output_text" || content.type === "text" || !content.type) &&
        typeof content.text === "string" &&
        content.text.trim()
      ) {
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
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/usman-masthan/ai-creative-os",
          "X-Title": "AI Creative OS",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: this.maxOutputTokens,
          response_format: {
            type: "json_object",
          },
          provider: {
            require_parameters: true,
          },
        }),
      });

      const body = (await response.json()) as OpenRouterApiBody;

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

        throw new Error(`OpenRouter API request failed: ${detail}`);
      }

      if (body.error?.message) {
        throw new Error(`OpenRouter API response error: ${body.error.message}`);
      }

      const outputText = extractOutputText(body);

      if (!outputText) {
        const status = body.status ? ` status=${body.status}.` : "";
        const incompleteReason = body.incomplete_details?.reason
          ? ` incomplete_reason=${body.incomplete_details.reason}.`
          : "";
        throw new Error(
          `OpenRouter API returned no output text.${status}${incompleteReason}`,
        );
      }

      return outputText;
    }
  }
}
