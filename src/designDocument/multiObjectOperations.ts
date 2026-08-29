import { assertDesignDocument } from "./validator.js";
import type { DesignDocument, DesignGroupLayer, DesignLayer } from "./types.js";

export type LayerOrderPlacement = "FRONT" | "FORWARD" | "BACKWARD" | "BACK";

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
    }
  | {
      type: "RENAME_LAYER";
      layerId: string;
      name: string;
      actor?: "human" | "ai";
    }
  | {
      type: "REORDER_LAYERS";
      layerIds: string[];
      placement: LayerOrderPlacement;
      actor?: "human" | "ai";
    }
  | {
      type: "DUPLICATE_GROUP";
      groupLayerId: string;
      newGroupLayerId: string;
      newChildLayerIds: string[];
      offsetX?: number;
      offsetY?: number;
      actor?: "human" | "ai";
    };

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function selected(document: DesignDocument, layerIds: string[], minimum = 2): DesignLayer[] {
  if (layerIds.length < minimum) throw new Error(`Select at least ${minimum} layer${minimum === 1 ? "" : "s"}.`);
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
  switch (operation.type) {
    case "DUPLICATE_LAYERS": return `Duplicated ${operation.layerIds.length} selected layers.`;
    case "DELETE_LAYERS": return `Deleted ${operation.layerIds.length} selected layers.`;
    case "RENAME_LAYER": return `Renamed ${operation.layerId} to ${operation.name.trim()}.`;
    case "REORDER_LAYERS": return `Moved ${operation.layerIds.length} layer selection ${operation.placement.toLowerCase()}.`;
    case "DUPLICATE_GROUP": return `Duplicated group ${operation.groupLayerId} as ${operation.newGroupLayerId}.`;
  }
}

function reorderEligible(layer: DesignLayer): boolean {
  return !layer.locked
    && layer.type !== "background"
    && layer.type !== "logo"
    && layer.type !== "group"
    && layer.type !== "mask";
}

