import type { ImageDraftProvider } from "./imageProviders/types.js";
import type { VisualQaResult } from "./visualQa/types.js";

export type ImageQualityTier = "FLASH_LITE" | "FLASH" | "PRO";

export interface ImageQualityTierProviders {
  FLASH_LITE: ImageDraftProvider;
  FLASH: ImageDraftProvider;
  PRO: ImageDraftProvider;
}

export type ImageQualityDimension =
  | "productTruth"
  | "realism"
  | "foodTexture"
  | "composition"
  | "governance";

export interface ImageQualityThresholds {
  productTruth: number;
  realism: number;
  foodTexture: number;
  composition: number;
  governance: number;
}

export const PROVISIONAL_M2_IMAGE_QA_THRESHOLDS = {
  calibrationStatus: "PROVISIONAL_UNTIL_20_IMAGE_CALIBRATION",
  calibrationTargetImages: 20,
  FLASH_LITE: {
    productTruth: 85,
    realism: 80,
    foodTexture: 78,
    composition: 80,
    governance: 90,
  },
  FLASH: {
    productTruth: 90,
    realism: 85,
    foodTexture: 82,
    composition: 83,
    governance: 90,
  },
  PRO: {
    // The roadmap does not define a separate Pro threshold. Pro must at least
    // meet the higher Flash Image pass bar; otherwise it cannot auto-pass.
    productTruth: 90,
    realism: 85,
    foodTexture: 82,
    composition: 83,
    governance: 90,
  },
} as const;

export type ImageQualityGateAction =
  | "PASS"
  | "ESCALATE"
  | "HUMAN_REVIEW"
  | "BLOCK";

export interface ImageQualityGateResult {
  tier: ImageQualityTier;
  action: ImageQualityGateAction;
  nextTier?: ImageQualityTier;
  failedDimensions: Array<{
    dimension: ImageQualityDimension;
    score: number;
    minimum: number;
  }>;
  reasons: string[];
}

const DIMENSIONS: ImageQualityDimension[] = [
  "productTruth",
  "realism",
  "foodTexture",
  "composition",
  "governance",
];

export function nextImageQualityTier(tier: ImageQualityTier): ImageQualityTier | undefined {
  switch (tier) {
    case "FLASH_LITE":
      return "FLASH";
    case "FLASH":
      return "PRO";
    case "PRO":
      return undefined;
  }
}

export function imageQualityThresholdsForTier(
  tier: ImageQualityTier,
): ImageQualityThresholds {
  const thresholds = PROVISIONAL_M2_IMAGE_QA_THRESHOLDS[tier];
  return {
    productTruth: thresholds.productTruth,
    realism: thresholds.realism,
    foodTexture: thresholds.foodTexture,
    composition: thresholds.composition,
    governance: thresholds.governance,
  };
}

export function evaluateImageQualityGate(input: {
  tier: ImageQualityTier;
  qa: VisualQaResult;
}): ImageQualityGateResult {
  const thresholds = imageQualityThresholdsForTier(input.tier);
  const failedDimensions = DIMENSIONS.flatMap((dimension) => {
    const score = input.qa.scores[dimension];
    const minimum = thresholds[dimension];
    return score < minimum ? [{ dimension, score, minimum }] : [];
  });

  if (input.qa.decision === "BLOCK") {
    return {
      tier: input.tier,
      action: "BLOCK",
      failedDimensions,
      reasons: ["Visual QA returned BLOCK."],
    };
  }

  if (input.qa.decision === "HUMAN_REVIEW") {
    return {
      tier: input.tier,
      action: "HUMAN_REVIEW",
      failedDimensions,
      reasons: ["Visual QA explicitly requires human review."],
    };
  }

  const reasons: string[] = [];
  if (input.qa.decision === "REGENERATE") {
    reasons.push("Visual QA requested regeneration.");
  }
  for (const failure of failedDimensions) {
    reasons.push(
      `${failure.dimension} ${failure.score} is below the provisional ${input.tier} minimum ${failure.minimum}.`,
    );
  }

  const qualifies = input.qa.decision === "PASS" && failedDimensions.length === 0;
  if (qualifies) {
    return {
      tier: input.tier,
      action: "PASS",
      failedDimensions: [],
      reasons: [],
    };
  }

  const nextTier = nextImageQualityTier(input.tier);
  if (nextTier) {
    return {
      tier: input.tier,
      action: "ESCALATE",
      nextTier,
      failedDimensions,
      reasons: reasons.length ? reasons : ["Image did not qualify for automatic pass."],
    };
  }

  return {
    tier: input.tier,
    action: "HUMAN_REVIEW",
    failedDimensions,
    reasons: [
      ...reasons,
      "Premium image tier is terminal; another automatic generation is not allowed.",
    ],
  };
}
