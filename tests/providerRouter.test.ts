import assert from "node:assert/strict";
import test from "node:test";

import { GroqResponsesProvider } from "../src/providers/groqResponses.js";
import { OpenAIResponsesProvider } from "../src/providers/openaiResponses.js";
import { createCampaignProvider } from "../src/providers/providerRouter.js";

test("provider router selects Groq explicitly", () => {
  const provider = createCampaignProvider({
    provider: "groq",
    groqApiKey: "groq-test-key",
  });

  assert.ok(provider instanceof GroqResponsesProvider);
  assert.equal(provider.providerName, "groq");
  assert.equal(provider.model, "openai/gpt-oss-120b");
});

test("provider router selects OpenAI explicitly", () => {
  const provider = createCampaignProvider({
    provider: "openai",
    openaiApiKey: "openai-test-key",
    openaiModel: "test-openai-model",
  });

  assert.ok(provider instanceof OpenAIResponsesProvider);
  assert.equal(provider.providerName, "openai");
  assert.equal(provider.model, "test-openai-model");
});

test("provider router prefers Groq when both keys are supplied and provider is omitted", () => {
  const provider = createCampaignProvider({
    groqApiKey: "groq-test-key",
    openaiApiKey: "openai-test-key",
  });

  assert.equal(provider.providerName, "groq");
});
