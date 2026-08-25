import { parseCreativeDirectorReview } from "./creativeDirectorValidator.js";
import type { CampaignGenerationProvider } from "./providers/types.js";

export interface CreativeDirectorEscalationDecision {
  escalate: boolean;
  reasons: string[];
  topScoreMargin?: number;
}

export function evaluateCreativeDirectorEscalation(rawReview: string): CreativeDirectorEscalationDecision {
  const review = parseCreativeDirectorReview(rawReview);
  const reasons: string[] = [];
  const totals = review.reviews.map((item) => item.totalScore).sort((a, b) => b - a);
  const topScoreMargin = totals.length >= 2 ? (totals[0] ?? 0) - (totals[1] ?? 0) : undefined;
  if (review.escalation.recommended) reasons.push(...review.escalation.reasons);
  if (topScoreMargin !== undefined && topScoreMargin <= 3) {
    reasons.push(`Top Creative Director concepts are close (${topScoreMargin}-point margin).`);
  }
  if (review.reviews.some((item) => item.scores.factualSafety < 8)) {
    reasons.push("At least one shortlisted concept has factual-safety score below 8.");
  }
  if (review.reviews.some((item) => item.risks.length > 0)) {
    reasons.push("Creative Director review contains explicit production risks.");
  }
  return {
    escalate: reasons.length > 0,
    reasons: [...new Set(reasons)],
    ...(topScoreMargin !== undefined ? { topScoreMargin } : {}),
  };
}

export class EscalatingCreativeDirectorProvider implements CampaignGenerationProvider {
  readonly providerName = "gemini-escalating-creative-director";
  readonly model: string;
  lastEscalation: CreativeDirectorEscalationDecision | undefined;
  lastProviderUsed: string | undefined;

  constructor(
    private readonly primary: CampaignGenerationProvider,
    private readonly advanced: CampaignGenerationProvider,
  ) {
    this.model = `${primary.model}->${advanced.model}`;
  }

  async generate(prompt: string): Promise<string> {
    const primaryOutput = await this.primary.generate(prompt);
    let decision: CreativeDirectorEscalationDecision;
    try {
      decision = evaluateCreativeDirectorEscalation(primaryOutput);
    } catch {
      this.lastProviderUsed = this.primary.model;
      return primaryOutput;
    }
    this.lastEscalation = decision;
    if (!decision.escalate) {
      this.lastProviderUsed = this.primary.model;
      return primaryOutput;
    }
    const advancedPrompt = [
      prompt,
      "",
      "ADVANCED CREATIVE DIRECTOR ESCALATION",
      `Primary review requires escalation because: ${decision.reasons.join("; ")}`,
      "Independently review the original three concepts again. Return the same required Creative Director JSON schema.",
      "Do not simply accept the primary review; choose the deterministic highest-scoring winner under the same scoring rules.",
      "Primary review for context:",
      primaryOutput,
    ].join("\n");
    const advancedOutput = await this.advanced.generate(advancedPrompt);
    this.lastProviderUsed = this.advanced.model;
    return advancedOutput;
  }
}
