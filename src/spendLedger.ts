import type { CampaignSpendEntry } from "./operations/types.js";

export interface CampaignBudgetPolicy {
  campaignCapUsd: number;
  imageCapUsd?: number;
  videoCapUsd?: number;
  premiumSingleActionApprovalUsd?: number;
}

export interface SpendDecision {
  allowed: boolean;
  campaignTotalBeforeUsd: number;
  campaignTotalAfterUsd: number;
  categoryTotalAfterUsd: number;
  requiresExplicitApproval: boolean;
  reasons: string[];
}

function money(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function assertPolicy(policy: CampaignBudgetPolicy): void {
  for (const [key, value] of Object.entries(policy)) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new Error(`Invalid budget policy ${key}.`);
    }
  }
}

export function campaignSpendTotal(entries: CampaignSpendEntry[]): number {
  return money(entries.reduce((sum, entry) => sum + entry.amountUsd, 0));
}

export function evaluateCampaignSpend(
  entries: CampaignSpendEntry[],
  next: Pick<CampaignSpendEntry, "category" | "amountUsd">,
  policy: CampaignBudgetPolicy,
): SpendDecision {
  assertPolicy(policy);
  if (!Number.isFinite(next.amountUsd) || next.amountUsd < 0) {
    throw new Error("Proposed campaign spend must be a finite non-negative number.");
  }

  const before = campaignSpendTotal(entries);
  const after = money(before + next.amountUsd);
  const categoryAfter = money(
    entries
      .filter((entry) => entry.category === next.category)
      .reduce((sum, entry) => sum + entry.amountUsd, next.amountUsd),
  );
  const reasons: string[] = [];

  if (after > policy.campaignCapUsd) {
    reasons.push(`Campaign cap exceeded: $${after} > $${policy.campaignCapUsd}.`);
  }
  if (next.category === "image" && policy.imageCapUsd !== undefined && categoryAfter > policy.imageCapUsd) {
    reasons.push(`Image cap exceeded: $${categoryAfter} > $${policy.imageCapUsd}.`);
  }
  if (next.category === "video" && policy.videoCapUsd !== undefined && categoryAfter > policy.videoCapUsd) {
    reasons.push(`Video cap exceeded: $${categoryAfter} > $${policy.videoCapUsd}.`);
  }

  const approvalThreshold = policy.premiumSingleActionApprovalUsd;
  const requiresExplicitApproval =
    approvalThreshold !== undefined && next.amountUsd >= approvalThreshold;

  return {
    allowed: reasons.length === 0,
    campaignTotalBeforeUsd: before,
    campaignTotalAfterUsd: after,
    categoryTotalAfterUsd: categoryAfter,
    requiresExplicitApproval,
    reasons,
  };
}

export function assertCampaignSpendAllowed(
  entries: CampaignSpendEntry[],
  next: Pick<CampaignSpendEntry, "category" | "amountUsd">,
  policy: CampaignBudgetPolicy,
  explicitApproval = false,
): SpendDecision {
  const decision = evaluateCampaignSpend(entries, next, policy);
  if (!decision.allowed) throw new Error(decision.reasons.join(" "));
  if (decision.requiresExplicitApproval && !explicitApproval) {
    throw new Error(
      `Spend of $${next.amountUsd} requires explicit approval under the campaign budget policy.`,
    );
  }
  return decision;
}
