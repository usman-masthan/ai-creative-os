import assert from "node:assert/strict";
import test from "node:test";

import { GeminiVisualQaProvider } from "../src/visualQa/gemini.js";

function visualQaResponse(decision = "PASS"): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  decision,
                  scores: {
                    productTruth: 92,
                    brandFit: 90,
                    realism: 91,
                    composition: 88,
                    governance: 95,
                    rights: 100,
                  },
                  issues: [],
                  observedIngredients: ["crispy chicken", "cabbage"],
                  unexpectedVisibleElements: [],
                  notes: ["Copy-safe negative space is available."],
                }),
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 80,
        totalTokenCount: 180,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("Gemini visual QA sends image pixels and returns structured review", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return visualQaResponse();
    },
  });

  const result = await provider.review({
    imageBase64: Buffer.from("fake-image-bytes").toString("base64"),
    mimeType: "image/jpeg",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    productId: "CRISPY_CHICKEN_BURGER",
    productName: "Crispy Chicken Burger",
    visualClass: "CONSTRAINED_PRODUCT_GENERATION",
    rightsStatus: "cleared",
    verifiedVisibleIngredients: ["crispy chicken", "cabbage"],
    mustNotInclude: ["generated text", "logo"],
    compositionRequirements: ["copy-safe negative space"],
  });

  assert.match(requestUrl, /gemini-3\.7-flash:generateContent$/);
  assert.equal(new Headers(requestInit?.headers).get("x-goog-api-key"), "gemini-test-key");

  const body = JSON.parse(String(requestInit?.body)) as {
    contents: Array<{
      parts: Array<{
        inline_data?: { mime_type: string; data: string };
        text?: string;
      }>;
    }>;
    generationConfig: {
      responseFormat: {
        text: {
          mimeType: string;
          schema: { type: string };
        };
      };
    };
  };

  assert.equal(body.contents[0]?.parts[0]?.inline_data?.mime_type, "image/jpeg");
  assert.equal(body.contents[0]?.parts[0]?.inline_data?.data, Buffer.from("fake-image-bytes").toString("base64"));
  assert.equal(body.generationConfig.responseFormat.text.mimeType, "application/json");
  assert.equal(body.generationConfig.responseFormat.text.schema.type, "object");
  assert.equal(result.decision, "PASS");
  assert.equal(result.scores.productTruth, 92);
  assert.equal(result.usage?.inputTokens, 100);
});

test("generic concept imagery cannot deterministically PASS as an actual product visual", async () => {
  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () => visualQaResponse("PASS"),
  });

  const result = await provider.review({
    imageBase64: "ZmFrZQ==",
    mimeType: "image/jpeg",
    brandId: "ATTHAS_BURGER",
    productId: "CRISPY_CHICKEN_BURGER",
    visualClass: "GENERIC_CONCEPT_VISUAL",
    rightsStatus: "cleared",
  });

  assert.equal(result.decision, "HUMAN_REVIEW");
  assert.ok(result.issues.some((issue) => issue.includes("Generic concept imagery")));
});

test("blocked commercial-use rights always force BLOCK", async () => {
  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () => visualQaResponse("PASS"),
  });

  const result = await provider.review({
    imageBase64: "ZmFrZQ==",
    mimeType: "image/png",
    brandId: "ATTHAS_RESTAURANT",
    visualClass: "VERIFIED_PRODUCT_VISUAL",
    rightsStatus: "blocked",
    verifiedVisibleIngredients: ["rice"],
  });

  assert.equal(result.decision, "BLOCK");
  assert.ok(result.issues.some((issue) => issue.includes("rights are explicitly blocked")));
});
