import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { applyDesignOperation } from "../designDocument/operations.js";
import type { DesignDocument, DesignGroupLayer, DesignLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import {
  assertReusableComponent,
  type CreativeComponentSummary,
  type CreativeReusableComponent,
  FileCreativeComponentStore,
  instantiateReusableComponent,
} from "./componentLibrary.js";

export type CreativeComponentFamilyStatus = "ACTIVE" | "DEPRECATED" | "ARCHIVED";

export interface CreativeComponentVersionRecord {
  version: number;
  componentId: string;
  createdAt: string;
  derivedFromComponentId?: string;
}

export interface CreativeComponentFamilyRecord {
  schemaVersion: 1;
  familyId: string;
  clientId: string;
  brandId: string;
  name: string;
  status: CreativeComponentFamilyStatus;
  latestVersion: number;
  latestComponentId: string;
  versions: CreativeComponentVersionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CreativeComponentLibraryVersion extends CreativeComponentSummary {
  version: number;
  familyId: string;
  familyStatus: CreativeComponentFamilyStatus;
  isLatest: boolean;
}

export interface CreativeComponentLibraryFamily {
  familyId: string;
  name: string;
  clientId: string;
  brandId: string;
  status: CreativeComponentFamilyStatus;
  latestVersion: number;
  latestComponentId: string;
  versions: CreativeComponentLibraryVersion[];
  createdAt: string;
  updatedAt: string;
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function safeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) throw new Error("Component family name must contain 1 to 120 characters.");
  return trimmed;
}

function validDate(value: string, name: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${name} must be an ISO date-time.`);
  return value;
}

function assertFamilyRecord(value: CreativeComponentFamilyRecord): CreativeComponentFamilyRecord {
  if (value.schemaVersion !== 1) throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: schemaVersion must be 1.");
  safeId(value.familyId, "familyId");
  if (!value.clientId.trim() || !value.brandId.trim()) throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: client and brand are required.");
  safeName(value.name);
  if (!["ACTIVE", "DEPRECATED", "ARCHIVED"].includes(value.status)) throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: status.");
  if (!Number.isInteger(value.latestVersion) || value.latestVersion < 1) throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: latestVersion.");
  safeId(value.latestComponentId, "latestComponentId");
  if (!value.versions.length) throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: versions are required.");
  const ordered = [...value.versions].sort((a, b) => a.version - b.version);
  ordered.forEach((entry, index) => {
    if (entry.version !== index + 1) throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: versions must be contiguous from 1.");
    safeId(entry.componentId, "componentId");
    validDate(entry.createdAt, "component version createdAt");
    if (entry.derivedFromComponentId) safeId(entry.derivedFromComponentId, "derivedFromComponentId");
  });
  const latest = ordered.at(-1)!;
  if (latest.version !== value.latestVersion || latest.componentId !== value.latestComponentId) {
    throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: latest pointer mismatch.");
  }
  if (new Set(ordered.map((entry) => entry.componentId)).size !== ordered.length) {
    throw new Error("CREATIVE_COMPONENT_FAMILY_INVALID: duplicate component ids.");
  }
  validDate(value.createdAt, "component family createdAt");
  validDate(value.updatedAt, "component family updatedAt");
  return value;
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function componentSummary(component: CreativeReusableComponent): CreativeComponentSummary {
  return {
    id: component.id,
    name: component.name,
    clientId: component.clientId,
    brandId: component.brandId,
    templateCount: component.templates.length,
    requiredTruthKeys: [...component.requiredTruthKeys],
    createdAt: component.createdAt,
  };
}

export class FileCreativeComponentLifecycleStore {
  readonly rootDir: string;
  readonly components: FileCreativeComponentStore;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
    this.components = new FileCreativeComponentStore(rootDir);
  }

  private directory(clientId: string, brandId: string): string {
    return join(this.rootDir, "components", safeId(clientId, "clientId"), safeId(brandId, "brandId"), "_families");
  }

  private path(clientId: string, brandId: string, familyId: string): string {
    return join(this.directory(clientId, brandId), `${safeId(familyId, "familyId")}.json`);
  }

  private async write(record: CreativeComponentFamilyRecord): Promise<CreativeComponentFamilyRecord> {
    const valid = assertFamilyRecord(record);
    await mkdir(this.directory(valid.clientId, valid.brandId), { recursive: true });
    await writeFile(this.path(valid.clientId, valid.brandId, valid.familyId), `${JSON.stringify(valid, null, 2)}\n`, "utf8");
    return valid;
  }

  async get(clientId: string, brandId: string, familyId: string): Promise<CreativeComponentFamilyRecord | undefined> {
    const raw = await readJson<CreativeComponentFamilyRecord>(this.path(clientId, brandId, familyId));
    return raw ? assertFamilyRecord(raw) : undefined;
  }

  async registerInitial(componentInput: CreativeReusableComponent): Promise<CreativeComponentFamilyRecord> {
    const component = assertReusableComponent(componentInput);
    const familyId = component.id;
    const existing = await this.get(component.clientId, component.brandId, familyId);
    if (existing) return existing;
    return this.write({
      schemaVersion: 1,
      familyId,
      clientId: component.clientId,
      brandId: component.brandId,
      name: component.name,
      status: "ACTIVE",
      latestVersion: 1,
      latestComponentId: component.id,
      versions: [{ version: 1, componentId: component.id, createdAt: component.createdAt }],
      createdAt: component.createdAt,
      updatedAt: component.createdAt,
    });
  }

  async familyForComponent(clientId: string, brandId: string, componentId: string): Promise<CreativeComponentFamilyRecord> {
    const families = await this.listRecords(clientId, brandId);
    const found = families.find((family) => family.versions.some((version) => version.componentId === componentId));
    if (found) return found;
    const component = await this.components.get(clientId, brandId, componentId);
    if (!component) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${componentId}`);
    return this.registerInitial(component);
  }

  async listRecords(clientId: string, brandId: string): Promise<CreativeComponentFamilyRecord[]> {
    const dir = this.directory(clientId, brandId);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const records = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => {
      const raw = await readJson<CreativeComponentFamilyRecord>(join(dir, file));
      return raw ? assertFamilyRecord(raw) : undefined;
    }));
    return records.filter((record): record is CreativeComponentFamilyRecord => Boolean(record));
  }

  async listLibrary(clientId: string, brandId: string): Promise<CreativeComponentLibraryFamily[]> {
    const summaries = await this.components.list(clientId, brandId);
    let families = await this.listRecords(clientId, brandId);
    for (const summary of summaries) {
      if (!families.some((family) => family.versions.some((version) => version.componentId === summary.id))) {
        const component = await this.components.get(clientId, brandId, summary.id);
        if (component) await this.registerInitial(component);
        families = await this.listRecords(clientId, brandId);
      }
    }
    const output: CreativeComponentLibraryFamily[] = [];
    for (const family of families) {
      const versions: CreativeComponentLibraryVersion[] = [];
      for (const ref of family.versions) {
        const component = await this.components.get(clientId, brandId, ref.componentId);
        if (!component) throw new Error(`CREATIVE_COMPONENT_FAMILY_BROKEN: missing ${ref.componentId}.`);
        versions.push({
          ...componentSummary(component),
          version: ref.version,
          familyId: family.familyId,
          familyStatus: family.status,
          isLatest: ref.version === family.latestVersion,
        });
      }
      output.push({
        familyId: family.familyId,
        name: family.name,
        clientId: family.clientId,
        brandId: family.brandId,
        status: family.status,
        latestVersion: family.latestVersion,
        latestComponentId: family.latestComponentId,
        versions,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      });
    }
    return output.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setStatus(input: {
    clientId: string;
    brandId: string;
    familyId: string;
    status: CreativeComponentFamilyStatus;
    updatedAt?: string;
  }): Promise<CreativeComponentFamilyRecord> {
    const record = await this.get(input.clientId, input.brandId, input.familyId);
    if (!record) throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_FOUND: ${input.familyId}`);
    const updatedAt = validDate(input.updatedAt ?? new Date().toISOString(), "component family updatedAt");
    return this.write({ ...record, status: input.status, updatedAt });
  }

  async duplicateAsNewVersion(input: {
    clientId: string;
    brandId: string;
    componentId: string;
    createdAt?: string;
  }): Promise<{ component: CreativeReusableComponent; family: CreativeComponentFamilyRecord }> {
    const source = await this.components.get(input.clientId, input.brandId, input.componentId);
    if (!source) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${input.componentId}`);
    const family = await this.familyForComponent(input.clientId, input.brandId, input.componentId);
    if (family.status !== "ACTIVE") {
      throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_ACTIVE: ${family.familyId} is ${family.status}.`);
    }
    const version = family.latestVersion + 1;
    const componentId = safeId(`${family.familyId}.v${version}`, "componentId");
    const createdAt = validDate(input.createdAt ?? new Date().toISOString(), "component version createdAt");
    const component: CreativeReusableComponent = assertReusableComponent({
      ...source,
      id: componentId,
      name: family.name,
      createdAt,
    });
    await this.components.save(component);
    const nextFamily = await this.write({
      ...family,
      latestVersion: version,
      latestComponentId: component.id,
      versions: [
        ...family.versions,
        { version, componentId: component.id, createdAt, derivedFromComponentId: source.id },
      ],
      updatedAt: createdAt,
    });
    return { component, family: nextFamily };
  }
}

function instanceLayers(document: DesignDocument, instanceId: string): DesignLayer[] {
  const id = safeId(instanceId, "instanceId");
  const layers = document.layers.filter((layer) => layer.componentInstance?.instanceId === id);
  if (!layers.length) throw new Error(`CREATIVE_COMPONENT_INSTANCE_NOT_FOUND: ${id}`);
  return layers;
}

function instanceGroup(document: DesignDocument, instanceId: string): DesignGroupLayer {
  const layers = instanceLayers(document, instanceId);
  const groups = layers.filter((layer): layer is DesignGroupLayer => layer.type === "group" && layer.componentInstance?.templateLayerId === "group-root");
  if (groups.length !== 1) throw new Error(`CREATIVE_COMPONENT_INSTANCE_INVALID: ${instanceId} requires exactly one root group.`);
  return groups[0]!;
}

function withoutComponentInstance(layer: DesignLayer): DesignLayer {
  const { componentInstance: _componentInstance, ...rest } = layer;
  return rest as DesignLayer;
}

export function detachReusableComponentInstance(
  documentInput: DesignDocument,
  instanceId: string,
  timestamp = new Date().toISOString(),
): DesignDocument {
  const document = assertDesignDocument(documentInput);
  validDate(timestamp, "component detach timestamp");
  const members = instanceLayers(document, instanceId);
  const ids = new Set(members.map((layer) => layer.id));
  const nextVersion = document.version + 1;
  return assertDesignDocument({
    ...document,
    version: nextVersion,
    layers: document.layers.map((layer) => ids.has(layer.id) ? withoutComponentInstance(layer) : layer),
    history: [
      ...document.history,
      { version: nextVersion, createdAt: timestamp, summary: `Detached reusable component instance ${instanceId}.`, actor: "human" },
    ],
    updatedAt: timestamp,
  });
}

export function replaceReusableComponentInstance(input: {
  document: DesignDocument;
  destinationTruth: TaskTruthSnapshot;
  currentComponent: CreativeReusableComponent;
  targetComponent: CreativeReusableComponent;
  instanceId: string;
  timestamp?: string;
}): DesignDocument {
  const document = assertDesignDocument(input.document);
  const timestamp = validDate(input.timestamp ?? new Date().toISOString(), "component upgrade timestamp");
  const oldGroup = instanceGroup(document, input.instanceId);
  const members = instanceLayers(document, input.instanceId);
  if (!members.every((layer) => layer.componentInstance?.componentId === input.currentComponent.id)) {
    throw new Error("CREATIVE_COMPONENT_INSTANCE_VERSION_MISMATCH: instance provenance does not match current component.");
  }
  const removeIds = new Set(members.map((layer) => layer.id));
  const pruned = assertDesignDocument({ ...document, layers: document.layers.filter((layer) => !removeIds.has(layer.id)) });
  let next = instantiateReusableComponent({
    document: pruned,
    destinationTruth: input.destinationTruth,
    component: input.targetComponent,
    instanceId: input.instanceId,
    timestamp,
  });
  let group = instanceGroup(next, input.instanceId);
  const scale = Math.min(oldGroup.width / Math.max(group.width, 0.0001), oldGroup.height / Math.max(group.height, 0.0001));
  if (!(scale > 0) || !Number.isFinite(scale)) throw new Error("CREATIVE_COMPONENT_UPGRADE_SCALE_INVALID.");
  next = applyDesignOperation(next, {
    type: "RESIZE_LAYER",
    layerId: group.id,
    width: group.width * scale,
    height: group.height * scale,
  }, timestamp);
  group = instanceGroup(next, input.instanceId);
  next = applyDesignOperation(next, { type: "ROTATE_LAYER", layerId: group.id, rotation: oldGroup.rotation }, timestamp);
  group = instanceGroup(next, input.instanceId);
  const targetCenterX = oldGroup.x + oldGroup.width / 2;
  const targetCenterY = oldGroup.y + oldGroup.height / 2;
  next = applyDesignOperation(next, {
    type: "MOVE_LAYER",
    layerId: group.id,
    x: targetCenterX - group.width / 2,
    y: targetCenterY - group.height / 2,
  }, timestamp);

  const finalVersion = document.version + 1;
  return assertDesignDocument({
    ...next,
    version: finalVersion,
    history: [
      ...document.history,
      {
        version: finalVersion,
        createdAt: timestamp,
        summary: `Upgraded reusable component instance ${input.instanceId} from ${input.currentComponent.id} to ${input.targetComponent.id}.`,
        actor: "human",
      },
    ],
    updatedAt: timestamp,
  });
}
