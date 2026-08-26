import type { BrandGovernance } from "./brandGovernance.js";
import type { CampaignPreflight, CreateCampaignRequest } from "./commands/createCampaign.js";
import type { CampaignProductionFormat } from "./creativeTypes.js";

export interface CampaignPromptInput {
  request: CreateCampaignRequest;
  preflight: CampaignPreflight;
  brandContext: string;
  productionFormat: CampaignProductionFormat;
  brandGovernance?: BrandGovernance;
}

function serializeVerifiedFacts(preflight: CampaignPreflight): string {
  return preflight.facts
    .map((fact) => {
      const value = JSON.stringify(fact.value);
      return `- ${fact.key} = ${value} [${fact.status ?? "VERIFIED"}; source=${fact.source ?? "internal"}]`;
    })
    .join("\n");
}

function serializeBrandGovernance(governance?: BrandGovernance): string {
  if (!governance) {
    return "- No explicit brand-governance object supplied. Treat anything described as proposed, working, legacy, or unapproved in BRAND CONTEXT as internal guidance only.";
  }

  const lines = [
    `- Proposed identity allowed in production output: ${governance.allowProposedIdentity === true ? "YES" : "NO"}`,
    `- Asset status: ${JSON.stringify(governance.assetStatus ?? {})}`,
  ];

  if (governance.allowProposedIdentity !== true && (governance.proposedIdentityTerms?.length ?? 0) > 0) {
    lines.push(
      `- DO NOT USE these proposed identity terms in concepts, creative copy, captions, image-generation instructions, or overlays: ${governance.proposedIdentityTerms!.join(" | ")}`,
    );
  }

  if ((governance.legacyIdentityTerms?.length ?? 0) > 0) {
    lines.push(`- Legacy identity terms are reference-only: ${governance.legacyIdentityTerms!.join(" | ")}`);
  }

  return lines.join("\n");
}

