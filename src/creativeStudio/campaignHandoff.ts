import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { CreativeStudioGovernanceStore } from "./governanceStore.js";
import { FileDesignProjectStore } from "./projectStore.js";
import { FileCampaignStore } from "../operations/fileStore.js";
import { CampaignWorkflow } from "../operations/workflow.js";

function normalizedTruthBinding(value: string): string {
  return value.trim().replace(/^task:/i, "");
}

export interface ApprovedCampaignHandoffResult {
  campaignId: string;
  campaignState: string;
  designId: string;
  designVersion: number;
  assetId: string;
  revisionId: string;
  alreadyRegistered: boolean;
  path: string;
}

export async function handoffApprovedDesignToCampaign(input: {
  rootDir?: string;
  designId: string;
  registeredBy: string;
  preset?: "standard" | "high-resolution" | "4k";
  now?: string;
}): Promise<ApprovedCampaignHandoffResult> {
  const rootDir = resolve(input.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const governance = new CreativeStudioGovernanceStore(rootDir);
  const campaigns = new FileCampaignStore(rootDir);
  const workflow = new CampaignWorkflow(campaigns);

  const project = await projects.get(input.designId);
  if (!project) throw new Error(`Design project ${input.designId} does not exist.`);
  const snapshot = await campaigns.getSnapshot(project.document.campaignId);
  if (!snapshot) throw new Error(`Campaign ${project.document.campaignId} does not exist.`);
  if (normalizedTruthBinding(project.document.truthSnapshotId) !== normalizedTruthBinding(snapshot.campaign.truthVersion)) {
    throw new Error("CAMPAIGN_HANDOFF_BLOCK: design truth snapshot does not match campaign truth version.");
  }

  const [finalVisualQa, approval, exports] = await Promise.all([
    governance.getFinalVisualQa(project.document.id, project.document.version),
    governance.getApproval(project.document.id, project.document.version),
    governance.listApprovedExports(project.document.id),
  ]);
  if (!finalVisualQa || finalVisualQa.result.decision !== "PASS") {
    throw new Error("CAMPAIGN_HANDOFF_BLOCK: current design version lacks PASS final visual QA.");
  }
  if (!approval) {
    throw new Error("CAMPAIGN_HANDOFF_BLOCK: current design version lacks explicit approval.");
  }

  const eligibleExports = exports.filter((record) =>
    record.designVersion === project.document.version &&
    (!input.preset || record.preset === input.preset),
  );
  const selected = eligibleExports.at(-1);
  if (!selected) {
    throw new Error("CAMPAIGN_HANDOFF_BLOCK: create an approved PNG export for the current version first.");
  }

  const existing = snapshot.assets.find((asset) =>
    asset.metadata?.studioApprovedAsset === true &&
    asset.metadata?.designId === project.document.id &&
    asset.metadata?.designVersion === project.document.version &&
    asset.metadata?.preset === selected.preset,
  );
  if (existing) {
    const revision = snapshot.revisions.find((item) => item.assetIds.includes(existing.assetId));
    return {
      campaignId: snapshot.campaign.campaignId,
      campaignState: snapshot.campaign.state,
      designId: project.document.id,
      designVersion: project.document.version,
      assetId: existing.assetId,
      revisionId: revision?.revisionId ?? "existing-revision",
      alreadyRegistered: true,
      path: existing.path,
    };
  }

  const assetId = randomUUID();
  const nextRevision = snapshot.campaign.currentRevision + 1;
  const createdAt = input.now ?? new Date().toISOString();
  await workflow.addAsset({
    assetId,
    campaignId: snapshot.campaign.campaignId,
    revision: nextRevision,
    kind: "poster",
    path: selected.path,
    assetType: "poster",
    truthVersion: snapshot.campaign.truthVersion,
    brandVersion: snapshot.campaign.brandVersion,
    createdAt,
    metadata: {
      studioApprovedAsset: true,
      designId: project.document.id,
      designVersion: project.document.version,
      preset: selected.preset,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
      finalVisualQaDecision: finalVisualQa.result.decision,
      deterministicDecision: approval.deterministicDecision,
    },
  });
  const revision = await workflow.addRevision({
    campaignId: snapshot.campaign.campaignId,
    createdBy: input.registeredBy,
    summary: `Registered approved layered Studio design ${project.document.id} v${project.document.version} (${selected.preset}).`,
    assetIds: [assetId],
    finalArtQaDecision: "PASS",
    now: createdAt,
  });

  const campaign = await campaigns.getCampaign(snapshot.campaign.campaignId);
  if (!campaign) throw new Error(`Campaign ${snapshot.campaign.campaignId} disappeared during handoff.`);
  return {
    campaignId: campaign.campaignId,
    campaignState: campaign.state,
    designId: project.document.id,
    designVersion: project.document.version,
    assetId,
    revisionId: revision.revisionId,
    alreadyRegistered: false,
    path: selected.path,
  };
}
