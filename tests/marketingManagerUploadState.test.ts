import test from "node:test";
import assert from "node:assert/strict";
import { Script } from "node:vm";
import { marketingManagerHtml } from "../src/dashboard/marketingManagerHtml.js";

// These checks protect the operator-facing binding contract exposed by Campaign 01 validation.
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


test("generated Marketing Manager browser script is valid JavaScript", () => {
  const html = marketingManagerHtml();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  const browserScript = match?.[1];
  if (!browserScript) assert.fail("expected inline Marketing Manager script");
  assert.doesNotThrow(() => new Script(browserScript));
});
