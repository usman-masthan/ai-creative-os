import type { FinalArtQaResult } from "./finalArtQa/types.js";
import type { TruthRecord } from "./types.js";
import type { VisualQaResult } from "./visualQa/types.js";

export const M3_EXIT_BRAND_AWARENESS_REQUEST =
  "Create an emotional ATTHA'S Burger brand awareness post for Instagram. No offer and no price.";
export const M3_EXIT_VISIT_TONIGHT_REQUEST =
  "Get more customers to Wellampitiya tonight with a strong Instagram post.";
export const M3_EXIT_FAMILY_DINING_REQUEST =
  "Create a premium family-dining campaign for ATTHA'S Restaurant Wellawatte.";

export const M3_EXIT_SYNTHETIC_SOURCE = "M2_EXIT_SYNTHETIC_DO_NOT_PUBLISH";

export interface M3ExitBranchMaster {
  tenantId: "T001";
  sourceId: string;
  status: "VERIFIED";
  branches: Array<{
    branchId: string;
    brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
    name: string;
    canonicalPhysicalAddress: string;
    officialPhone: string;
    physicalOpeningHours: { daily: string };
  }>;
}

export function createM3ExitBranchTruthRecords(
  master: M3ExitBranchMaster,
  branchId: string,
): TruthRecord[] {
  const branch = master.branches.find((item) => item.branchId === branchId);
  if (!branch) throw new Error(`M3 exit calibration branch ${branchId} is not in the owner-confirmed branch master.`);
  return [
    {
      key: "branchPhysicalAddress",
      value: branch.canonicalPhysicalAddress,
      status: master.status,
      sourceId: master.sourceId,
      scope: {
        tenantId: master.tenantId,
        brandId: branch.brandId,
        branchId: branch.branchId,
      },
    },
    {
      key: "physicalOpeningHours",
      value: branch.physicalOpeningHours.daily,
      status: master.status,
      sourceId: master.sourceId,
      scope: {
        tenantId: master.tenantId,
        brandId: branch.brandId,
        branchId: branch.branchId,
      },
    },
  ];
}

export function assertM3ExitCalibrationAllowed(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (env.M3_CALIBRATION_ALLOW_SYNTHETIC?.trim().toLowerCase() !== "true") {
    throw new Error(
      "M3 exit calibration includes the synthetic Chicken Tikka Wrap fixture. Set M3_CALIBRATION_ALLOW_SYNTHETIC=true to run it intentionally.",
    );
  }
  if (env.ALLOW_PAID_MEDIA?.trim().toLowerCase() !== "true") {
    throw new Error(
      "M3 exit calibration exercises paid Gemini image generation. Set ALLOW_PAID_MEDIA=true to authorize model spend.",
    );
  }
  if (!env.GEMINI_API_KEY?.trim()) {
    throw new Error("M3 exit calibration requires GEMINI_API_KEY for the live Gemini round.");
  }
}

export type M3ExitScore = 0 | 1 | 2 | 3;

export interface M3ExitScoreInput {
  status: string;
  visualQa?: VisualQaResult;
  finalArtQa?: FinalArtQaResult;
  error?: string;
}

export interface M3ExitScoreResult {
  score: M3ExitScore;
  targetPass: boolean;
  materialIssues: string[];
  rationale: string;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function scoreM3ExitScenario(input: M3ExitScoreInput): M3ExitScoreResult {
  const materialIssues = unique([
    ...(input.visualQa?.issues ?? []),
    ...(input.visualQa?.unexpectedVisibleElements ?? []),
    ...(input.finalArtQa?.issues ?? []),
    ...(input.error ? [input.error] : []),
  ]);

  if (input.status !== "FINAL_RENDERED") {
    const hardBlock = input.status.startsWith("BLOCKED_") || Boolean(input.error);
    return {
      score: hardBlock ? 3 : 2,
      targetPass: false,
      materialIssues,
      rationale: hardBlock
        ? "Calibration did not reach final art because truth, governance, infrastructure, or another hard production gate blocked it."
        : "Calibration did not reach a passing final poster and requires diagnosis or human review.",
    };
  }

  if (!input.finalArtQa || input.finalArtQa.decision !== "PASS") {
    return {
      score: 2,
      targetPass: false,
      materialIssues,
      rationale: "A FINAL_RENDERED calibration result must also have M3.3 Final Art QA PASS.",
    };
  }

  const score: M3ExitScore = materialIssues.length === 0 ? 0 : materialIssues.length === 1 ? 1 : 2;
  return {
    score,
    targetPass: score <= 1,
    materialIssues,
    rationale:
      score === 0
        ? "All automated production gates passed with no material QA issues."
        : score === 1
          ? "All automated production gates passed with one residual material QA issue; manual review decides acceptability."
          : "Two or more material QA issues remain despite final rendering; diagnose via AI Trace before production validation.",
  };
}
