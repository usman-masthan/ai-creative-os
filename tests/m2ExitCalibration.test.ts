import assert from "node:assert/strict";
import test from "node:test";

import {
  assertM2ExitSyntheticCalibrationAllowed,
  createM2ExitSyntheticTruthRecords,
  M2_EXIT_CALIBRATION_PRODUCT_ID,
  M2_EXIT_CALIBRATION_SOURCE,
  summarizeM2ExitVisualQa,
} from "../src/m2ExitCalibration.js";
import type { VisualQaResult } from "../src/visualQa/types.js";

function qa(overrides: Partial<VisualQaResult> = {}): VisualQaResult {
  return {
    provider: "mock-qa",
    model: "mock-qa-model",
    decision: "PASS",
    scores: {
      productTruth: 95,
      brandFit: 90,
      realism: 90,
      foodTexture: 88,
      composition: 90,
      copyZoneSuitability: 90,
      governance: 95,
      rights: 100,
    },
    issues: [],
    observedIngredients: [],
    unexpectedVisibleElements: [],
    notes: [],
    compositionEvidence: {
      heroPlacement: "MATCH",
      heroScale: "MATCH",
      cropQuality: "GOOD",
      copyZones: {
        upperLeft: "GOOD",
        upperRight: "POOR",
        lowerLeft: "ACCEPTABLE",
        lowerRight: "POOR",
      },
      notes: [],
    },
    ...overrides,
  };
}

test("M2 exit calibration requires explicit synthetic and paid-media authorization", () => {
  assert.throws(
    () => assertM2ExitSyntheticCalibrationAllowed({}),
    /M2_CALIBRATION_ALLOW_SYNTHETIC=true/,
  );
  assert.throws(
    () =>
      assertM2ExitSyntheticCalibrationAllowed({
        M2_CALIBRATION_ALLOW_SYNTHETIC: "true",
      }),
    /ALLOW_PAID_MEDIA=true/,
  );
  assert.doesNotThrow(() =>
    assertM2ExitSyntheticCalibrationAllowed({
      M2_CALIBRATION_ALLOW_SYNTHETIC: "true",
      ALLOW_PAID_MEDIA: "true",
    }),
  );
});

test("synthetic Chicken Tikka calibration facts are scoped and tagged do-not-publish", () => {
  const records = createM2ExitSyntheticTruthRecords();
  assert.ok(records.length >= 4);
  for (const record of records) {
    assert.equal(record.sourceId, M2_EXIT_CALIBRATION_SOURCE);
    assert.equal(record.scope.productId, M2_EXIT_CALIBRATION_PRODUCT_ID);
    assert.equal(record.scope.brandId, "ATTHAS_RESTAURANT");
  }
  assert.deepEqual(
    records.map((record) => record.key),
    ["productName", "branchAvailability", "approvedProductVisual", "ingredients"],
  );
});

test("M2 exit automated QA passes only with strong scores and composition evidence", () => {
  const summary = summarizeM2ExitVisualQa(qa());
  assert.equal(summary.automatedPass, true);
  assert.equal(summary.copyZoneEvidencePresent, true);
  assert.equal(summary.manualReviewRequired, true);
});

test("graphic leakage blocks M2 exit even when model scores are high", () => {
  const summary = summarizeM2ExitVisualQa(
    qa({ unexpectedVisibleElements: ["dark rectangle behind the headline area"] }),
  );
  assert.equal(summary.graphicLeakageObserved, true);
  assert.equal(summary.automatedPass, false);
});

test("missing copy-zone evidence blocks automated M2 exit", () => {
  const result = qa();
  delete result.compositionEvidence;
  const summary = summarizeM2ExitVisualQa(result);
  assert.equal(summary.copyZoneEvidencePresent, false);
  assert.equal(summary.automatedPass, false);
});
