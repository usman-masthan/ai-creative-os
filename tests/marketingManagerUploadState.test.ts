import test from "node:test";
import assert from "node:assert/strict";
import { marketingManagerHtml } from "../src/dashboard/marketingManagerHtml.js";

test("Marketing Manager invalidates product-photo binding when approvals change", () => {
  const html = marketingManagerHtml();
  assert.match(html, /Image approval changed\. Re-upload and bind the image/);
  assert.match(html, /tick all three approval confirmations before binding/i);
  assert.match(html, /Advertising ✓ · Appearance ✓ · Ingredient match ✓/);
});

test("Marketing Manager list truth controls clearly support structured separators", () => {
  const html = marketingManagerHtml();
  assert.match(html, /one per line, or comma\/semicolon separated/);
  assert.match(html, /semicolon separated/);
});
