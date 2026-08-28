import type { CampaignCreativeOutput, CampaignProductionFormat } from "../creativeTypes.js";
import type { AtthasBrandId, AtthasLayoutDefinition } from "../layouts/atthas.js";
import type { DesignAssetRef, DesignDocument } from "../designDocument/types.js";
import { assembleDesignDocument } from "../creativeStudio/designDocumentAssembler.js";
import type { DesignCopyZone } from "../layoutEngine/resolver.js";

export interface GenerateCreativeDesignRequest {
  designId: string;
  campaignId: string;
  creativeBriefId?: string;
  truthSnapshotId: string;
  clientId: string;
  brandId: AtthasBrandId;
  brandKitId: string;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  layout: AtthasLayoutDefinition;
  backgroundAsset: DesignAssetRef;
  subjectAsset?: DesignAssetRef;
  logoAsset?: DesignAssetRef;
  copyZone?: DesignCopyZone;
  createdAt?: string;
}

/**
 * Bridge command between the existing governed creative pipeline and the new
 * editor-neutral layered document. This intentionally performs no model calls.
 */
export function generateCreativeDesign(request: GenerateCreativeDesignRequest): DesignDocument {
  return assembleDesignDocument({
    id: request.designId,
    campaignId: request.campaignId,
    ...(request.creativeBriefId ? { creativeBriefId: request.creativeBriefId } : {}),
    truthSnapshotId: request.truthSnapshotId,
    clientId: request.clientId,
    brandId: request.brandId,
    brandKitId: request.brandKitId,
    creative: request.creative,
    format: request.format,
    layout: request.layout,
    backgroundAsset: request.backgroundAsset,
    ...(request.subjectAsset ? { subjectAsset: request.subjectAsset } : {}),
    ...(request.logoAsset ? { logoAsset: request.logoAsset } : {}),
    ...(request.copyZone ? { copyZone: request.copyZone } : {}),
    ...(request.createdAt ? { createdAt: request.createdAt } : {}),
  });
}
