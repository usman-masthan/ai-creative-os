import assert from "node:assert/strict";
import test from "node:test";

import {
  assertM3ExitCalibrationAllowed,
  createM3ExitBranchTruthRecords,
  M3_EXIT_BRAND_AWARENESS_REQUEST,
  M3_EXIT_FAMILY_DINING_REQUEST,
  M3_EXIT_VISIT_TONIGHT_REQUEST,
  scoreM3ExitScenario,
  type M3ExitBranchMaster,
} from "../src/m3ExitCalibration.js";
import { interpretAtthasTaskRequest } from "../src/ui/taskIntent.js";

const branchMaster: M3ExitBranchMaster = {
  tenantId: "T001",
  sourceId: "OWNER_BRANCH_MASTER_2026_08_25",
  status: "VERIFIED",
  branches: [
    {
      branchId: "BURGER_WELLAMPITIYA",
      brandId: "ATTHAS_BURGER",
      name: "ATTHA’S Burger — Wellampitiya",
      canonicalPhysicalAddress: "Urban City Food Court, Ambagaha Junction Rd, Kotikawatta",
      officialPhone: "+94 76 630 6890",
      physicalOpeningHours: { daily: "17:00-00:00" },
    },
  ],
};

test("M3 exit reuses the exact three original calibration intents", () => {
  const awareness = interpretAtthasTaskRequest(M3_EXIT_BRAND_AWARENESS_REQUEST);
  assert.equal(awareness.brandId, "ATTHAS_BURGER");
  assert.equal(awareness.branchScope, "BRAND_WIDE");
  assert.equal(awareness.campaignType, "BRAND_BUILDING");
  assert.equal(awareness.showPrice, false);

  const visit = interpretAtthasTaskRequest(M3_EXIT_VISIT_TONIGHT_REQUEST);
  assert.equal(visit.brandId, "ATTHAS_BURGER");
  assert.equal(visit.branchScope, "BURGER_WELLAMPITIYA");
  assert.equal(visit.campaignType, "DINE_IN");

  const family = interpretAtthasTaskRequest(M3_EXIT_FAMILY_DINING_REQUEST);
  assert.equal(family.brandId, "ATTHAS_RESTAURANT");
  assert.equal(family.branchScope, "RESTAURANT_COLOMBO_06");
  assert.equal(family.campaignType, "DINE_IN");
});

test("branch calibration truth is owner-confirmed and exactly scoped", () => {
  const records = createM3ExitBranchTruthRecords(branchMaster, "BURGER_WELLAMPITIYA");
  assert.deepEqual(records.map((record) => record.key), ["branchPhysicalAddress", "physicalOpeningHours"]);
  assert.ok(records.every((record) => record.status === "VERIFIED"));
  assert.ok(records.every((record) => record.scope.branchId === "BURGER_WELLAMPITIYA"));
  assert.throws(
    () => createM3ExitBranchTruthRecords(branchMaster, "UNKNOWN"),
    /not in the owner-confirmed branch master/,
  );
});

test("M3 live calibration requires explicit synthetic and paid-media opt in plus Gemini", () => {
  assert.throws(
    () => assertM3ExitCalibrationAllowed({}),
    /M3_CALIBRATION_ALLOW_SYNTHETIC=true/,
  );
  assert.throws(
    () => assertM3ExitCalibrationAllowed({ M3_CALIBRATION_ALLOW_SYNTHETIC: "true" }),
    /ALLOW_PAID_MEDIA=true/,
  );
  assert.throws(
    () => assertM3ExitCalibrationAllowed({
      M3_CALIBRATION_ALLOW_SYNTHETIC: "true",
      ALLOW_PAID_MEDIA: "true",
    }),
    /GEMINI_API_KEY/,
  );
  assert.doesNotThrow(() => assertM3ExitCalibrationAllowed({
    M3_CALIBRATION_ALLOW_SYNTHETIC: "true",
    ALLOW_PAID_MEDIA: "true",
    GEMINI_API_KEY: "test-key",
  }));
});

test("M3 exit score maps clean final art to zero and one residual issue to one", () => {
  const base = {
    provider: "fixture",
    model: "fixture",
    decision: "PASS" as const,
    scores: {
      brandVisibility: 95,
      headlineHierarchy: 95,
      ctaHierarchyPlacement: 95,
      priceVisibility: 100,
      safeAreas: 95,
      contrastLegibility: 95,
      productDominance: 100,
      platformReadability: 100,
      decorativeCoherence: 95,
    },
    checks: {
      brandVisibility: "PASS" as const,
      headlineHierarchy: "PASS" as const,
      ctaHierarchyPlacement: "PASS" as const,
      priceVisibility: "NOT_APPLICABLE" as const,
      safeAreas: "PASS" as const,
      contrastLegibility: "PASS" as const,
      productDominance: "NOT_APPLICABLE" as const,
      platformReadability: "NOT_APPLICABLE" as const,
      decorativeCoherence: "PASS" as const,
    },
    issues: [] as string[],
    notes: [] as string[],
  };

  assert.deepEqual(scoreM3ExitScenario({ status: "FINAL_RENDERED", finalArtQa: base }).score, 0);
  assert.deepEqual(
    scoreM3ExitScenario({
      status: "FINAL_RENDERED",
      finalArtQa: { ...base, issues: ["Minor residual issue"] },
    }).score,
    1,
  );
});

test("M3 exit score sends two issues or non-final outcomes to diagnosis", () => {
  const result = scoreM3ExitScenario({
    status: "FINAL_RENDERED",
    finalArtQa: {
      provider: "fixture",
      model: "fixture",
      decision: "PASS",
      scores: {
        brandVisibility: 95,
        headlineHierarchy: 95,
        ctaHierarchyPlacement: 95,
        priceVisibility: 100,
        safeAreas: 95,
        contrastLegibility: 95,
        productDominance: 100,
        platformReadability: 100,
        decorativeCoherence: 95,
      },
      checks: {
        brandVisibility: "PASS",
        headlineHierarchy: "PASS",
        ctaHierarchyPlacement: "PASS",
        priceVisibility: "NOT_APPLICABLE",
        safeAreas: "PASS",
        contrastLegibility: "PASS",
        productDominance: "NOT_APPLICABLE",
        platformReadability: "NOT_APPLICABLE",
        decorativeCoherence: "PASS",
      },
      issues: ["Issue one", "Issue two"],
      notes: [],
    },
  });
  assert.equal(result.score, 2);
  assert.equal(result.targetPass, false);

  assert.equal(scoreM3ExitScenario({ status: "HUMAN_REVIEW_REQUIRED" }).score, 2);
  assert.equal(scoreM3ExitScenario({ status: "BLOCKED_VISUAL_QA" }).score, 3);
  assert.equal(scoreM3ExitScenario({ status: "ERROR", error: "boom" }).score, 3);
});
