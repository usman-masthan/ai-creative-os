export type TenantId = "T001" | "T002" | "T003";
export type RiskProfile = "commercial" | "humanitarian-strict";
export type RiskLevel = "low" | "medium" | "high";

export interface Brand {
  id: string;
  name: string;
}

export interface Tenant {
  id: TenantId;
  slug: string;
  name: string;
  type: "commercial" | "ngo";
  brands: Brand[];
  riskProfile: RiskProfile;
}

export interface VerifiedFact {
  key: string;
  value: unknown;
  verified: boolean;
  source?: string;
}

export interface CampaignContext {
  campaignId: string;
  tenantId: TenantId;
  brandId: string;
  objective: string;
  channel: string;
  assetType: string;
  requiredFactKeys: string[];
  facts: VerifiedFact[];
  sensitiveStory?: boolean;
  expensiveVideo?: boolean;
}

export interface FactGateResult {
  pass: boolean;
  missing: string[];
  unverified: string[];
}

export interface CampaignReadiness {
  factGate: FactGateResult;
  riskLevel: RiskLevel;
  humanApprovalRequired: boolean;
  canContinue: boolean;
}
