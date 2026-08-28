import test from "node:test";
import assert from "node:assert/strict";

import { creativeStudioFinalHtml } from "../src/dashboard/creativeStudioFinalHtml.js";

test("final Studio UI exposes flattened QA, approval, approved export and migration controls", () => {
  const html = creativeStudioFinalHtml();
  assert.match(html, /id="visualQaBtn"/);
  assert.match(html, /id="parityBtn"/);
  assert.match(html, /id="approvalBadge"/);
  assert.match(html, /id="approveVersionBtn"/);
  assert.match(html, /id="approvedExportBtn"/);
  assert.match(html, /\/api\/studio\/final-visual-qa/);
  assert.match(html, /\/api\/studio\/approval\?designId=/);
  assert.match(html, /\/api\/studio\/approve-version/);
  assert.match(html, /\/api\/studio\/export-approved/);
  assert.match(html, /\/api\/studio\/parity\?designId=/);
  assert.match(html, /Any later edit will require a new visual QA and approval/);
  assert.match(html, /id="directionsBtn"/);
  assert.match(html, /id="directionModal"/);
  assert.match(html, /Generate 3 Directions/);
  assert.match(html, /Apply Safe Auto-Polish/);
});
