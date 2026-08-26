import type { MarketingCalendarEntry } from "../marketingPlannerTypes.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import {
  confirmTaskTruth,
  prepareTaskTruthConfirmation,
  taskTruthSnapshotToRecords,
  validateTaskTruthSnapshot,
  type TaskTruthAnswer,
  type TaskTruthQuestionnaire,
  type TaskTruthSnapshot,
} from "../taskTruth.js";
import { confirmTaskTruthWithSemanticClassifier } from "../taskTruthSemanticClassifier.js";
import type { TruthRequirement } from "../types.js";
import {
  producePlannedCampaign,
  type PlannedTruthRequirementScope,
  type ProducePlannedCampaignRequest,
  type ProducePlannedCampaignResult,
} from "./producePlannedCampaign.js";

export interface PrepareConfirmedCampaignTaskRequest {
  campaignId: string;
  entry: MarketingCalendarEntry;
  truthRecords: ProducePlannedCampaignRequest["truthRecords"];
  requirementScopes?: Record<string, PlannedTruthRequirementScope>;
  allowSourceVerified?: boolean;
  sessionId: string;
  createdAt?: string;
}

export type ConfirmedCampaignTaskResult =
  | {
      status: "TASK_CONFIRMATION_REQUIRED";
      questionnaire: TaskTruthQuestionnaire;
    }
  | {
      status: "TASK_CONFIRMATION_INVALID";
      questionnaire: TaskTruthQuestionnaire;
      issues: string[];
    }
  | {
      status: "TASK_CONFIRMED_AND_PRODUCED";
      snapshot: TaskTruthSnapshot;
      production: ProducePlannedCampaignResult;
    };

function requirementsForTask(input: {
  entry: MarketingCalendarEntry;
  scopes?: Record<string, PlannedTruthRequirementScope>;
}): TruthRequirement[] {
  return input.entry.requiredTruth.map((key) => {
    const scope = input.scopes?.[key];
    return {
      key,
      ...(input.entry.branchScope !== "BRAND_WIDE"
        ? { branchId: input.entry.branchScope }
        : {}),
      ...(scope?.productId ? { productId: scope.productId } : {}),
      ...(scope?.salesChannel ? { salesChannel: scope.salesChannel } : {}),
    };
  });
}

export function prepareConfirmedCampaignTask(
  request: PrepareConfirmedCampaignTaskRequest,
): TaskTruthQuestionnaire {
  const requirements = requirementsForTask({
    entry: request.entry,
    ...(request.requirementScopes ? { scopes: request.requirementScopes } : {}),
  });

  return prepareTaskTruthConfirmation({
    sessionId: request.sessionId,
    campaignId: request.campaignId,
    tenantId: "T001",
    brandId: request.entry.brandId,
    ...(request.entry.branchScope !== "BRAND_WIDE"
      ? { branchId: request.entry.branchScope }
      : {}),
    requirements,
    records: request.truthRecords,
    ...(request.allowSourceVerified !== undefined
      ? { allowSourceVerified: request.allowSourceVerified }
      : {}),
    ...(request.createdAt ? { createdAt: request.createdAt } : {}),
    ...(request.entry.truthConfirmationHints
      ? { suggestedValues: request.entry.truthConfirmationHints }
      : {}),
  });
}

export function answerConfirmedCampaignTask(input: {
  questionnaire: TaskTruthQuestionnaire;
  answers: TaskTruthAnswer[];
  confirmedBy: string;
  confirmedAt?: string;
}): TaskTruthSnapshot {
  return confirmTaskTruth({
    questionnaire: input.questionnaire,
    answers: input.answers,
    confirmedBy: input.confirmedBy,
    ...(input.confirmedAt ? { confirmedAt: input.confirmedAt } : {}),
  });
}

export async function answerConfirmedCampaignTaskSemantically(input: {
  questionnaire: TaskTruthQuestionnaire;
  answers: TaskTruthAnswer[];
  confirmedBy: string;
  confirmedAt?: string;
  classifierProvider: CampaignGenerationProvider;
}): Promise<TaskTruthSnapshot> {
  return confirmTaskTruthWithSemanticClassifier(
    {
      questionnaire: input.questionnaire,
      answers: input.answers,
      confirmedBy: input.confirmedBy,
      ...(input.confirmedAt ? { confirmedAt: input.confirmedAt } : {}),
    },
    input.classifierProvider,
  );
}

/**
 * Canonical user-facing production gateway.
 *
 * Phase 1: call without taskTruthSnapshot -> receive every task-relevant fact
 *          as a grouped confirmation/input questionnaire. No AI is called.
 * Phase 2: call again with the user's immutable snapshot -> production runs
 *          only from that snapshot, never directly from stored truth.
 */
export async function runConfirmedCampaignTask(input: {
  productionRequest: ProducePlannedCampaignRequest;
  sessionId: string;
  taskTruthSnapshot?: TaskTruthSnapshot;
}): Promise<ConfirmedCampaignTaskResult> {
  const questionnaire = prepareConfirmedCampaignTask({
    campaignId: input.productionRequest.campaignId,
    entry: input.productionRequest.entry,
    truthRecords: input.productionRequest.truthRecords,
    ...(input.productionRequest.requirementScopes
      ? { requirementScopes: input.productionRequest.requirementScopes }
      : {}),
    ...(input.productionRequest.allowSourceVerified !== undefined
      ? { allowSourceVerified: input.productionRequest.allowSourceVerified }
      : {}),
    sessionId: input.sessionId,
  });

  if (!input.taskTruthSnapshot) {
    return { status: "TASK_CONFIRMATION_REQUIRED", questionnaire };
  }

  const requirements = requirementsForTask({
    entry: input.productionRequest.entry,
    ...(input.productionRequest.requirementScopes
      ? { scopes: input.productionRequest.requirementScopes }
      : {}),
  });
  const validation = validateTaskTruthSnapshot({
    snapshot: input.taskTruthSnapshot,
    campaignId: input.productionRequest.campaignId,
    tenantId: "T001",
    brandId: input.productionRequest.entry.brandId,
    ...(input.productionRequest.entry.branchScope !== "BRAND_WIDE"
      ? { branchId: input.productionRequest.entry.branchScope }
      : {}),
    requirements,
  });

  if (!validation.valid) {
    return {
      status: "TASK_CONFIRMATION_INVALID",
      questionnaire,
      issues: validation.issues,
    };
  }

  const production = await producePlannedCampaign({
    ...input.productionRequest,
    truthRecords: taskTruthSnapshotToRecords(input.taskTruthSnapshot),
  });

  return {
    status: "TASK_CONFIRMED_AND_PRODUCED",
    snapshot: input.taskTruthSnapshot,
    production,
  };
}
