import type {
  TruthRecord,
  TruthRequirement,
  TruthStatus,
  VerifiedFact,
} from "./types.js";

const precedence: Record<TruthStatus, number> = {
  VERIFIED: 5,
  OWNER_SOURCE_CONFIRMED: 4,
  SOURCE_VERIFIED: 3,
  CONFLICT_REQUIRES_CONFIRMATION: 0,
  MISSING: 0,
};

export interface ResolveTruthInput {
  tenantId: TruthRecord["scope"]["tenantId"];
  brandId: string;
  branchId?: string;
  requirements: TruthRequirement[];
  records: TruthRecord[];
  allowSourceVerified?: boolean;
}

export interface TruthResolution {
  pass: boolean;
  facts: VerifiedFact[];
  missing: string[];
  conflicts: string[];
}

function scopeMatches(
  record: TruthRecord,
  input: ResolveTruthInput,
  requirement: TruthRequirement,
): boolean {
  if (record.scope.tenantId !== input.tenantId) return false;
  if (record.scope.brandId && record.scope.brandId !== input.brandId) return false;

  const targetBranchId = requirement.branchId ?? input.branchId;
  if (requirement.branchId) {
    // An explicitly branch-scoped requirement must be satisfied by that exact
    // branch. This prevents a price/availability record from another branch
    // silently satisfying the task.
    if (record.scope.branchId !== requirement.branchId) return false;
  } else if (targetBranchId) {
    if (record.scope.branchId && record.scope.branchId !== targetBranchId) return false;
  } else if (record.scope.branchId) {
    // A brand-wide task cannot silently consume an arbitrary branch record.
    return false;
  }

  if (requirement.productId && record.scope.productId !== requirement.productId) return false;
  if (requirement.salesChannel && record.scope.salesChannel !== requirement.salesChannel) return false;
  return record.key === requirement.key;
}

function publishable(record: TruthRecord, allowSourceVerified: boolean): boolean {
  if (record.status === "VERIFIED" || record.status === "OWNER_SOURCE_CONFIRMED") {
    return true;
  }
  return allowSourceVerified && record.status === "SOURCE_VERIFIED";
}

export function truthRequirementLabel(requirement: TruthRequirement): string {
  const parts = [requirement.key];
  if (requirement.branchId) parts.push(`branch=${requirement.branchId}`);
  if (requirement.productId) parts.push(`product=${requirement.productId}`);
  if (requirement.salesChannel) parts.push(`salesChannel=${requirement.salesChannel}`);
  return parts.join("|");
}

export function resolveTruth(input: ResolveTruthInput): TruthResolution {
  const facts: VerifiedFact[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const allowSourceVerified = input.allowSourceVerified === true;

  for (const requirement of input.requirements) {
    const label = truthRequirementLabel(requirement);
    const candidates = input.records.filter((record) =>
      scopeMatches(record, input, requirement),
    );

    if (candidates.some((record) => record.status === "CONFLICT_REQUIRES_CONFIRMATION")) {
      conflicts.push(label);
      continue;
    }

    const usable = candidates
      .filter((record) => publishable(record, allowSourceVerified))
      .sort((a, b) => precedence[b.status] - precedence[a.status]);

    const selected = usable[0];
    if (!selected) {
      missing.push(label);
      continue;
    }

    facts.push({
      key: label,
      value: selected.value,
      verified: true,
      ...(selected.sourceId ? { source: selected.sourceId } : {}),
      status: selected.status,
    });
  }

  return {
    pass: missing.length === 0 && conflicts.length === 0,
    facts,
    missing,
    conflicts,
  };
}
