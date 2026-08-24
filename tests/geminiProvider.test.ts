import assert from "node:assert/strict";
import test from "node:test";

import { GeminiCampaignProvider } from "../src/providers/gemini.js";
import { GEMINI_MODEL_STACK } from "../src/providers/geminiModels.js";

test("Gemini provider uses the default campaign model and JSON output mode", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const provider = new GeminiCampaignProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '{"status":"WORKING"}' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 20,
            thoughtsTokenCount: 10,
            totalTokenCount: 130,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const output = await provider.generate("Return campaign JSON");

  assert.equal(provider.providerName, "gemini");
  assert.equal(provider.role, "default");
  assert.equal(provider.model, GEMINI_MODEL_STACK.text.default);
  assert.match(requestUrl, /gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(new Headers(requestInit?.headers).get("x-goog-api-key"), "gemini-test-key");

  const body = JSON.parse(String(requestInit?.body)) as {
    generationConfig: {
      responseMimeType: string;
      maxOutputTokens: number;
    };
  };

  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.maxOutputTokens, 3500);
  assert.equal(output, '{"status":"WORKING"}');
  assert.equal(provider.lastUsage?.inputTokens, 100);
  assert.equal(provider.lastUsage?.outputTokens, 30);
  assert.equal(provider.lastUsage?.pricingVersion, "2026-08-13");
});

test("Gemini provider resolves creative and advanced roles", () => {
  const creative = new GeminiCampaignProvider({
    apiKey: "gemini-test-key",
    role: "creative",
  });
  const advanced = new GeminiCampaignProvider({
    apiKey: "gemini-test-key",
    role: "advanced",
  });

  assert.equal(creative.model, "gemini-3.6-flash");
  assert.equal(advanced.model, "gemini-3.7-flash");
});

test("Gemini provider supports an explicit model override", () => {
  const provider = new GeminiCampaignProvider({
    apiKey: "gemini-test-key",
    role: "review",
    model: "custom-gemini-model",
  });

  assert.equal(provider.role, "review");
  assert.equal(provider.model, "custom-gemini-model");
});

test("Gemini provider surfaces API errors", async () => {
  const provider = new GeminiCampaignProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Quota exceeded",
            status: "RESOURCE_EXHAUSTED",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
  });

  await assert.rejects(
    provider.generate("Return campaign JSON"),
    /Gemini API request failed: Quota exceeded/,
  );
});

test("Gemini provider requires an API key", () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  try {
    assert.throws(
      () => new GeminiCampaignProvider(),
      /GEMINI_API_KEY is required/,
    );
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
