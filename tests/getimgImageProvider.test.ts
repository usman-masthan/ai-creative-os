import assert from "node:assert/strict";
import test from "node:test";

import { GetimgImageProvider } from "../src/imageProviders/getimg.js";

test("getimg provider sends bearer-authenticated synchronous image request", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetchFn: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(
      JSON.stringify({
        id: "req-123",
        status: "completed",
        model: "gemini-3-1-flash-lite-image",
        data: [{ url: "https://cdn.example.test/image.jpg" }],
        usage: { total_cost: 0.035 },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  const provider = new GetimgImageProvider({
    apiKey: "sk_test",
    fetchFn,
  });

  const result = await provider.generate({
    prompt: "Text-free food hero image.",
    aspectRatio: "4:5",
  });

  assert.equal(requestedUrl, "https://api.getimg.ai/v2/images/generations");
  assert.equal((requestedInit?.headers as Record<string, string>).Authorization, "Bearer sk_test");
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
    model: "gemini-3-1-flash-lite-image",
    prompt: "Text-free food hero image.",
    aspect_ratio: "4:5",
    resolution: "1K",
    output_format: "jpeg",
  });
  assert.deepEqual(result, {
    provider: "getimg",
    model: "gemini-3-1-flash-lite-image",
    requestId: "req-123",
    imageUrl: "https://cdn.example.test/image.jpg",
    costUsd: 0.035,
  });
});

test("getimg provider surfaces API errors", async () => {
  const fetchFn: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: "insufficient balance" } }), {
      status: 402,
      headers: { "content-type": "application/json" },
    });

  const provider = new GetimgImageProvider({ apiKey: "sk_test", fetchFn });
  await assert.rejects(
    () => provider.generate({ prompt: "Food image", aspectRatio: "4:5" }),
    /insufficient balance/,
  );
});
