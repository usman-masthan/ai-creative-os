import type { CampaignPriceStyle } from "../../creativeTypes.js";

export interface CreativePriceTheme {
  fill: string;
  text: string;
}

export interface CreativeBrandTheme {
  brandId: string;
  displayName: string;
  displayFont: string;
  bodyFont: string;
  priceFont: string;
  artboardBackground: string;
  primaryText: string;
  secondaryText: string;
  ctaFill: string;
  ctaText: string;
  defaultPriceStyle: CampaignPriceStyle;
  priceThemes: Record<CampaignPriceStyle, CreativePriceTheme>;
  logoLayerName: string;
}

export interface CreativeClientProfile {
  clientId: string;
  displayName: string;
  defaultBrandKitId: string;
  approvedAssetRoot: string;
  brands: Record<string, CreativeBrandTheme>;
}
