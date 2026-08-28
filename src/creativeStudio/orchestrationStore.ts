import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import {
  assertCreativeOrchestrationPlan,
  type CreativeOrchestrationPlan,
} from "./orchestrator.js";

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
}