export function buildCampaignGenerationPrompt(input: CampaignPromptInput): string {
  const { request, preflight, brandContext, brandGovernance, productionFormat } = input;
  const verifiedFacts = serializeVerifiedFacts(preflight);
  const governance = serializeBrandGovernance(brandGovernance);

  return `You are the campaign-generation stage of AI Creative OS.

NON-NEGOTIABLE FACT RULES:
1. Use ONLY the verified facts supplied below for customer-facing factual claims.
2. Never invent or alter prices, offers, dates, branch details, product details, availability, contact details, statistics, certifications, ingredients, portion sizes, or quality claims.
3. Do not upgrade source-specific facts into universal brand facts.
4. If a price is supplied, keep its branch/channel scope intact.
5. Product names are not permission to invent related sensory claims. Do not add unsupported claims such as "juicy", "spicy", "fresh", "homemade", "organic", "healthy", "best", or similar unless those words are present in VERIFIED FACTS.

NON-NEGOTIABLE BRAND GOVERNANCE:
6. Proposed, working, legacy, or unapproved identity elements are NOT production assets unless BRAND GOVERNANCE explicitly allows them.
7. When proposed identity is disallowed, do not reproduce blocked tagline, colour, typography, logo, or identity terms anywhere in production-facing output.
8. If the logo is not APPROVED, overlaySpec.logoUsage MUST be "OMIT".

CREATIVE STRATEGY RULES:
9. Generate exactly 3 meaningfully different concepts with fixed strategic roles:
   - C1 = CONVERSION. It must contain an explicit behavioural mechanism and direct action. Its central idea must be about moving the customer to act now; it cannot be C2 with a CTA added.
   - C2 = CRAVE / EMOTION. It must be product-centric and desire-led without inventing product attributes. Its central idea must work even without a direct-response mechanic; it cannot be C1 with the CTA removed.
   - C3 = BRAND BUILDING. It must create an ATTHA'S-owned memory, association, ritual, attitude, or territory. It cannot be generic hospitality language that could belong unchanged to a competitor.
10. C1, C2, and C3 must differ in CENTRAL IDEA, not merely wording, CTA, crop, camera angle, or headline phrasing. If two concepts could reasonably share the same headline or coreIdea, regenerate them before answering.
11. Recommend exactly 1 concept based on objective, channel, factual safety, visual clarity, production simplicity, and brand fit.
12. Prefer one hero, one message, one CTA for direct-response food posters. People, phones, app screens, third-party logos, multiple products, or complex environments increase production complexity and should be used only when strategically necessary.
13. Avoid generic AI-ad language, excessive hype, unsupported superlatives, fake scarcity, cliché startup-style copy, emoji-heavy captions, and hashtag stuffing.
14. Do not say "link in bio" unless that instruction is a verified/requested fact.

IMAGE + TEXT PRODUCTION RULES:
15. Separate image generation from deterministic text rendering.
16. imageGeneration.basePrompt is for the visual image ONLY. It MUST NOT ask an image model to render headlines, prices, letters, numbers, logos, badges, app screens, or promotional text.
17. imageGeneration.textPolicy MUST equal "NO_TEXT_OR_LOGOS".
18. Put all critical customer-facing text in overlaySpec so HTML/CSS or another deterministic renderer can place it later.
19. If a verified price is used, overlaySpec.price must be an object with the exact numeric amount and currency "LKR". Do NOT format the display string yourself; the application will do that deterministically.
20. Generated food imagery must not be described as the exact served product unless approved reference photography supports that claim.
21. The production format is deterministic. creativeBrief.aspectRatio MUST be exactly "${productionFormat.aspectRatio}" for ${productionFormat.width}x${productionFormat.height} output.
22. Return JSON only. Do not use Markdown fences or commentary outside the JSON object.

CAMPAIGN REQUEST:
- Campaign ID: ${request.campaignId}
- Tenant: ${request.tenantId}
- Brand: ${request.brandId}
- Branch: ${request.branchId ?? "not specified"}
- Objective: ${request.objective}
- Channel: ${request.channel}
- Asset type: ${request.assetType}
- Required format: ${productionFormat.width}x${productionFormat.height} (${productionFormat.aspectRatio})
- Risk level: ${preflight.riskLevel}
- Human approval required: ${preflight.humanApprovalRequired ? "YES" : "NO"}

BRAND CONTEXT:
${brandContext}

BRAND GOVERNANCE:
${governance}

VERIFIED FACTS AVAILABLE TO THIS GENERATION:
${verifiedFacts || "- No customer-facing factual claims supplied."}

OUTPUT CONTRACT:
{
  "concepts": [
    {
      "id": "C1",
      "strategicRole": "conversion",
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
    {
      "id": "C2",
      "strategicRole": "crave-emotion",
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
    {
      "id": "C3",
      "strategicRole": "brand-building",
      "campaignName": "string",
      "coreIdea": "string",
      "customerEmotion": "string",
      "headlineDirection": "string",
      "visualConcept": "string",
      "cta": "string",
      "targetAudience": "string",
      "expectedStrength": 1,
      "risks": ["string"]
    }
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
    "aspectRatio": "${productionFormat.aspectRatio}"
  },
  "caption": "string",
  "imageGeneration": {
    "basePrompt": "image-only visual prompt with no rendered promotional text, numbers, prices, app screens or logos",
    "negativePrompt": "string",
    "visualConstraints": ["string"],
    "textPolicy": "NO_TEXT_OR_LOGOS"
  },
  "overlaySpec": {
    "headline": "string",
    "supportingCopy": "string",
    "price": { "amount": 950, "currency": "LKR" },
    "cta": "string",
    "logoUsage": "APPROVED_ONLY or OMIT",
    "placementHints": {
      "headline": "string",
      "supportingCopy": "string",
      "price": "optional string",
      "cta": "string",
      "logo": "string"
    }
  },
  "factualQaNotes": ["string"]
}

If no verified price is required, omit overlaySpec.price. expectedStrength must be an integer from 1 to 10. The recommendation must refer to one of C1, C2, or C3. Respect the fixed strategicRole assigned to each concept ID.`;
}
