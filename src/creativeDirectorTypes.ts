export interface CreativeDirectorScores {
  strategicFit: number;
  brandFit: number;
  originality: number;
  emotionalStrength: number;
  conversionPotential: number;
  visualPotential: number;
  factualSafety: number;
  productionEfficiency: number;
}

export interface CreativeDirectorConceptReview {
  conceptId: "C1" | "C2" | "C3";
  scores: CreativeDirectorScores;
  totalScore: number;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
}

export interface CreativeDirectorReview {
  reviews: CreativeDirectorConceptReview[];
  winnerConceptId: "C1" | "C2" | "C3";
  winnerRationale: string;
  improvementDirectives: string[];
  escalation: {
    recommended: boolean;
    reasons: string[];
  };
}

export interface CreativeDirectorTrace {
  director: {
    provider: string;
    model: string;
  };
  finalizer: {
    provider: string;
    model: string;
  };
  review: CreativeDirectorReview;
  finalization: {
    attempts: number;
    repairs: number;
  };
}
