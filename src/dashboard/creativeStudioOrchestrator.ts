import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { assertCreativeBrief, type CreativeBrief } from "../creativeStudio/contracts/creativeBrief.js";
import { createCreativeOrchestrationPlan } from "../creativeStudio/orchestrator.js";
import { FileCreativeOrchestrationStore } from "../creativeStudio/orchestrationStore.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 256 * 1024) throw new Error("Creative Orchestrator request exceeds 256 KB.");
    chunks.push(buffer);
  }
  return chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
    : {};
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function objectValue(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function truthSnapshotValue(value: unknown): TaskTruthSnapshot {
  const snapshot = objectValue(value, "taskTruthSnapshot");
  for (const field of ["sessionId", "campaignId", "tenantId", "brandId", "confirmedBy", "confirmedAt"] as const) {
    if (typeof snapshot[field] !== "string" || !String(snapshot[field]).trim()) {
      throw new Error(`taskTruthSnapshot.${field} is required.`);
    }
  }
  if (!Array.isArray(snapshot.facts)) throw new Error("taskTruthSnapshot.facts must be an array.");
  return snapshot as unknown as TaskTruthSnapshot;
}

function briefValue(value: unknown): CreativeBrief {
  return assertCreativeBrief(objectValue(value, "brief") as unknown as CreativeBrief);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioOrchestratorHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioOrchestratorHandler(
  options: CreativeStudioOrchestratorHandlerOptions = {},
) {
  const store = new FileCreativeOrchestrationStore(resolve(options.rootDir ?? ".atthas-os"));

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/orchestration") {
      const campaignId = safeId(url.searchParams.get("campaignId") ?? "", "campaignId");
      const plan = await store.getCurrentForCampaign(campaignId);
      if (!plan) {
        sendJson(res, 404, { error: "orchestration_not_found", campaignId });
        return true;
      }
      sendJson(res, 200, plan);
      return true;
    }

    if (req.method !== "POST" || url.pathname !== "/api/studio/orchestrate") return false;
    const data = await readBody(req);
    const campaignId = safeId(data.campaignId, "campaignId");
    const brief = briefValue(data.brief);
    const truthSnapshot = truthSnapshotValue(data.taskTruthSnapshot);
    const plan = createCreativeOrchestrationPlan({ campaignId, brief, truthSnapshot });
    const saved = await store.create(plan);
    sendJson(res, 201, saved);
    return true;
  };
}
