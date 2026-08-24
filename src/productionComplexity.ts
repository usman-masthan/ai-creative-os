import type {
  CampaignCreativeOutput,
  CampaignProductionComplexity,
} from "./creativeTypes.js";

interface Rule {
  label: string;
  points: number;
  terms: string[];
}

const rules: Rule[] = [
  {
    label: "people or hands",
    points: 2,
    terms: ["person", "people", "friend", "family", "hand", "hands", "group"],
  },
  {
    label: "phone or app-device scene",
    points: 2,
    terms: ["phone", "smartphone", "mobile screen", "app screen"],
  },
  {
    label: "third-party logo or icon",
    points: 2,
    terms: ["uber eats icon", "uber eats logo", "third-party logo", "brand mark"],
  },
  {
    label: "multiple products or complex table scene",
    points: 2,
    terms: ["several burgers", "multiple burgers", "tabletop", "table scene", "sharing burgers"],
  },
  {
    label: "complex environmental scene",
    points: 1,
    terms: ["street backdrop", "restaurant interior", "home setting", "city", "neon"],
  },
  {
    label: "motion or flying food elements",
    points: 1,
    terms: ["crumbs flying", "splash", "motion blur", "flying"],
  },
];

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}

function removeNegativeClauses(value: string): string {
  return value
    .replace(/\b(?:no|without|avoid|exclude|do not|don't)\s+[^,.;\n]+/gi, " ")
    .replace(/\s+/g, " ");
}

export function evaluateProductionComplexity(
  creative: CampaignCreativeOutput,
): CampaignProductionComplexity {
  const recommended = creative.concepts.find(
    (concept) => concept.id === creative.recommendedConceptId,
  );

  const productionText = normalize(
    [
      recommended?.visualConcept ?? "",
      creative.creativeBrief.visualDirection,
      creative.creativeBrief.composition,
      creative.imageGeneration.basePrompt,
      ...creative.imageGeneration.visualConstraints,
    ]
      .map(removeNegativeClauses)
      .join("\n"),
  );

  let score = 0;
  const reasons: string[] = [];

  for (const rule of rules) {
    if (rule.terms.some((term) => productionText.includes(term))) {
      score += rule.points;
      reasons.push(rule.label);
    }
  }

  score = Math.min(score, 10);
  const level = score <= 2 ? "low" : score <= 5 ? "medium" : "high";

  return {
    score,
    level,
    reasons,
  };
}
