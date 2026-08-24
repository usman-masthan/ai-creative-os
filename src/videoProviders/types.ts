export interface VideoGenerationRequest {
  prompt: string;
  durationSeconds?: 4 | 6 | 8;
  resolution?: "720p" | "1080p" | "4k";
  aspectRatio?: "16:9" | "9:16";
}

export interface VideoGenerationResult {
  provider: string;
  model: string;
  operationName: string;
  data: Uint8Array;
  mimeType: "video/mp4";
  durationSeconds: number;
  resolution: string;
  aspectRatio: string;
  costUsd?: number;
}

export interface VideoGenerationProvider {
  providerName: string;
  model: string;
  generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
}
