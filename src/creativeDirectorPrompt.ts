import type { CampaignCreativeOutput, CampaignProductionFormat } from "./creativeTypes.js";
import type { CampaignPreflight } from "./commands/createCampaign.js";
import type { GenerateCampaignRequest } from "./commands/generateCampaign.js";
import type { CreativeDirectorReview } from "./creativeDirectorTypes.js";

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildCreativeDirectorPrompt(input: {
  request: GenerateCampaignRequest;
  preflight: CampaignPreflight;
  format: CampaignProductionFormat;
  creative: CampaignCreativeOutput;
}): string {
  const { request, preflight, format, creative } = input;
  return `You are the senior Creative Director for ATTHA'S Creative OS.

Your job is to critique exactly three already-generated campaign concepts and select the strongest one without inventing facts.

CAMPAIGN
- Brand: ${request.brandId}
- Branch: ${request.branchId ?? "brand-wide"}
- Objective: ${request.objective}
- Channel: ${request.channel}
- Asset type: ${request.assetType}
- Format: ${format.aspectRatio} ${format.width}x${format.height}

BRAND CONTEXT
${request.brandContext}

VERIFIED FACTS AVAILABLE
${json(preflight.facts)}

CONCEPTS TO REVIEW
${json(creative.concepts)}

SCORING
Score every concept from 1-10 on all eight dimensions:
- strategicFit
- brandFit
- originality
- emotionalStrength
- conversionPotential
- visualPotential
- factualSafety
- productionEfficiency

RULES
- Do not introduce new prices, ingredients, offers, availability, awards, superlatives or product attributes.
- A concept that depends on an unverified fact must score poorly on factualSafety.
- Judge Burger work as bold, energetic and crave-led; judge Restaurant work as warm, considered and hospitality-led.
- The winnerConceptId MUST be one of the concepts with the highest sum of the eight scores.
- Give practical improvementDirectives for the selected winner only.
- escalation.recommended should be true when concepts are close, factual safety is weak, production is unusually risky, or deeper review would materially help.

Return ONLY JSON in exactly this shape:
{
  "reviews": [
    {
      "conceptId": "C1",
      "scores": {
        "strategicFit": 1,
        "brandFit": 1,
        "originality": 1,
        "emotionalStrength": 1,
        "conversionPotential": 1,
        "visualPotential": 1,
        "factualSafety": 1,
        "productionEfficiency": 1
      },
      "strengths": [],
      "weaknesses": [],
      "risks": []
    },
    { "conceptId": "C2", "scores": { "strategicFit": 1, "brandFit": 1, "originality": 1, "emotionalStrength": 1, "conversionPotential": 1, "visualPotential": 1, "factualSafety": 1, "productionEfficiency": 1 }, "strengths": [], "weaknesses": [], "risks": [] },
    { "conceptId": "C3", "scores": { "strategicFit": 1, "brandFit": 1, "originality": 1, "emotionalStrength": 1, "conversionPotential": 1, "visualPotential": 1, "factualSafety": 1, "productionEfficiency": 1 }, "strengths": [], "weaknesses": [], "risks": [] }
  ],
  "winnerConceptId": "C1",
  "winnerRationale": "...",
  "improvementDirectives": ["..."],
  "escalation": {
    "recommended": false,
    "reasons": []
  }
}`;
}

export function buildDirectedCreativePrompt(input: {
  request: GenerateCampaignRequest;
  preflight: CampaignPreflight;
  format: CampaignProductionFormat;
  originalCreative: CampaignCreativeOutput;
  review: CreativeDirectorReview;
}): string {
  const { request, preflight, format, originalCreative, review } = input;
  return `You are the production copy and art-direction finalizer for ATTHA'S Creative OS.

A senior Creative Director has reviewed three concepts and selected ${review.winnerConceptId}. Refine the final campaign around that winner while preserving verified truth and deterministic overlay rules.

CAMPAIGN
- Brand: ${request.brandId}
- Branch: ${request.branchId ?? "brand-wide"}
- Objective: ${request.objective}
- Channel: ${request.channel}
- Asset type: ${request.assetType}
- Required aspect ratio: ${format.aspectRatio}

BRAND CONTEXT
${request.brandContext}

VERIFIED FACTS
${json(preflight.facts)}

ORIGINAL CREATIVE OUTPUT
${json(originalCreative)}

CREATIVE DIRECTOR REVIEW
${json(review)}

FINALIZATION RULES
1. Copy the original concepts array EXACTLY. Do not rewrite C1/C2/C3.
2. Set recommendedConceptId exactly to ${review.winnerConceptId}.
3. Improve recommendationReason, creativeBrief, caption, imageGeneration and overlaySpec according to the improvementDirectives.
4. Never invent facts. Use only verified facts shown above.
5. Prices must never appear in imageGeneration.basePrompt. Prices belong only in overlaySpec.price.
6. imageGeneration.textPolicy must remain NO_TEXT_OR_LOGOS.
7. Do not ask the image model to generate logos, text, badges, prices or watermarks.
8. creativeBrief.aspectRatio must be exactly ${format.aspectRatio}.
9. If a deterministic price exists in the original overlaySpec, preserve it exactly.
10. Preserve logoUsage policy; do not promote pending logo artwork.

Return ONLY a complete CampaignCreativeOutput JSON object in the same schema as ORIGINAL CREATIVE OUTPUT.`;
}
