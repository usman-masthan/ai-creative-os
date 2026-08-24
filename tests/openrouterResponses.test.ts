import assert from "node:assert/strict";
import test from "node:test";

import { OpenRouterResponsesProvider } from "../src/providers/openrouterResponses.js";

test("OpenRouter provider requires JSON output on Chat Completions", async () => {
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
        choices: [
          {
            message: {
              role: "assistant",
              content: '{"ok":true}',
            },
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
  const parsedBody = JSON.parse(requestedBody) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    response_format: { type: string };
    provider: { require_parameters: boolean };
  };

  assert.equal(requestedUrl, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(requestedAuthorization, "Bearer test-key");
  assert.equal(parsedBody.model, "openai/gpt-oss-20b:free");
  assert.equal(parsedBody.messages[0]?.role, "user");
  assert.equal(parsedBody.messages[0]?.content, "test prompt");
  assert.deepEqual(parsedBody.response_format, { type: "json_object" });
  assert.deepEqual(parsedBody.provider, { require_parameters: true });
  assert.equal(output, '{"ok":true}');
});

test("OpenRouter provider keeps Responses output_text compatibility", async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({
        status: "completed",
        output_text: '{"source":"top-level"}',
        output: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  const provider = new OpenRouterResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
  });

  assert.equal(await provider.generate("test"), '{"source":"top-level"}');
});

test("OpenRouter provider keeps nested Responses compatibility", async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: '{"source":"nested"}',
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  const provider = new OpenRouterResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
  });

  assert.equal(await provider.generate("test"), '{"source":"nested"}');
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
        choices: [
          {
            message: {
              content: '{"recovered":true}',
            },
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

  assert.equal(output, '{"recovered":true}');
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
    /OpenRouter API request failed: bad request/,
  );
});

test("OpenRouter provider surfaces response-level errors even on HTTP 200", async () => {
  const fetchImpl = (async () =>
    new Response(
      JSON.stringify({
        status: "failed",
        error: { message: "routed provider failed" },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  const provider = new OpenRouterResponsesProvider({
    apiKey: "test-key",
    fetchImpl,
  });

  await assert.rejects(
    () => provider.generate("test"),
    /OpenRouter API response error: routed provider failed/,
  );
});
