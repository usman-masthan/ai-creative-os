import type { TruthRecord } from "./types.js";
import type { VisualQaCompositionEvidence, VisualQaResult } from "./visualQa/types.js";

export const M2_EXIT_CALIBRATION_SOURCE = "M2_EXIT_SYNTHETIC_DO_NOT_PUBLISH";
export const M2_EXIT_CALIBRATION_PRODUCT_ID = "CALIBRATION_CHICKEN_TIKKA_WRAP";
export const M2_EXIT_CALIBRATION_PRODUCT_NAME = "Chicken Tikka Wrap";
export const M2_EXIT_CALIBRATION_BRANCH_ID = "RESTAURANT_COLOMBO_06";
export const M2_EXIT_CALIBRATION_INGREDIENTS = [
  "chicken tikka",
  "tortilla",
  "sauce",
  "lettuce",
  "onion",
  "tomato",
  "coriander",
] as const;

export function assertM2ExitSyntheticCalibrationAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.M2_CALIBRATION_ALLOW_SYNTHETIC?.trim().toLowerCase() !== "true") {
    throw new Error(
      "M2 exit calibration is synthetic and non-publishable. Set M2_CALIBRATION_ALLOW_SYNTHETIC=true to run it intentionally.",
    );
  }
  if (env.ALLOW_PAID_MEDIA?.trim().toLowerCase() !== "true") {
    throw new Error(
      "M2 exit calibration exercises paid image generation. Set ALLOW_PAID_MEDIA=true to authorize model spend.",
    );
  }
}

export function createM2ExitSyntheticTruthRecords(): TruthRecord[] {
  const scope = {
    tenantId: "T001" as const,
    brandId: "ATTHAS_RESTAURANT",
    branchId: M2_EXIT_CALIBRATION_BRANCH_ID,
    productId: M2_EXIT_CALIBRATION_PRODUCT_ID,
  };
  return [
    {
      key: "productName",
      value: M2_EXIT_CALIBRATION_PRODUCT_NAME,
      status: "VERIFIED",
      sourceId: M2_EXIT_CALIBRATION_SOURCE,
      scope,
    },
    {
      key: "branchAvailability",
      value: true,
      status: "VERIFIED",
      sourceId: M2_EXIT_CALIBRATION_SOURCE,
      scope,
    },
    {
      key: "approvedProductVisual",
      value: "GENERATED_CALIBRATION_VISUAL_ONLY",
      status: "VERIFIED",
      sourceId: M2_EXIT_CALIBRATION_SOURCE,
      scope,
    },
    {
      key: "ingredients",
      value: [...M2_EXIT_CALIBRATION_INGREDIENTS],
      status: "VERIFIED",
      sourceId: M2_EXIT_CALIBRATION_SOURCE,
      scope,
    },
  ];
}

export interface M2ExitCalibrationQaSummary {
  automatedPass: boolean;
  manualReviewRequired: true;
  graphicLeakageObserved: boolean;
  scoreChecks: {
    productTruth: boolean;
    realism: boolean;
    foodTexture: boolean;
    composition: boolean;
    governance: boolean;
  };
  copyZoneEvidencePresent: boolean;
  copyZones?: VisualQaCompositionEvidence["copyZones"];
  issues: string[];
  unexpectedVisibleElements: string[];
}

const GRAPHIC_LEAKAGE = /\b(?:dark rectangle|rectangle|graphic panel|cta panel|headline panel|banner|badge|label|logo|price|watermark|generated text)\b/i;

export function summarizeM2ExitVisualQa(qa: VisualQaResult): M2ExitCalibrationQaSummary {
  const searchable = [...qa.issues, ...qa.unexpectedVisibleElements, ...qa.notes].join("\n");
  const graphicLeakageObserved = GRAPHIC_LEAKAGE.test(searchable);
  const scoreChecks = {
    productTruth: qa.scores.productTruth >= 90,
    realism: qa.scores.realism >= 85,
    foodTexture: qa.scores.foodTexture >= 82,
    composition: qa.scores.composition >= 83,
    governance: qa.scores.governance >= 90,
  };
  const copyZoneEvidencePresent = Boolean(qa.compositionEvidence?.copyZones);
  return {
    automatedPass:
      qa.decision === "PASS" &&
      !graphicLeakageObserved &&
      Object.values(scoreChecks).every(Boolean) &&
      copyZoneEvidencePresent,
    manualReviewRequired: true,
    graphicLeakageObserved,
    scoreChecks,
    copyZoneEvidencePresent,
    ...(qa.compositionEvidence?.copyZones
      ? { copyZones: qa.compositionEvidence.copyZones }
      : {}),
    issues: [...qa.issues],
    unexpectedVisibleElements: [...qa.unexpectedVisibleElements],
  };
}
