import { assertDesignDocument } from "./validator.js";
import type {
  DesignAssetRef,
  DesignDocument,
  DesignGroupLayer,
  DesignLayer,
  DesignTextLayer,
} from "./types.js";

export interface DesignTextStylePatch {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  align?: DesignTextLayer["align"];
  fill?: string;
  stroke?: string | null;
}

export type DesignLayerAlignment =
  | "left"
  | "horizontal-center"
  | "right"
  | "top"
  | "vertical-center"
  | "bottom";

export type DesignLayerDistributionAxis = "horizontal" | "vertical";

export type DesignOperation =
  | { type: "MOVE_LAYER"; layerId: string; x: number; y: number; actor?: "human" | "ai" }
  | { type: "MOVE_LAYERS"; layerIds: string[]; deltaX: number; deltaY: number; actor?: "human" | "ai" }
  | { type: "RESIZE_LAYER"; layerId: string; width: number; height: number; actor?: "human" | "ai" }
  | { type: "ROTATE_LAYER"; layerId: string; rotation: number; actor?: "human" | "ai" }
  | { type: "ALIGN_LAYERS"; layerIds: string[]; alignment: DesignLayerAlignment; actor?: "human" | "ai" }
  | { type: "DISTRIBUTE_LAYERS"; layerIds: string[]; axis: DesignLayerDistributionAxis; actor?: "human" | "ai" }
  | { type: "GROUP_LAYERS"; layerIds: string[]; groupLayerId: string; name?: string; actor?: "human" | "ai" }
  | { type: "UNGROUP_LAYERS"; layerId: string; actor?: "human" | "ai" }
  | { type: "SET_OPACITY"; layerId: string; opacity: number; actor?: "human" | "ai" }
  | { type: "SET_VISIBILITY"; layerId: string; visible: boolean; actor?: "human" | "ai" }
  | { type: "SET_LOCK"; layerId: string; locked: boolean; actor?: "human" | "ai" }
  | { type: "REORDER_LAYER"; layerId: string; zIndex: number; actor?: "human" | "ai" }
  | { type: "UPDATE_TEXT"; layerId: string; text: string; actor?: "human" | "ai" }
  | { type: "UPDATE_TEXT_STYLE"; layerId: string; patch: DesignTextStylePatch; actor?: "human" | "ai" }
  | { type: "UPDATE_SHAPE_STYLE"; layerId: string; fill?: string; stroke?: string; strokeWidth?: number; cornerRadius?: number; actor?: "human" | "ai" }
  | { type: "REPLACE_ASSET"; layerId: string; asset: DesignAssetRef; actor?: "human" | "ai" }
  | { type: "DUPLICATE_LAYER"; layerId: string; newLayerId: string; name?: string; offsetX?: number; offsetY?: number; actor?: "human" | "ai" }
  | { type: "DELETE_LAYER"; layerId: string; actor?: "human" | "ai" };

function nowOr(value?: string): string {
  return value ?? new Date().toISOString();
}

