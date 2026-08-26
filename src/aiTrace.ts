import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { FinalArtQaProvider, FinalArtQaRequest, FinalArtQaResult } from "./finalArtQa/types.js";
import type { ImageDraftProvider, ImageDraftRequest, ImageDraftResult } from "./imageProviders/types.js";
import type { CampaignGenerationProvider } from "./providers/types.js";
import type { VisualQaProvider, VisualQaRequest, VisualQaResult } from "./visualQa/types.js";

export type AiTraceTextStageName = "strategist" | "creativeDirector" | "finalizer";
export type AiTraceStageStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "NOT_IMPLEMENTED";

export interface AiTraceCall {
  attempt: number;
  provider: string;
  model: string;
  startedAt: string;
  completedAt?: string;
  prompt?: string;
  request?: unknown;
  response?: unknown;
  usage?: unknown;
  retryTrace?: unknown;
  costUsd?: number;
  error?: string;
}

export interface AiTraceStage {
  status: AiTraceStageStatus;
  note?: string;
  calls: AiTraceCall[];
  summary?: unknown;
}

export interface AiTraceDocument {
  version: 1;
  campaignId: string;
  createdAt: string;
  updatedAt: string;
  request?: unknown;
  intent?: unknown;
  truth?: unknown;
  strategist: AiTraceStage;
  creativeDirector: AiTraceStage;
  finalizer: AiTraceStage;
  briefCompiler: AiTraceStage;
  image: AiTraceStage;
  visualQa: AiTraceStage;
  renderer: AiTraceStage;
  finalArtQa: AiTraceStage;
  outcome?: unknown;
  failure?: {
    message: string;
    at: string;
  };
}

const SENSITIVE_KEY = /^(?:api[_-]?key|authorization|password|secret|imageBase64|dataBase64)$/i;
const GEMINI_KEY = /AIza[0-9A-Za-z_-]{20,}/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi;

function sanitizeString(value: string): string {
  const trimmed = value.trim();
  if (value.length > 512 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) {
    return `[REDACTED_BASE64:${value.length}]`;
  }
  return value
    .replace(GEMINI_KEY, "[REDACTED_GEMINI_KEY]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/gi, "[REDACTED_IMAGE_DATA_URL]");
}

export function sanitizeTraceValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeTraceValue(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key)
        ? `[REDACTED:${key}]`
        : sanitizeTraceValue(item);
    }
    return output;
  }
  return String(value);
}

function emptyStage(status: AiTraceStageStatus = "PENDING", note?: string): AiTraceStage {
  return {
    status,
    calls: [],
    ...(note ? { note } : {}),
  };
}

function observableProvider(provider: unknown): { lastUsage?: unknown; lastRetryTrace?: unknown } {
  if (!provider || typeof provider !== "object") return {};
  return provider as { lastUsage?: unknown; lastRetryTrace?: unknown };
}

export class AiTraceSession {
  readonly document: AiTraceDocument;

  constructor(campaignId: string, now = new Date().toISOString()) {
    this.document = {
      version: 1,
      campaignId,
      createdAt: now,
      updatedAt: now,
      strategist: emptyStage(),
      creativeDirector: emptyStage(),
      finalizer: emptyStage(),
      briefCompiler: emptyStage(
        "NOT_IMPLEMENTED",
        "Structured Brief Compiler is planned for M2. PR27 keeps the existing image-prompt path unchanged.",
      ),
      image: emptyStage(),
      visualQa: emptyStage(),
      renderer: emptyStage(),
      finalArtQa: emptyStage(),
    };
  }

  private touch(): void {
    this.document.updatedAt = new Date().toISOString();
  }

  setRequest(value: unknown): void {
    this.document.request = sanitizeTraceValue(value);
    this.touch();
  }

  setIntent(value: unknown): void {
    this.document.intent = sanitizeTraceValue(value);
    this.touch();
  }

  setTruth(value: unknown): void {
    this.document.truth = sanitizeTraceValue(value);
    this.touch();
  }

  markSkipped(stageName: "image" | "visualQa" | "renderer" | "finalArtQa", note: string): void {
    const stage = this.document[stageName];
    stage.status = "SKIPPED";
    stage.note = note;
    this.touch();
  }

  setStageSummary(
    stageName: AiTraceTextStageName | "image" | "visualQa" | "renderer" | "finalArtQa",
    summary: unknown,
  ): void {
    const stage = this.document[stageName];
    stage.summary = sanitizeTraceValue(summary);
    if (stage.status === "PENDING" && stage.calls.length === 0) stage.status = "COMPLETED";
    this.touch();
  }

  wrapCampaignProvider(
    stageName: AiTraceTextStageName,
    provider: CampaignGenerationProvider,
  ): CampaignGenerationProvider {
    const stage = this.document[stageName];
    return {
      providerName: provider.providerName,
      model: provider.model,
      generate: async (prompt: string): Promise<string> => {
        const call: AiTraceCall = {
          attempt: stage.calls.length + 1,
          provider: provider.providerName,
          model: provider.model,
          startedAt: new Date().toISOString(),
          prompt: sanitizeString(prompt),
        };
        stage.calls.push(call);
        stage.status = "RUNNING";
        this.touch();
        try {
          const response = await provider.generate(prompt);
          const observable = observableProvider(provider);
          call.response = sanitizeString(response);
          if (observable.lastUsage !== undefined) call.usage = sanitizeTraceValue(observable.lastUsage);
          if (observable.lastRetryTrace !== undefined) call.retryTrace = sanitizeTraceValue(observable.lastRetryTrace);
          call.completedAt = new Date().toISOString();
          stage.status = "COMPLETED";
          this.touch();
          return response;
        } catch (error) {
          const observable = observableProvider(provider);
          if (observable.lastUsage !== undefined) call.usage = sanitizeTraceValue(observable.lastUsage);
          if (observable.lastRetryTrace !== undefined) call.retryTrace = sanitizeTraceValue(observable.lastRetryTrace);
          call.error = error instanceof Error ? error.message : String(error);
          call.completedAt = new Date().toISOString();
          stage.status = "FAILED";
          this.touch();
          throw error;
        }
      },
    };
  }

