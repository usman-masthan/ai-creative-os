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
  assert.equal(output, '{"ok":true}');
});

test("Groq provider surfaces API errors", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: "rate limited" } }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const provider = new GroqResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
  });

  await assert.rejects(
    () => provider.generate("test"),
    /Groq Responses API request failed: rate limited/,
  );
});
