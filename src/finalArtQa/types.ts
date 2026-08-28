import type { GeminiUsageTelemetry } from "../providers/geminiUsage.js";

export type FinalArtQaDecision = "PASS" | "REGENERATE" | "HUMAN_REVIEW" | "BLOCK";
export type FinalArtQaCheckState = "PASS" | "FAIL" | "NOT_APPLICABLE";

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
  expectedProductName?: string;
  expectedPlatforms?: string[];
  logoExpected: boolean;
}

export interface FinalArtQaScores {
  brandVisibility: number;
  headlineHierarchy: number;
  ctaHierarchyPlacement: number;
  priceVisibility: number;
  safeAreas: number;
  contrastLegibility: number;
  productDominance: number;
  platformReadability: number;
  decorativeCoherence: number;
}

export interface FinalArtQaChecks {
  brandVisibility: FinalArtQaCheckState;
  headlineHierarchy: FinalArtQaCheckState;
  ctaHierarchyPlacement: FinalArtQaCheckState;
  priceVisibility: FinalArtQaCheckState;
  safeAreas: FinalArtQaCheckState;
  contrastLegibility: FinalArtQaCheckState;
  productDominance: FinalArtQaCheckState;
  platformReadability: FinalArtQaCheckState;
  decorativeCoherence: FinalArtQaCheckState;
}

export interface FinalArtQaResult {
  provider: string;
  model: string;
  decision: FinalArtQaDecision;
  scores: FinalArtQaScores;
  checks: FinalArtQaChecks;
  issues: string[];
  notes: string[];
  usage?: GeminiUsageTelemetry;
}

export interface FinalArtQaProvider {
  providerName: string;
  model: string;
  review(request: FinalArtQaRequest): Promise<FinalArtQaResult>;
}
