export interface SubjectSegmentationRequest {
  imageBase64: string;
  mimeType: string;
  width?: number;
  height?: number;
  subjectHint?: string;
}

export interface SubjectSegmentationResult {
  foregroundBase64: string;
  backgroundBase64: string;
  foregroundMimeType: "image/png" | "image/svg+xml";
  backgroundMimeType: "image/png" | "image/jpeg" | "image/webp";
  confidence?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface SubjectSegmentationProvider {
  providerName: string;
  model: string;
  segment(request: SubjectSegmentationRequest): Promise<SubjectSegmentationResult>;
}
