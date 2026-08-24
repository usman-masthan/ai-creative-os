import type { GeminiUsageTelemetry } from "../providers/geminiUsage.js";

export interface ImageDraftRequest {
  prompt: string;
  aspectRatio: string;
  resolution?: string;
  outputFormat?: "jpeg" | "png" | "webp";
}

export interface ImageDraftResult {
  provider: string;
  model: string;
  requestId?: string;
  imageUrl?: string;
  dataBase64?: string;
  mimeType?: string;
  costUsd?: number;
  usage?: GeminiUsageTelemetry;
}

export interface ImageDraftProvider {
  providerName: string;
  model: string;
  generate(request: ImageDraftRequest): Promise<ImageDraftResult>;
}
