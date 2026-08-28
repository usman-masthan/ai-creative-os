import { resolve, sep } from "node:path";

import type { DesignAssetRef } from "../designDocument/types.js";
import { getCreativeClientProfile } from "./clientProfiles/registry.js";

function within(path: string, root: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedPath = resolve(path);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + sep);
}

export function resolveGovernedStudioAssetPath(input: {
  path: string;
  asset: DesignAssetRef;
  clientId: string;
  rootDir: string;
  repoRoot: string;
}): string {
  const path = resolve(input.path);
  if (input.asset.source === "approved-brand") {
    const profile = getCreativeClientProfile(input.clientId);
    const approvedRoot = resolve(input.repoRoot, profile.approvedAssetRoot);
    if (!within(path, approvedRoot)) {
      throw new Error(
        `BRAND_ASSET_PATH_BLOCK: approved asset for ${profile.clientId} is outside ${profile.approvedAssetRoot}.`,
      );
    }
    return path;
  }

  const runtimeRoot = resolve(input.rootDir);
  if (!within(path, runtimeRoot)) {
    throw new Error("ASSET_PATH_BLOCK: runtime asset is outside Creative OS storage.");
  }
  return path;
}
