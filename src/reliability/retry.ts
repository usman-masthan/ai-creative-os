import type { ImageDraftProvider, ImageDraftRequest, ImageDraftResult } from "../imageProviders/types.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import type { VisualQaProvider, VisualQaRequest, VisualQaResult } from "../visualQa/types.js";

export interface RetryPolicy {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RetryTrace {
  attempts: number;
  retries: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isTransientProviderError(error: unknown): boolean {
  const status = (error as { status?: unknown })?.status;
  if (status === 429 || status === 503) return true;
  const text = error instanceof Error ? error.message : String(error);
  return /\b429\b|\b503\b|RESOURCE_EXHAUSTED|UNAVAILABLE|temporar(?:y|ily)|rate limit/i.test(text);
}

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = {},
): Promise<{ value: T; trace: RetryTrace }> {
  const maxAttempts = policy.maxAttempts ?? 4;
  const baseDelayMs = policy.baseDelayMs ?? 250;
  const maxDelayMs = policy.maxDelayMs ?? 4_000;
  const sleep = policy.sleep ?? defaultSleep;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 8) {
    throw new Error("Retry maxAttempts must be an integer from 1 to 8.");
  }
  if (baseDelayMs < 0 || maxDelayMs < 0) throw new Error("Retry delays cannot be negative.");

  let attempts = 0;
  while (true) {
    attempts += 1;
    try {
      return { value: await operation(), trace: { attempts, retries: attempts - 1 } };
    } catch (error) {
      if (attempts >= maxAttempts || !isTransientProviderError(error)) throw error;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempts - 1));
      await sleep(delay);
    }
  }
}

export class RetryingCampaignProvider implements CampaignGenerationProvider {
  readonly providerName: string;
  readonly model: string;
  lastTrace: RetryTrace | undefined;

  constructor(
    private readonly inner: CampaignGenerationProvider,
    private readonly policy: RetryPolicy = {},
  ) {
    this.providerName = inner.providerName;
    this.model = inner.model;
  }

  async generate(prompt: string): Promise<string> {
    const result = await withTransientRetry(() => this.inner.generate(prompt), this.policy);
    this.lastTrace = result.trace;
    return result.value;
  }
}

export class RetryingImageProvider implements ImageDraftProvider {
  readonly providerName: string;
  readonly model: string;
  lastTrace: RetryTrace | undefined;

  constructor(
    private readonly inner: ImageDraftProvider,
    private readonly policy: RetryPolicy = {},
  ) {
    this.providerName = inner.providerName;
    this.model = inner.model;
  }

  async generate(request: ImageDraftRequest): Promise<ImageDraftResult> {
    const result = await withTransientRetry(() => this.inner.generate(request), this.policy);
    this.lastTrace = result.trace;
    return result.value;
  }
}

export class RetryingVisualQaProvider implements VisualQaProvider {
  readonly providerName: string;
  readonly model: string;
  lastTrace: RetryTrace | undefined;

  constructor(
    private readonly inner: VisualQaProvider,
    private readonly policy: RetryPolicy = {},
  ) {
    this.providerName = inner.providerName;
    this.model = inner.model;
  }

  async review(request: VisualQaRequest): Promise<VisualQaResult> {
    const result = await withTransientRetry(() => this.inner.review(request), this.policy);
    this.lastTrace = result.trace;
    return result.value;
  }
}
