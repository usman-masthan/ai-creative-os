import test from "node:test";
import assert from "node:assert/strict";

import { creativeStudioFinalHtml } from "../src/dashboard/creativeStudioFinalHtml.js";

test("final Studio UI exposes flattened visual QA and migration parity controls", () => {
  const html = creativeStudioFinalHtml();
  assert.match(html, /id="visualQaBtn"/);
  assert.match(html, /id="parityBtn"/);
  assert.match(html, /\/api\/studio\/final-visual-qa/);
  assert.match(html, /\/api\/studio\/parity\?designId=/);
  assert.match(html, /id="directionsBtn"/);
  assert.match(html, /id="directionModal"/);
  assert.match(html, /Generate 3 Directions/);
  assert.match(html, /Apply Safe Auto-Polish/);
});
