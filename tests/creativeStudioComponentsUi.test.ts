import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioComponentsHtml } from "../src/dashboard/creativeStudioComponentsHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes a truth-safe reusable component lifecycle browser", () => {
  const html = creativeStudioComponentsHtml();
  assert.match(html, /Reusable Components/);
  assert.match(html, /Save Group as New Family/);
  assert.match(html, /Insert Version/);
  assert.match(html, /Duplicate as New Version/);
  assert.match(html, /Deprecate/);
  assert.match(html, /Archive/);
  assert.match(html, /Reactivate/);
  assert.match(html, /Upgrade Selected Instance/);
  assert.match(html, /Detach Instance/);
  assert.match(html, /\/api\/studio\/components\/create/);
  assert.match(html, /\/api\/studio\/components\/version/);
  assert.match(html, /\/api\/studio\/components\/status/);
  assert.match(html, /\/api\/studio\/components\/instantiate/);
  assert.match(html, /\/api\/studio\/components\/upgrade/);
  assert.match(html, /\/api\/studio\/components\/detach/);
  assert.match(html, /\/api\/studio\/components\?designId=/);
});

test("component browser keeps family/version selection separate from document truth and provenance", () => {
  const html = creativeStudioComponentsHtml();
  assert.match(html, /componentFamilySelect/);
  assert.match(html, /componentVersionSelect/);
  assert.match(html, /latestVersion/);
  assert.match(html, /requiredTruthKeys/);
  assert.match(html, /instanceId='component-'\+Date\.now\(\)/);
  assert.match(html, /instanceGroupId/);
  assert.match(html, /componentInstance/);
  assert.match(html, /No instance auto-updates/i);
  assert.match(html, /destination truth/i);
  assert.match(html, /__creativeStudioSetMultiSelection/);
});

test("all active reusable-component lifecycle Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioComponentsHtml());
  assert.ok(scripts.length >= 9);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio reusable-component lifecycle script ${index + 1} must compile as JavaScript.`,
    );
  }
});
