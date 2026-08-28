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
    brandId: "ATTHAS_BURGER",
    brandDisplayName: "ATTHA'S Burger",
    expectedBrandIdentifier: "ATTHA'S BURGER",
    finalArtReviewLabel: "ATTHA'S Burger advertising artwork",
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
    evidence: {
      brandVisibility: { status: "PASS", observations: ["Brand identifier is clearly visible."] },
      headlineHierarchy: { status: "PASS", observations: ["Headline is visually primary."] },
      ctaHierarchyPlacement: { status: "PASS", observations: ["CTA is tied to the copy block."] },
      priceVisibility: { status: "PASS", observations: ["Price is readable."] },
      safeAreas: { status: "PASS", observations: ["Important elements remain within safe margins."] },
      contrastLegibility: { status: "PASS", observations: ["Customer-facing text is legible."] },
      productDominance: { status: "PASS", observations: ["Product remains visually dominant."] },
      platformReadability: { status: "PASS", observations: ["Platform name is readable."] },
      decorativeCoherence: { status: "PASS", observations: ["No rendering artifacts are visible."] },
    },
    issues: [] as string[],
    notes: [] as string[],
  };
}

function providerFor(review: unknown): GeminiFinalArtQaProvider {
  return new GeminiFinalArtQaProvider({
    apiKey: "test",
    fetchImpl: async () => fakeResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify(review) }] }],
    }),
  });
}

test("M3.3 final artwork QA keeps strong nine-dimension output as PASS", async () => {
  const result = await providerFor(strongReview()).review(request());
  assert.equal(result.decision, "PASS");
  assert.equal(result.scores.brandVisibility, 95);
  assert.equal(result.checks.decorativeCoherence, "PASS");
});

test("PASS evidence normalizes an inconsistent sub-threshold score without lowering the threshold", async () => {
  const review = strongReview();
  review.scores.contrastLegibility = 60;
  const result = await providerFor(review).review(request());
  assert.equal(result.decision, "PASS");
  assert.equal(result.scores.contrastLegibility, 82);
  assert.match(result.notes.join(" "), /evidence consistency normalized contrastLegibility score from 60 to 82/);
});

test("concrete concern evidence is not normalized away", async () => {
  const review = strongReview();
  review.scores.contrastLegibility = 70;
  review.evidence.contrastLegibility = {
    status: "CONCERN",
    observations: ["Supporting copy has weak contrast over a bright background."],
  };
  const result = await providerFor(review).review(request());
  assert.notEqual(result.decision, "PASS");
  assert.equal(result.scores.contrastLegibility, 70);
  assert.match(result.issues.join(" "), /weak contrast over a bright background/);
});

test("brand visibility check cannot be hidden behind a high model score", async () => {
  const review = strongReview();
  review.checks.brandVisibility = "FAIL";
  review.evidence.brandVisibility = { status: "FAIL", observations: ["Brand identifier is obscured."] };
  const result = await providerFor(review).review(request());
  assert.equal(result.decision, "REGENERATE");
  assert.match(result.issues.join(" "), /brandVisibility check must be PASS/);
});

test("expected price requires both a visible-price check and threshold", async () => {
  const review = strongReview();
  review.checks.priceVisibility = "FAIL";
  review.evidence.priceVisibility = { status: "FAIL", observations: ["Expected price is unreadable."] };
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
  review.evidence.priceVisibility = { status: "NOT_APPLICABLE", observations: [] };
  review.evidence.productDominance = { status: "NOT_APPLICABLE", observations: [] };
  review.evidence.platformReadability = { status: "NOT_APPLICABLE", observations: [] };

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
  review.evidence.decorativeCoherence = {
    status: "FAIL",
    observations: ["A stray rectangular graphic fragment appears near the CTA."],
  };
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
