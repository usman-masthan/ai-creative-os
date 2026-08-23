import assert from "node:assert/strict";
import test from "node:test";

import { OpenAIResponsesProvider } from "../src/providers/openaiResponses.js";

test("OpenAI provider calls Responses API and extracts output text", async () => {
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

  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key",
    model: "gpt-5.6-luna",
    fetchImpl,
  });

  const output = await provider.generate("test prompt");

  assert.equal(requestedUrl, "https://api.openai.com/v1/responses");
  assert.match(requestedBody, /gpt-5\.6-luna/);
  assert.match(requestedBody, /test prompt/);
  assert.equal(output, '{"ok":true}');
});

test("OpenAI provider surfaces API errors", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: "bad request" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const provider = new OpenAIResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
  });

  await assert.rejects(
    () => provider.generate("test"),
    /OpenAI Responses API request failed: bad request/,
  );
});
