import assert from "node:assert/strict";
import test from "node:test";

import {
  assertImageEscalationAllowed,
  assertVideoEscalationAllowed,
  selectGeminiTextRole,
} from "../src/providers/geminiPolicy.js";

test("text role policy escalates only when justified", () => {
  assert.equal(selectGeminiTextRole(), "default");
  assert.equal(selectGeminiTextRole({ creativeDirection: true }), "creative");
  assert.equal(selectGeminiTextRole({ advancedReasoning: true }), "advanced");
  assert.equal(selectGeminiTextRole({ sensitive: true }), "review");
  assert.equal(selectGeminiTextRole({ majorCampaign: true, advancedReasoning: true }), "review");
});

test("paid media policy blocks premature production and premium image spending", () => {
  assert.doesNotThrow(() => assertImageEscalationAllowed("draft"));
  assert.throws(
    () => assertImageEscalationAllowed("production"),
    /conceptApproved=true/,
  );
  assert.throws(
    () => assertImageEscalationAllowed("premium", { conceptApproved: true }),
    /allowPremium=true/,
  );
  assert.doesNotThrow(() =>
    assertImageEscalationAllowed("premium", {
      conceptApproved: true,
      allowPremium: true,
    }),
  );
});

test("video policy requires approved static direction and premium override", () => {
  assert.throws(() => assertVideoEscalationAllowed("lite"), /staticDirectionApproved=true/);
  assert.doesNotThrow(() =>
    assertVideoEscalationAllowed("lite", { staticDirectionApproved: true }),
  );
  assert.throws(
    () =>
      assertVideoEscalationAllowed("premium", {
        staticDirectionApproved: true,
      }),
    /allowPremium=true/,
  );
});
