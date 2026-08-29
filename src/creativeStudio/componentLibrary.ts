import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { TaskTruthSnapshot } from "../taskTruth.js";
import type {
  DesignDocument,
  DesignGroupLayer,
  DesignLayer,
  DesignShapeLayer,
  DesignTextLayer,
  LayerShadow,
} from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";

export interface CreativeComponentTemplateBase {
  templateLayerId: string;
  name: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zOrder: number;
  visible: boolean;
}

export interface CreativeComponentTextTemplate extends CreativeComponentTemplateBase {
  type: "text";
  role: DesignTextLayer["role"];
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  align: DesignTextLayer["align"];
  fill: string;
  stroke?: string;
  shadow?: LayerShadow;
  requiredTruthKeys: string[];
}

export interface CreativeComponentShapeTemplate extends CreativeComponentTemplateBase {
  type: "shape";
  shape: DesignShapeLayer["shape"];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export type CreativeComponentLayerTemplate = CreativeComponentTextTemplate | CreativeComponentShapeTemplate;

export interface CreativeReusableComponent {
  schemaVersion: 1;
  id: string;
  name: string;
  clientId: string;
  brandId: string;
  sourceDesignId: string;
  sourceDesignVersion: number;
  sourceTruthSnapshotId: string;
  sourceArtboard: { width: number; height: number };
  root: {
    originXRatio: number;
    originYRatio: number;
    width: number;
    height: number;
  };
  templates: CreativeComponentLayerTemplate[];
  requiredTruthKeys: string[];
  portability: "STRUCTURE_STYLE_WITH_DESTINATION_TEXT_REBIND";
  createdAt: string;
}

export interface CreativeComponentSummary {
  id: string;
  name: string;
  clientId: string;
  brandId: string;
  templateCount: number;
  requiredTruthKeys: string[];
  createdAt: string;
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function safeName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) throw new Error("Component name must contain 1 to 120 characters.");
  return trimmed;
}

function assertTruthBinding(document: DesignDocument, snapshot: TaskTruthSnapshot): void {
  if (snapshot.campaignId !== document.campaignId) {
    throw new Error("COMPONENT_TRUTH_MISMATCH: task truth belongs to a different campaign.");
  }
  if (snapshot.brandId !== document.brand.brandId) {
    throw new Error("COMPONENT_TRUTH_MISMATCH: task truth belongs to a different brand.");
  }
  if (`task:${snapshot.sessionId}` !== document.truthSnapshotId) {
    throw new Error("COMPONENT_TRUTH_MISMATCH: DesignDocument is bound to a different task truth snapshot.");
  }
  if (!snapshot.confirmedBy.trim() || Number.isNaN(Date.parse(snapshot.confirmedAt))) {
    throw new Error("COMPONENT_TRUTH_UNCONFIRMED: destination task truth lacks confirmation provenance.");
  }
}

function groupById(document: DesignDocument, groupLayerId: string): DesignGroupLayer {
  const id = safeId(groupLayerId, "groupLayerId");
  const group = document.layers.find((layer): layer is DesignGroupLayer => layer.id === id && layer.type === "group");
  if (!group) throw new Error(`COMPONENT_GROUP_NOT_FOUND: ${id}`);
  if (group.locked) throw new Error(`DESIGN_LAYER_LOCKED: ${id}`);
  return group;
}