function safeLayerId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function updateLayer(
  document: DesignDocument,
  layerId: string,
  transform: (layer: DesignLayer) => DesignLayer,
): DesignLayer[] {
  let found = false;
  const layers = document.layers.map((layer) => {
    if (layer.id !== layerId) return layer;
    found = true;
    return transform(layer);
  });
  if (!found) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${layerId}`);
  return layers;
}

function summary(operation: DesignOperation): string {
  switch (operation.type) {
    case "MOVE_LAYER": return `Moved ${operation.layerId}.`;
    case "MOVE_LAYERS": return `Moved ${operation.layerIds.length} selected layers.`;
    case "RESIZE_LAYER": return `Resized ${operation.layerId}.`;
    case "ROTATE_LAYER": return `Rotated ${operation.layerId}.`;
    case "ALIGN_LAYERS": return `Aligned ${operation.layerIds.length} layers ${operation.alignment}.`;
    case "DISTRIBUTE_LAYERS": return `Distributed ${operation.layerIds.length} layers ${operation.axis}ly.`;
    case "GROUP_LAYERS": return `Grouped ${operation.layerIds.length} layers as ${operation.groupLayerId}.`;
    case "UNGROUP_LAYERS": return `Ungrouped ${operation.layerId}.`;
    case "SET_OPACITY": return `Changed opacity of ${operation.layerId}.`;
    case "SET_VISIBILITY": return `${operation.visible ? "Showed" : "Hid"} ${operation.layerId}.`;
    case "SET_LOCK": return `${operation.locked ? "Locked" : "Unlocked"} ${operation.layerId}.`;
    case "REORDER_LAYER": return `Reordered ${operation.layerId}.`;
    case "UPDATE_TEXT": return `Updated text in ${operation.layerId}.`;
    case "UPDATE_TEXT_STYLE": return `Updated typography for ${operation.layerId}.`;
    case "UPDATE_SHAPE_STYLE": return `Updated styling for ${operation.layerId}.`;
    case "REPLACE_ASSET": return `Replaced asset in ${operation.layerId}.`;
    case "DUPLICATE_LAYER": return `Duplicated ${operation.layerId} as ${operation.newLayerId}.`;
    case "DELETE_LAYER": return `Deleted ${operation.layerId}.`;
  }
}

function assertEditable(layer: DesignLayer, operation: DesignOperation): void {
  if (layer.locked && operation.type !== "SET_LOCK") {
    throw new Error(`DESIGN_LAYER_LOCKED: ${layer.id}`);
  }
}

function assertTextPatch(patch: DesignTextStylePatch): void {
  if (patch.fontFamily !== undefined && !patch.fontFamily.trim()) throw new Error("Font family cannot be blank.");
  if (patch.fontSize !== undefined && (!Number.isFinite(patch.fontSize) || patch.fontSize <= 0)) throw new Error("Font size must be positive.");
  if (patch.fontWeight !== undefined && (!Number.isFinite(patch.fontWeight) || patch.fontWeight < 100 || patch.fontWeight > 1000)) throw new Error("Font weight must be from 100 to 1000.");
  if (patch.lineHeight !== undefined && (!Number.isFinite(patch.lineHeight) || patch.lineHeight <= 0)) throw new Error("Line height must be positive.");
  if (patch.letterSpacing !== undefined && !Number.isFinite(patch.letterSpacing)) throw new Error("Letter spacing must be finite.");
  if (patch.fill !== undefined && !patch.fill.trim()) throw new Error("Text fill cannot be blank.");
}

function selectedLayers(document: DesignDocument, layerIds: string[], minimum: number): DesignLayer[] {
  if (layerIds.length < minimum) throw new Error(`Select at least ${minimum} layers.`);
  const unique = [...new Set(layerIds.map((id) => safeLayerId(id, "layerId")))];
  if (unique.length !== layerIds.length) throw new Error("Layer selection contains duplicate ids.");
  return unique.map((id) => {
    const layer = document.layers.find((candidate) => candidate.id === id);
    if (!layer) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${id}`);
    return layer;
  });
}

function assertArrangeable(layers: DesignLayer[], operation: DesignOperation): void {
  for (const layer of layers) {
    assertEditable(layer, operation);
    if (layer.type === "group") throw new Error("DESIGN_GROUP_SELECTION_BLOCK: arrange group containers separately from leaf layers.");
    if (layer.type === "background") throw new Error("DESIGN_STRUCTURE_BLOCK: the primary background cannot participate in multi-layer arrange operations.");
  }
}

