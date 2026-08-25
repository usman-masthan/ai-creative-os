import assert from "node:assert/strict";
import test from "node:test";

import { withTransientRetry } from "../src/reliability/retry.js";

test("transient 429 failures are retried with bounded backoff", async () => {
  let calls = 0;
  const delays: number[] = [];
  const result = await withTransientRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error("Gemini API request failed: HTTP 429 rate limit");
      return "ok";
    },
    { maxAttempts: 4, baseDelayMs: 10, maxDelayMs: 100, sleep: async (ms) => void delays.push(ms) },
  );
  assert.equal(result.value, "ok");
  assert.deepEqual(result.trace, { attempts: 3, retries: 2 });
  assert.deepEqual(delays, [10, 20]);
});

test("non-transient errors fail immediately", async () => {
  let calls = 0;
  await assert.rejects(
    withTransientRetry(async () => {
      calls += 1;
      throw new Error("validation failed");
    }, { sleep: async () => undefined }),
    /validation failed/,
  );
  assert.equal(calls, 1);
});
