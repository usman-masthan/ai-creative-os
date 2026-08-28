import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import type { CampaignProductionFormat } from "../creativeTypes.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { reviewLayeredFinalVisual } from "../creativeStudio/finalVisualQa.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { exportDesignDocumentPng } from "../creativeStudio/renderDesignDocument.js";
import { GeminiFinalArtQaProvider } from "../finalArtQa/gemini.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> : {};
}

function safeId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error("designId contains unsafe characters.");
  }
  return value.trim();
}

function snapshotFromTruth(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function sendJson(res: ServerResponse, value: unknown): void {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioFinalVisualQaHandlerOptions { rootDir?: string }

export function createCreativeStudioFinalVisualQaHandler(options: CreativeStudioFinalVisualQaHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const store = new FileDesignProjectStore(rootDir);
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/final-visual-qa") return false;
    if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is required for final visual QA.");

    const data = await readBody(req);
    const designId = safeId(data.designId);
    const project = await store.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const trace = await readAiTrace(join(rootDir, "outputs", project.document.campaignId));
    const truth = snapshotFromTruth(trace.truth);
    if (!truth) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: final visual QA requires task truth.");
    const deterministicQa = runDesignQa({ document: project.document, truthSnapshot: truth });
    if (deterministicQa.decision === "BLOCK") {
      throw new Error("FINAL_QA_BLOCK: resolve deterministic blockers before final visual QA.");
    }

    const rendererCall = [...trace.renderer.calls].reverse().find((call) => call.request);
    const renderer = objectValue(rendererCall?.request);
    const tracedFormat = renderer?.format as CampaignProductionFormat | undefined;
    const format: CampaignProductionFormat = tracedFormat
      ? { ...tracedFormat, width: project.document.artboard.width, height: project.document.artboard.height }
      : {
          channel: "instagram",
          assetType: "poster",
          aspectRatio: `${project.document.artboard.width}:${project.document.artboard.height}`,
          width: project.document.artboard.width,
          height: project.document.artboard.height,
        };
    const outputDir = join(rootDir, "designs", designId, "final-visual-qa");
    const rendered = await exportDesignDocumentPng({
      document: project.document,
      outputDir,
      preset: "standard",
      ...(process.env.CHROME_PATH?.trim() ? { chromePath: process.env.CHROME_PATH.trim() } : {}),
    });
    const review = await reviewLayeredFinalVisual({
      document: project.document,
      truthSnapshot: truth,
      format,
      pngPath: rendered.outputPath,
      provider: new GeminiFinalArtQaProvider(),
    });
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, `final-visual-qa-v${project.document.version}.json`), `${JSON.stringify(review, null, 2)}\n`, "utf8");
    sendJson(res, {
      designId,
      version: project.document.version,
      deterministicDecision: deterministicQa.decision,
      review,
    });
    return true;
  };
}
