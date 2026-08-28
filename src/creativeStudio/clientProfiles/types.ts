import type { CampaignPriceStyle } from "../../creativeTypes.js";

export interface CreativePriceTheme {
  fill: string;
  text: string;
}

export interface CreativeApprovedBrandAsset {
  assetId: string;
  relativePath: string;
  mimeType: string;
}

export interface CreativeBrandQaGovernance {
  approvedColours: readonly string[];
  approvedFonts: readonly string[];
  safeAreaRatio: number;
  minimumLogoPx: number;
  logoRequired: boolean;
  logoRequirementLabel: string;
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
  approvedLogoAsset: CreativeApprovedBrandAsset;
  qa: CreativeBrandQaGovernance;
}

export interface CreativeClientProfile {
  clientId: string;
  displayName: string;
  defaultBrandKitId: string;
  approvedAssetRoot: string;
  brands: Record<string, CreativeBrandTheme>;
}
