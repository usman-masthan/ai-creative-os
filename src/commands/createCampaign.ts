import { evaluateCampaignReadiness } from "../orchestrator.js";
import { assertBrandBelongsToTenant } from "../tenantRegistry.js";
import { resolveTruth } from "../truthResolver.js";
import type {
  RiskLevel,
  TenantId,
  TruthRecord,
  TruthRequirement,
} from "../types.js";

export interface CreateCampaignRequest {
  campaignId: string;
  tenantId: TenantId;
  brandId: string;
  branchId?: string;
  objective: string;
  channel: string;
  assetType: string;
  requirements: TruthRequirement[];
  truthRecords: TruthRecord[];
  allowSourceVerified?: boolean;
  sensitiveStory?: boolean;
  expensiveVideo?: boolean;
}

export interface CampaignPreflight {
  status: "READY_FOR_CREATIVE" | "BLOCKED_MISSING_VERIFIED_DATA";
  factGate: "PASS" | "FAIL";
  missing: string[];
  conflicts: string[];
  facts: ReturnType<typeof resolveTruth>["facts"];
  riskLevel: RiskLevel;
  humanApprovalRequired: boolean;
}

export function createCampaignPreflight(
  request: CreateCampaignRequest,
): CampaignPreflight {
  assertBrandBelongsToTenant(request.tenantId, request.brandId);

  const resolution = resolveTruth({
    tenantId: request.tenantId,
    brandId: request.brandId,
    ...(request.branchId ? { branchId: request.branchId } : {}),
    requirements: request.requirements,
    records: request.truthRecords,
    ...(request.allowSourceVerified !== undefined
      ? { allowSourceVerified: request.allowSourceVerified }
      : {}),
  });

  const readiness = evaluateCampaignReadiness({
    campaignId: request.campaignId,
    tenantId: request.tenantId,
    brandId: request.brandId,
    objective: request.objective,
    channel: request.channel,
    assetType: request.assetType,
    requiredFactKeys: request.requirements.map((requirement) => requirement.key),
    facts: resolution.facts,
    ...(request.sensitiveStory !== undefined
      ? { sensitiveStory: request.sensitiveStory }
      : {}),
    ...(request.expensiveVideo !== undefined
      ? { expensiveVideo: request.expensiveVideo }
      : {}),
  });

  const ready = resolution.pass;

  return {
    status: ready ? "READY_FOR_CREATIVE" : "BLOCKED_MISSING_VERIFIED_DATA",
    factGate: ready ? "PASS" : "FAIL",
    missing: resolution.missing,
    conflicts: resolution.conflicts,
    facts: resolution.facts,
    riskLevel: readiness.riskLevel,
    humanApprovalRequired: readiness.humanApprovalRequired,
  };
}
