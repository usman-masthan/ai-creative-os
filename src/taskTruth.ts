import { resolveTruth, truthRequirementLabel } from "./truthResolver.js";
import type {
  TenantId,
  TruthRecord,
  TruthRequirement,
  TruthScope,
} from "./types.js";

export type TaskTruthQuestionKind =
  | "CONFIRM_STORED"
  | "PROVIDE_MISSING"
  | "RESOLVE_CONFLICT";

export interface TaskTruthQuestion {
  label: string;
  requirement: TruthRequirement;
  scope: TruthScope;
  kind: TaskTruthQuestionKind;
  prompt: string;
  storedValue?: unknown;
  storedSource?: string;
}

export interface TaskTruthQuestionnaire {
  schemaVersion: 1;
  sessionId: string;
  campaignId: string;
  tenantId: TenantId;
  brandId: string;
  branchId?: string;
  createdAt: string;
  questions: TaskTruthQuestion[];
}

export type TaskTruthAnswerAction = "CONFIRM" | "PROVIDE" | "REPLACE";

export interface TaskTruthAnswer {
  label: string;
  action: TaskTruthAnswerAction;
  value?: unknown;
  updateStoredTruth?: boolean;
}

export interface TaskTruthSnapshotFact {
  label: string;
  key: string;
  value: unknown;
  scope: TruthScope;
  confirmationAction: TaskTruthAnswerAction;
  storedSource?: string;
  previousStoredValue?: unknown;
  updateStoredTruthRequested: boolean;
}

export interface TaskTruthSnapshot {
  schemaVersion: 1;
  sessionId: string;
  campaignId: string;
  tenantId: TenantId;
  brandId: string;
  branchId?: string;
  confirmedBy: string;
  confirmedAt: string;
  facts: TaskTruthSnapshotFact[];
}

export interface PrepareTaskTruthInput {
  sessionId: string;
  campaignId: string;
  tenantId: TenantId;
  brandId: string;
  branchId?: string;
  requirements: TruthRequirement[];
  records: TruthRecord[];
  allowSourceVerified?: boolean;
  createdAt?: string;
}

export interface ConfirmTaskTruthInput {
  questionnaire: TaskTruthQuestionnaire;
  answers: TaskTruthAnswer[];
  confirmedBy: string;
  confirmedAt?: string;
}

function questionScope(input: PrepareTaskTruthInput, requirement: TruthRequirement): TruthScope {
  return {
    tenantId: input.tenantId,
    brandId: input.brandId,
    ...((requirement.branchId ?? input.branchId)
      ? { branchId: requirement.branchId ?? input.branchId }
      : {}),
    ...(requirement.productId ? { productId: requirement.productId } : {}),
    ...(requirement.salesChannel ? { salesChannel: requirement.salesChannel } : {}),
  };
}

function promptFor(input: {
  kind: TaskTruthQuestionKind;
  requirement: TruthRequirement;
  scope: TruthScope;
  storedValue?: unknown;
}): string {
  const scopeParts = [
    input.scope.branchId ? `branch ${input.scope.branchId}` : "brand-wide scope",
    input.scope.productId ? `product ${input.scope.productId}` : "",
    input.scope.salesChannel ? `channel ${input.scope.salesChannel}` : "",
  ].filter(Boolean);
  const scopeText = scopeParts.join(", ");

  if (input.kind === "CONFIRM_STORED") {
    return `Please confirm the stored ${input.requirement.key} for ${scopeText}: ${String(input.storedValue)}.`;
  }
  if (input.kind === "RESOLVE_CONFLICT") {
    return `Stored records conflict for ${input.requirement.key} (${scopeText}). Please provide the current value for this task.`;
  }
  return `No usable stored value exists for ${input.requirement.key} (${scopeText}). Please provide the current value for this task.`;
}

/**
 * Builds the complete, task-specific confirmation questionnaire.
 * Every required fact becomes a question, even when the stored value is already VERIFIED.
 * Stored truth is reference material only until the user confirms it for this task.
 */
