import assert from "node:assert/strict";
import test from "node:test";

import {
  EscalatingCreativeDirectorProvider,
  evaluateCreativeDirectorEscalation,
} from "../src/creativeDirectorEscalation.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";

function review(margin = 1) {
  return JSON.stringify({
    reviews: [
      { conceptId: "C1", scores: { strategicFit: 9, brandFit: 9, originality: 8, emotionalStrength: 8, conversionPotential: 9, visualPotential: 9, factualSafety: 10, productionEfficiency: 9 }, strengths: [], weaknesses: [], risks: [] },
      { conceptId: "C2", scores: { strategicFit: 9, brandFit: 9, originality: 8, emotionalStrength: 8, conversionPotential: 9, visualPotential: 9, factualSafety: 10, productionEfficiency: 9 - margin }, strengths: [], weaknesses: [], risks: [] },
      { conceptId: "C3", scores: { strategicFit: 6, brandFit: 6, originality: 6, emotionalStrength: 6, conversionPotential: 6, visualPotential: 6, factualSafety: 10, productionEfficiency: 8 }, strengths: [], weaknesses: [], risks: [] },
    ],
    winnerConceptId: "C1",
    winnerRationale: "highest",
    improvementDirectives: [],
    escalation: { recommended: false, reasons: [] },
  });
}

function provider(model: string, output: string): CampaignGenerationProvider {
  return { providerName: "gemini", model, async generate() { return output; } };
}

test("close Creative Director scores trigger advanced escalation", () => {
  const decision = evaluateCreativeDirectorEscalation(review(1));
  assert.equal(decision.escalate, true);
  assert.ok((decision.topScoreMargin ?? 99) <= 3);
});

test("escalating provider uses advanced provider when policy triggers", async () => {
  const advanced = review(5);
  const routing = new EscalatingCreativeDirectorProvider(
    provider("gemini-3.6-flash", review(1)),
    provider("gemini-3.7-flash", advanced),
  );
  const output = await routing.generate("review concepts");
  assert.equal(output, advanced);
  assert.equal(routing.lastProviderUsed, "gemini-3.7-flash");
});
