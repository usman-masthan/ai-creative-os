import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import {
  FileCreativeComponentAuthoringStore,
  previewReusableComponentVersion,
} from "../creativeStudio/componentAuthoring.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 512 * 1024) throw new Error("Creative Studio component authoring request exceeds 512 KB.");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} must be a string.`);
  return value;
}

function truthSnapshotFromTrace(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

async function campaignTruth(rootDir: string, campaignId: string): Promise<TaskTruthSnapshot> {
  const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
  const snapshot = truthSnapshotFromTrace(trace.truth);
  if (!snapshot) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: component authoring requires confirmed campaign truth.");
  return snapshot;
}

export interface CreativeStudioComponentAuthoringHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioComponentAuthoringHandler(
  options: CreativeStudioComponentAuthoringHandlerOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const authoring = new FileCreativeComponentAuthoringStore(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/components/version-audit") {
      const designId = safeId(url.searchParams.get("designId"), "designId");
      const familyId = safeId(url.searchParams.get("familyId"), "familyId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const family = await authoring.lifecycle.get(
        project.document.brand.clientId,
        project.document.brand.brandId,
        familyId,
      );
      if (!family) throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_FOUND: ${familyId}`);
      const audit = await authoring.getAudit(family.clientId, family.brandId, familyId);
      sendJson(res, 200, { family, records: audit.records });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/version-preview") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const groupLayerId = safeId(data.groupLayerId, "groupLayerId");
      const familyId = safeId(data.familyId, "familyId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const family = await authoring.lifecycle.get(
        project.document.brand.clientId,
        project.document.brand.brandId,
        familyId,
      );
      if (!family) throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_FOUND: ${familyId}`);
      const base = await authoring.lifecycle.components.get(family.clientId, family.brandId, family.latestComponentId);
      if (!base) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${family.latestComponentId}`);
      const result = previewReusableComponentVersion({
        document: project.document,
        sourceTruth: truth,
        groupLayerId,
        family,
        baseComponent: base,
      });
      sendJson(res, 200, { preview: result.preview });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/publish-version") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const result = await authoring.publish({
        document: project.document,
        sourceTruth: truth,
        groupLayerId: safeId(data.groupLayerId, "groupLayerId"),
        familyId: safeId(data.familyId, "familyId"),
        expectedBaseComponentId: safeId(data.expectedBaseComponentId, "expectedBaseComponentId"),
        expectedPreviewToken: stringValue(data.expectedPreviewToken, "expectedPreviewToken"),
        versionNotes: stringValue(data.versionNotes, "versionNotes"),
        acceptReviewRequired: data.acceptReviewRequired === true,
      });
      sendJson(res, 201, {
        component: {
          id: result.component.id,
          name: result.component.name,
          clientId: result.component.clientId,
          brandId: result.component.brandId,
          templateCount: result.component.templates.length,
          requiredTruthKeys: result.component.requiredTruthKeys,
          createdAt: result.component.createdAt,
        },
        family: result.family,
        record: result.record,
        preview: result.preview,
      });
      return true;
    }

    return false;
  };
}
