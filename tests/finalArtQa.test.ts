import assert from "node:assert/strict";
import test from "node:test";

import { producePoster } from "../src/commands/producePoster.js";
import { GeminiFinalArtQaProvider } from "../src/finalArtQa/gemini.js";

function fakeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    imageBase64: Buffer.from("fake-image").toString("base64"),
    mimeType: "image/png",
    brandId: "ATTHAS_BURGER" as const,
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    channel: "instagram",
    assetType: "poster",
    width: 1080,
    height: 1350,
    expectedHeadline: "Crispy Chicken Burger",
    expectedSupportingCopy: "On Uber Eats",
    expectedCta: "Order on Uber Eats",
    expectedPrice: "LKR 950",
    expectedProductName: "Crispy Chicken Burger",
    expectedPlatforms: ["Uber Eats"],
    logoExpected: false,
    ...overrides,
  };
}

function strongReview() {
  return {
    decision: "PASS",
    scores: {
      brandVisibility: 95,
      headlineHierarchy: 92,
      ctaHierarchyPlacement: 90,
      priceVisibility: 94,
      safeAreas: 93,
      contrastLegibility: 92,
      productDominance: 91,
      platformReadability: 90,
      decorativeCoherence: 94,
    },
    checks: {
      brandVisibility: "PASS",
      headlineHierarchy: "PASS",
      ctaHierarchyPlacement: "PASS",
      priceVisibility: "PASS",
      safeAreas: "PASS",
      contrastLegibility: "PASS",
      productDominance: "PASS",
      platformReadability: "PASS",
      decorativeCoherence: "PASS",
    },
    issues: [] as string[],
    notes: [] as string[],
  };
}

function providerFor(review: unknown): GeminiFinalArtQaProvider {
  return new GeminiFinalArtQaProvider({
    apiKey: "test",
    fetchImpl: async () => fakeResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify(review) }] } }],
    }),
  });
}

test("M3.3 final artwork QA keeps strong nine-dimension output as PASS", async () => {
  const result = await providerFor(strongReview()).review(request());
  assert.equal(result.decision, "PASS");
  assert.equal(result.scores.brandVisibility, 95);
  assert.equal(result.checks.decorativeCoherence, "PASS");
});

test("deterministic threshold downgrades weak contrast/legibility PASS to REGENERATE", async () => {
  const review = strongReview();
  review.scores.contrastLegibility = 60;
  const result = await providerFor(review).review(request());
  assert.equal(result.decision, "REGENERATE");
  assert.match(result.issues.join(" "), /contrastLegibility score/);
});

test("brand visibility check cannot be hidden behind a high model score", async () => {
  const review = strongReview();
  review.checks.brandVisibility = "FAIL";
  const result = await providerFor(review).review(request());
  assert.equal(result.decision, "REGENERATE");
  assert.match(result.issues.join(" "), /brandVisibility check must be PASS/);
});

test("expected price requires both a visible-price check and threshold", async () => {
  const review = strongReview();
  review.checks.priceVisibility = "FAIL";
  const result = await providerFor(review).review(request());
  assert.equal(result.decision, "REGENERATE");
  assert.match(result.issues.join(" "), /priceVisibility check must be PASS/);
});

test("non-applicable price product and platform dimensions must be explicit", async () => {
  const review = strongReview();
  review.scores.priceVisibility = 100;
  review.scores.productDominance = 100;
  review.scores.platformReadability = 100;
  review.checks.priceVisibility = "NOT_APPLICABLE";
  review.checks.productDominance = "NOT_APPLICABLE";
  review.checks.platformReadability = "NOT_APPLICABLE";

  const result = await providerFor(review).review(
    request({
      expectedPrice: undefined,
      expectedProductName: undefined,
      expectedPlatforms: undefined,
    }),
  );
  assert.equal(result.decision, "PASS");
});

test("accidental decorative artifacts force regeneration even when Gemini reports PASS", async () => {
  const review = strongReview();
  review.checks.decorativeCoherence = "FAIL";
  review.issues = ["A stray rectangular graphic fragment appears near the CTA."];
  const result = await providerFor(review).review(request());
  assert.equal(result.decision, "REGENERATE");
  assert.match(result.issues.join(" "), /decorativeCoherence check must be PASS/);
});

test("final poster production marked QA-required cannot bypass the reviewer", async () => {
  await assert.rejects(
    () => producePoster({
      campaignId: "M3-FINAL-QA-GATE",
      campaign: {} as Parameters<typeof producePoster>[0]["campaign"],
      outputDir: "/tmp/m3-final-art-qa-gate",
      baseImagePath: "/tmp/this-file-must-not-be-read.jpg",
      finalArtQaRequired: true,
    }),
    /requires final-art QA before rendering/,
  );
});
