import { ATTHAS_CREATIVE_LAYOUT_PROVIDER } from "./atthas.js";
import type { CreativeLayoutProvider } from "./types.js";

const PROVIDERS: Record<string, CreativeLayoutProvider> = {
  [ATTHAS_CREATIVE_LAYOUT_PROVIDER.clientId]: ATTHAS_CREATIVE_LAYOUT_PROVIDER,
};

export function getCreativeLayoutProvider(clientId: string): CreativeLayoutProvider {
  const provider = PROVIDERS[clientId.trim()];
  if (!provider) throw new Error(`CREATIVE_LAYOUT_PROVIDER_NOT_FOUND: ${clientId}.`);
  return provider;
}

export function listCreativeLayoutProviders(): CreativeLayoutProvider[] {
  return Object.values(PROVIDERS);
}
