import assert from "node:assert/strict";
import test from "node:test";

import { getCreativeTruthProvider, listCreativeTruthProviders } from "../src/creativeStudio/truthProviders/registry.js";

test("ATTHAS truth provider preserves the existing hard questionnaire confirmation gate", () => {
  const providers = listCreativeTruthProviders();
  assert.equal(providers.length, 1);
  const provider = getCreativeTruthProvider("T001");
  assert.equal(provider.providerId, "ATTHAS_UI_TRUTH_V1");
  assert.equal(provider.factGateMode, "QUESTIONNAIRE_CONFIRMATION");
  assert.equal(provider.confirmationRequired, true);
  assert.equal(provider.immutableSnapshotRequired, true);
  assert.deepEqual(provider.endpoints, {
    bootstrap: "/api/ui/bootstrap",
    prepare: "/api/ui/prepare",
    confirm: "/api/ui/confirm",
    upload: "/api/ui/upload",
    produce: "/api/ui/produce",
  });
});

test("unknown clients cannot silently fall back to another truth provider", () => {
  assert.throws(() => getCreativeTruthProvider("UNKNOWN"), /CREATIVE_TRUTH_PROVIDER_NOT_FOUND/);
});
