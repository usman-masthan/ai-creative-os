import test from "node:test";
import assert from "node:assert/strict";

import { interpretAtthasTaskRequest, normalizeAtthasTaskIntent } from "../src/ui/taskIntent.js";
import {
  WORKSPACE_PRODUCTION_PROFILE,
  assertWorkspaceProductionTruth,
  assertWorkspaceUploadedAssetMatchesTask,
  buildWorkspaceVisualQaContext,
  coerceWorkspaceTruthValue,
  assertWorkspaceProductPhotoApproval,
  type WorkspaceUploadedAsset,
} from "../src/dashboard/workspaceProduction.js";
import type { TaskTruthSnapshot } from "../src/taskTruth.js";

function snapshot(values: Record<string, unknown>): TaskTruthSnapshot {
  return {
    schemaVersion: 1,
    sessionId: "task-1",
    campaignId: "C1",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    confirmedBy: "owner",
    confirmedAt: "2026-08-28T00:00:00.000Z",
    facts: Object.entries(values).map(([key, value]) => ({
      label: key,
      key,
      value,
      scope: { tenantId: "T001", brandId: "ATTHAS_BURGER", branchId: "BURGER_WELLAMPITIYA", productId: "Crispy Chicken Burger" },
      confirmationAction: "PROVIDE",
      updateStoredTruthRequested: false,
    })),
  };
}

const asset: WorkspaceUploadedAsset = {
  schemaVersion: 1,
  assetId: "asset-1",
  sessionId: "task-1",
  campaignId: "C1",
  filename: "burger.jpg",
  path: "/tmp/burger.jpg",
  mimeType: "image/jpeg",
  bytes: 10000,
  brandId: "ATTHAS_BURGER",
  branchId: "BURGER_WELLAMPITIYA",
  productId: "Crispy Chicken Burger",
  sourceType: "owner_supplied",
  approvedForAds: true,
  appearanceVerified: true,
  ingredientMatchVerified: true,
  createdAt: "2026-08-28T00:00:00.000Z",
};

test("Marketing Manager always uses the calibrated M2/M3 production profile", () => {
  assert.deepEqual(WORKSPACE_PRODUCTION_PROFILE, {
    useStructuredBrief: true,
    useFoodComposer: true,
    useNewRenderer: true,
  });
});

test("natural-language featuring product is extracted without manual repetition", () => {
  const intent = interpretAtthasTaskRequest("Create an Instagram product post for ATTHA'S Burger Wellampitiya featuring Crispy Chicken Burger. No offer.");
  assert.equal(intent.productId, "Crispy Chicken Burger");
  assert.equal(intent.campaignType, "PRODUCT_PUSH");
  assert.ok(!intent.missingFields.includes("productId"));
});

test("product workspace asks for visible product truth needed by generation and QA", () => {
  const normalized = normalizeAtthasTaskIntent({
    ...interpretAtthasTaskRequest("Feature Crispy Chicken Burger at ATTHA'S Burger Wellampitiya."),
    mode: "FINAL",
  });
  assert.ok(normalized.entry.requiredTruth.includes("ingredients"));
  assert.ok(normalized.entry.requiredTruth.includes("mustInclude"));
  assert.ok(normalized.entry.requiredTruth.includes("mustNotInclude"));
});

test("workspace truth values are typed instead of frozen as arbitrary strings", () => {
  assert.equal(coerceWorkspaceTruthValue("branchAvailability", "yes"), true);
  assert.equal(coerceWorkspaceTruthValue("branchAvailability", "no"), false);
  assert.equal(coerceWorkspaceTruthValue("price", "1,230"), 1230);
  assert.deepEqual(coerceWorkspaceTruthValue("ingredients", "bun, chicken; lettuce\nsauce"), ["bun", "chicken", "lettuce", "sauce"]);
  assert.throws(() => coerceWorkspaceTruthValue("approvedProductVisual", "yes"));
});

test("real product photo must be an approved bound asset", () => {
  const s = snapshot({
    productName: "Crispy Chicken Burger",
    branchAvailability: true,
    approvedProductVisual: "APPROVED_REAL_PRODUCT_PHOTO",
    ingredients: ["bun", "crispy chicken", "cheese", "tomato", "lettuce", "sauce"],
    mustInclude: [],
    mustNotInclude: [],
  });
  assert.throws(() => assertWorkspaceProductionTruth({ snapshot: s, campaignType: "PRODUCT_PUSH" }), /no governed photo asset/i);
  assert.doesNotThrow(() => assertWorkspaceProductionTruth({ snapshot: s, campaignType: "PRODUCT_PUSH", uploadedAsset: asset }));
});

test("real uploaded product photo becomes VERIFIED_PRODUCT_VISUAL with cleared deterministic rights", () => {
  const s = snapshot({
    productName: "Crispy Chicken Burger",
    branchAvailability: true,
    approvedProductVisual: "APPROVED_REAL_PRODUCT_PHOTO",
    ingredients: ["bun", "crispy chicken", "cheese", "tomato", "lettuce", "sauce"],
    mustInclude: ["crispy chicken"],
    mustNotInclude: ["pickles"],
  });
  const context = buildWorkspaceVisualQaContext({ campaignType: "PRODUCT_PUSH", snapshot: s, uploadedAsset: asset });
  assert.equal(context.visualClass, "VERIFIED_PRODUCT_VISUAL");
  assert.equal(context.rightsStatus, "cleared");
  assert.deepEqual(context.approvedReferenceImageIds, ["asset-1"]);
  assert.deepEqual(context.verifiedVisibleIngredients, ["bun", "crispy chicken", "cheese", "tomato", "lettuce", "sauce"]);
});

test("uploaded asset cannot cross campaign/product scope", () => {
  assert.doesNotThrow(() => assertWorkspaceUploadedAssetMatchesTask({
    asset,
    campaignId: "C1",
    sessionId: "task-1",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    productId: "Crispy Chicken Burger",
  }));
  assert.throws(() => assertWorkspaceUploadedAssetMatchesTask({
    asset,
    campaignId: "C1",
    sessionId: "task-1",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    productId: "Different Burger",
  }), /product binding mismatch/i);
});


test("product photo binding refuses incomplete approval metadata", () => {
  assert.throws(() => assertWorkspaceProductPhotoApproval({
    productId: "Crispy Chicken Burger",
    approvedForAds: true,
    appearanceVerified: false,
    ingredientMatchVerified: true,
  }), /product appearance verification/i);
  assert.doesNotThrow(() => assertWorkspaceProductPhotoApproval({
    productId: "Crispy Chicken Burger",
    approvedForAds: true,
    appearanceVerified: true,
    ingredientMatchVerified: true,
  }));
});
