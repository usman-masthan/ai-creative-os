import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { DesignDocument, DesignLayer } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import { FileDesignProjectStore, type DesignProjectSnapshot } from "./projectStore.js";

export interface LayerVersionChange {
  layerId: string;
  kind: "added" | "removed" | "changed";
  fields: string[];
}

export interface DesignVersionComparison {
  designId: string;
  fromVersion: number;
  toVersion: number;
  artboardChanged: boolean;
  layoutChanged: boolean;
  layerChanges: LayerVersionChange[];
}

function safeId(value: string): string {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) throw new Error("designId contains unsafe characters.");
  return value.trim();
}

function positiveVersion(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function stableLayerShape(layer: DesignLayer): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: layer.name,
    type: layer.type,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
    visible: layer.visible,
    locked: layer.locked,
    aiEditable: layer.aiEditable,
  };
  if (layer.type === "text") {
    Object.assign(base, {
      role: layer.role,
      text: layer.text,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      lineHeight: layer.lineHeight,
      letterSpacing: layer.letterSpacing,
      align: layer.align,
      fill: layer.fill,
      stroke: layer.stroke,
    });
  } else if (layer.type === "image" || layer.type === "logo") {
    Object.assign(base, {
      assetId: layer.asset.assetId,
      assetSource: layer.asset.source,
      visualTruthClass: layer.asset.visualTruthClass,
    });
  } else if (layer.type === "background") {
    Object.assign(base, {
      fill: layer.fill,
      assetId: layer.asset?.assetId,
      assetSource: layer.asset?.source,
      visualTruthClass: layer.asset?.visualTruthClass,
    });
  } else if (layer.type === "shape") {
    Object.assign(base, {
      shape: layer.shape,
      fill: layer.fill,
      stroke: layer.stroke,
      strokeWidth: layer.strokeWidth,
      cornerRadius: layer.cornerRadius,
    });
  } else if (layer.type === "group") {
    base.childIds = layer.childIds;
  } else if (layer.type === "mask") {
    base.targetLayerId = layer.targetLayerId;
    base.maskAssetId = layer.asset?.assetId;
  }
  return base;
}

function changedFields(a: DesignLayer, b: DesignLayer): string[] {
  const left = stableLayerShape(a);
  const right = stableLayerShape(b);
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
}

export class DesignVersionService {
  readonly rootDir: string;
  readonly store: FileDesignProjectStore;

  constructor(rootDir = ".atthas-os") {
    this.rootDir = resolve(rootDir);
    this.store = new FileDesignProjectStore(this.rootDir);
  }

  async readVersion(designIdInput: string, versionInput: number): Promise<DesignDocument> {
    const designId = safeId(designIdInput);
    const version = positiveVersion(versionInput, "version");
    const path = join(this.rootDir, "designs", designId, "versions", `${version}.json`);
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`DESIGN_VERSION_NOT_FOUND: ${designId} v${version}.`);
      }
      throw error;
    }
    return assertDesignDocument(JSON.parse(raw) as DesignDocument);
  }

  async compare(designId: string, fromVersion: number, toVersion: number): Promise<DesignVersionComparison> {
    const [from, to] = await Promise.all([
      this.readVersion(designId, fromVersion),
      this.readVersion(designId, toVersion),
    ]);
    const fromLayers = new Map(from.layers.map((layer) => [layer.id, layer]));
    const toLayers = new Map(to.layers.map((layer) => [layer.id, layer]));
    const ids = new Set([...fromLayers.keys(), ...toLayers.keys()]);
    const layerChanges: LayerVersionChange[] = [];
    for (const layerId of ids) {
      const before = fromLayers.get(layerId);
      const after = toLayers.get(layerId);
      if (!before && after) {
        layerChanges.push({ layerId, kind: "added", fields: Object.keys(stableLayerShape(after)) });
        continue;
      }
      if (before && !after) {
        layerChanges.push({ layerId, kind: "removed", fields: Object.keys(stableLayerShape(before)) });
        continue;
      }
      if (before && after) {
        const fields = changedFields(before, after);
        if (fields.length) layerChanges.push({ layerId, kind: "changed", fields });
      }
    }
    return {
      designId: safeId(designId),
      fromVersion: positiveVersion(fromVersion, "fromVersion"),
      toVersion: positiveVersion(toVersion, "toVersion"),
      artboardChanged: JSON.stringify(from.artboard) !== JSON.stringify(to.artboard),
      layoutChanged: from.layoutId !== to.layoutId,
      layerChanges,
    };
  }

  async restore(designId: string, sourceVersion: number, restoredAt?: string): Promise<DesignProjectSnapshot> {
    const [project, source] = await Promise.all([
      this.store.get(designId),
      this.readVersion(designId, sourceVersion),
    ]);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const at = restoredAt ?? new Date().toISOString();
    const nextVersion = project.state.currentVersion + 1;
    const restored = assertDesignDocument({
      ...source,
      id: project.document.id,
      campaignId: project.document.campaignId,
      truthSnapshotId: project.document.truthSnapshotId,
      version: nextVersion,
      history: [
        ...project.document.history,
        {
          version: nextVersion,
          createdAt: at,
          actor: "human",
          summary: `Restored design content from v${sourceVersion}.`,
        },
      ],
      createdAt: project.document.createdAt,
      updatedAt: at,
    });
    return this.store.save(restored);
  }
}
