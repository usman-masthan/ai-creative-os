import assert from "node:assert/strict";
import test from "node:test";

import { GeminiVisualQaProvider } from "../src/visualQa/gemini.js";
import type { VisualQaCompositionEvidence } from "../src/visualQa/types.js";

function evidence(
  overrides: Partial<VisualQaCompositionEvidence> = {},
): VisualQaCompositionEvidence {
  return {
    heroPlacement: "MATCH",
    heroScale: "MATCH",
    cropQuality: "GOOD",
    copyZones: {
      upperLeft: "GOOD",
      upperRight: "POOR",
      lowerLeft: "ACCEPTABLE",
      lowerRight: "POOR",
    },
    notes: ["Upper-left is structurally calm and suitable for copy."],
    ...overrides,
  };
}

function visualQaResponse(
  decision = "PASS",
  compositionEvidence: VisualQaCompositionEvidence = evidence(),
): Response {
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
                    foodTexture: 86,
                    composition: 88,
                    copyZoneSuitability: 84,
                    governance: 95,
                    rights: 100,
                  },
                  issues: [],
                  scoreEvidence: {
                    productTruth: { status: "PASS", observations: ["Verified product form and ingredients match."] },
                    brandFit: { status: "PASS", observations: ["Brand treatment is appropriate."] },
                    realism: { status: "PASS", observations: ["Food and lighting are photorealistic."] },
                    foodTexture: { status: "PASS", observations: ["Food texture is physically credible."] },
                    composition: { status: "PASS", observations: ["Hero placement and crop are sound."] },
                    copyZoneSuitability: { status: "PASS", observations: ["Requested copy zone is usable."] },
                    governance: { status: "PASS", observations: ["No prohibited graphics are visible."] },
                    rights: { status: "PASS", observations: ["Rights status is supplied as cleared."] },
                  },
                  observedIngredients: ["crispy chicken", "cabbage"],
                  unexpectedVisibleElements: [],
                  notes: ["Copy-safe negative space is available."],
                  compositionEvidence,
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

test("Gemini visual QA sends image pixels and returns composition-aware structured review", async () => {
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
    compositionExpectation: {
      heroPosition: "centre-right",
      heroScale: "dominant food hero",
      cropBehavior: "protect the food edges",
      requestedQuietZones: ["upperLeft"],
    },
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
  assert.equal(
    body.contents[0]?.parts[0]?.inline_data?.data,
    Buffer.from("fake-image-bytes").toString("base64"),
  );
  assert.match(body.contents[0]?.parts[1]?.text ?? "", /Requested quiet copy zones: upperLeft/);
  assert.equal(body.generationConfig.responseFormat.text.mimeType, "APPLICATION_JSON");
  assert.equal(body.generationConfig.responseFormat.text.schema.type, "object");
  assert.equal(result.decision, "PASS");
  assert.equal(result.scores.productTruth, 92);
  assert.equal(result.scores.foodTexture, 86);
  assert.equal(result.scores.copyZoneSuitability, 84);
  assert.equal(result.compositionEvidence?.copyZones.upperLeft, "GOOD");
  assert.equal(result.compositionEvidence?.copyZones.upperRight, "POOR");
  assert.equal(result.usage?.inputTokens, 100);
});

test("a POOR requested copy zone deterministically forces regeneration", async () => {
  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () =>
      visualQaResponse(
        "PASS",
        evidence({
          copyZones: {
            upperLeft: "POOR",
            upperRight: "GOOD",
            lowerLeft: "ACCEPTABLE",
            lowerRight: "GOOD",
          },
        }),
      ),
  });

  const result = await provider.review({
    imageBase64: "ZmFrZQ==",
    mimeType: "image/jpeg",
    brandId: "ATTHAS_BURGER",
    visualClass: "GENERIC_CONCEPT_VISUAL",
    rightsStatus: "cleared",
    compositionExpectation: { requestedQuietZones: ["upperLeft"] },
  });

  assert.equal(result.decision, "REGENERATE");
  assert.ok(result.issues.some((issue) => issue.includes("copy-safe zones")));
});

test("hero-placement mismatch forces regeneration for a pass-eligible visual", async () => {
  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () => visualQaResponse("PASS", evidence({ heroPlacement: "MISMATCH" })),
  });

  const result = await provider.review({
    imageBase64: "ZmFrZQ==",
    mimeType: "image/jpeg",
    brandId: "ATTHAS_BURGER",
    visualClass: "CONSTRAINED_PRODUCT_GENERATION",
    rightsStatus: "cleared",
    verifiedVisibleIngredients: ["crispy chicken", "cabbage"],
    compositionExpectation: {
      heroPosition: "centre-right",
      requestedQuietZones: ["upperLeft"],
    },
  });

  assert.equal(result.decision, "REGENERATE");
  assert.ok(result.issues.some((issue) => issue.includes("hero placement")));
});

