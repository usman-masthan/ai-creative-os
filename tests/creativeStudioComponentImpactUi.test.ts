import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioComponentImpactHtml } from "../src/dashboard/creativeStudioComponentImpactHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes component dependency impact analysis and lifecycle gating", () => {
  const html = creativeStudioComponentImpactHtml();
  assert.match(html, /Dependency Impact/);
  assert.match(html, /Analyze Selected Version Impact/);
  assert.match(html, /\/api\/studio\/components\/impact\?/);
  assert.match(html, /FROZEN_APPROVED/);
  assert.match(html, /missingTruthKeys/);
  assert.match(html, /missingTextRoles/);
  assert.match(html, /impactToken:report\.impactToken/);
  assert.match(html, /approved\/frozen/i);
});

test("semantic component authoring submits candidate impact evidence", () => {
  const html = creativeStudioComponentImpactHtml();
  assert.match(html, /Existing-family impact/);
  assert.match(html, /expectedImpactToken/);
  assert.match(html, /dependency-impact review/i);
  assert.match(html, /Existing design instances remain unchanged/i);
});

test("all active component impact Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioComponentImpactHtml());
  assert.ok(scripts.length >= 12);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio component-impact script ${index + 1} must compile as JavaScript.`,
    );
  }
});
