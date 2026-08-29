import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import {
  createReusableComponent,
  FileCreativeComponentStore,
  instantiateReusableComponent,
} from "../creativeStudio/componentLibrary.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { FileDesignProjectStore, type DesignProjectSnapshot } from "../creativeStudio/projectStore.js";
import type { DesignDocument, DesignLayer } from "../designDocument/types.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 512 * 1024) throw new Error("Creative Studio component request exceeds 512 KB.");
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

function safeName(value: unknown): string {
  if (typeof value !== "string") throw new Error("name must be a string.");
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) throw new Error("name must contain 1 to 120 characters.");
  return trimmed;
}

function truthSnapshotFromTrace(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

async function campaignTruth(rootDir: string, campaignId: string): Promise<TaskTruthSnapshot> {
  const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
  const snapshot = truthSnapshotFromTrace(trace.truth);
  if (!snapshot) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: reusable component work requires confirmed campaign truth.");
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

export interface CreativeStudioComponentHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioComponentHandler(options: CreativeStudioComponentHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const components = new FileCreativeComponentStore(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/components") {
      const designId = safeId(url.searchParams.get("designId"), "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const list = await components.list(project.document.brand.clientId, project.document.brand.brandId);
      sendJson(res, 200, { components: list });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/create") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const sourceTruth = await campaignTruth(rootDir, project.document.campaignId);
      const component = createReusableComponent({
        document: project.document,
        sourceTruth,
        groupLayerId: safeId(data.groupLayerId, "groupLayerId"),
        componentId: safeId(data.componentId, "componentId"),
        name: safeName(data.name),
      });
      await components.save(component);
      sendJson(res, 201, {
        component: {
          id: component.id,
          name: component.name,
          clientId: component.clientId,
          brandId: component.brandId,
          templateCount: component.templates.length,
          requiredTruthKeys: component.requiredTruthKeys,
          createdAt: component.createdAt,
        },
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/instantiate") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const componentId = safeId(data.componentId, "componentId");
      const component = await components.get(project.document.brand.clientId, project.document.brand.brandId, componentId);
      if (!component) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${componentId}`);
      const destinationTruth = await campaignTruth(rootDir, project.document.campaignId);
      const instanceId = safeId(data.instanceId, "instanceId");
      const document = instantiateReusableComponent({
        document: project.document,
        destinationTruth,
        component,
        instanceId,
      });
      let saved = await projects.save(document);
      const qa = runDesignQa({ document, truthSnapshot: destinationTruth });
      await projects.saveQa(designId, { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues });
      saved = { ...saved, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
      sendJson(res, 200, { project: clientProject(saved), instanceGroupId: `${instanceId}.group` });
      return true;
    }

    return false;
  };
}
