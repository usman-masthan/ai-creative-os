import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { AiTraceSession, readAiTrace, sanitizeTraceValue } from "../src/aiTrace.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";

test("AI trace sanitizes secrets and large image payloads", () => {
  const sanitized = sanitizeTraceValue({
    apiKey: "AIza123456789012345678901234567890",
    authorization: "Bearer secret-token",
    imageBase64: "A".repeat(2048),
    prompt: "safe creative prompt",
    totalTokens: 120,
  }) as Record<string, unknown>;

  assert.equal(sanitized.apiKey, "[REDACTED:apiKey]");
  assert.equal(sanitized.authorization, "[REDACTED:authorization]");
  assert.equal(sanitized.imageBase64, "[REDACTED:imageBase64]");
  assert.equal(sanitized.prompt, "safe creative prompt");
  assert.equal(sanitized.totalTokens, 120);
});

test("AI trace captures strategist prompt, response, usage and repair calls without changing provider output", async () => {
  let calls = 0;
  const provider: CampaignGenerationProvider & { lastUsage?: unknown; lastRetryTrace?: unknown } = {
    providerName: "mock",
    model: "mock-model",
    async generate(prompt) {
      calls += 1;
      this.lastUsage = { inputTokens: prompt.length, outputTokens: 4, estimatedCostUsd: 0.001 };
      this.lastRetryTrace = { attempts: 1 };
      return JSON.stringify({ call: calls });
    },
  };

  const trace = new AiTraceSession("TRACE-001", "2026-08-26T00:00:00.000Z");
  const wrapped = trace.wrapCampaignProvider("strategist", provider);

  const first = await wrapped.generate("first prompt");
  const second = await wrapped.generate("repair prompt");

  assert.equal(first, JSON.stringify({ call: 1 }));
  assert.equal(second, JSON.stringify({ call: 2 }));
  assert.equal(trace.document.strategist.status, "COMPLETED");
  assert.equal(trace.document.strategist.calls.length, 2);
  assert.equal(trace.document.strategist.calls[0]?.prompt, "first prompt");
  assert.equal(trace.document.strategist.calls[1]?.prompt, "repair prompt");
  assert.deepEqual(trace.document.strategist.calls[1]?.usage, {
    inputTokens: "repair prompt".length,
    outputTokens: 4,
    estimatedCostUsd: 0.001,
  });
  assert.deepEqual(trace.document.strategist.calls[1]?.retryTrace, { attempts: 1 });
});

test("AI trace persists a future-ready document with the brief compiler explicitly deferred", async () => {
  const root = await mkdtemp(join(tmpdir(), "atthas-ai-trace-"));
  try {
    const trace = new AiTraceSession("TRACE-002", "2026-08-26T00:00:00.000Z");
    trace.setRequest({ rawRequest: "Create an ATTHA'S Burger campaign" });
    trace.setIntent({ campaignType: "BRAND_BUILDING" });
    trace.setTruth({ requiredTruth: [], snapshot: { confirmedBy: "tester" } });
    trace.markSkipped("visualQa", "Draft mode");
    trace.recordOutcome({ taskStatus: "TASK_CONFIRMED_AND_PRODUCED" });

    await trace.persist(root);
    const saved = await readAiTrace(root);

    assert.equal(saved.campaignId, "TRACE-002");
    assert.equal(saved.version, 1);
    assert.equal(saved.briefCompiler.status, "NOT_IMPLEMENTED");
    assert.match(saved.briefCompiler.note ?? "", /planned for M2/i);
    assert.equal(saved.visualQa.status, "SKIPPED");
    assert.deepEqual(saved.outcome, { taskStatus: "TASK_CONFIRMED_AND_PRODUCED" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
