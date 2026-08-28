import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioTransformHtml } from "../src/dashboard/creativeStudioTransformHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes direct resize/rotate and keyboard transform controls", () => {
  const html = creativeStudioTransformHtml();
  assert.match(html, /id:'studioTransformControls'/);
  assert.match(html, /data-transform-handle':'resize'/);
  assert.match(html, /data-transform-handle':'rotate'/);
  assert.match(html, /type:'RESIZE_LAYER'/);
  assert.match(html, /type:'ROTATE_LAYER'/);
  assert.match(html, /type:'MOVE_LAYER'/);
  assert.match(html, /event\.shiftKey\?10:1/);
  assert.match(html, /type:'DUPLICATE_LAYER'/);
  assert.match(html, /type:'DELETE_LAYER'/);
  assert.match(html, /safeX=doc\.artboard\.width\*\.05/);
  assert.match(html, /centerX=doc\.artboard\.width\/2-layer\.width\/2/);
});

test("direct canvas transforms preserve existing logo and structure governance in the UI", () => {
  const html = creativeStudioTransformHtml();
  assert.match(html, /if\(layer\.type!==['"]logo['"]\)/);
  assert.match(html, /layer\.type!==['"]logo['"]&&layer\.type!==['"]background['"]/);
  assert.match(html, /if\(!layer\|\|!p\|\|layer\.locked\)return/);
  assert.match(html, /\/api\/studio\/operation/);
});

test("all active Studio inline browser scripts are syntactically valid JavaScript", () => {
  const scripts = inlineScripts(creativeStudioTransformHtml());
  assert.ok(scripts.length >= 5);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio script ${index + 1} must compile as JavaScript.`,
    );
  }
});
