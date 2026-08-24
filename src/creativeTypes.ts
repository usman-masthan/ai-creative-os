export type CampaignConceptRole = "conversion" | "crave-emotion" | "brand-building";

export interface CampaignConcept {
  id: string;
  strategicRole: CampaignConceptRole;
  campaignName: string;
  coreIdea: string;
  customerEmotion: string;
  headlineDirection: string;
  visualConcept: string;
  cta: string;
  targetAudience: string;
  expectedStrength: number;
  risks: string[];
}

export interface CampaignCreativeBrief {
  headline: string;
  supportingCopy: string;
  cta: string;
  visualDirection: string;
  composition: string;
  lighting: string;
  photographyStyle: string;
  aspectRatio: string;
}

export interface CampaignImageGeneration {
  basePrompt: string;
  negativePrompt: string;
  visualConstraints: string[];
  textPolicy: "NO_TEXT_OR_LOGOS";
}

export interface CampaignMoneyOverlay {
  amount: number;
  currency: "LKR";
  display: string;
}

export interface CampaignOverlaySpec {
  headline: string;
  supportingCopy: string;
  price?: CampaignMoneyOverlay;
  cta: string;
  logoUsage: "APPROVED_ONLY" | "OMIT";
  placementHints: {
    headline: string;
    supportingCopy: string;
    price?: string;
    cta: string;
    logo: string;
  };
}

export interface CampaignCreativeOutput {
  concepts: CampaignConcept[];
  recommendedConceptId: string;
  recommendationReason: string;
  creativeBrief: CampaignCreativeBrief;
  caption: string;
  imageGeneration: CampaignImageGeneration;
  overlaySpec: CampaignOverlaySpec;
  factualQaNotes: string[];
}

export interface CampaignProductionFormat {
  channel: string;
  assetType: string;
  aspectRatio: string;
  width: number;
  height: number;
}

export interface CampaignProductionComplexity {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
}
