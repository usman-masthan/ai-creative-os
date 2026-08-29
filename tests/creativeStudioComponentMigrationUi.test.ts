import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioComponentMigrationHtml } from "../src/dashboard/creativeStudioComponentMigrationHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes immutable dry-run component migration planning", () => {
  const html = creativeStudioComponentMigrationHtml();
  assert.match(html, /Migration Planner/);
  assert.match(html, /Create Dry-run Migration Plan/);
  assert.match(html, /Execute Selected Design Migrations/);
  assert.match(html, /\/api\/studio\/components\/migration-plan/);
  assert.match(html, /\/api\/studio\/components\/migration-execute/);
  assert.match(html, /expectedPlanToken:activePlan\.planToken/);
  assert.match(html, /eligible design\(s\)/);
  assert.match(html, /approved\/frozen/i);
  assert.match(html, /one revision \+ QA per design/i);
});

test("migration UI keeps execution opt-in per eligible design and refreshes only an executed current design", () => {
  const html = creativeStudioComponentMigrationHtml();
  assert.match(html, /data-migration-item/);
  assert.match(html, /selectedItemIds\(\)/);
  assert.match(html, /window\.confirm/);
  assert.match(html, /executed\.find\(function\(item\)\{return item\.designId===d\.id;/);
  assert.match(html, /\/api\/studio\/project\?designId=/);
  assert.match(html, /Create a new dry-run plan before any additional migration/);
});

test("all active migration-planner Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioComponentMigrationHtml());
  assert.ok(scripts.length >= 13);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio component-migration script ${index + 1} must compile as JavaScript.`,
    );
  }
});
