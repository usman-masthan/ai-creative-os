import assert from "node:assert/strict";
import test from "node:test";

import { GeminiVeoProvider } from "../src/videoProviders/geminiVeo.js";

test("Veo Lite submits, polls and downloads one video without numberOfVideos", async () => {
  let call = 0;
  let startBody = "";

  const provider = new GeminiVeoProvider({
    apiKey: "gemini-test-key",
    role: "lite",
    pollIntervalMs: 0,
    sleepFn: async () => {},
    fetchImpl: async (input, init) => {
      call += 1;

      if (call === 1) {
        startBody = String(init?.body);
        assert.match(String(input), /veo-3\.1-lite-generate-preview:predictLongRunning$/);
        return new Response(JSON.stringify({ name: "models/veo/operations/test-op" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (call === 2) {
        assert.equal(String(input), "https://generativelanguage.googleapis.com/v1beta/models/veo/operations/test-op");
        return new Response(JSON.stringify({ done: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (call === 3) {
        return new Response(
          JSON.stringify({
            done: true,
            response: {
              generateVideoResponse: {
                generatedSamples: [
                  {
                    video: {
                      uri: "https://generativelanguage.googleapis.com/v1beta/files/test:download?alt=media",
                    },
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      assert.equal(
        String(input),
        "https://generativelanguage.googleapis.com/v1beta/files/test:download?alt=media",
      );
      return new Response(new Uint8Array(1_500).fill(1), {
        status: 200,
        headers: { "Content-Type": "video/mp4" },
      });
    },
  });

  const result = await provider.generate({
    prompt: "Cinematic burger shot",
    durationSeconds: 4,
    resolution: "720p",
    aspectRatio: "16:9",
  });

  const payload = JSON.parse(startBody) as {
    parameters: Record<string, unknown>;
  };

  assert.equal(payload.parameters.durationSeconds, 4);
  assert.equal(payload.parameters.resolution, "720p");
  assert.equal(payload.parameters.aspectRatio, "16:9");
  assert.equal("numberOfVideos" in payload.parameters, false);
  assert.equal(result.operationName, "models/veo/operations/test-op");
  assert.equal(result.data.byteLength, 1_500);
  assert.equal(result.costUsd, 0.2);
  assert.equal(call, 4);
});

test("Veo Lite blocks unsupported 4k output before spending", async () => {
  const provider = new GeminiVeoProvider({
    apiKey: "gemini-test-key",
    role: "lite",
  });

  await assert.rejects(
    provider.generate({
      prompt: "Video",
      resolution: "4k",
    }),
    /does not support 4k/,
  );
});

test("Veo provider surfaces generation errors", async () => {
  let call = 0;
  const provider = new GeminiVeoProvider({
    apiKey: "gemini-test-key",
    pollIntervalMs: 0,
    sleepFn: async () => {},
    fetchImpl: async () => {
      call += 1;
      if (call === 1) {
        return new Response(JSON.stringify({ name: "models/veo/operations/fail" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ done: true, error: { message: "Safety rejection" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  await assert.rejects(
    provider.generate({ prompt: "Video" }),
    /Veo generation failed: Safety rejection/,
  );
});
