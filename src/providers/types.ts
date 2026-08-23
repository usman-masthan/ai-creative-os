export interface CampaignGenerationProvider {
  readonly providerName: string;
  readonly model: string;
  generate(prompt: string): Promise<string>;
}