function childLayers(document: DesignDocument, group: DesignGroupLayer): Array<DesignTextLayer | DesignShapeLayer> {
  const children = group.childLayerIds.map((id) => {
    const child = document.layers.find((layer) => layer.id === id);
    if (!child) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${id}`);
    if (child.locked) throw new Error(`COMPONENT_CHILD_LOCKED: ${id}`);
    if (document.layers.some((layer) => layer.type === "mask" && layer.targetLayerIds.includes(id))) {
      throw new Error(`COMPONENT_MASK_BOUNDARY_BLOCK: ${id} participates in mask semantics.`);
    }
    if (child.type !== "text" && child.type !== "shape") {
      throw new Error(
        `COMPONENT_ASSET_BOUNDARY_BLOCK: reusable components currently admit native text and shape layers only; ${id} is ${child.type}.`,
      );
    }
    return child;
  });
  const roles = children.filter((layer): layer is DesignTextLayer => layer.type === "text").map((layer) => layer.role);
  if (new Set(roles).size !== roles.length) {
    throw new Error("COMPONENT_TEXT_ROLE_AMBIGUOUS: a reusable component may contain only one text slot per role.");
  }
  return children;
}

function truthValueTokens(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length >= 3 ? [trimmed] : [];
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const token = String(value);
    return token.length >= 3 ? [token] : [];
  }
  if (Array.isArray(value)) return value.flatMap(truthValueTokens);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(truthValueTokens);
  return [];
}

function truthKeysForText(layer: DesignTextLayer, snapshot: TaskTruthSnapshot): string[] {
  const keys = new Set<string>();
  if (layer.role === "price") keys.add("price");
  const lower = layer.text.toLowerCase();
  for (const fact of snapshot.facts) {
    if (truthValueTokens(fact.value).some((token) => lower.includes(token.toLowerCase()))) keys.add(fact.key);
  }
  for (const key of keys) {
    if (!snapshot.facts.some((fact) => fact.key === key)) {
      throw new Error(`COMPONENT_SOURCE_TRUTH_MISSING: text role ${layer.role} requires confirmed ${key}.`);
    }
  }
  return [...keys].sort();
}

function templateFromLayer(
  layer: DesignTextLayer | DesignShapeLayer,
  group: DesignGroupLayer,
  sourceTruth: TaskTruthSnapshot,
  zOrder: number,
): CreativeComponentLayerTemplate {
  const base: CreativeComponentTemplateBase = {
    templateLayerId: layer.id,
    name: layer.type === "text" ? `Component ${layer.role}` : `Component shape ${zOrder + 1}`,
    offsetX: layer.x - group.x,
    offsetY: layer.y - group.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    opacity: layer.opacity,
    zOrder,
    visible: layer.visible,
  };
  if (layer.type === "text") {
    return {
      ...base,
      type: "text",
      role: layer.role,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      lineHeight: layer.lineHeight,
      letterSpacing: layer.letterSpacing,
      align: layer.align,
      fill: layer.fill,
      ...(layer.stroke ? { stroke: layer.stroke } : {}),
      ...(layer.shadow ? { shadow: { ...layer.shadow } } : {}),
      requiredTruthKeys: truthKeysForText(layer, sourceTruth),
    };
  }
  return {
    ...base,
    type: "shape",
    shape: layer.shape,
    ...(layer.fill ? { fill: layer.fill } : {}),
    ...(layer.stroke ? { stroke: layer.stroke } : {}),
    ...(layer.strokeWidth !== undefined ? { strokeWidth: layer.strokeWidth } : {}),
    ...(layer.cornerRadius !== undefined ? { cornerRadius: layer.cornerRadius } : {}),
  };
}

export function createReusableComponent(input: {
  document: DesignDocument;
  sourceTruth: TaskTruthSnapshot;
  groupLayerId: string;
  componentId: string;
  name: string;
  createdAt?: string;
}): CreativeReusableComponent {
  const document = assertDesignDocument(input.document);
  assertTruthBinding(document, input.sourceTruth);
  const group = groupById(document, input.groupLayerId);
  const children = childLayers(document, group).sort((a, b) => a.zIndex - b.zIndex);
  const templates = children.map((layer, index) => templateFromLayer(layer, group, input.sourceTruth, index));
  const createdAt = input.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("COMPONENT_CREATED_AT_INVALID.");
  const component: CreativeReusableComponent = {
    schemaVersion: 1,
    id: safeId(input.componentId, "componentId"),
    name: safeName(input.name),
    clientId: document.brand.clientId,
    brandId: document.brand.brandId,
    sourceDesignId: document.id,
    sourceDesignVersion: document.version,
    sourceTruthSnapshotId: document.truthSnapshotId,
    sourceArtboard: { width: document.artboard.width, height: document.artboard.height },
    root: {
      originXRatio: group.x / document.artboard.width,
      originYRatio: group.y / document.artboard.height,
      width: group.width,
      height: group.height,
    },
    templates,
    requiredTruthKeys: [...new Set(templates.flatMap((template) => template.type === "text" ? template.requiredTruthKeys : []))].sort(),
    portability: "STRUCTURE_STYLE_WITH_DESTINATION_TEXT_REBIND",
    createdAt,
  };
  return assertReusableComponent(component);
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function assertReusableComponent(value: CreativeReusableComponent): CreativeReusableComponent {
  if (value.schemaVersion !== 1) throw new Error("CREATIVE_COMPONENT_INVALID: schemaVersion must be 1.");
  safeId(value.id, "componentId");
  safeName(value.name);
  if (!value.clientId.trim() || !value.brandId.trim() || !value.sourceDesignId.trim() || !value.sourceTruthSnapshotId.trim()) {
    throw new Error("CREATIVE_COMPONENT_INVALID: source and brand provenance are required.");
  }
  if (!Number.isInteger(value.sourceDesignVersion) || value.sourceDesignVersion < 1) {
    throw new Error("CREATIVE_COMPONENT_INVALID: sourceDesignVersion must be positive.");
  }
  if (value.portability !== "STRUCTURE_STYLE_WITH_DESTINATION_TEXT_REBIND") {
    throw new Error("CREATIVE_COMPONENT_INVALID: unsafe portability mode.");
  }
  if (value.templates.length < 2) throw new Error("CREATIVE_COMPONENT_INVALID: at least two templates are required.");
  const ids = value.templates.map((template) => safeId(template.templateLayerId, "templateLayerId"));
  if (new Set(ids).size !== ids.length) throw new Error("CREATIVE_COMPONENT_INVALID: duplicate template ids.");
  const roles = value.templates.filter((template): template is CreativeComponentTextTemplate => template.type === "text").map((template) => template.role);
  if (new Set(roles).size !== roles.length) throw new Error("CREATIVE_COMPONENT_INVALID: duplicate text roles.");
  for (const template of value.templates) {
    for (const dimension of [template.offsetX, template.offsetY, template.width, template.height, template.rotation, template.opacity, template.zOrder]) {
      if (!finite(dimension)) throw new Error("CREATIVE_COMPONENT_INVALID: template geometry must be finite.");
    }
    if (template.width < 0 || template.height < 0 || template.opacity < 0 || template.opacity > 1) {
      throw new Error("CREATIVE_COMPONENT_INVALID: template geometry/opacity is invalid.");
    }
    if (template.type === "text") {
      if (!template.fontFamily.trim() || template.fontSize <= 0 || template.lineHeight <= 0) {
        throw new Error("CREATIVE_COMPONENT_INVALID: text style is incomplete.");
      }
      for (const key of template.requiredTruthKeys) if (!key.trim()) throw new Error("CREATIVE_COMPONENT_INVALID: blank truth key.");
    }
  }
  if (!finite(value.root.originXRatio) || !finite(value.root.originYRatio) || !finite(value.root.width) || !finite(value.root.height)) {
    throw new Error("CREATIVE_COMPONENT_INVALID: root geometry must be finite.");
  }
  return value;
}

function destinationRoleLayer(document: DesignDocument, role: DesignTextLayer["role"]): DesignTextLayer {
  const candidates = document.layers.filter(
    (layer): layer is DesignTextLayer => layer.type === "text" && layer.role === role && !layer.componentInstance,
  );
  if (candidates.length !== 1) {
    throw new Error(
      `COMPONENT_DESTINATION_TEXT_AMBIGUOUS: role ${role} requires exactly one native destination text layer; found ${candidates.length}.`,
    );
  }
  return candidates[0]!;
}

function requireDestinationTruth(component: CreativeReusableComponent, snapshot: TaskTruthSnapshot): void {
  for (const key of component.requiredTruthKeys) {
    if (!snapshot.facts.some((fact) => fact.key === key)) {
      throw new Error(`COMPONENT_DESTINATION_TRUTH_MISSING: confirmed destination truth key ${key} is required.`);
    }
  }
}

function scaleShadow(shadow: LayerShadow | undefined, scale: number): LayerShadow | undefined {
  if (!shadow) return undefined;
  return {
    ...shadow,
    offsetX: shadow.offsetX * scale,
    offsetY: shadow.offsetY * scale,
    blur: shadow.blur * scale,
  };
}

function editableLayer(layer: DesignLayer): boolean {
  return !layer.locked && layer.type !== "background" && layer.type !== "logo" && layer.type !== "group" && layer.type !== "mask";
}

function zSlots(document: DesignDocument, count: number): number[] {
  const editable = document.layers.filter(editableLayer);
  const maxEditable = editable.length ? Math.max(...editable.map((layer) => layer.zIndex)) : 0;
  const upper = document.layers
    .filter((layer) => !editableLayer(layer) && layer.zIndex > maxEditable)
    .map((layer) => layer.zIndex)
    .sort((a, b) => a - b)[0];
  if (upper === undefined) return Array.from({ length: count }, (_, index) => maxEditable + index + 1);
  const step = (upper - maxEditable) / (count + 1);
  if (!(step > 0)) throw new Error("COMPONENT_Z_ORDER_BLOCK: no editable stacking space remains before protected structure.");
  return Array.from({ length: count }, (_, index) => maxEditable + step * (index + 1));
}

function bounds(layers: DesignLayer[]): { x: number; y: number; width: number; height: number } {
  const left = Math.min(...layers.map((layer) => layer.x));
  const top = Math.min(...layers.map((layer) => layer.y));
  const right = Math.max(...layers.map((layer) => layer.x + layer.width));
  const bottom = Math.max(...layers.map((layer) => layer.y + layer.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function fitTranslation(document: DesignDocument, layers: DesignLayer[]): { dx: number; dy: number } {
  const box = bounds(layers);
  let dx = 0;
  let dy = 0;
  if (box.x < 0) dx = -box.x;
  else if (box.x + box.width > document.artboard.width) dx = document.artboard.width - (box.x + box.width);
  if (box.y < 0) dy = -box.y;
  else if (box.y + box.height > document.artboard.height) dy = document.artboard.height - (box.y + box.height);
  return { dx, dy };
}

export function instantiateReusableComponent(input: {
  document: DesignDocument;
  destinationTruth: TaskTruthSnapshot;
  component: CreativeReusableComponent;
  instanceId: string;
  timestamp?: string;
}): DesignDocument {
  const document = assertDesignDocument(input.document);
  const component = assertReusableComponent(input.component);
  assertTruthBinding(document, input.destinationTruth);
  requireDestinationTruth(component, input.destinationTruth);
  if (component.clientId !== document.brand.clientId || component.brandId !== document.brand.brandId) {
    throw new Error("COMPONENT_BRAND_BOUNDARY_BLOCK: reusable components cannot cross client or brand boundaries.");
  }
  const instanceId = safeId(input.instanceId, "instanceId");
  const groupId = `${instanceId}.group`;
  const childIds = component.templates.map((_, index) => `${instanceId}.${index}`);
  const existingIds = new Set(document.layers.map((layer) => layer.id));
  for (const id of [groupId, ...childIds]) if (existingIds.has(id)) throw new Error(`DESIGN_LAYER_DUPLICATE_ID: ${id}`);

  const scale = Math.min(
    document.artboard.width / component.sourceArtboard.width,
    document.artboard.height / component.sourceArtboard.height,
  );
  if (!(scale > 0) || !finite(scale)) throw new Error("COMPONENT_SCALE_INVALID.");
  const originX = document.artboard.width * component.root.originXRatio;
  const originY = document.artboard.height * component.root.originYRatio;
  const slots = zSlots(document, component.templates.length);
  const orderedTemplates = [...component.templates].sort((a, b) => a.zOrder - b.zOrder);

  let children = orderedTemplates.map((template, index): DesignLayer => {
    const base = {
      id: childIds[index]!,
      name: template.name,
      x: originX + template.offsetX * scale,
      y: originY + template.offsetY * scale,
      width: template.width * scale,
      height: template.height * scale,
      rotation: template.rotation,
      opacity: template.opacity,
      zIndex: slots[index]!,
      visible: template.visible,
      locked: false,
      componentInstance: {
        componentId: component.id,
        instanceId,
        templateLayerId: template.templateLayerId,
      },
    };
    if (template.type === "text") {
      const destination = destinationRoleLayer(document, template.role);
      const layer: DesignTextLayer = {
        ...base,
        type: "text",
        aiEditable: destination.aiEditable,
        text: destination.text,
        role: template.role,
        fontFamily: template.fontFamily,
        fontSize: template.fontSize * scale,
        fontWeight: template.fontWeight,
        lineHeight: template.lineHeight,
        letterSpacing: template.letterSpacing * scale,
        align: template.align,
        fill: template.fill,
        ...(template.stroke ? { stroke: template.stroke } : {}),
        ...(template.shadow ? { shadow: scaleShadow(template.shadow, scale)! } : {}),
      };
      return layer;
    }
    const layer: DesignShapeLayer = {
      ...base,
      type: "shape",
      aiEditable: false,
      shape: template.shape,
      ...(template.fill ? { fill: template.fill } : {}),
      ...(template.stroke ? { stroke: template.stroke } : {}),
      ...(template.strokeWidth !== undefined ? { strokeWidth: template.strokeWidth * scale } : {}),
      ...(template.cornerRadius !== undefined ? { cornerRadius: template.cornerRadius * scale } : {}),
    };
    return layer;
  });

  const translation = fitTranslation(document, children);
  if (translation.dx || translation.dy) {
    children = children.map((layer) => ({ ...layer, x: layer.x + translation.dx, y: layer.y + translation.dy }));
  }
  const box = bounds(children);
  const group: DesignGroupLayer = {
    id: groupId,
    name: component.name,
    type: "group",
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    rotation: 0,
    opacity: 1,
    zIndex: children.length ? Math.max(...children.map((layer) => layer.zIndex)) : 0,
    visible: true,
    locked: false,
    aiEditable: false,
    childLayerIds: children.map((layer) => layer.id),
    componentInstance: {
      componentId: component.id,
      instanceId,
      templateLayerId: "group-root",
    },
  };
  const timestamp = input.timestamp ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("COMPONENT_INSTANCE_TIMESTAMP_INVALID.");
  const nextVersion = document.version + 1;
  return assertDesignDocument({
    ...document,
    version: nextVersion,
    layers: [...document.layers, ...children, group],
    history: [
      ...document.history,
      {
        version: nextVersion,
        createdAt: timestamp,
        summary: `Inserted reusable component ${component.id} as ${instanceId} with destination text rebinding.`,
        actor: "human",
      },
    ],
    updatedAt: timestamp,
  });
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

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export class FileCreativeComponentStore {
  readonly rootDir: string;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
  }

  private directory(clientId: string, brandId: string): string {
    return join(this.rootDir, "components", safeId(clientId, "clientId"), safeId(brandId, "brandId"));
  }

  private path(clientId: string, brandId: string, componentId: string): string {
    return join(this.directory(clientId, brandId), `${safeId(componentId, "componentId")}.json`);
  }

  async save(componentInput: CreativeReusableComponent): Promise<CreativeReusableComponent> {
    const component = assertReusableComponent(componentInput);
    const path = this.path(component.clientId, component.brandId, component.id);
    if (await readJson<CreativeReusableComponent>(path)) {
      throw new Error(`CREATIVE_COMPONENT_IMMUTABLE: ${component.id} already exists.`);
    }
    await mkdir(this.directory(component.clientId, component.brandId), { recursive: true });
    await writeFile(path, `${JSON.stringify(component, null, 2)}\n`, "utf8");
    return component;
  }

  async get(clientId: string, brandId: string, componentId: string): Promise<CreativeReusableComponent | undefined> {
    const raw = await readJson<CreativeReusableComponent>(this.path(clientId, brandId, componentId));
    return raw ? assertReusableComponent(raw) : undefined;
  }

  async list(clientId: string, brandId: string): Promise<CreativeComponentSummary[]> {
    const dir = this.directory(clientId, brandId);
    let files: string[];
    try {
      files = await readdir(dir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const components = await Promise.all(
      files.filter((file) => file.endsWith(".json")).map(async (file) => {
        const raw = await readJson<CreativeReusableComponent>(join(dir, file));
        return raw ? assertReusableComponent(raw) : undefined;
      }),
    );
    return components
      .filter((component): component is CreativeReusableComponent => Boolean(component))
      .map(componentSummary)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