export function prepareTaskTruthConfirmation(
  input: PrepareTaskTruthInput,
): TaskTruthQuestionnaire {
  if (!input.sessionId.trim()) throw new Error("Task truth sessionId is required.");
  if (!input.campaignId.trim()) throw new Error("Task truth campaignId is required.");
  if (!input.brandId.trim()) throw new Error("Task truth brandId is required.");

  const labels = input.requirements.map(truthRequirementLabel);
  if (new Set(labels).size !== labels.length) {
    throw new Error("Task truth requirements must be uniquely scoped.");
  }

  const questions = input.requirements.map((requirement): TaskTruthQuestion => {
    const resolution = resolveTruth({
      tenantId: input.tenantId,
      brandId: input.brandId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      requirements: [requirement],
      records: input.records,
      ...(input.allowSourceVerified !== undefined
        ? { allowSourceVerified: input.allowSourceVerified }
        : {}),
    });
    const label = truthRequirementLabel(requirement);
    const scope = questionScope(input, requirement);

    if (resolution.conflicts.includes(label)) {
      const kind: TaskTruthQuestionKind = "RESOLVE_CONFLICT";
      return {
        label,
        requirement,
        scope,
        kind,
        prompt: promptFor({ kind, requirement, scope }),
      };
    }

    const stored = resolution.facts.find((fact) => fact.key === label);
    if (stored) {
      const kind: TaskTruthQuestionKind = "CONFIRM_STORED";
      return {
        label,
        requirement,
        scope,
        kind,
        prompt: promptFor({ kind, requirement, scope, storedValue: stored.value }),
        storedValue: stored.value,
        ...(stored.source ? { storedSource: stored.source } : {}),
      };
    }

    const kind: TaskTruthQuestionKind = "PROVIDE_MISSING";
    return {
      label,
      requirement,
      scope,
      kind,
      prompt: promptFor({ kind, requirement, scope }),
    };
  });

  return {
    schemaVersion: 1,
    sessionId: input.sessionId,
    campaignId: input.campaignId,
    tenantId: input.tenantId,
    brandId: input.brandId,
    ...(input.branchId ? { branchId: input.branchId } : {}),
    createdAt: input.createdAt ?? new Date().toISOString(),
    questions,
  };
}

function answerValue(question: TaskTruthQuestion, answer: TaskTruthAnswer): unknown {
  if (question.kind === "CONFIRM_STORED") {
    if (answer.action === "CONFIRM") return question.storedValue;
    if (answer.action !== "REPLACE") {
      throw new Error(`${question.label} must be CONFIRM or REPLACE.`);
    }
    if (answer.value === undefined) {
      throw new Error(`${question.label} replacement value is required.`);
    }
    return answer.value;
  }

  if (answer.action !== "PROVIDE" && answer.action !== "REPLACE") {
    throw new Error(`${question.label} requires a provided current value.`);
  }
  if (answer.value === undefined) {
    throw new Error(`${question.label} current value is required.`);
  }
  return answer.value;
}

/**
 * Converts one complete user confirmation into an immutable task-scoped snapshot.
 * A snapshot is what production consumes; stored truth is never used silently.
 */
export function confirmTaskTruth(input: ConfirmTaskTruthInput): TaskTruthSnapshot {
  if (!input.confirmedBy.trim()) throw new Error("confirmedBy is required.");
  const answers = new Map(input.answers.map((answer) => [answer.label, answer]));
  if (answers.size !== input.answers.length) {
    throw new Error("Task truth answers contain duplicate labels.");
  }

  const expected = new Set(input.questionnaire.questions.map((question) => question.label));
  for (const label of answers.keys()) {
    if (!expected.has(label)) throw new Error(`Unexpected task truth answer: ${label}.`);
  }

  const facts = input.questionnaire.questions.map((question): TaskTruthSnapshotFact => {
    const answer = answers.get(question.label);
    if (!answer) throw new Error(`Task truth confirmation missing answer for ${question.label}.`);
    const value = answerValue(question, answer);
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
  });

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

export function taskTruthSnapshotToRecords(snapshot: TaskTruthSnapshot): TruthRecord[] {
  return snapshot.facts.map((fact) => ({
    key: fact.key,
    value: fact.value,
    status: "VERIFIED",
    sourceId: `TASK_CONFIRMATION:${snapshot.sessionId}`,
    scope: fact.scope,
    observedAt: snapshot.confirmedAt,
    timeSensitive: true,
  }));
}

export function validateTaskTruthSnapshot(input: {
  snapshot: TaskTruthSnapshot;
  campaignId: string;
  tenantId: TenantId;
  brandId: string;
  branchId?: string;
  requirements: TruthRequirement[];
}): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (input.snapshot.campaignId !== input.campaignId) issues.push("campaignId mismatch");
  if (input.snapshot.tenantId !== input.tenantId) issues.push("tenantId mismatch");
  if (input.snapshot.brandId !== input.brandId) issues.push("brandId mismatch");
  if ((input.snapshot.branchId ?? undefined) !== (input.branchId ?? undefined)) {
    issues.push("branchId mismatch");
  }

  const expected = input.requirements.map(truthRequirementLabel).sort();
  const actual = input.snapshot.facts.map((fact) => fact.label).sort();
  if (new Set(actual).size !== actual.length) issues.push("duplicate confirmed fact labels");
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    issues.push("confirmed facts do not exactly match task requirements");
  }

  for (const fact of input.snapshot.facts) {
    if (fact.scope.tenantId !== input.tenantId) issues.push(`${fact.label}: tenant scope mismatch`);
    if (fact.scope.brandId !== input.brandId) issues.push(`${fact.label}: brand scope mismatch`);
  }

  return { valid: issues.length === 0, issues };
}
