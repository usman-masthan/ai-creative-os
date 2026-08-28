import assert from "node:assert/strict";
import test from "node:test";

import { GeminiFinalArtQaProvider } from "../src/finalArtQa/gemini.js";

function finalArtResponse(): Response {
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
                    brandVisibility: 94,
                    headlineHierarchy: 92,
                    ctaHierarchyPlacement: 90,
                    priceVisibility: 100,
                    safeAreas: 91,
                    contrastLegibility: 89,
                    productDominance: 100,
                    platformReadability: 100,
                    decorativeCoherence: 90,
                  },
                  checks: {
                    brandVisibility: "PASS",
                    headlineHierarchy: "PASS",
                    ctaHierarchyPlacement: "PASS",
                    priceVisibility: "NOT_APPLICABLE",
                    safeAreas: "PASS",
                    contrastLegibility: "PASS",
                    productDominance: "NOT_APPLICABLE",
                    platformReadability: "NOT_APPLICABLE",
                    decorativeCoherence: "PASS",
                  },
                  issues: [],
                  notes: ["Finished artwork satisfies the M3.3 final-art checks."],
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 50,
        candidatesTokenCount: 40,
        totalTokenCount: 90,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("Gemini final-art QA uses the REST response-format MIME enum and nine-dimension schema", async () => {
  let requestInit: RequestInit | undefined;

  const provider = new GeminiFinalArtQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async (_input, init) => {
      requestInit = init;
      return finalArtResponse();
    },
  });

  const result = await provider.review({
    imageBase64: Buffer.from("fake-final-art").toString("base64"),
    mimeType: "image/png",
    brandId: "ATTHAS_RESTAURANT",
    layoutId: "ATTHAS_RESTAURANT_FOOD_HERO_V1",
    channel: "instagram",
    assetType: "poster",
    width: 1080,
    height: 1350,
    expectedHeadline: "An evening around the table",
    expectedSupportingCopy: "ATTHA'S Restaurant",
    expectedCta: "Join Us",
    logoExpected: false,
  });

  const body = JSON.parse(String(requestInit?.body)) as {
    contents: Array<{ parts: Array<{ text?: string }> }>;
    generationConfig: {
      responseFormat: {
        text: {
          mimeType: string;
          schema: {
            type: string;
            properties: {
              scores: { required: string[] };
              checks: { required: string[] };
            };
          };
        };
      };
    };
  };

  assert.equal(body.generationConfig.responseFormat.text.mimeType, "APPLICATION_JSON");
  assert.equal(body.generationConfig.responseFormat.text.schema.type, "object");
  assert.equal(body.generationConfig.responseFormat.text.schema.properties.scores.required.length, 9);
  assert.equal(body.generationConfig.responseFormat.text.schema.properties.checks.required.length, 9);
  assert.match(body.contents[0]!.parts[1]!.text ?? "", /Expected brand identifier: ATTHA'S RESTAURANT/);
  assert.equal(result.decision, "PASS");
  assert.equal(result.usage?.inputTokens, 50);
});
