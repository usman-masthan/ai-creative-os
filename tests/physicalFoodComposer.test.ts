import assert from "node:assert/strict";
import test from "node:test";

import {
  composeDeterministicFoodSubject,
  composeDeterministicFoodSubjectFromFacts,
  selectPhysicalFoodTemplate,
} from "../src/physicalFoodComposer.js";
import type { VerifiedFact } from "../src/types.js";

function fact(key: string, value: unknown, verified = true): VerifiedFact {
  return { key, value, verified, status: verified ? "VERIFIED" : "MISSING" };
}

test("deterministic food composer selects stable physical template families", () => {
  assert.equal(selectPhysicalFoodTemplate("Crispy Chicken Burger"), "BURGER_STACK");
  assert.equal(selectPhysicalFoodTemplate("Chicken Wrap"), "WRAP_ROLL");
  assert.equal(selectPhysicalFoodTemplate("Club Sandwich"), "SANDWICH_STACK");
  assert.equal(selectPhysicalFoodTemplate("Chicken Kebab"), "KEBAB_CLUSTER");
  assert.equal(selectPhysicalFoodTemplate("Chicken Biryani"), "RICE_OR_CURRY_PLATE");
  assert.equal(selectPhysicalFoodTemplate("House Special"), "GENERIC_FOOD_HERO");
});

test("deterministic food composer uses only supplied ingredients and no invented cooking method", () => {
  const result = composeDeterministicFoodSubject({
    productName: "Chicken Burger",
    confirmedIngredients: ["chicken fillet", "lettuce", "sauce", "burger bun"],
  });

  assert.equal(result.templateId, "BURGER_STACK");
  assert.deepEqual(result.confirmedIngredients, [
    "chicken fillet",
    "lettuce",
    "sauce",
    "burger bun",
  ]);
  assert.deepEqual(result.confirmedCookingMethods, []);

  const subjectText = Object.values(result.subject).join("\n").toLowerCase();
  assert.match(subjectText, /chicken fillet/);
  assert.match(subjectText, /lettuce/);
  assert.match(subjectText, /sauce/);
  assert.match(subjectText, /burger bun/);
  assert.match(subjectText, /do not imply a cooking method/);
  assert.match(subjectText, /do not add quality adjectives|without implying flavour, freshness or quantity/);
  assert.doesNotMatch(subjectText, /\bgrilled\b|\bfried\b|\bsmoked\b/);
  assert.doesNotMatch(
    subjectText,
    /\b(?:fresh|juicy|premium|tender)\s+(?:chicken|fillet|lettuce|sauce|bun)\b/,
  );
});

test("verified cooking methods are admitted explicitly without creating extra methods", () => {
  const result = composeDeterministicFoodSubject({
    productName: "Chicken Wrap",
    confirmedIngredients: ["chicken", "tortilla", "lettuce", "sauce"],
    confirmedCookingMethods: ["grilled"],
  });

  assert.deepEqual(result.confirmedCookingMethods, ["grilled"]);
  assert.match(result.subject.physicalState, /verified method set: grilled/i);
  assert.doesNotMatch(result.subject.physicalState, /fried|smoked|roasted/i);
});

test("fact-driven composer blocks verified product identity when ingredients are absent", () => {
  const result = composeDeterministicFoodSubjectFromFacts([
    fact("productName|product=CRISPY_CHICKEN_BURGER", "Crispy Chicken Burger"),
  ]);

  assert.equal(result.status, "BLOCKED_MISSING_VERIFIED_INGREDIENTS");
  if (result.status !== "BLOCKED_MISSING_VERIFIED_INGREDIENTS") return;
  assert.equal(result.productName, "Crispy Chicken Burger");
  assert.deepEqual(result.missingFactKeys, ["ingredients"]);
});

test("fact-driven composer refuses unverified ingredient arrays", () => {
  const result = composeDeterministicFoodSubjectFromFacts([
    fact("productName", "Crispy Chicken Burger"),
    fact("ingredients", ["chicken", "bun"], false),
  ]);

  assert.equal(result.status, "BLOCKED_MISSING_VERIFIED_INGREDIENTS");
});

test("fact-driven composer is not applicable to non-product campaigns", () => {
  const result = composeDeterministicFoodSubjectFromFacts([
    fact("branchPhysicalAddress", "Example branch address"),
  ]);
  assert.deepEqual(result, {
    status: "NOT_APPLICABLE",
    reason: "NO_VERIFIED_PRODUCT_NAME",
  });
});
