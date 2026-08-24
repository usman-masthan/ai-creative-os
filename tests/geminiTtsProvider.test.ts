import assert from "node:assert/strict";
import test from "node:test";

import { GeminiTtsProvider } from "../src/audioProviders/geminiTts.js";

test("Gemini TTS provider uses Interactions API and returns PCM audio", async () => {
  let requestInit: RequestInit | undefined;

  const provider = new GeminiTtsProvider({
    apiKey: "gemini-test-key",
    defaultVoice: "Kore",
    fetchImpl: async (_input, init) => {
      requestInit = init;
      return new Response(
        JSON.stringify({
          id: "tts-request-1",
          usage: {
            total_tokens: 100,
            total_input_tokens: 20,
            total_output_tokens: 80,
            service_tier: "standard",
          },
          steps: [
            {
              content: [
                {
                  type: "audio",
                  data: Buffer.from("fake-pcm-bytes").toString("base64"),
                  mime_type: "audio/L16;rate=24000",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const result = await provider.generate({ text: "Say: Creative OS is working." });
  const body = JSON.parse(String(requestInit?.body)) as {
    model: string;
    response_format: { type: string };
    generation_config: { speech_config: Array<{ voice: string }> };
  };

  assert.equal(body.model, "gemini-3.1-flash-tts-preview");
  assert.equal(body.response_format.type, "audio");
  assert.equal(body.generation_config.speech_config[0]?.voice, "Kore");
  assert.equal(Buffer.from(result.dataBase64, "base64").toString(), "fake-pcm-bytes");
  assert.equal(result.sampleRateHz, 24_000);
  assert.equal(result.channels, 1);
  assert.equal(result.bitsPerSample, 16);
  assert.equal(result.usage?.serviceTier, "standard");
});

test("Gemini TTS supports a per-request voice override", async () => {
  let requestBody = "";
  const provider = new GeminiTtsProvider({
    apiKey: "gemini-test-key",
    fetchImpl: async (_input, init) => {
      requestBody = String(init?.body);
      return new Response(
        JSON.stringify({
          steps: [
            {
              content: [
                {
                  type: "audio",
                  data: Buffer.from("audio").toString("base64"),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  await provider.generate({ text: "Hello", voice: "Puck" });
  assert.equal(
    JSON.parse(requestBody).generation_config.speech_config[0].voice,
    "Puck",
  );
});
