import { ATTHAS_CREATIVE_CLIENT_PROFILE } from "./atthas.js";
import type { CreativeBrandTheme, CreativeClientProfile } from "./types.js";

const PROFILES: Record<string, CreativeClientProfile> = {
  [ATTHAS_CREATIVE_CLIENT_PROFILE.clientId]: ATTHAS_CREATIVE_CLIENT_PROFILE,
};

export function listCreativeClientProfiles(): CreativeClientProfile[] {
  return Object.values(PROFILES);
}

export function getCreativeClientProfile(clientId: string): CreativeClientProfile {
  const profile = PROFILES[clientId.trim()];
  if (!profile) throw new Error(`CREATIVE_CLIENT_PROFILE_NOT_FOUND: ${clientId}.`);
  return profile;
}

export function getCreativeBrandTheme(clientId: string, brandId: string): CreativeBrandTheme {
  const profile = getCreativeClientProfile(clientId);
  const theme = profile.brands[brandId.trim()];
  if (!theme) throw new Error(`CREATIVE_BRAND_PROFILE_NOT_FOUND: ${clientId}/${brandId}.`);
  return theme;
}
