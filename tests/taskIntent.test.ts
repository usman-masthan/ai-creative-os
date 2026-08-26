import assert from "node:assert/strict";
import test from "node:test";

import {
  interpretAtthasTaskRequest,
  normalizeAtthasTaskIntent,
} from "../src/ui/taskIntent.js";

test("natural-language dine-in request resolves the correct Burger branch", () => {
  const intent = interpretAtthasTaskRequest(
    "Get more customers to Wellampitiya tonight with a strong Instagram post.",
  );
  assert.equal(intent.brandId, "ATTHAS_BURGER");
  assert.equal(intent.branchScope, "BURGER_WELLAMPITIYA");
  assert.equal(intent.campaignType, "DINE_IN");
  assert.equal(intent.channel, "instagram");
  assert.deepEqual(intent.missingFields, []);
});

test("quoted product request preserves product scope and price sales channel", () => {
  const intent = interpretAtthasTaskRequest(
    'Promote "Beef Cheese Burger" at Bambalapitiya with the dine-in price on Instagram.',
  );
  assert.equal(intent.productId, "Beef Cheese Burger");
  assert.equal(intent.branchScope, "BURGER_MARINE_DRIVE_C04");
  assert.equal(intent.campaignType, "PRODUCT_PUSH");
  assert.equal(intent.showPrice, true);
  assert.equal(intent.salesChannel, "DINE_IN");

  const normalized = normalizeAtthasTaskIntent(intent);
  assert.ok(normalized.entry.requiredTruth.includes("productName"));
  assert.ok(normalized.entry.requiredTruth.includes("branchAvailability"));
  assert.ok(normalized.entry.requiredTruth.includes("approvedProductVisual"));
  assert.ok(normalized.entry.requiredTruth.includes("price"));
  assert.equal(normalized.requirementScopes.price?.productId, "Beef Cheese Burger");
  assert.equal(normalized.requirementScopes.price?.salesChannel, "DINE_IN");
});

test("price-bearing task cannot proceed without an explicit sales channel", () => {
  const intent = interpretAtthasTaskRequest(
    'Promote "Beef Cheese Burger" at Kollupitiya and show the price.',
  );
  assert.equal(intent.branchScope, "BURGER_HEY_MARINE_C03");
  assert.ok(intent.missingFields.includes("salesChannel"));
  assert.throws(
    () => normalizeAtthasTaskIntent(intent),
    /sales channel/i,
  );
});

test("Wellawatte maps to the canonical Restaurant branch master id", () => {
  const intent = interpretAtthasTaskRequest(
    "Bring more family dinner visits to ATTHA'S Restaurant Wellawatte tonight.",
  );
  assert.equal(intent.brandId, "ATTHAS_RESTAURANT");
  assert.equal(intent.branchScope, "RESTAURANT_COLOMBO_06");
  assert.equal(intent.campaignType, "DINE_IN");
});

test("explicit no-offer and no-price language is respected", () => {
  const intent = interpretAtthasTaskRequest(
    "Create an emotional ATTHA'S Burger brand awareness post for Instagram. No offer and no price.",
  );
  assert.equal(intent.brandId, "ATTHAS_BURGER");
  assert.equal(intent.branchScope, "BRAND_WIDE");
  assert.equal(intent.campaignType, "BRAND_BUILDING");
  assert.equal(intent.showPrice, false);
  assert.equal(intent.salesChannel, undefined);
  assert.deepEqual(intent.missingFields, []);
});
