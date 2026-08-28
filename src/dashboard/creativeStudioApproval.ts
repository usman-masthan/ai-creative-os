import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { assertApprovedExportEligible } from "../creativeStudio/exportGovernance.js";
import { CreativeStudioGovernanceStore } from "../creativeStudio/governanceStore.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { exportDesignDocumentPng, type DesignExportPreset } from "../creativeStudio/renderDesignDocument.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 128 * 1024) throw new Error("Approval request exceeds 128 KB.");
    chunks.push(buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> : {};
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function person(value: unknown): string {
  if (typeof value !== "string") throw new Error("approvedBy is required.");
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120 || /[\u0000-\u001F\u007F]/.test(trimmed)) {
    throw new Error("approvedBy must be a printable value up to 120 characters.");
  }
  return trimmed;
}

function optionalNote(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("note must be a string.");
  const trimmed = value.trim();
  if (trimmed.length > 500) throw new Error("note must be 500 characters or fewer.");
  return trimmed || undefined;
}

function preset(value: unknown): DesignExportPreset {
  if (value === "high-resolution" || value === "4k") return value;
  return "standard";
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

export interface CreativeStudioApprovalHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioApprovalHandler(options: CreativeStudioApprovalHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const governance = new CreativeStudioGovernanceStore(rootDir);

  async function truthFor(campaignId: string): Promise<TaskTruthSnapshot> {
    const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
    const truth = snapshotFromTruth(trace.truth);
    if (!truth) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: approval requires governed task truth.");
    return truth;
  }

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/approval") {
      const designId = safeId(url.searchParams.get("designId") ?? "", "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const [finalVisualQa, approval, approvedExports] = await Promise.all([
        governance.getFinalVisualQa(designId, project.document.version),
        governance.getApproval(designId, project.document.version),
        governance.listApprovedExports(designId),
      ]);
      sendJson(res, 200, {
        designId,
        version: project.document.version,
        finalVisualQa: finalVisualQa
          ? { checkedAt: finalVisualQa.checkedAt, decision: finalVisualQa.result.decision }
          : null,
        approval: approval ?? null,
        approvedExports: approvedExports.filter((record) => record.designVersion === project.document.version),
      });
      return true;
    }

    if (req.method !== "POST") return false;

    if (url.pathname === "/api/studio/approve-version") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await truthFor(project.document.campaignId);
      const deterministicQa = runDesignQa({ document: project.document, truthSnapshot: truth });
      if (deterministicQa.decision === "BLOCK") {
        throw new Error("DESIGN_APPROVAL_BLOCK: resolve deterministic QA blockers first.");
      }
      const finalVisualQa = await governance.getFinalVisualQa(designId, project.document.version);
      if (!finalVisualQa) {
        throw new Error("DESIGN_APPROVAL_BLOCK: run final visual QA for the current version first.");
      }
      if (finalVisualQa.result.decision !== "PASS") {
        throw new Error(`DESIGN_APPROVAL_BLOCK: final visual QA is ${finalVisualQa.result.decision}, not PASS.`);
      }
      const approvedAt = new Date().toISOString();
      const approvedBy = person(data.approvedBy);
      const note = optionalNote(data.note);
      const record = {
        schemaVersion: 1 as const,
        designId,
        designVersion: project.document.version,
        approvedAt,
        approvedBy,
        deterministicDecision: deterministicQa.decision,
        finalVisualQaDecision: "PASS" as const,
        ...(note ? { note } : {}),
      };
      await governance.saveApproval(record);
      sendJson(res, 200, record);
      return true;
    }

    if (url.pathname === "/api/studio/export-approved") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await truthFor(project.document.campaignId);
      const deterministicQa = runDesignQa({ document: project.document, truthSnapshot: truth });
      const [finalVisualQa, approval] = await Promise.all([
        governance.getFinalVisualQa(designId, project.document.version),
        governance.getApproval(designId, project.document.version),
      ]);
      const eligibility = assertApprovedExportEligible({
        document: project.document,
        deterministicQa,
        finalVisualQa,
        approval,
      });
      const exportPreset = preset(data.preset);
      const exported = await exportDesignDocumentPng({
        document: project.document,
        outputDir: join(rootDir, "designs", designId, "exports"),
        preset: exportPreset,
        ...(process.env.CHROME_PATH?.trim() ? { chromePath: process.env.CHROME_PATH.trim() } : {}),
      });
      const exportedAt = new Date().toISOString();
      await Promise.all([
        projects.appendExport(designId, {
          exportedAt,
          format: "png",
          preset: exportPreset,
          path: exported.outputPath,
          width: exported.width,
          height: exported.height,
        }),
        governance.appendApprovedExport({
          schemaVersion: 1,
          designId,
          designVersion: project.document.version,
          approvedAt: eligibility.approvedAt,
          exportedAt,
          format: "png",
          preset: exportPreset,
          path: exported.outputPath,
          width: exported.width,
          height: exported.height,
        }),
      ]);
      sendJson(res, 200, {
        designId,
        version: project.document.version,
        approvedBy: eligibility.approvedBy,
        approvedAt: eligibility.approvedAt,
        exportedAt,
        format: "png",
        preset: exportPreset,
        width: exported.width,
        height: exported.height,
        outputPath: `/studio-media/${encodeURIComponent(designId)}/${encodeURIComponent(basename(exported.outputPath))}`,
      });
      return true;
    }

    return false;
  };
}
