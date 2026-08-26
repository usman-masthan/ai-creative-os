export type TaskTruthValueClassification = "FACT" | "INSTRUCTION" | "AMBIGUOUS";

export interface TaskTruthValueValidation {
  classification: TaskTruthValueClassification;
  reason?: string;
}

const PLACEHOLDER = /^(?:tbd|tbc|todo|unknown|n\/?a\??|none yet|not sure|select(?: one)?|choose(?: one)?|pick(?: one)?|enter(?: value)?|type here|placeholder|[-_.]{2,})$/i;
const INSTRUCTION_START = /^(?:confirm|replace|select|upload|choose|pick|enter|type|provide|please provide|please enter|please select|please choose|one of the following)\b/i;
const QUESTION_START = /^(?:what|which|where|when|who|why|how|is|are|am|do|does|did|can|could|should|would|will|may)\b/i;

function classifyString(raw: string): TaskTruthValueValidation {
  const value = raw.trim();
  if (!value) {
    return { classification: "INSTRUCTION", reason: "empty value" };
  }
  if (PLACEHOLDER.test(value)) {
    return { classification: "INSTRUCTION", reason: "placeholder value" };
  }
  if (INSTRUCTION_START.test(value)) {
    return { classification: "INSTRUCTION", reason: "instructional wording" };
  }
  if (value.endsWith("?") || QUESTION_START.test(value) && /\?$/.test(value)) {
    return { classification: "INSTRUCTION", reason: "question wording" };
  }
  if (/\b(?:confirm|replace|select|upload|choose|provide)\b/i.test(value) && value.length < 80) {
    return { classification: "AMBIGUOUS", reason: "confirmation-like wording" };
  }
  return { classification: "FACT" };
}

export function classifyTaskTruthValue(value: unknown): TaskTruthValueValidation {
  if (typeof value === "string") return classifyString(value);
  if (value === null || value === undefined) {
    return { classification: "INSTRUCTION", reason: "missing value" };
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = classifyTaskTruthValue(item);
      if (result.classification !== "FACT") return result;
    }
    return { classification: "FACT" };
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const result = classifyTaskTruthValue(item);
      if (result.classification !== "FACT") return result;
    }
    return { classification: "FACT" };
  }
  return { classification: "FACT" };
}

export function assertTaskTruthValueIsFact(value: unknown): void {
  const result = classifyTaskTruthValue(value);
  if (result.classification === "FACT") return;

  if (result.classification === "AMBIGUOUS") {
    throw new Error(
      "This value is ambiguous and requires semantic review before it can be frozen as task truth.",
    );
  }

  throw new Error(
    "This appears to be an instruction rather than a confirmed fact. Please enter the actual value.",
  );
}
