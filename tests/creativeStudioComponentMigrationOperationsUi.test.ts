import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioComponentMigrationOperationsHtml } from "../src/dashboard/creativeStudioComponentMigrationOperationsHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes migration history reconciliation and non-destructive recovery", () => {
  const html = creativeStudioComponentMigrationOperationsHtml();
  assert.match(html, /Migration History & Recovery/);
  assert.match(html, /Refresh Migration History/);
  assert.match(html, /PERSISTED_WITHOUT_EXECUTION_AUDIT/);
  assert.match(html, /Inspect Diff/);
  assert.match(html, /Preview Recovery/);
  assert.match(html, /Restore Pre-migration Content as New Revision/);
  assert.match(html, /\/api\/studio\/components\/migration-history/);
  assert.match(html, /\/api\/studio\/components\/migration-recovery-preview/);
  assert.match(html, /\/api\/studio\/components\/migration-recover/);
  assert.match(html, /\/api\/studio\/compare/);
});

test("recovery UI explicitly preserves approved history and requires acknowledgement", () => {
  const html = creativeStudioComponentMigrationOperationsHtml();
  assert.match(html, /current exact version is approved/i);
  assert.match(html, /create a new unapproved revision/i);
  assert.match(html, /acknowledgeApprovedCurrent/);
  assert.match(html, /Historical migration and current versions remain immutable/i);
});

test("all active migration operations Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioComponentMigrationOperationsHtml());
  assert.ok(scripts.length >= 14);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio migration-operations script ${index + 1} must compile as JavaScript.`,
    );
  }
});