function bounds(layers: DesignLayer[]): { x: number; y: number; width: number; height: number } {
  const left = Math.min(...layers.map((layer) => layer.x));
  const top = Math.min(...layers.map((layer) => layer.y));
  const right = Math.max(...layers.map((layer) => layer.x + layer.width));
  const bottom = Math.max(...layers.map((layer) => layer.y + layer.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function visualBoundsForLayer(layer: DesignLayer): { x: number; y: number; width: number; height: number } {
  const radians = layer.rotation * Math.PI / 180;
  if (Math.abs(radians) < 1e-9) return { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const corners = [
    [layer.x, layer.y],
    [layer.x + layer.width, layer.y],
    [layer.x + layer.width, layer.y + layer.height],
    [layer.x, layer.y + layer.height],
  ].map(([x, y]) => {
    const dx = x! - cx;
    const dy = y! - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
  const left = Math.min(...corners.map((point) => point.x));
  const top = Math.min(...corners.map((point) => point.y));
  const right = Math.max(...corners.map((point) => point.x));
  const bottom = Math.max(...corners.map((point) => point.y));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function visualBounds(layers: DesignLayer[]): { x: number; y: number; width: number; height: number } {
  const boxes = layers.map(visualBoundsForLayer);
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function parentGroup(document: DesignDocument, layerId: string): DesignGroupLayer | undefined {
  return document.layers.find(
    (layer): layer is DesignGroupLayer => layer.type === "group" && layer.childLayerIds.includes(layerId),
  );
}

function recomputeGroupBounds(layers: DesignLayer[]): DesignLayer[] {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  return layers.map((layer) => {
    if (layer.type !== "group") return layer;
    const children = layer.childLayerIds
      .map((id) => byId.get(id))
      .filter((child): child is DesignLayer => Boolean(child));
    if (!children.length) return layer;
    const next = visualBounds(children);
    return { ...layer, ...next };
  });
}

function applySingleLayerOperation(layer: DesignLayer, operation: DesignOperation): DesignLayer {
  assertEditable(layer, operation);
  switch (operation.type) {
    case "MOVE_LAYER":
      if (!Number.isFinite(operation.x) || !Number.isFinite(operation.y)) throw new Error("Layer position must be finite.");
      return { ...layer, x: operation.x, y: operation.y };
    case "RESIZE_LAYER":
      if (layer.type === "group") throw new Error("DESIGN_GROUP_TRANSFORM_BLOCK: group resize requires the group transform path.");
      if (!Number.isFinite(operation.width) || !Number.isFinite(operation.height) || operation.width <= 0 || operation.height <= 0) {
        throw new Error("Layer dimensions must be positive finite numbers.");
      }
      if (layer.type === "logo") {
        const ratio = layer.width / Math.max(1, layer.height);
        const requested = operation.width / Math.max(1, operation.height);
        if (Math.abs(ratio - requested) / Math.max(ratio, 0.0001) > 0.02) {
          throw new Error("BRAND_GOVERNANCE_BLOCK: logo resizing must preserve aspect ratio.");
        }
      }
      return { ...layer, width: operation.width, height: operation.height };
    case "ROTATE_LAYER":
      if (layer.type === "group") throw new Error("DESIGN_GROUP_TRANSFORM_BLOCK: group rotation requires the group transform path.");
      if (!Number.isFinite(operation.rotation)) throw new Error("Layer rotation must be finite.");
      if (layer.type === "logo") throw new Error("BRAND_GOVERNANCE_BLOCK: logo rotation is not permitted.");
      return { ...layer, rotation: operation.rotation };
    case "SET_OPACITY":
      if (layer.type === "group") throw new Error("DESIGN_GROUP_STYLE_BLOCK: group opacity is not destructive shorthand for child opacity.");
      if (!Number.isFinite(operation.opacity) || operation.opacity < 0 || operation.opacity > 1) {
        throw new Error("Layer opacity must be between 0 and 1.");
      }
      if (layer.type === "logo" && operation.opacity !== 1) {
        throw new Error("BRAND_GOVERNANCE_BLOCK: logo opacity must remain 1.");
      }
      return { ...layer, opacity: operation.opacity };
    case "SET_VISIBILITY":
      return { ...layer, visible: operation.visible };
    case "SET_LOCK":
      if (layer.type === "logo" && !operation.locked) {
        throw new Error("BRAND_GOVERNANCE_BLOCK: logo layers cannot be unlocked.");
      }
      return { ...layer, locked: operation.locked };
    case "REORDER_LAYER":
      if (layer.type === "group") throw new Error("DESIGN_GROUP_STYLE_BLOCK: reorder child layers directly.");
      if (!Number.isFinite(operation.zIndex)) throw new Error("Layer zIndex must be finite.");
      return { ...layer, zIndex: operation.zIndex };
    case "UPDATE_TEXT":
      if (layer.type !== "text") throw new Error(`DESIGN_LAYER_TYPE_MISMATCH: ${layer.id} is not text.`);
      if (!operation.text.trim()) throw new Error("Text layers cannot be blank.");
      if (layer.role === "price" && operation.actor === "ai") {
        throw new Error("FACT_GOVERNANCE_BLOCK: AI cannot rewrite a price layer.");
      }
      return { ...layer, text: operation.text };
    case "UPDATE_TEXT_STYLE": {
      if (layer.type !== "text") throw new Error(`DESIGN_LAYER_TYPE_MISMATCH: ${layer.id} is not text.`);
      assertTextPatch(operation.patch);
      const { stroke, ...rest } = operation.patch;
      return {
        ...layer,
        ...rest,
        ...(stroke === null ? { stroke: undefined } : stroke !== undefined ? { stroke } : {}),
      } as DesignTextLayer;
    }
    case "UPDATE_SHAPE_STYLE":
      if (layer.type !== "shape") throw new Error(`DESIGN_LAYER_TYPE_MISMATCH: ${layer.id} is not a shape.`);
      if (operation.strokeWidth !== undefined && (!Number.isFinite(operation.strokeWidth) || operation.strokeWidth < 0)) {
        throw new Error("Shape strokeWidth must be non-negative.");
      }
      if (operation.cornerRadius !== undefined && (!Number.isFinite(operation.cornerRadius) || operation.cornerRadius < 0)) {
        throw new Error("Shape cornerRadius must be non-negative.");
      }
      return {
        ...layer,
        ...(operation.fill !== undefined ? { fill: operation.fill } : {}),
        ...(operation.stroke !== undefined ? { stroke: operation.stroke } : {}),
        ...(operation.strokeWidth !== undefined ? { strokeWidth: operation.strokeWidth } : {}),
        ...(operation.cornerRadius !== undefined ? { cornerRadius: operation.cornerRadius } : {}),
      };
    case "REPLACE_ASSET":
      if (layer.type === "image") return { ...layer, asset: operation.asset };
      if (layer.type === "background") return { ...layer, asset: operation.asset };
      if (layer.type === "logo") {
        if (operation.asset.source !== "approved-brand") {
          throw new Error("BRAND_GOVERNANCE_BLOCK: logo replacement requires an approved-brand asset.");
        }
        return { ...layer, asset: operation.asset };
      }
      throw new Error(`DESIGN_LAYER_TYPE_MISMATCH: ${layer.id} does not accept an asset.`);
    default:
      throw new Error(`DESIGN_OPERATION_NOT_SINGLE_LAYER: ${operation.type}.`);
  }
}

function moveGroup(document: DesignDocument, operation: Extract<DesignOperation, { type: "MOVE_LAYER" }>, group: DesignGroupLayer): DesignLayer[] {
  assertEditable(group, operation);
  if (!Number.isFinite(operation.x) || !Number.isFinite(operation.y)) throw new Error("Layer position must be finite.");
  const deltaX = operation.x - group.x;
  const deltaY = operation.y - group.y;
  const childIds = new Set(group.childLayerIds);
  return document.layers.map((layer) => {
    if (layer.id === group.id) return { ...layer, x: operation.x, y: operation.y };
    if (!childIds.has(layer.id)) return layer;
    assertEditable(layer, operation);
    return { ...layer, x: layer.x + deltaX, y: layer.y + deltaY };
  });
}

function scaleGroupChild(layer: DesignLayer, scale: number, originX: number, originY: number): DesignLayer {
  const centerX = layer.x + layer.width / 2;
  const centerY = layer.y + layer.height / 2;
  const width = layer.width * scale;
  const height = layer.height * scale;
  const x = originX + (centerX - originX) * scale - width / 2;
  const y = originY + (centerY - originY) * scale - height / 2;
  const common = { ...layer, x, y, width, height };
  if (layer.type === "text") {
    return {
      ...common,
      fontSize: layer.fontSize * scale,
      letterSpacing: layer.letterSpacing * scale,
      ...(layer.shadow
        ? {
            shadow: {
              ...layer.shadow,
              offsetX: layer.shadow.offsetX * scale,
              offsetY: layer.shadow.offsetY * scale,
              blur: layer.shadow.blur * scale,
            },
          }
        : {}),
    } as DesignTextLayer;
  }
  if (layer.type === "shape") {
    return {
      ...common,
      ...(layer.strokeWidth !== undefined ? { strokeWidth: layer.strokeWidth * scale } : {}),
      ...(layer.cornerRadius !== undefined ? { cornerRadius: layer.cornerRadius * scale } : {}),
    };
  }
  return common as DesignLayer;
}

function resizeGroup(document: DesignDocument, operation: Extract<DesignOperation, { type: "RESIZE_LAYER" }>, group: DesignGroupLayer): DesignLayer[] {
  assertEditable(group, operation);
  if (!Number.isFinite(operation.width) || !Number.isFinite(operation.height) || operation.width <= 0 || operation.height <= 0) {
    throw new Error("Layer dimensions must be positive finite numbers.");
  }
  const widthScale = operation.width / Math.max(group.width, 0.0001);
  const heightScale = operation.height / Math.max(group.height, 0.0001);
  if (Math.abs(widthScale - heightScale) / Math.max(widthScale, heightScale, 0.0001) > 0.02) {
    throw new Error("DESIGN_GROUP_TRANSFORM_BLOCK: group resizing must preserve aspect ratio.");
  }
  const scale = (widthScale + heightScale) / 2;
  const childIds = new Set(group.childLayerIds);
  return document.layers.map((layer) => {
    if (layer.id === group.id) return { ...layer, width: operation.width, height: operation.height };
    if (!childIds.has(layer.id)) return layer;
    assertEditable(layer, operation);
    return scaleGroupChild(layer, scale, group.x, group.y);
  });
}

function normalizeRotation(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Math.abs(normalized) < 1e-9 ? 0 : normalized;
}

function rotateGroup(document: DesignDocument, operation: Extract<DesignOperation, { type: "ROTATE_LAYER" }>, group: DesignGroupLayer): DesignLayer[] {
  assertEditable(group, operation);
  if (!Number.isFinite(operation.rotation)) throw new Error("Layer rotation must be finite.");
  const deltaDegrees = operation.rotation - group.rotation;
  const radians = deltaDegrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const pivotX = group.x + group.width / 2;
  const pivotY = group.y + group.height / 2;
  const childIds = new Set(group.childLayerIds);
  return document.layers.map((layer) => {
    if (layer.id === group.id) return { ...layer, rotation: normalizeRotation(operation.rotation) };
    if (!childIds.has(layer.id)) return layer;
    assertEditable(layer, operation);
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    const dx = centerX - pivotX;
    const dy = centerY - pivotY;
    const nextCenterX = pivotX + dx * cos - dy * sin;
    const nextCenterY = pivotY + dx * sin + dy * cos;
    return {
      ...layer,
      x: nextCenterX - layer.width / 2,
      y: nextCenterY - layer.height / 2,
      rotation: normalizeRotation(layer.rotation + deltaDegrees),
    };
  });
}

function alignLayers(document: DesignDocument, operation: Extract<DesignOperation, { type: "ALIGN_LAYERS" }>): DesignLayer[] {
  const chosen = selectedLayers(document, operation.layerIds, 2);
  assertArrangeable(chosen, operation);
  const frame = bounds(chosen);
  const targets = new Map<string, { x: number; y: number }>();
  for (const layer of chosen) {
    let x = layer.x;
    let y = layer.y;
    switch (operation.alignment) {
      case "left": x = frame.x; break;
      case "horizontal-center": x = frame.x + frame.width / 2 - layer.width / 2; break;
      case "right": x = frame.x + frame.width - layer.width; break;
      case "top": y = frame.y; break;
      case "vertical-center": y = frame.y + frame.height / 2 - layer.height / 2; break;
      case "bottom": y = frame.y + frame.height - layer.height; break;
    }
    targets.set(layer.id, { x, y });
  }
  return document.layers.map((layer) => {
    const target = targets.get(layer.id);
    return target ? { ...layer, ...target } : layer;
  });
}

function distributeLayers(document: DesignDocument, operation: Extract<DesignOperation, { type: "DISTRIBUTE_LAYERS" }>): DesignLayer[] {
  const chosen = selectedLayers(document, operation.layerIds, 3);
  assertArrangeable(chosen, operation);
  const horizontal = operation.axis === "horizontal";
  const ordered = [...chosen].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const start = horizontal ? first.x : first.y;
  const end = horizontal ? last.x + last.width : last.y + last.height;
  const occupied = ordered.reduce((sum, layer) => sum + (horizontal ? layer.width : layer.height), 0);
  const gap = (end - start - occupied) / (ordered.length - 1);
  const targets = new Map<string, number>();
  let cursor = start;
  for (const layer of ordered) {
    targets.set(layer.id, cursor);
    cursor += (horizontal ? layer.width : layer.height) + gap;
  }
  return document.layers.map((layer) => {
    const target = targets.get(layer.id);
    if (target === undefined) return layer;
    return horizontal ? { ...layer, x: target } : { ...layer, y: target };
  });
}

export function applyDesignOperation(
  document: DesignDocument,
  operation: DesignOperation,
  timestamp?: string,
): DesignDocument {
  const createdAt = nowOr(timestamp);
  const actor = operation.actor ?? "human";
  let layers: DesignLayer[];

  switch (operation.type) {
    case "DUPLICATE_LAYER": {
      const newLayerId = safeLayerId(operation.newLayerId, "newLayerId");
      if (document.layers.some((layer) => layer.id === newLayerId)) {
        throw new Error(`DESIGN_LAYER_DUPLICATE_ID: ${newLayerId}`);
      }
      const source = document.layers.find((layer) => layer.id === operation.layerId);
      if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
      assertEditable(source, operation);
      if (source.type === "logo") throw new Error("BRAND_GOVERNANCE_BLOCK: logo layers cannot be duplicated.");
      if (source.type === "group") throw new Error("DESIGN_GROUP_DUPLICATE_BLOCK: duplicate group members explicitly instead.");
      const copy: DesignLayer = {
        ...source,
        id: newLayerId,
        name: operation.name?.trim() || `${source.name} copy`,
        x: source.x + (operation.offsetX ?? 20),
        y: source.y + (operation.offsetY ?? 20),
        zIndex: source.zIndex + 1,
        locked: false,
      };
      layers = [...document.layers, copy];
      break;
    }
    case "DELETE_LAYER": {
      const source = document.layers.find((layer) => layer.id === operation.layerId);
      if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
      assertEditable(source, operation);
      if (source.type === "logo") throw new Error("BRAND_GOVERNANCE_BLOCK: logo layers cannot be deleted.");
      if (source.type === "background") throw new Error("DESIGN_STRUCTURE_BLOCK: the primary background cannot be deleted.");
      const parent = parentGroup(document, source.id);
      if (parent) throw new Error(`DESIGN_GROUP_MEMBER_BLOCK: ungroup ${parent.id} before deleting ${source.id}.`);
      layers = document.layers.filter((layer) => layer.id !== operation.layerId);
      break;
    }
    case "GROUP_LAYERS": {
      const chosen = selectedLayers(document, operation.layerIds, 2);
      assertArrangeable(chosen, operation);
      for (const layer of chosen) {
        if (layer.type === "logo" || layer.type === "mask") {
          throw new Error(`DESIGN_GROUP_MEMBER_BLOCK: ${layer.type} layer ${layer.id} cannot join a movable group.`);
        }
        const parent = parentGroup(document, layer.id);
        if (parent) throw new Error(`DESIGN_GROUP_MEMBER_BLOCK: ${layer.id} already belongs to ${parent.id}.`);
      }
      const groupLayerId = safeLayerId(operation.groupLayerId, "groupLayerId");
      if (document.layers.some((layer) => layer.id === groupLayerId)) {
        throw new Error(`DESIGN_LAYER_DUPLICATE_ID: ${groupLayerId}`);
      }
      const frame = visualBounds(chosen);
      const group: DesignGroupLayer = {
        id: groupLayerId,
        name: operation.name?.trim() || "Group",
        type: "group",
        ...frame,
        rotation: 0,
        opacity: 1,
        zIndex: Math.max(...chosen.map((layer) => layer.zIndex)) + 1,
        visible: chosen.some((layer) => layer.visible),
        locked: false,
        aiEditable: false,
        childLayerIds: chosen.map((layer) => layer.id),
      };
      layers = [...document.layers, group];
      break;
    }
    case "UNGROUP_LAYERS": {
      const group = document.layers.find((layer): layer is DesignGroupLayer => layer.id === operation.layerId && layer.type === "group");
      if (!group) throw new Error(`DESIGN_GROUP_NOT_FOUND: ${operation.layerId}`);
      assertEditable(group, operation);
      layers = document.layers.filter((layer) => layer.id !== group.id);
      break;
    }
    case "MOVE_LAYERS": {
      if (!Number.isFinite(operation.deltaX) || !Number.isFinite(operation.deltaY)) throw new Error("Multi-layer movement delta must be finite.");
      const chosen = selectedLayers(document, operation.layerIds, 2);
      assertArrangeable(chosen, operation);
      const ids = new Set(chosen.map((layer) => layer.id));
      layers = document.layers.map((layer) => ids.has(layer.id)
        ? { ...layer, x: layer.x + operation.deltaX, y: layer.y + operation.deltaY }
        : layer);
      break;
    }
    case "ALIGN_LAYERS":
      layers = alignLayers(document, operation);
      break;
    case "DISTRIBUTE_LAYERS":
      layers = distributeLayers(document, operation);
      break;
    case "MOVE_LAYER": {
      const source = document.layers.find((layer) => layer.id === operation.layerId);
      if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
      layers = source.type === "group"
        ? moveGroup(document, operation, source)
        : updateLayer(document, operation.layerId, (layer) => applySingleLayerOperation(layer, operation));
      break;
    }
    case "RESIZE_LAYER": {
      const source = document.layers.find((layer) => layer.id === operation.layerId);
      if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
      layers = source.type === "group"
        ? resizeGroup(document, operation, source)
        : updateLayer(document, operation.layerId, (layer) => applySingleLayerOperation(layer, operation));
      break;
    }
    case "ROTATE_LAYER": {
      const source = document.layers.find((layer) => layer.id === operation.layerId);
      if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
      layers = source.type === "group"
        ? rotateGroup(document, operation, source)
        : updateLayer(document, operation.layerId, (layer) => applySingleLayerOperation(layer, operation));
      break;
    }
    case "SET_VISIBILITY":
    case "SET_LOCK": {
      const source = document.layers.find((layer) => layer.id === operation.layerId);
      if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
      if (source.type !== "group") {
        layers = updateLayer(document, operation.layerId, (layer) => applySingleLayerOperation(layer, operation));
        break;
      }
      assertEditable(source, operation);
      const childIds = new Set(source.childLayerIds);
      layers = document.layers.map((layer) => {
        if (layer.id === source.id || childIds.has(layer.id)) return applySingleLayerOperation(layer, operation);
        return layer;
      });
      break;
    }
    case "SET_OPACITY":
    case "REORDER_LAYER":
    case "UPDATE_TEXT":
    case "UPDATE_TEXT_STYLE":
    case "UPDATE_SHAPE_STYLE":
    case "REPLACE_ASSET":
      layers = updateLayer(document, operation.layerId, (layer) => applySingleLayerOperation(layer, operation));
      break;
  }

  layers = recomputeGroupBounds(layers);
  const nextVersion = document.version + 1;
  return assertDesignDocument({
    ...document,
    version: nextVersion,
    layers,
    history: [
      ...document.history,
      { version: nextVersion, createdAt, summary: summary(operation), actor },
    ],
    updatedAt: createdAt,
  });
}