  wrapImageProvider(provider: ImageDraftProvider): ImageDraftProvider {
    const stage = this.document.image;
    return {
      providerName: provider.providerName,
      model: provider.model,
      generate: async (request: ImageDraftRequest): Promise<ImageDraftResult> => {
        const call: AiTraceCall = {
          attempt: stage.calls.length + 1,
          provider: provider.providerName,
          model: provider.model,
          startedAt: new Date().toISOString(),
          request: sanitizeTraceValue(request),
          prompt: sanitizeString(request.prompt),
        };
        stage.calls.push(call);
        stage.status = "RUNNING";
        this.touch();
        try {
          const response = await provider.generate(request);
          call.response = sanitizeTraceValue(response);
          if (response.usage !== undefined) call.usage = sanitizeTraceValue(response.usage);
          if (response.costUsd !== undefined) call.costUsd = response.costUsd;
          call.completedAt = new Date().toISOString();
          stage.status = "COMPLETED";
          this.touch();
          return response;
        } catch (error) {
          call.error = error instanceof Error ? error.message : String(error);
          call.completedAt = new Date().toISOString();
          stage.status = "FAILED";
          this.touch();
          throw error;
        }
      },
    };
  }

  wrapVisualQaProvider(provider: VisualQaProvider): VisualQaProvider {
    const stage = this.document.visualQa;
    return {
      providerName: provider.providerName,
      model: provider.model,
      review: async (request: VisualQaRequest): Promise<VisualQaResult> => {
        const call: AiTraceCall = {
          attempt: stage.calls.length + 1,
          provider: provider.providerName,
          model: provider.model,
          startedAt: new Date().toISOString(),
          request: sanitizeTraceValue(request),
        };
        stage.calls.push(call);
        stage.status = "RUNNING";
        this.touch();
        try {
          const response = await provider.review(request);
          call.response = sanitizeTraceValue(response);
          if (response.usage !== undefined) call.usage = sanitizeTraceValue(response.usage);
          call.completedAt = new Date().toISOString();
          stage.status = "COMPLETED";
          this.touch();
          return response;
        } catch (error) {
          call.error = error instanceof Error ? error.message : String(error);
          call.completedAt = new Date().toISOString();
          stage.status = "FAILED";
          this.touch();
          throw error;
        }
      },
    };
  }

  wrapFinalArtQaProvider(provider: FinalArtQaProvider): FinalArtQaProvider {
    const stage = this.document.finalArtQa;
    return {
      providerName: provider.providerName,
      model: provider.model,
      review: async (request: FinalArtQaRequest): Promise<FinalArtQaResult> => {
        const call: AiTraceCall = {
          attempt: stage.calls.length + 1,
          provider: provider.providerName,
          model: provider.model,
          startedAt: new Date().toISOString(),
          request: sanitizeTraceValue(request),
        };
        stage.calls.push(call);
        stage.status = "RUNNING";
        this.touch();
        try {
          const response = await provider.review(request);
          call.response = sanitizeTraceValue(response);
          if (response.usage !== undefined) call.usage = sanitizeTraceValue(response.usage);
          call.completedAt = new Date().toISOString();
          stage.status = "COMPLETED";
          this.touch();
          return response;
        } catch (error) {
          call.error = error instanceof Error ? error.message : String(error);
          call.completedAt = new Date().toISOString();
          stage.status = "FAILED";
          this.touch();
          throw error;
        }
      },
    };
  }

  recordRendererStart(value: unknown): void {
    const stage = this.document.renderer;
    stage.status = "RUNNING";
    stage.calls.push({
      attempt: stage.calls.length + 1,
      provider: "deterministic",
      model: "html-css-poster-renderer",
      startedAt: new Date().toISOString(),
      request: sanitizeTraceValue(value),
    });
    this.touch();
  }

  recordRendererResult(value: unknown): void {
    const stage = this.document.renderer;
    const call = stage.calls.at(-1);
    if (call) {
      call.response = sanitizeTraceValue(value);
      call.completedAt = new Date().toISOString();
    }
    stage.status = "COMPLETED";
    this.touch();
  }

  recordRendererFailure(error: unknown): void {
    const stage = this.document.renderer;
    const call = stage.calls.at(-1);
    if (call) {
      call.error = error instanceof Error ? error.message : String(error);
      call.completedAt = new Date().toISOString();
    }
    stage.status = "FAILED";
    this.touch();
  }

  recordOutcome(value: unknown): void {
    this.document.outcome = sanitizeTraceValue(value);
    this.touch();
  }

  recordFailure(error: unknown): void {
    this.document.failure = {
      message: error instanceof Error ? error.message : String(error),
      at: new Date().toISOString(),
    };
    this.touch();
  }

  async persist(outputDir: string): Promise<string> {
    const directory = resolve(outputDir);
    await mkdir(directory, { recursive: true });
    const path = join(directory, "ai-trace.json");
    await writeFile(path, JSON.stringify(this.document, null, 2), "utf8");
    return path;
  }
}

export async function readAiTrace(outputDir: string): Promise<AiTraceDocument> {
  const path = join(resolve(outputDir), "ai-trace.json");
  return JSON.parse(await readFile(path, "utf8")) as AiTraceDocument;
}
