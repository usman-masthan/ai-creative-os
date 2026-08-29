import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioMultiSelectHtml } from "../src/dashboard/creativeStudioMultiSelectHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes multi-select arrange, grouping and distribution controls", () => {
  const html = creativeStudioMultiSelectHtml();
  assert.match(html, /id="arrangePanel"/);
  assert.match(html, /data-align="left"/);
  assert.match(html, /data-align="horizontal-center"/);
  assert.match(html, /data-align="vertical-center"/);
  assert.match(html, /data-distribute="horizontal"/);
  assert.match(html, /data-distribute="vertical"/);
  assert.match(html, /id="groupSelectionBtn"/);
  assert.match(html, /id="ungroupSelectionBtn"/);
  assert.match(html, /type:'MOVE_LAYERS'/);
  assert.match(html, /type:'ALIGN_LAYERS'/);
  assert.match(html, /type:'DISTRIBUTE_LAYERS'/);
  assert.match(html, /type:'GROUP_LAYERS'/);
  assert.match(html, /type:'UNGROUP_LAYERS'/);
  assert.match(html, /__creativeStudioMultiSelectionIds/);
  assert.match(html, /Shift\/Cmd\/Ctrl-click/);
});

test("multi-select keeps arrange work deterministic and avoids conflicting single-layer handles", () => {
  const html = creativeStudioMultiSelectHtml();
  assert.match(html, /one persisted version and zero model calls/i);
  assert.match(html, /multiSelection\(\)\.length>1/);
  assert.match(html, /studioMultiSelectionControls/);
  assert.match(html, /\/api\/studio\/operation/);
  assert.match(html, /event\.metaKey\|\|event\.ctrlKey/);
});

test("all active multi-select Studio inline browser scripts are syntactically valid JavaScript", () => {
  const scripts = inlineScripts(creativeStudioMultiSelectHtml());
  assert.ok(scripts.length >= 6);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline multi-select Studio script ${index + 1} must compile as JavaScript.`,
    );
  }
});
