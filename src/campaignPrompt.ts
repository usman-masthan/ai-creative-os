import type { CampaignPreflight, CreateCampaignRequest } from "./commands/createCampaign.js";

export interface CampaignPromptInput {
  request: CreateCampaignRequest;
  preflight: CampaignPreflight;
  brandContext: string;
}

function serializeVerifiedFacts(preflight: CampaignPreflight): string {
  return preflight.facts
    .map((fact) => {
      const value = JSON.stringify(fact.value);
      return `- ${fact.key} = ${value} [${fact.status ?? "VERIFIED"}; source=${fact.source ?? "internal"}]`;
    })
    .join("\n");
}

export function buildCampaignGenerationPrompt(input: CampaignPromptInput): string {
  const { request, preflight, brandContext } = input;
  const verifiedFacts = serializeVerifiedFacts(preflight);

  return `You are the campaign-generation stage of AI Creative OS.

NON-NEGOTIABLE RULES:
1. Use ONLY the verified facts supplied below for customer-facing factual claims.
2. Never invent or alter prices, offers, dates, branch details, product details, availability, contact details, statistics, or claims.
3. Do not upgrade source-specific facts into universal brand facts.
4. Brand context may guide tone and visuals but proposed/rebrand elements must not be described as officially approved unless the context explicitly says they are approved.
5. Generate exactly 3 meaningfully different concepts, then recommend exactly 1.
6. Important factual text such as prices should be treated as deterministic overlay text, not embedded into generated food imagery.
7. Return JSON only. Do not use Markdown fences or commentary outside the JSON object.

CAMPAIGN REQUEST:
- Campaign ID: ${request.campaignId}
- Tenant: ${request.tenantId}
- Brand: ${request.brandId}
- Branch: ${request.branchId ?? "not specified"}
- Objective: ${request.objective}
- Channel: ${request.channel}
- Asset type: ${request.assetType}
- Risk level: ${preflight.riskLevel}
- Human approval required: ${preflight.humanApprovalRequired ? "YES" : "NO"}

BRAND CONTEXT:
${brandContext}

VERIFIED FACTS AVAILABLE TO THIS GENERATION:
${verifiedFacts || "- No customer-facing factual claims supplied."}

OUTPUT CONTRACT:
{
  "concepts": [
    {
      "id": "C1",
      "campaignName": "string",
      "coreIdea": "string",
      "customerEmotion": "string",
      "headlineDirection": "string",
      "visualConcept": "string",
      "cta": "string",
      "targetAudience": "string",
      "expectedStrength": 1,
      "risks": ["string"]
    },
    { "id": "C2", "campaignName": "...", "coreIdea": "...", "customerEmotion": "...", "headlineDirection": "...", "visualConcept": "...", "cta": "...", "targetAudience": "...", "expectedStrength": 1, "risks": [] },
    { "id": "C3", "campaignName": "...", "coreIdea": "...", "customerEmotion": "...", "headlineDirection": "...", "visualConcept": "...", "cta": "...", "targetAudience": "...", "expectedStrength": 1, "risks": [] }
  ],
  "recommendedConceptId": "C1",
  "recommendationReason": "string",
  "creativeBrief": {
    "headline": "string",
    "supportingCopy": "string",
    "cta": "string",
    "visualDirection": "string",
    "composition": "string",
    "lighting": "string",
    "photographyStyle": "string",
    "aspectRatio": "string"
  },
  "caption": "string",
  "imagePrompt": {
    "immutable": ["verified identity/fact constraints only"],
    "flexible": ["environment, lighting, angle, atmosphere, composition, styling"],
    "prompt": "string"
  },
  "factualQaNotes": ["string"]
}

expectedStrength must be an integer from 1 to 10. The recommendation must refer to one of C1, C2, or C3.`;
}
