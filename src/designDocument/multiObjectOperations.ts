import { assertDesignDocument } from "./validator.js";
import type { DesignDocument, DesignLayer } from "./types.js";

export type MultiObjectDesignOperation =
  | {
      type: "DUPLICATE_LAYERS";
      layerIds: string[];
      newLayerIds: string[];
      offsetX?: number;
      offsetY?: number;
      actor?: "human" | "ai";
    }
  | {
      type: "DELETE_LAYERS";
      layerIds: string[];
      actor?: "human" | "ai";
    };

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function selected(document: DesignDocument, layerIds: string[]): DesignLayer[] {
  if (layerIds.length < 2) throw new Error("Select at least 2 layers.");
  const unique = [...new Set(layerIds.map((id) => safeId(id, "layerId")))];
  if (unique.length !== layerIds.length) throw new Error("Layer selection contains duplicate ids.");
  return unique.map((id) => {
    const layer = document.layers.find((candidate) => candidate.id === id);
    if (!layer) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${id}`);
    return layer;
  });
}

function parentGroup(document: DesignDocument, layerId: string): string | undefined {
  const group = document.layers.find(
    (layer) => layer.type === "group" && layer.childLayerIds.includes(layerId),
  );
  return group?.id;
}

function assertMultiEditable(document: DesignDocument, layers: DesignLayer[], action: "duplicate" | "delete"): void {
  for (const layer of layers) {
    if (layer.locked) throw new Error(`DESIGN_LAYER_LOCKED: ${layer.id}`);
    if (layer.type === "logo") throw new Error(`BRAND_GOVERNANCE_BLOCK: logo layers cannot be ${action}d.`);
    if (layer.type === "background") throw new Error(`DESIGN_STRUCTURE_BLOCK: the primary background cannot be ${action}d.`);
    if (layer.type === "group") throw new Error(`DESIGN_GROUP_${action.toUpperCase()}_BLOCK: ${action} group members explicitly instead.`);
    if (layer.type === "mask") throw new Error(`DESIGN_MASK_${action.toUpperCase()}_BLOCK: ${action} masks explicitly through mask tooling.`);
    if (action === "delete") {
      const parent = parentGroup(document, layer.id);
      if (parent) throw new Error(`DESIGN_GROUP_MEMBER_BLOCK: ungroup ${parent} before deleting ${layer.id}.`);
    }
  }
}

function summary(operation: MultiObjectDesignOperation): string {
  return operation.type === "DUPLICATE_LAYERS"
    ? `Duplicated ${operation.layerIds.length} selected layers.`
    : `Deleted ${operation.layerIds.length} selected layers.`;
}

export function applyMultiObjectDesignOperation(
  document: DesignDocument,
  operation: MultiObjectDesignOperation,
  timestamp = new Date().toISOString(),
): DesignDocument {
  const chosen = selected(document, operation.layerIds);
  const actor = operation.actor ?? "human";
  let layers: DesignLayer[];

  if (operation.type === "DUPLICATE_LAYERS") {
    assertMultiEditable(document, chosen, "duplicate");
    if (operation.newLayerIds.length !== chosen.length) {
      throw new Error("newLayerIds must match the selected layer count.");
    }
    const newIds = operation.newLayerIds.map((id) => safeId(id, "newLayerId"));
    if (new Set(newIds).size !== newIds.length) throw new Error("newLayerIds contains duplicate ids.");
    const existingIds = new Set(document.layers.map((layer) => layer.id));
    for (const id of newIds) if (existingIds.has(id)) throw new Error(`DESIGN_LAYER_DUPLICATE_ID: ${id}`);
    const offsetX = operation.offsetX ?? 20;
    const offsetY = operation.offsetY ?? 20;
    if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) throw new Error("Duplicate offsets must be finite.");
    const maxZ = Math.max(0, ...document.layers.map((layer) => layer.zIndex));
    const copies = chosen.map((source, index): DesignLayer => ({
      ...source,
      id: newIds[index]!,
      name: `${source.name} copy`,
      x: source.x + offsetX,
      y: source.y + offsetY,
      zIndex: maxZ + index + 1,
      locked: false,
    }));
    layers = [...document.layers, ...copies];
  } else {
    assertMultiEditable(document, chosen, "delete");
    const ids = new Set(chosen.map((layer) => layer.id));
    layers = document.layers.filter((layer) => !ids.has(layer.id));
  }

  const nextVersion = document.version + 1;
  return assertDesignDocument({
    ...document,
    version: nextVersion,
    layers,
    history: [
      ...document.history,
      { version: nextVersion, createdAt: timestamp, summary: summary(operation), actor },
    ],
    updatedAt: timestamp,
  });
}