test("non-product generic concept imagery may PASS brand or hospitality QA", async () => {
  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () => visualQaResponse("PASS"),
  });

  const result = await provider.review({
    imageBase64: "ZmFrZQ==",
    mimeType: "image/jpeg",
    brandId: "ATTHAS_RESTAURANT",
    visualClass: "GENERIC_CONCEPT_VISUAL",
    rightsStatus: "cleared",
  });

  assert.equal(result.decision, "PASS");
  assert.ok(!result.issues.some((issue) => issue.includes("Generic concept imagery")));
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


test("evidence-consistency normalizes unsupported conservative scores instead of escalating", async () => {
  const response = visualQaResponse("REGENERATE");
  const payload = (await response.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  const candidate = payload.candidates[0]!;
  const part = candidate.content.parts[0]!;
  const review = JSON.parse(part.text) as Record<string, any>;
  review.scores = {
    productTruth: 72, brandFit: 70, realism: 72, foodTexture: 71,
    composition: 70, copyZoneSuitability: 69, governance: 75, rights: 75,
  };
  part.text = JSON.stringify(review);

  const provider = new GeminiVisualQaProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
  });
  const result = await provider.review({
    imageBase64: "ZmFrZQ==",
    mimeType: "image/jpeg",
    brandId: "ATTHAS_RESTAURANT",
    productId: "CALIBRATION_CHICKEN_TIKKA_WRAP",
    productName: "Chicken Tikka Wrap",
    visualClass: "CONSTRAINED_PRODUCT_GENERATION",
    rightsStatus: "cleared",
    verifiedVisibleIngredients: ["crispy chicken", "cabbage"],
    compositionExpectation: { requestedQuietZones: ["upperLeft"] },
  });
  assert.equal(result.decision, "PASS");
  assert.equal(result.scores.productTruth, 90);
  assert.equal(result.scores.realism, 85);
  assert.equal(result.scores.foodTexture, 82);
  assert.equal(result.scores.composition, 83);
  assert.equal(result.scores.governance, 90);
  assert.equal(result.scores.rights, 100);
  assert.ok(result.notes.some((note) => note.includes("evidence-consistency")));
});


test("WRAP_ROLL rejects separate serving elements even when ingredients themselves are verified", async () => {
  const response = visualQaResponse("PASS");
  const payload = (await response.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  const part = payload.candidates[0]!.content.parts[0]!;
  const review = JSON.parse(part.text) as Record<string, any>;
  review.scores = { productTruth: 95, brandFit: 80, realism: 90, foodTexture: 90, composition: 88, copyZoneSuitability: 80, governance: 95, rights: 100 };
  review.scoreEvidence.productTruth = { status: "PASS", observations: ["Verified ingredients accurately depicted in wrap format, with a separate side salad and sauce ramekin."] };
  review.unexpectedVisibleElements = [];
  part.text = JSON.stringify(review);
  const provider = new GeminiVisualQaProvider({ apiKey: "gemini-test-key", fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }) });
  const result = await provider.review({ imageBase64: "ZmFrZQ==", mimeType: "image/jpeg", brandId: "ATTHAS_RESTAURANT", productId: "CALIBRATION_CHICKEN_TIKKA_WRAP", productName: "Chicken Tikka Wrap", visualClass: "CONSTRAINED_PRODUCT_GENERATION", rightsStatus: "cleared", verifiedVisibleIngredients: ["chicken tikka", "tortilla", "sauce", "lettuce", "onion", "tomato", "coriander"], verifiedCookingMethods: [], foodTemplateId: "WRAP_ROLL" });
  assert.equal(result.decision, "REGENERATE");
  assert.ok(result.issues.some((issue) => issue.includes("WRAP_ROLL presentation contract")));
});

test("unverified grill-mark evidence cannot PASS when no cooking method is verified", async () => {
  const response = visualQaResponse("PASS");
  const payload = (await response.json()) as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  const part = payload.candidates[0]!.content.parts[0]!;
  const review = JSON.parse(part.text) as Record<string, any>;
  review.scores = { productTruth: 95, brandFit: 80, realism: 90, foodTexture: 90, composition: 88, copyZoneSuitability: 80, governance: 95, rights: 100 };
  review.scoreEvidence.foodTexture = { status: "PASS", observations: ["Clear grill marks and fresh vegetable textures."] };
  part.text = JSON.stringify(review);
  const provider = new GeminiVisualQaProvider({ apiKey: "gemini-test-key", fetchImpl: async () => new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }) });
  const result = await provider.review({ imageBase64: "ZmFrZQ==", mimeType: "image/jpeg", brandId: "ATTHAS_RESTAURANT", productId: "CALIBRATION_CHICKEN_TIKKA_WRAP", productName: "Chicken Tikka Wrap", visualClass: "CONSTRAINED_PRODUCT_GENERATION", rightsStatus: "cleared", verifiedVisibleIngredients: ["chicken tikka", "tortilla", "sauce", "lettuce", "onion", "tomato", "coriander"], verifiedCookingMethods: [], foodTemplateId: "WRAP_ROLL" });
  assert.equal(result.decision, "REGENERATE");
  assert.ok(result.issues.some((issue) => issue.includes("cooking method that was not separately verified")));
});
