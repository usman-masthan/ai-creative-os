import assert from "node:assert/strict";
import test from "node:test";

import { assertCreativeClientRegistration, validateCreativeClientRegistration } from "../src/creativeStudio/clientRegistration.js";
import { getCreativeClientProfile } from "../src/creativeStudio/clientProfiles/registry.js";
import { getCreativeLayoutProvider } from "../src/creativeStudio/layoutProfiles/registry.js";
import { getCreativeTruthProvider } from "../src/creativeStudio/truthProviders/registry.js";

test("ATTHAS registration is complete across profile, layout, truth and review contracts", () => {
  const profile = getCreativeClientProfile("T001");
  const result = validateCreativeClientRegistration({
    profile,
    layoutProvider: getCreativeLayoutProvider("T001"),
    truthProvider: getCreativeTruthProvider("T001"),
  });
  assert.deepEqual(result, { valid: true, issues: [] });
  assert.doesNotThrow(() => assertCreativeClientRegistration({
    profile,
    layoutProvider: getCreativeLayoutProvider("T001"),
    truthProvider: getCreativeTruthProvider("T001"),
  }));
});

test("incomplete review context and unsafe approved asset paths fail registration", () => {
  const source = getCreativeClientProfile("T001");
  const burger = source.brands.ATTHAS_BURGER!;
  const profile = {
    ...source,
    brands: {
      ...source.brands,
      ATTHAS_BURGER: {
        ...burger,
        approvedLogoAsset: { ...burger.approvedLogoAsset, relativePath: "../other-client/logo.svg" },
        review: { ...burger.review, expectedBrandIdentifier: "", creativeDirectorGuidance: [] },
      },
    },
  };
  const result = validateCreativeClientRegistration({
    profile,
    layoutProvider: getCreativeLayoutProvider("T001"),
    truthProvider: getCreativeTruthProvider("T001"),
  });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /safe relative path/);
  assert.match(result.issues.join(" "), /expectedBrandIdentifier is required/);
  assert.match(result.issues.join(" "), /Creative Director guidance/);
});

test("cross-client layout or truth provider bindings fail closed", () => {
  const profile = getCreativeClientProfile("T001");
  const layoutProvider = { ...getCreativeLayoutProvider("T001"), clientId: "OTHER" };
  const truthProvider = { ...getCreativeTruthProvider("T001"), clientId: "OTHER" };
  const result = validateCreativeClientRegistration({ profile, layoutProvider, truthProvider });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /Layout provider OTHER does not match profile T001/);
  assert.match(result.issues.join(" "), /Truth provider OTHER does not match profile T001/);
});
