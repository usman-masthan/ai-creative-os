import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";

import { resolveGovernedStudioAssetPath } from "../src/creativeStudio/assetPathGovernance.js";
import { getCreativeBrandTheme, getCreativeClientProfile } from "../src/creativeStudio/clientProfiles/registry.js";

test("approved brand assets resolve only inside the active client profile asset root", () => {
  const repoRoot = resolve("/tmp/creative-os-repo");
  const rootDir = resolve("/tmp/creative-os-runtime");
  const approved = join(repoRoot, "clients/T001-atthas/assets/logos/source/logo.svg");

  assert.equal(resolveGovernedStudioAssetPath({
    path: approved,
    asset: { assetId: "approved-logo", source: "approved-brand" },
    clientId: "T001",
    rootDir,
    repoRoot,
  }), resolve(approved));

  assert.throws(() => resolveGovernedStudioAssetPath({
    path: join(repoRoot, "clients/other-client/assets/logo.svg"),
    asset: { assetId: "wrong-root", source: "approved-brand" },
    clientId: "T001",
    rootDir,
    repoRoot,
  }), /BRAND_ASSET_PATH_BLOCK/);

  assert.throws(() => resolveGovernedStudioAssetPath({
    path: join(repoRoot, "clients/T001-atthas/assets/../private.txt"),
    asset: { assetId: "traversal", source: "approved-brand" },
    clientId: "T001",
    rootDir,
    repoRoot,
  }), /BRAND_ASSET_PATH_BLOCK/);
});

test("registered Brand Kit preview logo resolves through the same approved asset-root guard", () => {
  const repoRoot = resolve("/tmp/creative-os-repo");
  const rootDir = resolve("/tmp/creative-os-runtime");
  const profile = getCreativeClientProfile("T001");
  const burger = getCreativeBrandTheme("T001", "ATTHAS_BURGER");
  const registeredLogo = resolve(repoRoot, profile.approvedAssetRoot, burger.approvedLogoAsset.relativePath);

  assert.equal(resolveGovernedStudioAssetPath({
    path: registeredLogo,
    asset: {
      assetId: burger.approvedLogoAsset.assetId,
      source: "approved-brand",
      mimeType: burger.approvedLogoAsset.mimeType,
    },
    clientId: profile.clientId,
    rootDir,
    repoRoot,
  }), registeredLogo);

  const escaped = resolve(repoRoot, profile.approvedAssetRoot, "../private/logo.svg");
  assert.throws(() => resolveGovernedStudioAssetPath({
    path: escaped,
    asset: { assetId: burger.approvedLogoAsset.assetId, source: "approved-brand" },
    clientId: profile.clientId,
    rootDir,
    repoRoot,
  }), /BRAND_ASSET_PATH_BLOCK/);
});

test("runtime Studio assets resolve only inside Creative OS runtime storage", () => {
  const repoRoot = resolve("/tmp/creative-os-repo");
  const rootDir = resolve("/tmp/creative-os-runtime");
  const runtimeAsset = join(rootDir, "designs/design-1/assets/generated.png");

  assert.equal(resolveGovernedStudioAssetPath({
    path: runtimeAsset,
    asset: { assetId: "generated", source: "runtime" },
    clientId: "T001",
    rootDir,
    repoRoot,
  }), resolve(runtimeAsset));

  assert.throws(() => resolveGovernedStudioAssetPath({
    path: join(repoRoot, "untrusted.png"),
    asset: { assetId: "outside", source: "runtime" },
    clientId: "T001",
    rootDir,
    repoRoot,
  }), /ASSET_PATH_BLOCK/);
});
