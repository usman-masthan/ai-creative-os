import type {
  CreativeDirectorConceptReview,
  CreativeDirectorReview,
  CreativeDirectorScores,
} from "./creativeDirectorTypes.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid Creative Director output: ${path} must be a non-empty string.`);
  }
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Invalid Creative Director output: ${path} must be a string array.`);
  }
  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid Creative Director output: ${path} must be boolean.`);
  }
  return value;
}

function requireScore(value: unknown, path: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10) {
    throw new Error(`Invalid Creative Director output: ${path} must be an integer from 1 to 10.`);
  }
  return value as number;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Invalid Creative Director output: provider did not return a JSON object.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid Creative Director output: malformed JSON (${message}).`);
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid Creative Director output: root must be an object.");
  }
  return parsed;
}

function parseScores(value: unknown, path: string): CreativeDirectorScores {
  if (!isRecord(value)) {
    throw new Error(`Invalid Creative Director output: ${path} must be an object.`);
  }

  return {
    strategicFit: requireScore(value.strategicFit, `${path}.strategicFit`),
    brandFit: requireScore(value.brandFit, `${path}.brandFit`),
    originality: requireScore(value.originality, `${path}.originality`),
    emotionalStrength: requireScore(value.emotionalStrength, `${path}.emotionalStrength`),
    conversionPotential: requireScore(value.conversionPotential, `${path}.conversionPotential`),
    visualPotential: requireScore(value.visualPotential, `${path}.visualPotential`),
    factualSafety: requireScore(value.factualSafety, `${path}.factualSafety`),
    productionEfficiency: requireScore(value.productionEfficiency, `${path}.productionEfficiency`),
  };
}

function totalScore(scores: CreativeDirectorScores): number {
  return Object.values(scores).reduce((sum, value) => sum + value, 0);
}

function parseReview(value: unknown, index: number): CreativeDirectorConceptReview {
  if (!isRecord(value)) {
    throw new Error(`Invalid Creative Director output: reviews[${index}] must be an object.`);
  }

  const expectedId = `C${index + 1}` as "C1" | "C2" | "C3";
  if (value.conceptId !== expectedId) {
    throw new Error(`Invalid Creative Director output: reviews[${index}].conceptId must be ${expectedId}.`);
  }

  const scores = parseScores(value.scores, `reviews[${index}].scores`);
  return {
    conceptId: expectedId,
    scores,
    totalScore: totalScore(scores),
    strengths: requireStringArray(value.strengths, `reviews[${index}].strengths`),
    weaknesses: requireStringArray(value.weaknesses, `reviews[${index}].weaknesses`),
    risks: requireStringArray(value.risks, `reviews[${index}].risks`),
  };
}

export function parseCreativeDirectorReview(raw: string): CreativeDirectorReview {
  const root = parseJsonObject(raw);
  if (!Array.isArray(root.reviews) || root.reviews.length !== 3) {
    throw new Error("Invalid Creative Director output: exactly 3 reviews are required.");
  }

  const reviews = root.reviews.map(parseReview);
  const maxScore = Math.max(...reviews.map((review) => review.totalScore));
  const winnerConceptId = root.winnerConceptId;
  if (winnerConceptId !== "C1" && winnerConceptId !== "C2" && winnerConceptId !== "C3") {
    throw new Error("Invalid Creative Director output: winnerConceptId must be C1, C2 or C3.");
  }

  const winner = reviews.find((review) => review.conceptId === winnerConceptId)!;
  if (winner.totalScore !== maxScore) {
    throw new Error(
      `Invalid Creative Director output: winner ${winnerConceptId} must have the highest deterministic score.`,
    );
  }

  const escalationValue = root.escalation;
  if (!isRecord(escalationValue)) {
    throw new Error("Invalid Creative Director output: escalation must be an object.");
  }

  return {
    reviews,
    winnerConceptId,
    winnerRationale: requireString(root.winnerRationale, "winnerRationale"),
    improvementDirectives: requireStringArray(root.improvementDirectives, "improvementDirectives"),
    escalation: {
      recommended: requireBoolean(escalationValue.recommended, "escalation.recommended"),
      reasons: requireStringArray(escalationValue.reasons, "escalation.reasons"),
    },
  };
}
