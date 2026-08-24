import assert from "node:assert/strict";
import test from "node:test";

import { GeminiImageProvider } from "../src/imageProviders/gemini.js";

test("Gemini image provider uses Interactions API and returns inline image data", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const provider = new GeminiImageProvider({
    apiKey: "gemini-test-key",
    role: "production",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestInit = init;
      return new Response(
        JSON.stringify({
          id: "image-request-1",
          usage: {
            total_tokens: 1200,
            total_input_tokens: 40,
            total_output_tokens: 1160,
            total_thought_tokens: 40,
            service_tier: "standard",
          },
          steps: [
            {
              content: [
                {
                  type: "image",
                  data: Buffer.from("fake-image-bytes").toString("base64"),
                  mime_type: "image/jpeg",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const result = await provider.generate({
    prompt: "Commercial food photograph, no text",
    aspectRatio: "4:5",
    resolution: "1K",
    outputFormat: "jpeg",
  });

  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(new Headers(requestInit?.headers).get("x-goog-api-key"), "gemini-test-key");

  const body = JSON.parse(String(requestInit?.body)) as {
    model: string;
    response_format: {
      type: string;
      mime_type: string;
      aspect_ratio: string;
      image_size: string;
    };
  };

  assert.equal(body.model, "gemini-3.1-flash-image");
  assert.deepEqual(body.response_format, {
    type: "image",
    mime_type: "image/jpeg",
    aspect_ratio: "4:5",
    image_size: "1K",
  });
  assert.equal(result.provider, "gemini");
  assert.equal(result.model, "gemini-3.1-flash-image");
  assert.equal(result.requestId, "image-request-1");
  assert.equal(Buffer.from(result.dataBase64 ?? "", "base64").toString(), "fake-image-bytes");
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.costUsd, 0.067);
  assert.equal(result.usage?.serviceTier, "standard");
});

test("Nano Banana 2 Lite rejects unsupported non-1K output", async () => {
  const provider = new GeminiImageProvider({
    apiKey: "gemini-test-key",
    role: "draft",
  });

  await assert.rejects(
    provider.generate({
      prompt: "Food photo",
      aspectRatio: "1:1",
      resolution: "2K",
    }),
    /only supports 1K/,
  );
});

test("Gemini image provider surfaces API errors", async () => {
  const provider = new GeminiImageProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: { message: "Image quota exceeded" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
  });

  await assert.rejects(
    provider.generate({ prompt: "Food photo", aspectRatio: "1:1" }),
    /Gemini image generation failed: Image quota exceeded/,
  );
});
