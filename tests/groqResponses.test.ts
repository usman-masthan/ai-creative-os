import assert from "node:assert/strict";
import test from "node:test";

import { GroqResponsesProvider } from "../src/providers/groqResponses.js";

test("Groq provider calls compatible Responses API and extracts output text", async () => {
  let requestedUrl = "";
  let requestedBody = "";

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedBody = String(init?.body ?? "");

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

  const provider = new GroqResponsesProvider({
    apiKey: "test-key",
    model: "openai/gpt-oss-120b",
    fetchImpl,
  });

  const output = await provider.generate("test prompt");

  assert.equal(requestedUrl, "https://api.groq.com/openai/v1/responses");
  assert.match(requestedBody, /openai\/gpt-oss-120b/);
  assert.match(requestedBody, /test prompt/);
  assert.match(requestedBody, /"max_output_tokens":3000/);
  assert.equal(output, '{"ok":true}');
});

test("Groq provider retries 429 responses using retry-after and then succeeds", async () => {
  let calls = 0;
  const waits: number[] = [];

  const fetchImpl = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(
        JSON.stringify({ error: { message: "rate limited; please try again in 0.01s" } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "retry-after": "0.01",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "{\"recovered\":true}" }],
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  const provider = new GroqResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
    sleepImpl: async (milliseconds) => {
      waits.push(milliseconds);
    },
  });

  const output = await provider.generate("test");

  assert.equal(calls, 2);
  assert.equal(waits.length, 1);
  assert.ok((waits[0] ?? 0) >= 250);
  assert.equal(output, '{"recovered":true}');
});

test("Groq provider surfaces API errors after configured retries are exhausted", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: "rate limited" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const provider = new GroqResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
    maxRateLimitRetries: 0,
  });

  await assert.rejects(
    () => provider.generate("test"),
    /Groq Responses API request failed: rate limited/,
  );
});
