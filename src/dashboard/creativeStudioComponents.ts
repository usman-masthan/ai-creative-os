import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import {
  createReusableComponent,
  FileCreativeComponentStore,
  instantiateReusableComponent,
} from "../creativeStudio/componentLibrary.js";
import {
  detachReusableComponentInstance,
  FileCreativeComponentLifecycleStore,
  replaceReusableComponentInstance,
  type CreativeComponentFamilyStatus,
} from "../creativeStudio/componentLifecycle.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { FileDesignProjectStore, type DesignProjectSnapshot } from "../creativeStudio/projectStore.js";
import type { DesignDocument, DesignGroupLayer, DesignLayer } from "../designDocument/types.js";
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

function lifecycleStatus(value: unknown): CreativeComponentFamilyStatus {
  if (value === "ACTIVE" || value === "DEPRECATED" || value === "ARCHIVED") return value;
  throw new Error("status must be ACTIVE, DEPRECATED or ARCHIVED.");
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

function componentInstanceGroup(document: DesignDocument, instanceId: string): DesignGroupLayer {
  const group = document.layers.find(
    (layer): layer is DesignGroupLayer => layer.type === "group"
      && layer.componentInstance?.instanceId === instanceId
      && layer.componentInstance.templateLayerId === "group-root",
  );
  if (!group) throw new Error(`CREATIVE_COMPONENT_INSTANCE_NOT_FOUND: ${instanceId}`);
  return group;
}

async function saveWithQa(input: {
  projects: FileDesignProjectStore;
  designId: string;
  document: DesignDocument;
  truth: TaskTruthSnapshot;
}): Promise<Record<string, unknown>> {
  let saved = await input.projects.save(input.document);
  const qa = runDesignQa({ document: input.document, truthSnapshot: input.truth });
  await input.projects.saveQa(input.designId, { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues });
  saved = { ...saved, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
  return clientProject(saved);
}

export interface CreativeStudioComponentHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioComponentHandler(options: CreativeStudioComponentHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const components = new FileCreativeComponentStore(rootDir);
  const lifecycle = new FileCreativeComponentLifecycleStore(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/components") {
      const designId = safeId(url.searchParams.get("designId"), "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const families = await lifecycle.listLibrary(project.document.brand.clientId, project.document.brand.brandId);
      sendJson(res, 200, {
        families,
        components: families.flatMap((family) => family.versions),
      });
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
      const family = await lifecycle.registerInitial(component);
      sendJson(res, 201, { family, component: family.versions[0] });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/version") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const componentId = safeId(data.componentId, "componentId");
      const result = await lifecycle.duplicateAsNewVersion({
        clientId: project.document.brand.clientId,
        brandId: project.document.brand.brandId,
        componentId,
      });
      sendJson(res, 201, { family: result.family, componentId: result.component.id });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/status") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const family = await lifecycle.setStatus({
        clientId: project.document.brand.clientId,
        brandId: project.document.brand.brandId,
        familyId: safeId(data.familyId, "familyId"),
        status: lifecycleStatus(data.status),
      });
      sendJson(res, 200, { family });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/instantiate") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const componentId = safeId(data.componentId, "componentId");
      const family = await lifecycle.familyForComponent(project.document.brand.clientId, project.document.brand.brandId, componentId);
      if (family.status !== "ACTIVE") {
        throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_ACTIVE: ${family.familyId} is ${family.status}.`);
      }
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
      const saved = await saveWithQa({ projects, designId, document, truth: destinationTruth });
      sendJson(res, 200, { project: saved, instanceGroupId: `${instanceId}.group`, familyId: family.familyId });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/detach") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const instanceId = safeId(data.instanceId, "instanceId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const document = detachReusableComponentInstance(project.document, instanceId);
      const saved = await saveWithQa({ projects, designId, document, truth });
      sendJson(res, 200, { project: saved, detachedInstanceId: instanceId });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/upgrade") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const instanceId = safeId(data.instanceId, "instanceId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const group = componentInstanceGroup(project.document, instanceId);
      const currentComponentId = group.componentInstance!.componentId;
      const currentFamily = await lifecycle.familyForComponent(project.document.brand.clientId, project.document.brand.brandId, currentComponentId);
      if (currentFamily.status !== "ACTIVE") {
        throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_ACTIVE: ${currentFamily.familyId} is ${currentFamily.status}.`);
      }
      const targetComponentId = data.targetComponentId === undefined
        ? currentFamily.latestComponentId
        : safeId(data.targetComponentId, "targetComponentId");
      const targetFamily = await lifecycle.familyForComponent(project.document.brand.clientId, project.document.brand.brandId, targetComponentId);
      if (targetFamily.familyId !== currentFamily.familyId) {
        throw new Error("CREATIVE_COMPONENT_UPGRADE_FAMILY_MISMATCH: target belongs to a different component family.");
      }
      const currentVersion = currentFamily.versions.find((entry) => entry.componentId === currentComponentId)?.version;
      const targetVersion = targetFamily.versions.find((entry) => entry.componentId === targetComponentId)?.version;
      if (!currentVersion || !targetVersion || targetVersion <= currentVersion) {
        throw new Error("CREATIVE_COMPONENT_UPGRADE_NOT_NEWER: target component version must be newer than the current instance.");
      }
      const currentComponent = await components.get(project.document.brand.clientId, project.document.brand.brandId, currentComponentId);
      const targetComponent = await components.get(project.document.brand.clientId, project.document.brand.brandId, targetComponentId);
      if (!currentComponent || !targetComponent) throw new Error("CREATIVE_COMPONENT_UPGRADE_BROKEN_FAMILY: component definition is missing.");
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const document = replaceReusableComponentInstance({
        document: project.document,
        destinationTruth: truth,
        currentComponent,
        targetComponent,
        instanceId,
      });
      const saved = await saveWithQa({ projects, designId, document, truth });
      sendJson(res, 200, {
        project: saved,
        instanceGroupId: `${instanceId}.group`,
        familyId: currentFamily.familyId,
        fromVersion: currentVersion,
        toVersion: targetVersion,
      });
      return true;
    }

    return false;
  };
}
