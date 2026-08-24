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
  imageUrl: string;
  costUsd?: number;
}

export interface ImageDraftProvider {
  providerName: string;
  model: string;
  generate(request: ImageDraftRequest): Promise<ImageDraftResult>;
}
