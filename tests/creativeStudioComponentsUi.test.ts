import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioComponentsHtml } from "../src/dashboard/creativeStudioComponentsHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes a truth-safe reusable block library", () => {
  const html = creativeStudioComponentsHtml();
  assert.match(html, /Reusable Blocks/);
  assert.match(html, /Save Selected Group/);
  assert.match(html, /Insert Block/);
  assert.match(html, /\/api\/studio\/components\/create/);
  assert.match(html, /\/api\/studio\/components\/instantiate/);
  assert.match(html, /\/api\/studio\/components\?designId=/);
  assert.match(html, /structure\/style only/i);
  assert.match(html, /destination native text roles/i);
  assert.match(html, /confirmed truth/i);
});

test("component UI treats library selection separately from document truth and provenance", () => {
  const html = creativeStudioComponentsHtml();
  assert.match(html, /componentSelect/);
  assert.match(html, /requiredTruthKeys/);
  assert.match(html, /instanceId='component-'\+Date\.now\(\)/);
  assert.match(html, /instanceGroupId/);
  assert.match(html, /__creativeStudioSetMultiSelection/);
});

test("all active reusable-component Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioComponentsHtml());
  assert.ok(scripts.length >= 9);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio reusable-component script ${index + 1} must compile as JavaScript.`,
    );
  }
});
