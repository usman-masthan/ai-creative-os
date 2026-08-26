import type { CampaignConcept, CampaignCreativeOutput } from "./creativeTypes.js";

const STOP_WORDS = new Set([
  "a", "an", "and", "at", "be", "by", "for", "from", "in", "into", "is", "it", "of", "on",
  "or", "our", "the", "their", "this", "to", "with", "your", "atthas", "attha", "campaign", "food",
]);

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function conceptTerritory(concept: CampaignConcept): string {
  return [concept.campaignName, concept.coreIdea, concept.headlineDirection, concept.visualConcept].join(" ");
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function normalizedPhrase(value: string): string {
  return normalize(value).join(" ");
}

export function conceptDifferentiationScore(
  left: CampaignConcept,
  right: CampaignConcept,
): number {
  const territorySimilarity = jaccard(normalize(conceptTerritory(left)), normalize(conceptTerritory(right)));
  const ideaSimilarity = jaccard(normalize(left.coreIdea), normalize(right.coreIdea));
  const headlineSimilarity = jaccard(normalize(left.headlineDirection), normalize(right.headlineDirection));
  return Math.max(territorySimilarity, ideaSimilarity, headlineSimilarity);
}

export function assertConceptDifferentiation(creative: CampaignCreativeOutput): void {
  if (creative.concepts.length !== 3) return;

  for (let i = 0; i < creative.concepts.length; i += 1) {
    for (let j = i + 1; j < creative.concepts.length; j += 1) {
      const left = creative.concepts[i]!;
      const right = creative.concepts[j]!;
      const sameCoreIdea = normalizedPhrase(left.coreIdea) === normalizedPhrase(right.coreIdea);
      const sameHeadline = normalizedPhrase(left.headlineDirection) === normalizedPhrase(right.headlineDirection);
      const similarity = conceptDifferentiationScore(left, right);

      if (sameCoreIdea || sameHeadline || similarity >= 0.72) {
        throw new Error(
          `FAIL_CONCEPT_DIFFERENTIATION: ${left.id} (${left.strategicRole}) and ${right.id} (${right.strategicRole}) occupy substantially the same creative territory. Regenerate genuinely different central ideas, not CTA variants.`,
        );
      }
    }
  }
}
