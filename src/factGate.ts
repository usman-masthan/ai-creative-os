import type { FactGateResult, VerifiedFact } from "./types.js";

export function evaluateFactGate(
  requiredKeys: string[],
  facts: VerifiedFact[],
): FactGateResult {
  const byKey = new Map(facts.map((fact) => [fact.key, fact]));

  const missing: string[] = [];
  const unverified: string[] = [];

  for (const key of requiredKeys) {
    const fact = byKey.get(key);

    if (!fact) {
      missing.push(key);
      continue;
    }

    if (!fact.verified) {
      unverified.push(key);
    }
  }

  return {
    pass: missing.length === 0 && unverified.length === 0,
    missing,
    unverified,
  };
}
