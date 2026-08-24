import {
  geminiVideoModelForRole,
  type GeminiVideoRole,
} from "../providers/geminiModels.js";
import { estimateVideoCostUsd } from "../providers/geminiUsage.js";
import type {
  VideoGenerationProvider,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "./types.js";

interface GeminiVeoProviderOptions {
  apiKey?: string;
  role?: GeminiVideoRole;
  model?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  fetchImpl?: typeof fetch;
  sleepFn?: (milliseconds: number) => Promise<void>;
}

interface VeoStartResponse {
  name?: string;
  error?: { message?: string };
}

interface VeoStatusResponse {
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: {
          uri?: string;
        };
      }>;
    };
  };
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class GeminiVeoProvider implements VideoGenerationProvider {
  readonly providerName = "gemini";
  readonly role: GeminiVideoRole;
  readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxPollAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepFn: (milliseconds: number) => Promise<void>;

  constructor(options: GeminiVeoProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error("GEMINI_API_KEY is required to use GeminiVeoProvider.");
    }

    this.apiKey = apiKey.trim();
    this.role = options.role ?? "lite";
    this.model = options.model?.trim() || geminiVideoModelForRole(this.role);
    this.baseUrl =
      options.baseUrl?.replace(/\/$/, "") ??
      "https://generativelanguage.googleapis.com/v1beta";
    this.pollIntervalMs = options.pollIntervalMs ?? 10_000;
    this.maxPollAttempts = options.maxPollAttempts ?? 60;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleepFn = options.sleepFn ?? sleep;
  }

  async generate(request: VideoGenerationRequest): Promise<VideoGenerationResult> {
    const prompt = request.prompt.trim();
    if (!prompt) {
      throw new Error("Veo prompt cannot be empty.");
    }

    const durationSeconds = request.durationSeconds ?? 4;
    const resolution = request.resolution ?? "720p";
    const aspectRatio = request.aspectRatio ?? "16:9";

    if (this.role === "lite" && resolution === "4k") {
      throw new Error("Veo 3.1 Lite does not support 4k output.");
    }

    const startResponse = await this.fetchImpl(
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:predictLongRunning`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            durationSeconds,
            resolution,
            aspectRatio,
          },
        }),
      },
    );

    let startBody: VeoStartResponse;
    try {
      startBody = (await startResponse.json()) as VeoStartResponse;
    } catch {
      throw new Error(`Veo submission returned a non-JSON response (HTTP ${startResponse.status}).`);
    }

    if (!startResponse.ok) {
      const detail = startBody.error?.message ?? `HTTP ${startResponse.status}`;
      throw new Error(`Veo submission failed: ${detail}`);
    }

    const operationName = startBody.name;
    if (!operationName) {
      throw new Error("Veo submission succeeded but returned no operation name.");
    }

    let finalStatus: VeoStatusResponse | undefined;

    for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
      if (attempt > 0) {
        await this.sleepFn(this.pollIntervalMs);
      }

      const statusResponse = await this.fetchImpl(`${this.baseUrl}/${operationName}`, {
        headers: {
          "x-goog-api-key": this.apiKey,
        },
      });

      let statusBody: VeoStatusResponse;
      try {
        statusBody = (await statusResponse.json()) as VeoStatusResponse;
      } catch {
        throw new Error(`Veo status returned a non-JSON response (HTTP ${statusResponse.status}).`);
      }

      if (!statusResponse.ok) {
        const detail = statusBody.error?.message ?? `HTTP ${statusResponse.status}`;
        throw new Error(`Veo status request failed: ${detail}`);
      }

      if (statusBody.error?.message) {
        throw new Error(`Veo generation failed: ${statusBody.error.message}`);
      }

      if (statusBody.done) {
        finalStatus = statusBody;
        break;
      }
    }

    if (!finalStatus) {
      throw new Error(
        `Veo generation timed out after ${this.maxPollAttempts} status checks.`,
      );
    }

    const videoUri =
      finalStatus.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("Veo generation completed but returned no video URI.");
    }

    const downloadResponse = await this.fetchImpl(videoUri, {
      headers: {
        "x-goog-api-key": this.apiKey,
      },
    });

    if (!downloadResponse.ok) {
      throw new Error(`Veo video download failed with HTTP ${downloadResponse.status}.`);
    }

    const data = new Uint8Array(await downloadResponse.arrayBuffer());
    if (data.byteLength < 1_000) {
      throw new Error(`Veo returned an unexpectedly small video payload (${data.byteLength} bytes).`);
    }

    const costUsd = estimateVideoCostUsd(this.model, durationSeconds, resolution);

    return {
      provider: this.providerName,
      model: this.model,
      operationName,
      data,
      mimeType: "video/mp4",
      durationSeconds,
      resolution,
      aspectRatio,
      ...(costUsd !== undefined ? { costUsd } : {}),
    };
  }
}
