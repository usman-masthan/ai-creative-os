import type { GeminiUsageTelemetry } from "../providers/geminiUsage.js";

export type FinalArtQaDecision = "PASS" | "REGENERATE" | "HUMAN_REVIEW" | "BLOCK";

export interface FinalArtQaRequest {
  imageBase64: string;
  mimeType: string;
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  layoutId: string;
  channel: string;
  assetType: string;
  width: number;
  height: number;
  expectedHeadline: string;
  expectedSupportingCopy: string;
  expectedCta: string;
  expectedPrice?: string;
  logoExpected: boolean;
}

export interface FinalArtQaScores {
  legibility: number;
  hierarchy: number;
  safeArea: number;
  contrast: number;
  brandFit: number;
  platformFit: number;
}

export interface FinalArtQaResult {
  provider: string;
  model: string;
  decision: FinalArtQaDecision;
  scores: FinalArtQaScores;
  issues: string[];
  notes: string[];
  usage?: GeminiUsageTelemetry;
}

export interface FinalArtQaProvider {
  providerName: string;
  model: string;
  review(request: FinalArtQaRequest): Promise<FinalArtQaResult>;
}
