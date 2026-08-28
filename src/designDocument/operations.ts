import { assertDesignDocument } from "./validator.js";
import type {
  DesignAssetRef,
  DesignDocument,
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

export type DesignOperation =
  | { type: "MOVE_LAYER"; layerId: string; x: number; y: number; actor?: "human" | "ai" }
  | { type: "RESIZE_LAYER"; layerId: string; width: number; height: number; actor?: "human" | "ai" }
  | { type: "ROTATE_LAYER"; layerId: string; rotation: number; actor?: "human" | "ai" }
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
    case "RESIZE_LAYER": return `Resized ${operation.layerId}.`;
    case "ROTATE_LAYER": return `Rotated ${operation.layerId}.`;
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

function applySingleLayerOperation(layer: DesignLayer, operation: Exclude<DesignOperation, { type: "DUPLICATE_LAYER" | "DELETE_LAYER" }>): DesignLayer {
  assertEditable(layer, operation);
  switch (operation.type) {
    case "MOVE_LAYER":
      return { ...layer, x: operation.x, y: operation.y };
    case "RESIZE_LAYER":
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
      if (!Number.isFinite(operation.rotation)) throw new Error("Layer rotation must be finite.");
      if (layer.type === "logo") throw new Error("BRAND_GOVERNANCE_BLOCK: logo rotation is not permitted.");
      return { ...layer, rotation: operation.rotation };
    case "SET_OPACITY":
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
  }
}

export function applyDesignOperation(
  document: DesignDocument,
  operation: DesignOperation,
  timestamp?: string,
): DesignDocument {
  const createdAt = nowOr(timestamp);
  const actor = operation.actor ?? "human";
  let layers: DesignLayer[];

  if (operation.type === "DUPLICATE_LAYER") {
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(operation.newLayerId)) throw new Error("newLayerId contains unsafe characters.");
    if (document.layers.some((layer) => layer.id === operation.newLayerId)) {
      throw new Error(`DESIGN_LAYER_DUPLICATE_ID: ${operation.newLayerId}`);
    }
    const source = document.layers.find((layer) => layer.id === operation.layerId);
    if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
    assertEditable(source, operation);
    if (source.type === "logo") throw new Error("BRAND_GOVERNANCE_BLOCK: logo layers cannot be duplicated.");
    const copy: DesignLayer = {
      ...source,
      id: operation.newLayerId,
      name: operation.name?.trim() || `${source.name} copy`,
      x: source.x + (operation.offsetX ?? 20),
      y: source.y + (operation.offsetY ?? 20),
      zIndex: source.zIndex + 1,
      locked: false,
    };
    layers = [...document.layers, copy];
  } else if (operation.type === "DELETE_LAYER") {
    const source = document.layers.find((layer) => layer.id === operation.layerId);
    if (!source) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${operation.layerId}`);
    assertEditable(source, operation);
    if (source.type === "logo") throw new Error("BRAND_GOVERNANCE_BLOCK: logo layers cannot be deleted.");
    if (source.type === "background") throw new Error("DESIGN_STRUCTURE_BLOCK: the primary background cannot be deleted.");
    layers = document.layers.filter((layer) => layer.id !== operation.layerId);
  } else {
    layers = updateLayer(document, operation.layerId, (layer) => applySingleLayerOperation(layer, operation));
  }

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
