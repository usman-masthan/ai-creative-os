import type { GeminiUsageTelemetry } from "../providers/geminiUsage.js";

export type VisualClass =
  | "VERIFIED_PRODUCT_VISUAL"
  | "CONSTRAINED_PRODUCT_GENERATION"
  | "GENERIC_CONCEPT_VISUAL";

export type VisualQaDecision =
  | "PASS"
  | "REGENERATE"
  | "HUMAN_REVIEW"
  | "BLOCK";

export type VisualRightsStatus = "cleared" | "unknown" | "blocked";

export interface VisualQaRequest {
  imageBase64: string;
  mimeType: string;
  brandId: "ATTHAS_MASTER" | "ATTHAS_RESTAURANT" | "ATTHAS_BURGER";
  branchId?: string;
  productId?: string;
  productName?: string;
  visualClass: VisualClass;
  rightsStatus: VisualRightsStatus;
  verifiedVisibleIngredients?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  compositionRequirements?: string[];
  approvedReferenceImageIds?: string[];
}

export interface VisualQaScores {
  productTruth: number;
  brandFit: number;
  realism: number;
  composition: number;
  governance: number;
  rights: number;
}

export interface VisualQaResult {
  provider: string;
  model: string;
  decision: VisualQaDecision;
  scores: VisualQaScores;
  issues: string[];
  observedIngredients: string[];
  unexpectedVisibleElements: string[];
  notes: string[];
  usage?: GeminiUsageTelemetry;
}

export interface VisualQaProvider {
  providerName: string;
  model: string;
  review(request: VisualQaRequest): Promise<VisualQaResult>;
}
