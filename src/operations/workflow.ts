import { randomUUID } from "node:crypto";

import type { CampaignStore } from "./fileStore.js";
import type {
  AssetRecord,
  CampaignActorRole,
  CampaignLifecycleEvent,
  CampaignLifecycleState,
  CampaignPerformanceRecord,
  CampaignRecord,
  CampaignRevision,
  CampaignSpendEntry,
  PublicationRecord,
} from "./types.js";

const ALLOWED_TRANSITIONS: Record<CampaignLifecycleState, CampaignLifecycleState[]> = {
  DRAFT: ["INTERNAL_REVIEW", "ARCHIVED"],
  INTERNAL_REVIEW: ["CLIENT_REVIEW", "REVISION_REQUESTED", "ARCHIVED"],
  CLIENT_REVIEW: ["APPROVED", "REVISION_REQUESTED", "ARCHIVED"],
  REVISION_REQUESTED: ["DRAFT", "ARCHIVED"],
  APPROVED: ["PRODUCTION_READY", "REVISION_REQUESTED", "ARCHIVED"],
  PRODUCTION_READY: ["PUBLISHED", "REVISION_REQUESTED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

export interface CreateCampaignInput {
  campaignId: string;
  brandId: CampaignRecord["brandId"];
  branchId?: string;
  truthVersion: string;
  brandVersion: string;
  selectedConceptId?: string;
  now?: string;
}

export interface TransitionCampaignInput {
  campaignId: string;
  to: CampaignLifecycleState;
  actorId: string;
  actorRole: CampaignActorRole;
  note?: string;
  now?: string;
  productionEvidence?: {
    hasFinalAsset: boolean;
    visualQaPassed: boolean;
    finalArtQaPassed: boolean;
  };
}

function nowIso(value?: string): string {
  return value ?? new Date().toISOString();
}

function assertRoleCanTransition(
  from: CampaignLifecycleState,
  to: CampaignLifecycleState,
  role: CampaignActorRole,
): void {
  if (role === "admin" || role === "system") return;
  if (to === "APPROVED" && role !== "client") {
    throw new Error("Only a client or admin may approve a campaign.");
  }
  if (to === "PUBLISHED" && role !== "operator") {
    throw new Error("Only an operator, admin or system may mark a campaign published.");
  }
  if (from === "CLIENT_REVIEW" && to === "REVISION_REQUESTED" && role !== "client") {
    throw new Error("Client-review revisions must be requested by the client or admin.");
  }
}

function assertProductionEvidence(input: TransitionCampaignInput): void {
  if (input.to !== "PRODUCTION_READY") return;
  const evidence = input.productionEvidence;
  if (!evidence?.hasFinalAsset || !evidence.visualQaPassed || !evidence.finalArtQaPassed) {
    throw new Error(
      "PRODUCTION_READY requires a final asset plus passing visual QA and final-art QA.",
    );
  }
}

export class CampaignWorkflow {
  constructor(private readonly store: CampaignStore) {}

  async create(input: CreateCampaignInput): Promise<CampaignRecord> {
    const timestamp = nowIso(input.now);
    const record: CampaignRecord = {
      campaignId: input.campaignId,
      brandId: input.brandId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
      state: "DRAFT",
      truthVersion: input.truthVersion,
      brandVersion: input.brandVersion,
      ...(input.selectedConceptId ? { selectedConceptId: input.selectedConceptId } : {}),
      currentRevision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.store.createCampaign(record);
    return record;
  }

  async transition(input: TransitionCampaignInput): Promise<CampaignRecord> {
    const current = await this.store.getCampaign(input.campaignId);
    if (!current) throw new Error(`Campaign ${input.campaignId} does not exist.`);
    if (!ALLOWED_TRANSITIONS[current.state].includes(input.to)) {
      throw new Error(`Invalid campaign transition ${current.state} -> ${input.to}.`);
    }
    assertRoleCanTransition(current.state, input.to, input.actorRole);
    assertProductionEvidence(input);

    const timestamp = nowIso(input.now);
    const event: CampaignLifecycleEvent = {
      eventId: randomUUID(),
      campaignId: current.campaignId,
      from: current.state,
      to: input.to,
      actorId: input.actorId,
      actorRole: input.actorRole,
      createdAt: timestamp,
      ...(input.note ? { note: input.note } : {}),
    };
    const updated: CampaignRecord = {
      ...current,
      state: input.to,
      updatedAt: timestamp,
    };
    await this.store.appendEvent(event);
    await this.store.updateCampaign(updated);
    return updated;
  }

  async addRevision(input: {
    campaignId: string;
    createdBy: string;
    summary: string;
    reason?: string;
    assetIds?: string[];
    visualQaDecision?: string;
    finalArtQaDecision?: string;
    now?: string;
  }): Promise<CampaignRevision> {
    const current = await this.store.getCampaign(input.campaignId);
    if (!current) throw new Error(`Campaign ${input.campaignId} does not exist.`);
    const revisionNumber = current.currentRevision + 1;
    const revision: CampaignRevision = {
      revisionId: `${current.campaignId}-R${revisionNumber}`,
      campaignId: current.campaignId,
      revision: revisionNumber,
      createdAt: nowIso(input.now),
      createdBy: input.createdBy,
      summary: input.summary,
      ...(input.reason ? { reason: input.reason } : {}),
      assetIds: [...(input.assetIds ?? [])],
      ...(input.visualQaDecision ? { visualQaDecision: input.visualQaDecision } : {}),
      ...(input.finalArtQaDecision ? { finalArtQaDecision: input.finalArtQaDecision } : {}),
    };
    await this.store.appendRevision(revision);
    await this.store.updateCampaign({
      ...current,
      currentRevision: revisionNumber,
      updatedAt: revision.createdAt,
    });
    return revision;
  }

  async addAsset(asset: AssetRecord): Promise<void> {
    const campaign = await this.store.getCampaign(asset.campaignId);
    if (!campaign) throw new Error(`Campaign ${asset.campaignId} does not exist.`);
    if (asset.truthVersion !== campaign.truthVersion || asset.brandVersion !== campaign.brandVersion) {
      throw new Error("Asset truth/brand versions must match the campaign record.");
    }
    await this.store.appendAsset(asset);
  }

  async addSpend(entry: CampaignSpendEntry): Promise<void> {
    await this.store.appendSpend(entry);
  }

  async publish(record: PublicationRecord): Promise<void> {
    const campaign = await this.store.getCampaign(record.campaignId);
    if (!campaign) throw new Error(`Campaign ${record.campaignId} does not exist.`);
    if (campaign.state !== "PRODUCTION_READY" && campaign.state !== "PUBLISHED") {
      throw new Error("Publication records require PRODUCTION_READY or PUBLISHED campaign state.");
    }
    await this.store.appendPublication(record);
  }

  async recordPerformance(record: CampaignPerformanceRecord): Promise<void> {
    await this.store.appendPerformance(record);
  }
}

export function allowedCampaignTransitions(state: CampaignLifecycleState): CampaignLifecycleState[] {
  return [...ALLOWED_TRANSITIONS[state]];
}
