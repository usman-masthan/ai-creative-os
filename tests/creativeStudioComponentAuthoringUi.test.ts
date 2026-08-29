import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioComponentAuthoringHtml } from "../src/dashboard/creativeStudioComponentAuthoringHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes governed component version authoring", () => {
  const html = creativeStudioComponentAuthoringHtml();
  assert.match(html, /Author New Version/);
  assert.match(html, /Preview Version Changes/);
  assert.match(html, /Publish as Next Immutable Version/);
  assert.match(html, /Required version notes|Required version notes:/i);
  assert.match(html, /\/api\/studio\/components\/version-preview/);
  assert.match(html, /\/api\/studio\/components\/publish-version/);
  assert.match(html, /\/api\/studio\/components\/version-audit/);
  assert.match(html, /REVIEW_REQUIRED/);
  assert.match(html, /previewToken/);
  assert.match(html, /expectedBaseComponentId/);
});

test("component authoring UI keeps publish explicit and invalidates stale previews", () => {
  const html = creativeStudioComponentAuthoringHtml();
  assert.match(html, /pending=null/);
  assert.match(html, /designVersion/);
  assert.match(html, /Preview is stale|preview is stale/i);
  assert.match(html, /acceptReviewRequired/);
  assert.match(html, /Existing instances were not changed/);
  assert.match(html, /versionNotes/);
});

test("all active component-authoring Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioComponentAuthoringHtml());
  assert.ok(scripts.length >= 10);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio component-authoring script ${index + 1} must compile as JavaScript.`,
    );
  }
});
