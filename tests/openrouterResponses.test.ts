import assert from "node:assert/strict";
import test from "node:test";

import { OpenRouterResponsesProvider } from "../src/providers/openrouterResponses.js";

test("OpenRouter provider calls Responses API and extracts output text", async () => {
  let requestedUrl = "";
  let requestedBody = "";
  let requestedAuthorization = "";

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedBody = String(init?.body ?? "");
    const headers = new Headers(init?.headers);
    requestedAuthorization = headers.get("Authorization") ?? "";

    return new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "{\"ok\":true}",
              },
            ],
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  const provider = new OpenRouterResponsesProvider({
    apiKey: "test-key",
    model: "openai/gpt-oss-20b:free",
    fetchImpl,
  });

  const output = await provider.generate("test prompt");

  assert.equal(requestedUrl, "https://openrouter.ai/api/v1/responses");
  assert.equal(requestedAuthorization, "Bearer test-key");
  assert.match(requestedBody, /openai\/gpt-oss-20b:free/);
  assert.match(requestedBody, /test prompt/);
  assert.equal(output, '{"ok":true}');
});

test("OpenRouter provider retries a temporary 429", async () => {
  let calls = 0;
  const waits: number[] = [];

  const fetchImpl = (async () => {
    calls += 1;

    if (calls === 1) {
      return new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "retry-after": "0.01",
        },
      });
    }

    return new Response(
      JSON.stringify({
        output: [
          {
            content: [{ type: "output_text", text: "recovered" }],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const provider = new OpenRouterResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
    sleepImpl: async (ms) => {
      waits.push(ms);
    },
  });

  const output = await provider.generate("test");

  assert.equal(output, "recovered");
  assert.equal(calls, 2);
  assert.deepEqual(waits, [10]);
});

test("OpenRouter provider surfaces non-retryable API errors", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: "bad request" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const provider = new OpenRouterResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
  });

  await assert.rejects(
    () => provider.generate("test"),
    /OpenRouter Responses API request failed: bad request/,
  );
});
