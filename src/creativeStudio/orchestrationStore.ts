import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  assertCreativeOrchestrationPlan,
  type CreativeOrchestrationPlan,
} from "./orchestrator.js";
import {
  assertCreativeOrchestrationExecution,
  type CreativeOrchestrationExecution,
} from "./orchestrationExecution.js";

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export class FileCreativeOrchestrationStore {
  readonly rootDir: string;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
  }

  private planPath(planId: string): string {
    return join(this.rootDir, "orchestrations", "plans", `${safeId(planId, "orchestrationId")}.json`);
  }

  private executionPath(planId: string): string {
    return join(this.rootDir, "orchestrations", "executions", `${safeId(planId, "orchestrationId")}.json`);
  }

  private campaignCurrentPath(campaignId: string): string {
    return join(this.rootDir, "orchestrations", "campaigns", `${safeId(campaignId, "campaignId")}.json`);
  }

  async create(planInput: CreativeOrchestrationPlan): Promise<CreativeOrchestrationPlan> {
    const plan = assertCreativeOrchestrationPlan(planInput);
    const existing = await this.get(plan.id);
    if (existing) {
      if (stableJson(existing) !== stableJson(plan)) {
        throw new Error(`ORCHESTRATION_CONFLICT: immutable plan ${plan.id} already exists with different content.`);
      }
      return existing;
    }
    await Promise.all([
      writeJson(this.planPath(plan.id), plan),
      writeJson(this.campaignCurrentPath(plan.campaignId), { orchestrationId: plan.id }),
    ]);
    return plan;
  }

  async get(planId: string): Promise<CreativeOrchestrationPlan | undefined> {
    const value = await readJson<CreativeOrchestrationPlan>(this.planPath(planId));
    return value ? assertCreativeOrchestrationPlan(value) : undefined;
  }

  async getCurrentForCampaign(campaignId: string): Promise<CreativeOrchestrationPlan | undefined> {
    const current = await readJson<{ orchestrationId?: string }>(this.campaignCurrentPath(campaignId));
    if (!current?.orchestrationId) return undefined;
    const plan = await this.get(current.orchestrationId);
    if (!plan) throw new Error(`ORCHESTRATION_INDEX_BROKEN: plan ${current.orchestrationId} is missing.`);
    if (plan.campaignId !== safeId(campaignId, "campaignId")) {
      throw new Error("ORCHESTRATION_INDEX_BROKEN: current plan belongs to a different campaign.");
    }
    return plan;
  }

  async saveExecution(
    executionInput: CreativeOrchestrationExecution,
  ): Promise<CreativeOrchestrationExecution> {
    const execution = assertCreativeOrchestrationExecution(executionInput);
    const plan = await this.get(execution.orchestrationId);
    if (!plan) throw new Error(`ORCHESTRATION_NOT_FOUND: ${execution.orchestrationId}.`);
    if (plan.campaignId !== execution.campaignId
      || plan.truthSnapshotId !== execution.truthSnapshotId
      || plan.clientId !== execution.clientId
      || plan.brandId !== execution.brandId) {
      throw new Error("ORCHESTRATION_EXECUTION_MISMATCH: execution does not match its immutable plan.");
    }
    const existing = await this.getExecution(execution.orchestrationId);
    if (existing) {
      if (stableJson(existing) !== stableJson(execution)) {
        throw new Error(`ORCHESTRATION_EXECUTION_CONFLICT: execution for ${execution.orchestrationId} already exists with different content.`);
      }
      return existing;
    }
    await writeJson(this.executionPath(execution.orchestrationId), execution);
    return execution;
  }

  async getExecution(planId: string): Promise<CreativeOrchestrationExecution | undefined> {
    const value = await readJson<CreativeOrchestrationExecution>(this.executionPath(planId));
    return value ? assertCreativeOrchestrationExecution(value) : undefined;
  }
}
