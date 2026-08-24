import type { GeminiUsageTelemetry } from "../providers/geminiUsage.js";

export interface AudioGenerationRequest {
  text: string;
  voice?: string;
}

export interface AudioGenerationResult {
  provider: string;
  model: string;
  requestId?: string;
  dataBase64: string;
  mimeType: string;
  sampleRateHz: number;
  channels: number;
  bitsPerSample: number;
  usage?: GeminiUsageTelemetry;
}

export interface AudioGenerationProvider {
  providerName: string;
  model: string;
  generate(request: AudioGenerationRequest): Promise<AudioGenerationResult>;
}
