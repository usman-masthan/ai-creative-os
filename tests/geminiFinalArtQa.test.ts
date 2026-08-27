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
                    legibility: 92,
                    hierarchy: 90,
                    safeArea: 91,
                    contrast: 89,
                    brandFit: 88,
                    platformFit: 90,
                  },
                  issues: [],
                  notes: ["Finished artwork is legible and within the expected safe areas."],
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

test("Gemini final-art QA uses the REST response-format MIME enum", async () => {
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
    expectedHeadline: "Chicken Tikka Wrap",
    expectedSupportingCopy: "Calibration only",
    expectedCta: "Discover",
    logoExpected: false,
  });

  const body = JSON.parse(String(requestInit?.body)) as {
    generationConfig: {
      responseFormat: {
        text: {
          mimeType: string;
          schema: { type: string };
        };
      };
    };
  };

  assert.equal(body.generationConfig.responseFormat.text.mimeType, "APPLICATION_JSON");
  assert.equal(body.generationConfig.responseFormat.text.schema.type, "object");
  assert.equal(result.decision, "PASS");
  assert.equal(result.usage?.inputTokens, 50);
});
