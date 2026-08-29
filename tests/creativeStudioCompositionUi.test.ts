import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioCompositionHtml } from "../src/dashboard/creativeStudioCompositionHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes marquee selection, smart guides and atomic multi-object actions", () => {
  const html = creativeStudioCompositionHtml();
  assert.match(html, /studioMarqueeControls/);
  assert.match(html, /studioSingleSmartGuides/);
  assert.match(html, /studioSmartGuides/);
  assert.match(html, /Marquee did not intersect an editable layer/);
  assert.match(html, /smart-guide snapping/);
  assert.match(html, /id="duplicateSelectionBtn"/);
  assert.match(html, /id="deleteSelectionBtn"/);
  assert.match(html, /\/api\/studio\/multi-object/);
  assert.match(html, /type:'DUPLICATE_LAYERS'/);
  assert.match(html, /type:'DELETE_LAYERS'/);
  assert.match(html, /kind:'spacing'/);
  assert.match(html, /kind:'alignment'/);
});

test("composition selection does not admit protected structure into marquee editing", () => {
  const html = creativeStudioCompositionHtml();
  assert.match(html, /layer\.type!==['"]background['"]&&layer\.type!==['"]group['"]&&layer\.type!==['"]mask['"]/);
  assert.match(html, /!layer\.locked/);
  assert.match(html, /layer\.type===['"]background['"]\)\{beginMarquee/);
});

test("all active composition-stage Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioCompositionHtml());
  assert.ok(scripts.length >= 7);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio composition script ${index + 1} must compile as JavaScript.`,
    );
  }
});
