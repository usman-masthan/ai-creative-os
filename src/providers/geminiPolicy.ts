import type { GeminiImageRole, GeminiTextRole, GeminiVideoRole } from "./geminiModels.js";

export interface GeminiTextTaskContext {
  creativeDirection?: boolean;
  advancedReasoning?: boolean;
  sensitive?: boolean;
  majorCampaign?: boolean;
  highReputationRisk?: boolean;
}

export function selectGeminiTextRole(context: GeminiTextTaskContext = {}): GeminiTextRole {
  if (context.sensitive || context.majorCampaign || context.highReputationRisk) {
    return "review";
  }
  if (context.advancedReasoning) return "advanced";
  if (context.creativeDirection) return "creative";
  return "default";
}

export interface PaidMediaGuardContext {
  conceptApproved?: boolean;
  staticDirectionApproved?: boolean;
  allowPremium?: boolean;
}

export function assertImageEscalationAllowed(
  role: GeminiImageRole,
  context: PaidMediaGuardContext = {},
): void {
  if (role === "premium" && !context.allowPremium) {
    throw new Error(
      "Premium image generation requires allowPremium=true after a lower-cost draft/production path has been considered.",
    );
  }
  if (role !== "draft" && !context.conceptApproved) {
    throw new Error(
      `${role} image generation requires conceptApproved=true to avoid paid production before creative direction is selected.`,
    );
  }
}

export function assertVideoEscalationAllowed(
  role: GeminiVideoRole,
  context: PaidMediaGuardContext = {},
): void {
  if (!context.staticDirectionApproved) {
    throw new Error(
      "Video generation requires staticDirectionApproved=true. Approve the static direction before spending on Veo.",
    );
  }
  if (role === "premium" && !context.allowPremium) {
    throw new Error(
      "Premium Veo generation requires allowPremium=true after Lite/Fast output has been considered.",
    );
  }
}
