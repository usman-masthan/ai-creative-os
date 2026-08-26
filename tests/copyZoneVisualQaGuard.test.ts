import assert from "node:assert/strict";
import test from "node:test";

import { GeminiVisualQaProvider } from "../src/visualQa/gemini.js";

function response(): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  decision: "PASS",
                  scores: {
                    productTruth: 95,
                    brandFit: 90,
                    realism: 90,
                    foodTexture: 88,
                    composition: 86,
                    copyZoneSuitability: 72,
                    governance: 96,
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
                      upperLeft: "POOR",
                      upperRight: "GOOD",
                      lowerLeft: "ACCEPTABLE",
                      lowerRight: "GOOD",
                    },
                    notes: ["Upper-left contains high-detail subject edges."],
                  },
                }),
              },
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("requested POOR copy zone cannot PASS composition-aware QA", async () => {
  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () => response(),
  });

  const result = await provider.review({
    imageBase64: "ZmFrZQ==",
    mimeType: "image/jpeg",
    brandId: "ATTHAS_BURGER",
    visualClass: "CONSTRAINED_PRODUCT_GENERATION",
    rightsStatus: "cleared",
    compositionExpectation: {
      heroPosition: "centre-right",
      requestedQuietZones: ["upperLeft"],
    },
  });

  assert.equal(result.decision, "REGENERATE");
  assert.ok(
    result.issues.some((issue) =>
      issue.includes("Requested copy-safe zones are visually unsafe: upperLeft"),
    ),
  );
  assert.equal(result.compositionEvidence?.copyZones.upperLeft, "POOR");
});
