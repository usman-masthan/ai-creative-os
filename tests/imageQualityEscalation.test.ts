import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateImageQualityGate,
  imageQualityThresholdsForTier,
  nextImageQualityTier,
  PROVISIONAL_M2_IMAGE_QA_THRESHOLDS,
} from "../src/imageQualityEscalation.js";
import type { VisualQaResult } from "../src/visualQa/types.js";

function qa(overrides: Partial<VisualQaResult["scores"]> = {}, decision: VisualQaResult["decision"] = "PASS"): VisualQaResult {
  return {
    provider: "mock-qa",
    model: "mock-qa-model",
    decision,
    scores: {
      productTruth: 95,
      brandFit: 90,
      realism: 90,
      foodTexture: 88,
      composition: 90,
      copyZoneSuitability: 90,
      governance: 95,
      rights: 100,
      ...overrides,
    },
    issues: [],
    observedIngredients: [],
    unexpectedVisibleElements: [],
    notes: [],
  };
}

test("M2 escalation thresholds remain explicitly provisional until 20-image calibration", () => {
  assert.equal(PROVISIONAL_M2_IMAGE_QA_THRESHOLDS.calibrationStatus, "PROVISIONAL_UNTIL_20_IMAGE_CALIBRATION");
  assert.equal(PROVISIONAL_M2_IMAGE_QA_THRESHOLDS.calibrationTargetImages, 20);
  assert.deepEqual(imageQualityThresholdsForTier("FLASH_LITE"), {
    productTruth: 85,
    realism: 80,
    foodTexture: 78,
    composition: 80,
    governance: 90,
  });
  assert.deepEqual(imageQualityThresholdsForTier("FLASH"), {
    productTruth: 90,
    realism: 85,
    foodTexture: 82,
    composition: 83,
    governance: 90,
  });
});

test("image quality tiers have a finite Flash Lite -> Flash -> Pro ladder", () => {
  assert.equal(nextImageQualityTier("FLASH_LITE"), "FLASH");
  assert.equal(nextImageQualityTier("FLASH"), "PRO");
  assert.equal(nextImageQualityTier("PRO"), undefined);
});

test("a PASS below the Flash Lite threshold escalates to Flash", () => {
  const result = evaluateImageQualityGate({
    tier: "FLASH_LITE",
    qa: qa({ productTruth: 84 }),
  });
  assert.equal(result.action, "ESCALATE");
  assert.equal(result.nextTier, "FLASH");
  assert.deepEqual(result.failedDimensions.map((item) => item.dimension), ["productTruth"]);
});

test("a qualifying Flash result passes without spending on Pro", () => {
  const result = evaluateImageQualityGate({ tier: "FLASH", qa: qa() });
  assert.equal(result.action, "PASS");
  assert.equal(result.nextTier, undefined);
  assert.deepEqual(result.failedDimensions, []);
});

test("Pro is terminal and below-threshold output routes to human review", () => {
  const result = evaluateImageQualityGate({
    tier: "PRO",
    qa: qa({ composition: 82 }),
  });
  assert.equal(result.action, "HUMAN_REVIEW");
  assert.equal(result.nextTier, undefined);
  assert.ok(result.reasons.some((reason) => reason.includes("terminal")));
});

test("explicit Visual QA BLOCK is never escalated to a more expensive model", () => {
  const result = evaluateImageQualityGate({ tier: "FLASH_LITE", qa: qa({}, "BLOCK") });
  assert.equal(result.action, "BLOCK");
  assert.equal(result.nextTier, undefined);
});
