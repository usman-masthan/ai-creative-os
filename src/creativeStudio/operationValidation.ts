import type { DesignOperation, DesignTextStylePatch } from "../designDocument/operations.js";
import type { DesignAssetRef } from "../designDocument/types.js";

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function numberValue(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must be a finite number.`);
  return value;
}

function booleanValue(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${name} must be boolean.`);
  return value;
}

function assetRef(value: unknown): DesignAssetRef {
  const data = record(value, "asset");
  const source = data.source;
  if (source !== "approved-brand" && source !== "verified-product" && source !== "generated" && source !== "uploaded" && source !== "runtime") {
    throw new Error("asset.source is invalid.");
  }
  return {
    assetId: text(data.assetId, "asset.assetId"),
    source,
    ...(typeof data.uri === "string" && data.uri.trim() ? { uri: data.uri.trim() } : {}),
    ...(typeof data.mimeType === "string" && data.mimeType.trim() ? { mimeType: data.mimeType.trim() } : {}),
    ...(data.visualTruthClass === "VERIFIED_PRODUCT_VISUAL" || data.visualTruthClass === "CONSTRAINED_PRODUCT_GENERATION" || data.visualTruthClass === "GENERIC_CONCEPT_VISUAL"
      ? { visualTruthClass: data.visualTruthClass }
      : {}),
  };
}

function textStyle(value: unknown): DesignTextStylePatch {
  const data = record(value, "patch");
  const patch: DesignTextStylePatch = {};
  if (typeof data.fontFamily === "string") patch.fontFamily = data.fontFamily;
  if (typeof data.fontSize === "number") patch.fontSize = data.fontSize;
  if (typeof data.fontWeight === "number") patch.fontWeight = data.fontWeight;
  if (typeof data.lineHeight === "number") patch.lineHeight = data.lineHeight;
  if (typeof data.letterSpacing === "number") patch.letterSpacing = data.letterSpacing;
  if (data.align === "left" || data.align === "center" || data.align === "right") patch.align = data.align;
  if (typeof data.fill === "string") patch.fill = data.fill;
  if (typeof data.stroke === "string" || data.stroke === null) patch.stroke = data.stroke;
  return patch;
}

export function parseDesignOperation(value: unknown): DesignOperation {
  const data = record(value, "operation");
  const type = text(data.type, "operation.type");
  const layerId = text(data.layerId, "operation.layerId");
  switch (type) {
    case "MOVE_LAYER":
      return { type, layerId, x: numberValue(data.x, "operation.x"), y: numberValue(data.y, "operation.y") };
    case "RESIZE_LAYER":
      return { type, layerId, width: numberValue(data.width, "operation.width"), height: numberValue(data.height, "operation.height") };
    case "ROTATE_LAYER":
      return { type, layerId, rotation: numberValue(data.rotation, "operation.rotation") };
    case "SET_OPACITY":
      return { type, layerId, opacity: numberValue(data.opacity, "operation.opacity") };
    case "SET_VISIBILITY":
      return { type, layerId, visible: booleanValue(data.visible, "operation.visible") };
    case "SET_LOCK":
      return { type, layerId, locked: booleanValue(data.locked, "operation.locked") };
    case "REORDER_LAYER":
      return { type, layerId, zIndex: numberValue(data.zIndex, "operation.zIndex") };
    case "UPDATE_TEXT":
      return { type, layerId, text: text(data.text, "operation.text") };
    case "UPDATE_TEXT_STYLE":
      return { type, layerId, patch: textStyle(data.patch) };
    case "UPDATE_SHAPE_STYLE":
      return {
        type,
        layerId,
        ...(typeof data.fill === "string" ? { fill: data.fill } : {}),
        ...(typeof data.stroke === "string" ? { stroke: data.stroke } : {}),
        ...(typeof data.strokeWidth === "number" ? { strokeWidth: data.strokeWidth } : {}),
        ...(typeof data.cornerRadius === "number" ? { cornerRadius: data.cornerRadius } : {}),
      };
    case "REPLACE_ASSET":
      return { type, layerId, asset: assetRef(data.asset) };
    case "DUPLICATE_LAYER":
      return {
        type,
        layerId,
        newLayerId: text(data.newLayerId, "operation.newLayerId"),
        ...(typeof data.name === "string" && data.name.trim() ? { name: data.name.trim() } : {}),
        ...(typeof data.offsetX === "number" ? { offsetX: data.offsetX } : {}),
        ...(typeof data.offsetY === "number" ? { offsetY: data.offsetY } : {}),
      };
    case "DELETE_LAYER":
      return { type, layerId };
    default:
      throw new Error(`Unsupported design operation: ${type}.`);
  }
}
