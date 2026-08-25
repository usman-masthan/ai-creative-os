export type CampaignLifecycleState =
  | "DRAFT"
  | "INTERNAL_REVIEW"
  | "CLIENT_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "PRODUCTION_READY"
  | "PUBLISHED"
  | "ARCHIVED";

export type CampaignActorRole = "operator" | "internal_reviewer" | "client" | "admin" | "system";

export interface CampaignRecord {
  campaignId: string;
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  branchId?: string;
  state: CampaignLifecycleState;
  truthVersion: string;
  brandVersion: string;
  selectedConceptId?: string;
  currentRevision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRevision {
  revisionId: string;
  campaignId: string;
  revision: number;
  createdAt: string;
  createdBy: string;
  summary: string;
  reason?: string;
  assetIds: string[];
  visualQaDecision?: string;
  finalArtQaDecision?: string;
}

export interface CampaignLifecycleEvent {
  eventId: string;
  campaignId: string;
  from: CampaignLifecycleState;
  to: CampaignLifecycleState;
  actorId: string;
  actorRole: CampaignActorRole;
  createdAt: string;
  note?: string;
}

export interface AssetRecord {
  assetId: string;
  campaignId: string;
  revision: number;
  kind: "source_image" | "draft" | "poster" | "adaptation" | "video" | "audio" | "other";
  path: string;
  channel?: string;
  assetType?: string;
  truthVersion: string;
  brandVersion: string;
  createdAt: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
}

export interface CampaignSpendEntry {
  spendId: string;
  campaignId: string;
  createdAt: string;
  category: "text" | "image" | "visual_qa" | "final_art_qa" | "audio" | "video" | "other";
  provider: string;
  model: string;
  amountUsd: number;
  description?: string;
}

export interface PublicationRecord {
  publicationId: string;
  campaignId: string;
  assetId: string;
  channel: string;
  publishedAt: string;
  publishedBy: string;
  url?: string;
  caption?: string;
}

export interface CampaignPerformanceRecord {
  performanceId: string;
  campaignId: string;
  publicationId?: string;
  observedAt: string;
  metrics: {
    reach?: number;
    impressions?: number;
    engagement?: number;
    clicks?: number;
    orders?: number;
    saves?: number;
    shares?: number;
    ctr?: number;
    conversionRate?: number;
  };
  notes?: string;
}

export interface CampaignSnapshot {
  campaign: CampaignRecord;
  revisions: CampaignRevision[];
  events: CampaignLifecycleEvent[];
  assets: AssetRecord[];
  spend: CampaignSpendEntry[];
  publications: PublicationRecord[];
  performance: CampaignPerformanceRecord[];
}
