export type DesignLayerType =
  | "text"
  | "image"
  | "logo"
  | "shape"
  | "background"
  | "group"
  | "mask";

export type DesignAssetSource =
  | "approved-brand"
  | "verified-product"
  | "generated"
  | "uploaded"
  | "runtime";

export type VisualTruthClass =
  | "VERIFIED_PRODUCT_VISUAL"
  | "CONSTRAINED_PRODUCT_GENERATION"
  | "GENERIC_CONCEPT_VISUAL";

export interface DesignAssetGenerationMetadata {
  provider?: string;
  model?: string;
  promptVersion?: string;
  promptHash?: string;
}

export interface DesignAssetRef {
  assetId: string;
  source: DesignAssetSource;
  uri?: string;
  mimeType?: string;
  visualTruthClass?: VisualTruthClass;
  generation?: DesignAssetGenerationMetadata;
}

export interface LayerShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface DesignLayerBase {
  id: string;
  name: string;
  type: DesignLayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  aiEditable: boolean;
}

export interface DesignTextLayer extends DesignLayerBase {
  type: "text";
  text: string;
  role: "headline" | "supporting" | "cta" | "price" | "body" | "disclaimer" | "brand-identifier";
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  align: "left" | "center" | "right";
  fill: string;
  stroke?: string;
  shadow?: LayerShadow;
}

export interface DesignImageLayer extends DesignLayerBase {
  type: "image";
  asset: DesignAssetRef;
  fit: "cover" | "contain" | "fill";
  crop?: { x: number; y: number; width: number; height: number };
}

export interface DesignBackgroundLayer extends DesignLayerBase {
  type: "background";
  fill?: string;
  asset?: DesignAssetRef;
  fit?: "cover" | "contain" | "fill";
}

export interface DesignLogoLayer extends DesignLayerBase {
  type: "logo";
  asset: DesignAssetRef;
  preserveAspectRatio: true;
  clearSpacePx: number;
}

export interface DesignShapeLayer extends DesignLayerBase {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface DesignGroupLayer extends DesignLayerBase {
  type: "group";
  childLayerIds: string[];
}

export interface DesignMaskLayer extends DesignLayerBase {
  type: "mask";
  targetLayerIds: string[];
  shape: "rect" | "ellipse";
}

export type DesignLayer =
  | DesignTextLayer
  | DesignImageLayer
  | DesignBackgroundLayer
  | DesignLogoLayer
  | DesignShapeLayer
  | DesignGroupLayer
  | DesignMaskLayer;

export interface DesignArtboard {
  width: number;
  height: number;
  background: string;
}

export interface DesignBrandContext {
  clientId: string;
  brandId: string;
  brandKitId: string;
}

export interface DesignHistoryEntry {
  version: number;
  createdAt: string;
  summary: string;
  actor: "system" | "human" | "ai";
}

export interface DesignDocument {
  schemaVersion: 1;
  id: string;
  version: number;
  campaignId: string;
  creativeBriefId?: string;
  truthSnapshotId: string;
  artboard: DesignArtboard;
  brand: DesignBrandContext;
  layoutId: string;
  layers: DesignLayer[];
  history: DesignHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}
