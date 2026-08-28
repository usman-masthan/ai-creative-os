import { assertDesignDocument } from "./validator.js";
import type { DesignDocument, DesignLayer } from "./types.js";

export type DesignOperation =
  | { type: "MOVE_LAYER"; layerId: string; x: number; y: number; actor?: "human" | "ai" }
  | { type: "RESIZE_LAYER"; layerId: string; width: number; height: number; actor?: "human" | "ai" }
  | { type: "SET_VISIBILITY"; layerId: string; visible: boolean; actor?: "human" | "ai" }
  | { type: "SET_LOCK"; layerId: string; locked: boolean; actor?: "human" | "ai" }
  | { type: "REORDER_LAYER"; layerId: string; zIndex: number; actor?: "human" | "ai" }
  | { type: "UPDATE_TEXT"; layerId: string; text: string; actor?: "human" | "ai" };

function nowOr(value?: string): string {
  return value ?? new Date().toISOString();
}

function updateLayer(document: DesignDocument, layerId: string, transform: (layer: DesignLayer) => DesignLayer): DesignLayer[] {
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
    case "SET_VISIBILITY": return `${operation.visible ? "Showed" : "Hid"} ${operation.layerId}.`;
    case "SET_LOCK": return `${operation.locked ? "Locked" : "Unlocked"} ${operation.layerId}.`;
    case "REORDER_LAYER": return `Reordered ${operation.layerId}.`;
    case "UPDATE_TEXT": return `Updated text in ${operation.layerId}.`;
  }
}

export function applyDesignOperation(
  document: DesignDocument,
  operation: DesignOperation,
  timestamp?: string,
): DesignDocument {
  const createdAt = nowOr(timestamp);
  const actor = operation.actor ?? "human";
  const layers = updateLayer(document, operation.layerId, (layer) => {
    if (layer.locked && operation.type !== "SET_LOCK") {
      throw new Error(`DESIGN_LAYER_LOCKED: ${operation.layerId}`);
    }
    switch (operation.type) {
      case "MOVE_LAYER":
        return { ...layer, x: operation.x, y: operation.y };
      case "RESIZE_LAYER":
        if (operation.width <= 0 || operation.height <= 0) throw new Error("Layer dimensions must be positive.");
        return { ...layer, width: operation.width, height: operation.height };
      case "SET_VISIBILITY":
        return { ...layer, visible: operation.visible };
      case "SET_LOCK":
        if (layer.type === "logo" && !operation.locked) throw new Error("BRAND_GOVERNANCE_BLOCK: logo layers cannot be unlocked.");
        return { ...layer, locked: operation.locked };
      case "REORDER_LAYER":
        return { ...layer, zIndex: operation.zIndex };
      case "UPDATE_TEXT":
        if (layer.type !== "text") throw new Error(`DESIGN_LAYER_TYPE_MISMATCH: ${operation.layerId} is not text.`);
        if (!operation.text.trim()) throw new Error("Text layers cannot be blank.");
        return { ...layer, text: operation.text };
    }
  });
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
