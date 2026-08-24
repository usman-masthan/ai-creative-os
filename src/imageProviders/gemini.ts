import {
  geminiImageModelForRole,
  type GeminiImageRole,
} from "../providers/geminiModels.js";
import {
  estimateImageOutputCostUsd,
  usageFromInteraction,
  type GeminiUsageTelemetry,
} from "../providers/geminiUsage.js";
import type {
  ImageDraftProvider,
  ImageDraftRequest,
  ImageDraftResult,
} from "./types.js";

interface GeminiImageProviderOptions {
  apiKey?: string;
  role?: GeminiImageRole;
  model?: string;
  baseUrl?: string;
  defaultResolution?: string;
  fetchImpl?: typeof fetch;
}

interface GeminiInteractionResponse {
  id?: string;
  usage?: {
    total_tokens?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
    service_tier?: string;
  };
  steps?: Array<{
    content?: Array<{
      type?: string;
      data?: string;
      mime_type?: string;
      mimeType?: string;
    }>;
  }>;
  output_image?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  error?: {
    message?: string;
    status?: string;
  };
}

function mimeTypeForOutputFormat(format: ImageDraftRequest["outputFormat"]): string {
  switch (format) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

function normalizeResolution(value: string | undefined, fallback: string): string {
  const resolution = (value ?? fallback).trim().toUpperCase();
  if (!resolution) return fallback;
  return resolution === "512PX" ? "0.5K" : resolution;
}

function extractImage(body: GeminiInteractionResponse): { dataBase64: string; mimeType: string } | undefined {
  for (const step of body.steps ?? []) {
    for (const content of step.content ?? []) {
      if (content.type !== "image" || !content.data) continue;
      return {
        dataBase64: content.data,
        mimeType: content.mime_type ?? content.mimeType ?? "image/jpeg",
      };
    }
  }

  if (body.output_image?.data) {
    return {
      dataBase64: body.output_image.data,
      mimeType: body.output_image.mime_type ?? body.output_image.mimeType ?? "image/jpeg",
    };
  }

  return undefined;
}

export class GeminiImageProvider implements ImageDraftProvider {
  readonly providerName = "gemini";
  readonly role: GeminiImageRole;
  readonly model: string;
  lastUsage?: GeminiUsageTelemetry;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultResolution: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiImageProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error("GEMINI_API_KEY is required to use GeminiImageProvider.");
    }

    this.apiKey = apiKey.trim();
    this.role = options.role ?? "draft";
    this.model = options.model?.trim() || geminiImageModelForRole(this.role);
    this.baseUrl =
      options.baseUrl?.replace(/\/$/, "") ??
      "https://generativelanguage.googleapis.com/v1beta";
    this.defaultResolution = options.defaultResolution?.trim() || "1K";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(request: ImageDraftRequest): Promise<ImageDraftResult> {
    const prompt = request.prompt.trim();
    if (!prompt) {
      throw new Error("Gemini image prompt cannot be empty.");
    }

    const resolution = normalizeResolution(request.resolution, this.defaultResolution);
    if (this.model === "gemini-3.1-flash-lite-image" && resolution !== "1K") {
      throw new Error("Nano Banana 2 Lite only supports 1K output in Creative OS.");
    }

    const mimeType = mimeTypeForOutputFormat(request.outputFormat);
    const response = await this.fetchImpl(`${this.baseUrl}/interactions`, {
      method: "POST",
      headers: {
        "x-goog-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt,
        response_format: {
          type: "image",
          mime_type: mimeType,
          aspect_ratio: request.aspectRatio,
          image_size: resolution,
        },
      }),
    });

    let body: GeminiInteractionResponse;
    try {
      body = (await response.json()) as GeminiInteractionResponse;
    } catch {
      throw new Error(`Gemini image API returned a non-JSON response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Gemini image generation failed: ${detail}`);
    }

    const image = extractImage(body);
    if (!image) {
      throw new Error("Gemini image generation succeeded but returned no image data.");
    }

    this.lastUsage = usageFromInteraction(this.model, body.usage);
    const outputCost = estimateImageOutputCostUsd(this.model, resolution);

    return {
      provider: this.providerName,
      model: this.model,
      ...(body.id ? { requestId: body.id } : {}),
      dataBase64: image.dataBase64,
      mimeType: image.mimeType,
      ...(outputCost !== undefined ? { costUsd: outputCost } : {}),
      ...(this.lastUsage ? { usage: this.lastUsage } : {}),
    };
  }
}
