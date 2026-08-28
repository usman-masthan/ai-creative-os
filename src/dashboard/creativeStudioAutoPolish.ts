import { join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readAiTrace } from "../aiTrace.js";
import { autoPolishDesign } from "../creativeStudio/autoPolish.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new Error("Auto-polish request exceeds 64 KB.");
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

function snapshotFromTruth(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioAutoPolishHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioAutoPolishHandler(options: CreativeStudioAutoPolishHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const store = new FileDesignProjectStore(rootDir);
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/auto-polish") return false;
    const data = await readBody(req);
    const designId = safeId(data.designId, "designId");
    const project = await store.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const trace = await readAiTrace(join(rootDir, "outputs", project.document.campaignId));
    const truth = snapshotFromTruth(trace.truth);
    if (!truth) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: deterministic polish requires governed task truth.");

    const beforeQa = runDesignQa({ document: project.document, truthSnapshot: truth });
    const polished = autoPolishDesign({ document: project.document, qa: beforeQa });
    let current = project;
    if (polished.applied.length) current = await store.save(polished.document);
    const afterQa = runDesignQa({ document: current.document, truthSnapshot: truth });
    await store.saveQa(designId, {
      checkedAt: afterQa.checkedAt,
      decision: afterQa.decision,
      issues: afterQa.issues,
    });
    sendJson(res, 200, {
      designId,
      version: current.document.version,
      applied: polished.applied,
      beforeDecision: beforeQa.decision,
      afterQa,
    });
    return true;
  };
}
