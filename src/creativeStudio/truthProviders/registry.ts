import { ATTHAS_CREATIVE_TRUTH_PROVIDER } from "./atthas.js";
import type { CreativeTruthProviderDescriptor } from "./types.js";

const PROVIDERS: Record<string, CreativeTruthProviderDescriptor> = {
  [ATTHAS_CREATIVE_TRUTH_PROVIDER.clientId]: ATTHAS_CREATIVE_TRUTH_PROVIDER,
};

export function listCreativeTruthProviders(): CreativeTruthProviderDescriptor[] {
  return Object.values(PROVIDERS);
}

export function getCreativeTruthProvider(clientId: string): CreativeTruthProviderDescriptor {
  const provider = PROVIDERS[clientId.trim()];
  if (!provider) throw new Error(`CREATIVE_TRUTH_PROVIDER_NOT_FOUND: ${clientId}.`);
  return provider;
}
