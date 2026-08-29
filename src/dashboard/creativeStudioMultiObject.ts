import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { FileDesignProjectStore, type DesignProjectSnapshot } from "../creativeStudio/projectStore.js";
import {
  applyMultiObjectDesignOperation,
  type MultiObjectDesignOperation,
} from "../designDocument/multiObjectOperations.js";
import type { DesignDocument, DesignLayer } from "../designDocument/types.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 512 * 1024) throw new Error("Creative Studio multi-object request exceeds 512 KB.");
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

function idArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length < 2) throw new Error(`${name} must contain at least two ids.`);
  return value.map((item, index) => safeId(item, `${name}[${index}]`));
}

function finiteOptional(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be finite.`);
  return value;
}

function parseOperation(value: unknown): MultiObjectDesignOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("operation must be an object.");
  const data = value as Record<string, unknown>;
  if (data.type === "DUPLICATE_LAYERS") {
    const layerIds = idArray(data.layerIds, "operation.layerIds");
    const newLayerIds = idArray(data.newLayerIds, "operation.newLayerIds");
    const offsetX = finiteOptional(data.offsetX, "operation.offsetX");
    const offsetY = finiteOptional(data.offsetY, "operation.offsetY");
    return {
      type: "DUPLICATE_LAYERS",
      layerIds,
      newLayerIds,
      ...(offsetX !== undefined ? { offsetX } : {}),
      ...(offsetY !== undefined ? { offsetY } : {}),
    };
  }
  if (data.type === "DELETE_LAYERS") {
    return { type: "DELETE_LAYERS", layerIds: idArray(data.layerIds, "operation.layerIds") };
  }
  throw new Error("Unsupported multi-object operation.");
}

function truthSnapshotFromTrace(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

async function campaignTruth(rootDir: string, campaignId: string): Promise<TaskTruthSnapshot> {
  const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
  const snapshot = truthSnapshotFromTrace(trace.truth);
  if (!snapshot) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: cannot run governed Studio editing.");
  return snapshot;
}

function clientDocument(document: DesignDocument): DesignDocument {
  return {
    ...document,
    layers: document.layers.map((layer): DesignLayer => {
      const uri = `/studio-asset/${encodeURIComponent(document.id)}/${encodeURIComponent(layer.id)}`;
      if (layer.type === "image" || layer.type === "logo") return { ...layer, asset: { ...layer.asset, uri } };
      if (layer.type === "background" && layer.asset) return { ...layer, asset: { ...layer.asset, uri } };
      return layer;
    }),
  };
}

function clientProject(project: DesignProjectSnapshot): Record<string, unknown> {
  return {
    ...project,
    document: clientDocument(project.document),
    exports: project.exports.map((record) => ({
      ...record,
      path: `/studio-media/${encodeURIComponent(project.document.id)}/${encodeURIComponent(basename(record.path))}`,
    })),
  };
}

export interface CreativeStudioMultiObjectHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioMultiObjectHandler(options: CreativeStudioMultiObjectHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const store = new FileDesignProjectStore(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/multi-object") return false;
    const data = await readBody(req);
    const designId = safeId(data.designId, "designId");
    const project = await store.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const operation = parseOperation(data.operation);
    const document = applyMultiObjectDesignOperation(project.document, { ...operation, actor: "human" });
    let saved = await store.save(document);
    const truth = await campaignTruth(rootDir, document.campaignId);
    const qa = runDesignQa({ document, truthSnapshot: truth });
    await store.saveQa(designId, { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues });
    saved = { ...saved, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
    sendJson(res, 200, clientProject(saved));
    return true;
  };
}
