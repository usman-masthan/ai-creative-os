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

export type VisualCopyZoneId =
  | "upperLeft"
  | "upperRight"
  | "lowerLeft"
  | "lowerRight";

export type VisualCopyZoneRating = "GOOD" | "ACCEPTABLE" | "POOR";
export type VisualCompositionMatch = "MATCH" | "ACCEPTABLE" | "MISMATCH";

export interface VisualQaCompositionExpectation {
  heroPosition?: string;
  heroScale?: string;
  cropBehavior?: string;
  requestedQuietZones?: VisualCopyZoneId[];
}

export interface VisualQaCompositionEvidence {
  heroPlacement: VisualCompositionMatch;
  heroScale: VisualCompositionMatch;
  cropQuality: VisualCopyZoneRating;
  copyZones: Record<VisualCopyZoneId, VisualCopyZoneRating>;
  notes: string[];
}

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
  verifiedCookingMethods?: string[];
  foodTemplateId?: string;
  mustInclude?: string[];
  mustNotInclude?: string[];
  compositionRequirements?: string[];
  compositionExpectation?: VisualQaCompositionExpectation;
  approvedReferenceImageIds?: string[];
}

export interface VisualQaScores {
  productTruth: number;
  brandFit: number;
  realism: number;
  foodTexture: number;
  composition: number;
  copyZoneSuitability: number;
  governance: number;
  rights: number;
}

export type VisualQaEvidenceStatus = "PASS" | "CONCERN" | "FAIL";

export interface VisualQaDimensionEvidence {
  status: VisualQaEvidenceStatus;
  observations: string[];
}

export type VisualQaScoreEvidence = {
  [K in keyof VisualQaScores]: VisualQaDimensionEvidence;
};

export interface VisualQaResult {
  provider: string;
  model: string;
  decision: VisualQaDecision;
  scores: VisualQaScores;
  scoreEvidence?: VisualQaScoreEvidence;
  issues: string[];
  observedIngredients: string[];
  unexpectedVisibleElements: string[];
  notes: string[];
  compositionEvidence?: VisualQaCompositionEvidence;
  usage?: GeminiUsageTelemetry;
}

export interface VisualQaProvider {
  providerName: string;
  model: string;
  review(request: VisualQaRequest): Promise<VisualQaResult>;
}
