import assert from "node:assert/strict";
import test from "node:test";

import { GeminiFinalArtQaProvider } from "../src/finalArtQa/gemini.js";

function fakeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function request() {
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
    expectedCta: "Order",
    logoExpected: false,
  };
}

test("final artwork QA keeps strong output as PASS", async () => {
  const provider = new GeminiFinalArtQaProvider({
    apiKey: "test",
    fetchImpl: async () => fakeResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        decision: "PASS",
        scores: { legibility: 95, hierarchy: 90, safeArea: 92, contrast: 91, brandFit: 88, platformFit: 93 },
        issues: [],
        notes: [],
      }) }] } }],
    }),
  });
  const result = await provider.review(request());
  assert.equal(result.decision, "PASS");
});

test("deterministic threshold downgrades weak legibility PASS to REGENERATE", async () => {
  const provider = new GeminiFinalArtQaProvider({
    apiKey: "test",
    fetchImpl: async () => fakeResponse({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        decision: "PASS",
        scores: { legibility: 60, hierarchy: 90, safeArea: 92, contrast: 91, brandFit: 88, platformFit: 93 },
        issues: [],
        notes: [],
      }) }] } }],
    }),
  });
  const result = await provider.review(request());
  assert.equal(result.decision, "REGENERATE");
  assert.match(result.issues.join(" "), /legibility score/);
});
