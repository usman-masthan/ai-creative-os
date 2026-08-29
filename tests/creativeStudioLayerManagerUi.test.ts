import assert from "node:assert/strict";
import test from "node:test";

import { creativeStudioLayerManagerHtml } from "../src/dashboard/creativeStudioLayerManagerHtml.js";

function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

test("active Studio exposes hierarchical layer management controls", () => {
  const html = creativeStudioLayerManagerHtml();
  assert.match(html, /id='layerOrderControls'|id="layerOrderControls"|block\.id='layerOrderControls'/);
  assert.match(html, /data-layer-order=\\?"FRONT\\?"|data-layer-order="FRONT"/);
  assert.match(html, /data-layer-order=\\?"FORWARD\\?"|data-layer-order="FORWARD"/);
  assert.match(html, /data-layer-order=\\?"BACKWARD\\?"|data-layer-order="BACKWARD"/);
  assert.match(html, /data-layer-order=\\?"BACK\\?"|data-layer-order="BACK"/);
  assert.match(html, /Duplicate Whole Group/);
  assert.match(html, /data-group-toggle/);
  assert.match(html, /data-layer-label/);
  assert.match(html, /RENAME_LAYER/);
  assert.match(html, /REORDER_LAYERS/);
  assert.match(html, /DUPLICATE_GROUP/);
  assert.match(html, /Cmd\/Ctrl\+\]/);
});

test("hierarchical layer panel renders group children once and keeps collapse state transient", () => {
  const html = creativeStudioLayerManagerHtml();
  assert.match(html, /var collapsed=new Set\(\)/);
  assert.match(html, /parentMap\(d\)/);
  assert.match(html, /layer\.childLayerIds/);
  assert.match(html, /collapsed\.has\(layer\.id\)/);
  assert.match(html, /group-child/);
});

test("all active layer-manager Studio inline scripts compile as JavaScript", () => {
  const scripts = inlineScripts(creativeStudioLayerManagerHtml());
  assert.ok(scripts.length >= 7);
  for (const [index, script] of scripts.entries()) {
    assert.doesNotThrow(
      () => new Function(script),
      `Inline Studio layer-manager script ${index + 1} must compile as JavaScript.`,
    );
  }
});
