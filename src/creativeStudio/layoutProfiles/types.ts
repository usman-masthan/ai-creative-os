import type { CampaignCreativeOutput, CampaignProductionFormat } from "../../creativeTypes.js";
import type { MarketingCampaignType } from "../../marketingPlannerTypes.js";

export interface CreativeLayoutDefinition {
  id: string;
  brandId: string;
  name: string;
  intent: string;
  supportedAspectRatios: string[];
  copyDensity: "low" | "medium";
  imageCompositionRequirements: string[];
}

export interface CreativeLayoutSelectionInput {
  brandId: string;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  campaignType?: MarketingCampaignType;
  preferredLayoutId?: string;
}

export interface CreativeLayoutAdaptationInput {
  brandId: string;
  sourceLayoutId: string;
  targetAspectRatio: string;
}

export interface CreativeLayoutProvider {
  clientId: string;
  list(brandId?: string): CreativeLayoutDefinition[];
  get(layoutId: string): CreativeLayoutDefinition;
  select(input: CreativeLayoutSelectionInput): CreativeLayoutDefinition;
  adaptationLayout(input: CreativeLayoutAdaptationInput): CreativeLayoutDefinition;
}
