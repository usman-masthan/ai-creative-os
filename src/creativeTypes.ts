export interface CampaignConcept {
  id: string;
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

export interface CampaignImagePrompt {
  immutable: string[];
  flexible: string[];
  prompt: string;
}

export interface CampaignCreativeOutput {
  concepts: CampaignConcept[];
  recommendedConceptId: string;
  recommendationReason: string;
  creativeBrief: CampaignCreativeBrief;
  caption: string;
  imagePrompt: CampaignImagePrompt;
  factualQaNotes: string[];
}
