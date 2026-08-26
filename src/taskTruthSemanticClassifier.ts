import type { CampaignGenerationProvider } from "./providers/types.js";
import {
  classifyTaskTruthValue,
  type TaskTruthValueClassification,
} from "./taskTruthValidation.js";
import type {
  ConfirmTaskTruthInput,
  TaskTruthAnswer,
  TaskTruthQuestion,
  TaskTruthSnapshot,
  TaskTruthSnapshotFact,
} from "./taskTruth.js";

function parseClassifierResponse(raw: string): Exclude<TaskTruthValueClassification, "AMBIGUOUS"> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    throw new Error("Task truth semantic classifier returned malformed JSON.");
  }

  if (!value || typeof value !== "object") {
    throw new Error("Task truth semantic classifier returned an invalid response.");
  }
  const classification = (value as Record<string, unknown>).classification;
  if (classification !== "FACT" && classification !== "INSTRUCTION") {
    throw new Error("Task truth semantic classifier must return FACT or INSTRUCTION.");
  }
  return classification;
}

export async function classifyAmbiguousTaskTruthValue(
  value: unknown,
  provider: CampaignGenerationProvider,
): Promise<Exclude<TaskTruthValueClassification, "AMBIGUOUS">> {
  const deterministic = classifyTaskTruthValue(value);
  if (deterministic.classification === "FACT") return "FACT";
  if (deterministic.classification === "INSTRUCTION") return "INSTRUCTION";

  const prompt = `You are a low-cost semantic gate for task truth confirmation.
Classify the supplied USER VALUE only.

FACT = an actual concrete value that can safely be frozen as a task-scoped fact.
INSTRUCTION = a prompt, placeholder, question, command, request to select/confirm/upload/provide something, or text that is not itself the factual value.

Do not infer the missing fact. Do not rewrite the value.
Return JSON only in exactly this form:
{"classification":"FACT"}
or
{"classification":"INSTRUCTION"}

USER VALUE:
${JSON.stringify(value)}`;

  return parseClassifierResponse(await provider.generate(prompt));
}

async function assertValueIsSemanticallySafe(
  value: unknown,
  provider: CampaignGenerationProvider,
): Promise<void> {
  const classification = await classifyAmbiguousTaskTruthValue(value, provider);
  if (classification === "FACT") return;
  throw new Error(
    "This appears to be an instruction rather than a confirmed fact. Please enter the actual value.",
  );
}

async function answerValue(
  question: TaskTruthQuestion,
  answer: TaskTruthAnswer,
  provider: CampaignGenerationProvider,
): Promise<unknown> {
  if (question.kind === "CONFIRM_STORED") {
    if (answer.action === "CONFIRM") return question.storedValue;
    if (answer.action !== "REPLACE") {
      throw new Error(`${question.label} must be CONFIRM or REPLACE.`);
    }
    if (answer.value === undefined) {
      throw new Error(`${question.label} replacement value is required.`);
    }
    await assertValueIsSemanticallySafe(answer.value, provider);
    return answer.value;
  }

  if (answer.action !== "PROVIDE" && answer.action !== "REPLACE") {
    throw new Error(`${question.label} requires a provided current value.`);
  }
  if (answer.value === undefined) {
    throw new Error(`${question.label} current value is required.`);
  }
  await assertValueIsSemanticallySafe(answer.value, provider);
  return answer.value;
}

/**
 * Async confirmation path for values that may require semantic classification.
 * Deterministic FACT/INSTRUCTION decisions never spend a model call. Only an
 * AMBIGUOUS value reaches the supplied low-cost provider.
 */
export async function confirmTaskTruthWithSemanticClassifier(
  input: ConfirmTaskTruthInput,
  provider: CampaignGenerationProvider,
): Promise<TaskTruthSnapshot> {
  if (!input.confirmedBy.trim()) throw new Error("confirmedBy is required.");
  const answers = new Map(input.answers.map((answer) => [answer.label, answer]));
  if (answers.size !== input.answers.length) {
    throw new Error("Task truth answers contain duplicate labels.");
  }

  const expected = new Set(input.questionnaire.questions.map((question) => question.label));
  for (const label of answers.keys()) {
    if (!expected.has(label)) throw new Error(`Unexpected task truth answer: ${label}.`);
  }

  const facts: TaskTruthSnapshotFact[] = await Promise.all(
    input.questionnaire.questions.map(async (question): Promise<TaskTruthSnapshotFact> => {
      const answer = answers.get(question.label);
      if (!answer) throw new Error(`Task truth confirmation missing answer for ${question.label}.`);
      const value = await answerValue(question, answer, provider);
      return {
        label: question.label,
        key: question.requirement.key,
        value,
        scope: question.scope,
        confirmationAction: answer.action,
        ...(question.storedSource ? { storedSource: question.storedSource } : {}),
        ...(question.kind === "CONFIRM_STORED"
          ? { previousStoredValue: question.storedValue }
          : {}),
        updateStoredTruthRequested: answer.updateStoredTruth === true,
      };
    }),
  );

  return {
    schemaVersion: 1,
    sessionId: input.questionnaire.sessionId,
    campaignId: input.questionnaire.campaignId,
    tenantId: input.questionnaire.tenantId,
    brandId: input.questionnaire.brandId,
    ...(input.questionnaire.branchId ? { branchId: input.questionnaire.branchId } : {}),
    confirmedBy: input.confirmedBy.trim(),
    confirmedAt: input.confirmedAt ?? new Date().toISOString(),
    facts,
  };
}
