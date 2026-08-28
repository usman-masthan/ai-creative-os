import type { DesignAssetRef, DesignDocument, DesignLayer } from "./types.js";

export interface DesignDocumentValidationResult {
  valid: boolean;
  issues: string[];
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validateAsset(layerId: string, asset: DesignAssetRef, issues: string[]): void {
  if (!asset.assetId.trim()) issues.push(`Layer ${layerId} has an empty assetId.`);
  if (asset.source === "generated" && asset.visualTruthClass === "VERIFIED_PRODUCT_VISUAL") {
    issues.push(`Layer ${layerId} cannot classify a generated asset as VERIFIED_PRODUCT_VISUAL.`);
  }
}

function validateLayerGeometry(layer: DesignLayer, document: DesignDocument, issues: string[]): void {
  if (!layer.id.trim()) issues.push("Every layer requires a non-empty id.");
  if (!layer.name.trim()) issues.push(`Layer ${layer.id || "<unknown>"} requires a name.`);
  for (const [key, value] of Object.entries({
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
    opacity: layer.opacity,
    zIndex: layer.zIndex,
  })) {
    if (!finite(value)) issues.push(`Layer ${layer.id} has non-finite ${key}.`);
  }
  if (layer.width < 0 || layer.height < 0) issues.push(`Layer ${layer.id} has negative dimensions.`);
  if (layer.opacity < 0 || layer.opacity > 1) issues.push(`Layer ${layer.id} opacity must be between 0 and 1.`);
  if (layer.x + layer.width < 0 || layer.y + layer.height < 0) {
    issues.push(`Layer ${layer.id} is completely outside the artboard.`);
  }
  if (layer.x > document.artboard.width || layer.y > document.artboard.height) {
    issues.push(`Layer ${layer.id} starts outside the artboard.`);
  }
}

export function validateDesignDocument(document: DesignDocument): DesignDocumentValidationResult {
  const issues: string[] = [];
  if (document.schemaVersion !== 1) issues.push("DesignDocument.schemaVersion must be 1.");
  if (!document.id.trim()) issues.push("DesignDocument.id is required.");
  if (!document.campaignId.trim()) issues.push("DesignDocument.campaignId is required.");
  if (!document.truthSnapshotId.trim()) issues.push("DesignDocument.truthSnapshotId is required.");
  if (!document.brand.clientId.trim() || !document.brand.brandId.trim() || !document.brand.brandKitId.trim()) {
    issues.push("DesignDocument brand clientId, brandId and brandKitId are required.");
  }
  if (!Number.isInteger(document.version) || document.version < 1) issues.push("DesignDocument.version must be a positive integer.");
  if (!Number.isInteger(document.artboard.width) || document.artboard.width < 64) issues.push("DesignDocument.artboard.width must be at least 64.");
  if (!Number.isInteger(document.artboard.height) || document.artboard.height < 64) issues.push("DesignDocument.artboard.height must be at least 64.");

  const ids = new Set<string>();
  for (const layer of document.layers) {
    if (ids.has(layer.id)) issues.push(`Duplicate layer id: ${layer.id}.`);
    ids.add(layer.id);
    validateLayerGeometry(layer, document, issues);
    if (layer.type === "text") {
      if (!layer.text.trim()) issues.push(`Text layer ${layer.id} cannot be blank.`);
      if (!layer.fontFamily.trim()) issues.push(`Text layer ${layer.id} requires a font family.`);
      if (layer.fontSize <= 0 || layer.lineHeight <= 0) issues.push(`Text layer ${layer.id} has invalid typography metrics.`);
    } else if (layer.type === "image") {
      validateAsset(layer.id, layer.asset, issues);
    } else if (layer.type === "background" && layer.asset) {
      validateAsset(layer.id, layer.asset, issues);
    } else if (layer.type === "logo") {
      validateAsset(layer.id, layer.asset, issues);
      if (layer.asset.source !== "approved-brand") issues.push(`Logo layer ${layer.id} must use an approved-brand asset.`);
      if (!layer.locked) issues.push(`Logo layer ${layer.id} must be locked by default.`);
      if (!layer.preserveAspectRatio) issues.push(`Logo layer ${layer.id} must preserve aspect ratio.`);
    }
  }

  for (const layer of document.layers) {
    if (layer.type === "group") {
      for (const childId of layer.childLayerIds) if (!ids.has(childId)) issues.push(`Group ${layer.id} references missing layer ${childId}.`);
    }
    if (layer.type === "mask") {
      for (const targetId of layer.targetLayerIds) if (!ids.has(targetId)) issues.push(`Mask ${layer.id} references missing layer ${targetId}.`);
    }
  }

  return { valid: issues.length === 0, issues };
}

export function assertDesignDocument(document: DesignDocument): DesignDocument {
  const result = validateDesignDocument(document);
  if (!result.valid) throw new Error(`DESIGN_DOCUMENT_INVALID: ${result.issues.join(" ")}`);
  return document;
}
