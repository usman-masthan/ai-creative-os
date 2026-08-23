import { evaluateFactGate } from "./factGate.js";
import { assertBrandBelongsToTenant, getTenant } from "./tenantRegistry.js";
import type {
  CampaignContext,
  CampaignReadiness,
  RiskLevel,
} from "./types.js";

function determineRiskLevel(context: CampaignContext): RiskLevel {
  const tenant = getTenant(context.tenantId);

  if (tenant.riskProfile === "humanitarian-strict" && context.sensitiveStory) {
    return "high";
  }

  if (context.expensiveVideo) {
    return "high";
  }

  if (tenant.riskProfile === "humanitarian-strict") {
    return "medium";
  }

  return "low";
}

export function evaluateCampaignReadiness(
  context: CampaignContext,
): CampaignReadiness {
  assertBrandBelongsToTenant(context.tenantId, context.brandId);

  const factGate = evaluateFactGate(
    context.requiredFactKeys,
    context.facts,
  );

  const riskLevel = determineRiskLevel(context);
  const humanApprovalRequired =
    riskLevel === "high" ||
    context.sensitiveStory === true ||
    context.expensiveVideo === true;

  return {
    factGate,
    riskLevel,
    humanApprovalRequired,
    canContinue: factGate.pass,
  };
}
