import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import { reviewLayeredDesignWithCreativeDirector } from "../creativeDirectorLayered.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { createGeminiCampaignProvider } from "../providers/gemini.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 256 * 1024) throw new Error("Creative Director request exceeds 256 KB.");
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

export interface CreativeStudioDirectorHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioDirectorHandler(options: CreativeStudioDirectorHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const store = new FileDesignProjectStore(rootDir);
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/ai/review") return false;
    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new Error("GEMINI_API_KEY is required for Creative Director review.");
    }
    const data = await readBody(req);
    const designId = safeId(data.designId, "designId");
    const project = await store.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const trace = await readAiTrace(join(rootDir, "outputs", project.document.campaignId));
    const truth = snapshotFromTruth(trace.truth);
    if (!truth) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: Creative Director review requires governed task truth.");
    const qa = runDesignQa({ document: project.document, truthSnapshot: truth });
    const review = await reviewLayeredDesignWithCreativeDirector({
      document: project.document,
      deterministicQa: qa,
      provider: createGeminiCampaignProvider({ role: "creative" }),
    });
    await store.saveDirectorReview(designId, review);
    sendJson(res, 200, review);
    return true;
  };
}
