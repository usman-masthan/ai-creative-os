import assert from "node:assert/strict";
import test from "node:test";

import { GroqResponsesProvider } from "../src/providers/groqResponses.js";
import { OpenAIResponsesProvider } from "../src/providers/openaiResponses.js";
import { OpenRouterResponsesProvider } from "../src/providers/openrouterResponses.js";
import { createCampaignProvider } from "../src/providers/providerRouter.js";

test("provider router selects OpenRouter explicitly", () => {
  const provider = createCampaignProvider({
    provider: "openrouter",
    openrouterApiKey: "openrouter-test-key",
    openrouterModel: "openai/gpt-oss-20b:free",
  });

  assert.ok(provider instanceof OpenRouterResponsesProvider);
  assert.equal(provider.providerName, "openrouter");
  assert.equal(provider.model, "openai/gpt-oss-20b:free");
});

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

test("provider router prefers OpenRouter when multiple keys are supplied and provider is omitted", () => {
  const provider = createCampaignProvider({
    openrouterApiKey: "openrouter-test-key",
    groqApiKey: "groq-test-key",
    openaiApiKey: "openai-test-key",
  });

  assert.equal(provider.providerName, "openrouter");
});
