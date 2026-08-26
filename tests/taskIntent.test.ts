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

test("family-dining phrasing resolves to dine-in", () => {
  const intent = interpretAtthasTaskRequest(
    "Create a premium family-dining campaign for ATTHA'S Restaurant Wellawatte.",
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

test("complex product brief is decomposed without treating incidental delivery wording as the campaign type", () => {
  const request = "Create a premium 4:5 social media poster for ATTHA’S Chicken Tikka Wrap, using the supplied KFC artwork only as inspiration for composition, hierarchy and high-impact QSR advertising energy, while keeping the design fully original to ATTHA’S. Use a dark charcoal-black background with subtle smoke, ember accents and faint food illustrations, bold white and ATTHA’S-red typography, and the headline “UNWRAP THE FLAVOUR” with “CHICKEN TIKKA WRAP” clearly beneath it. Make the hero product a highly realistic, generously filled wrap with smoky orange-red grilled chicken tikka, light char, creamy sauce, lettuce, onion, tomato and coriander, presented in premium ATTHA’S-branded wrapping with dramatic studio lighting and appetising texture. Add a clean red price card showing only the verified price, and include only verified branch, phone, website or delivery information in the footer.";
  const intent = interpretAtthasTaskRequest(request);

  assert.equal(intent.brandId, undefined);
  assert.equal(intent.branchScope, "BRAND_WIDE");
  assert.equal(intent.productId, "Chicken Tikka Wrap");
  assert.equal(intent.campaignType, "PRODUCT_PUSH");
  assert.equal(intent.showPrice, true);
  assert.equal(intent.salesChannel, undefined);
  assert.equal(intent.lockedHeadline, "UNWRAP THE FLAVOUR");
  assert.equal(intent.lockedSubheadline, "CHICKEN TIKKA WRAP");
  assert.equal(intent.packagingDirectionRequested, true);
  assert.ok(intent.requestedProductClaims?.some((claim) => /tomato/i.test(claim)));
  assert.ok(intent.missingFields.includes("brandId"));
  assert.ok(intent.missingFields.includes("branchScope"));
  assert.ok(intent.missingFields.includes("salesChannel"));

  const normalized = normalizeAtthasTaskIntent({
    ...intent,
    brandId: "ATTHAS_RESTAURANT",
    branchScope: "RESTAURANT_COLOMBO_06",
    salesChannel: "DINE_IN",
  });
  assert.ok(normalized.entry.requiredTruth.includes("requestedProductClaims"));
  assert.ok(normalized.entry.requiredTruth.includes("approvedPackagingDirection"));
  assert.ok(normalized.entry.requiredTruth.includes("price"));
  assert.equal(normalized.requirementScopes.requestedProductClaims?.productId, "Chicken Tikka Wrap");
  assert.equal(normalized.requirementScopes.price?.salesChannel, "DINE_IN");
  assert.match(normalized.entry.conceptDirection, /LOCKED HEADLINE.*UNWRAP THE FLAVOUR/i);
  assert.equal(
    normalized.entry.truthConfirmationHints?.requestedProductClaims,
    "smoky orange-red grilled chicken tikka; light char; creamy sauce; lettuce; onion; tomato; coriander",
  );
});