function expandOrderSelection(document: DesignDocument, layerIds: string[]): DesignLayer[] {
  const requested = selected(document, layerIds, 1);
  const expanded: DesignLayer[] = [];
  const seen = new Set<string>();
  for (const layer of requested) {
    const members = layer.type === "group"
      ? layer.childLayerIds.map((id) => {
          const child = document.layers.find((candidate) => candidate.id === id);
          if (!child) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${id}`);
          return child;
        })
      : [layer];
    if (layer.type === "group" && layer.locked) throw new Error(`DESIGN_LAYER_LOCKED: ${layer.id}`);
    for (const member of members) {
      if (!reorderEligible(member)) {
        throw new Error(`DESIGN_LAYER_ORDER_BLOCK: ${member.id} is protected from layer-order changes.`);
      }
      if (!seen.has(member.id)) {
        seen.add(member.id);
        expanded.push(member);
      }
    }
  }
  return expanded;
}

function reorderedEditableLayers(document: DesignDocument, operation: Extract<MultiObjectDesignOperation, { type: "REORDER_LAYERS" }>): DesignLayer[] {
  const chosen = expandOrderSelection(document, operation.layerIds);
  const chosenIds = new Set(chosen.map((layer) => layer.id));
  const editable = document.layers
    .filter(reorderEligible)
    .sort((a, b) => a.zIndex - b.zIndex || document.layers.indexOf(a) - document.layers.indexOf(b));
  const slots = editable.map((layer) => layer.zIndex);
  let ordered = [...editable];

  if (operation.placement === "FRONT") {
    ordered = [...ordered.filter((layer) => !chosenIds.has(layer.id)), ...ordered.filter((layer) => chosenIds.has(layer.id))];
  } else if (operation.placement === "BACK") {
    ordered = [...ordered.filter((layer) => chosenIds.has(layer.id)), ...ordered.filter((layer) => !chosenIds.has(layer.id))];
  } else if (operation.placement === "FORWARD") {
    for (let index = ordered.length - 2; index >= 0; index -= 1) {
      if (chosenIds.has(ordered[index]!.id) && !chosenIds.has(ordered[index + 1]!.id)) {
        [ordered[index], ordered[index + 1]] = [ordered[index + 1]!, ordered[index]!];
      }
    }
  } else {
    for (let index = 1; index < ordered.length; index += 1) {
      if (chosenIds.has(ordered[index]!.id) && !chosenIds.has(ordered[index - 1]!.id)) {
        [ordered[index - 1], ordered[index]] = [ordered[index]!, ordered[index - 1]!];
      }
    }
  }

  const zById = new Map<string, number>();
  ordered.forEach((layer, index) => zById.set(layer.id, slots[index]!));
  return document.layers.map((layer) => zById.has(layer.id) ? { ...layer, zIndex: zById.get(layer.id)! } : layer);
}

function groupById(document: DesignDocument, id: string): DesignGroupLayer {
  const group = document.layers.find((layer): layer is DesignGroupLayer => layer.id === id && layer.type === "group");
  if (!group) throw new Error(`DESIGN_GROUP_NOT_FOUND: ${id}`);
  return group;
}

function duplicateGroup(
  document: DesignDocument,
  operation: Extract<MultiObjectDesignOperation, { type: "DUPLICATE_GROUP" }>,
): DesignLayer[] {
  const group = groupById(document, safeId(operation.groupLayerId, "groupLayerId"));
  if (group.locked) throw new Error(`DESIGN_LAYER_LOCKED: ${group.id}`);
  const children = group.childLayerIds.map((id) => {
    const child = document.layers.find((layer) => layer.id === id);
    if (!child) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${id}`);
    if (!reorderEligible(child)) throw new Error(`DESIGN_GROUP_DUPLICATE_BLOCK: child ${id} is protected.`);
    if (document.layers.some((layer) => layer.type === "mask" && layer.targetLayerIds.includes(id))) {
      throw new Error(`DESIGN_GROUP_DUPLICATE_BLOCK: child ${id} participates in a mask; duplicate through mask tooling instead.`);
    }
    return child;
  });
  if (operation.newChildLayerIds.length !== children.length) {
    throw new Error("newChildLayerIds must match the group child count.");
  }
  const newGroupLayerId = safeId(operation.newGroupLayerId, "newGroupLayerId");
  const newChildIds = operation.newChildLayerIds.map((id) => safeId(id, "newChildLayerId"));
  const allNewIds = [newGroupLayerId, ...newChildIds];
  if (new Set(allNewIds).size !== allNewIds.length) throw new Error("Group duplicate ids must be unique.");
  const existing = new Set(document.layers.map((layer) => layer.id));
  for (const id of allNewIds) if (existing.has(id)) throw new Error(`DESIGN_LAYER_DUPLICATE_ID: ${id}`);
  const offsetX = operation.offsetX ?? 24;
  const offsetY = operation.offsetY ?? 24;
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) throw new Error("Duplicate offsets must be finite.");
  const maxZ = Math.max(0, ...document.layers.map((layer) => layer.zIndex));
  const copies = children.map((child, index): DesignLayer => ({
    ...child,
    id: newChildIds[index]!,
    name: `${child.name} copy`,
    x: child.x + offsetX,
    y: child.y + offsetY,
    zIndex: maxZ + index + 1,
    locked: false,
  }));
  const copyGroup: DesignGroupLayer = {
    ...group,
    id: newGroupLayerId,
    name: `${group.name} copy`,
    x: group.x + offsetX,
    y: group.y + offsetY,
    zIndex: maxZ + copies.length + 1,
    locked: false,
    childLayerIds: newChildIds,
  };
  return [...document.layers, ...copies, copyGroup];
}

export function applyMultiObjectDesignOperation(
  document: DesignDocument,
  operation: MultiObjectDesignOperation,
  timestamp = new Date().toISOString(),
): DesignDocument {
  const actor = operation.actor ?? "human";
  let layers: DesignLayer[];

  if (operation.type === "DUPLICATE_LAYERS") {
    const chosen = selected(document, operation.layerIds);
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
  } else if (operation.type === "DELETE_LAYERS") {
    const chosen = selected(document, operation.layerIds);
    assertMultiEditable(document, chosen, "delete");
    const ids = new Set(chosen.map((layer) => layer.id));
    layers = document.layers.filter((layer) => !ids.has(layer.id));
  } else if (operation.type === "RENAME_LAYER") {
    const layerId = safeId(operation.layerId, "layerId");
    const name = operation.name.trim();
    if (!name || name.length > 120) throw new Error("Layer name must contain 1 to 120 characters.");
    let found = false;
    layers = document.layers.map((layer) => {
      if (layer.id !== layerId) return layer;
      found = true;
      return { ...layer, name };
    });
    if (!found) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${layerId}`);
  } else if (operation.type === "REORDER_LAYERS") {
    layers = reorderedEditableLayers(document, operation);
  } else {
    layers = duplicateGroup(document, operation);
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
