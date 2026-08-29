import test from "node:test";
import assert from "node:assert/strict";

import { creativeStudioEnhancedHtml } from "../src/dashboard/creativeStudioEnhancedHtml.js";

test("enhanced Studio exposes advanced layered capabilities without replacing base editor", () => {
  const html = creativeStudioEnhancedHtml();
  assert.match(html, /ATTHA'S <span>Creative Studio<\/span>/);
  assert.match(html, /id="exportSvgBtn"/);
  assert.match(html, /id="segmentBtn"/);
  assert.match(html, /id="directorReviewBtn"/);
  assert.match(html, /id="adaptBtn"/);
  assert.match(html, /id="compareVersionsBtn"/);
  assert.match(html, /id="restoreVersionBtn"/);
  assert.match(html, /\/api\/studio\/export-svg/);
  assert.match(html, /\/api\/studio\/segment/);
  assert.match(html, /\/api\/studio\/ai\/review/);
  assert.match(html, /\/api\/studio\/adapt/);
  assert.match(html, /\/api\/studio\/compare/);
  assert.match(html, /\/api\/studio\/restore/);
  assert.match(html, /__creativeStudioLoadProject/);
  assert.match(html, /Original foreground pixels preserved/);
});
