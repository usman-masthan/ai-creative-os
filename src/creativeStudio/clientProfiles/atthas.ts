import { ATTHAS_TOKENS, atthasDisplayFont } from "../../atthasTokens.js";
import type { CreativeClientProfile } from "./types.js";

const APPROVED_COLOURS = [...new Set(Object.values(ATTHAS_TOKENS.colours))];
const APPROVED_MASTER_SYMBOL = {
  assetId: "ATTHAS_MASTER_SYMBOL_A_FORK",
  relativePath: "logos/source/atthas-master-symbol-a-fork.svg",
  mimeType: "image/svg+xml",
} as const;

function qaGovernance(displayFont: string) {
  return {
    approvedColours: APPROVED_COLOURS,
    approvedFonts: [displayFont, ATTHAS_TOKENS.typography.body, ATTHAS_TOKENS.typography.price],
    safeAreaRatio: 0.05,
    minimumLogoPx: 32,
    logoRequired: true,
    logoRequirementLabel: "approved ATTHA'S logo/symbol",
  } as const;
}

const burgerDisplayFont = atthasDisplayFont("ATTHAS_BURGER");
const restaurantDisplayFont = atthasDisplayFont("ATTHAS_RESTAURANT");

export const ATTHAS_CREATIVE_CLIENT_PROFILE: CreativeClientProfile = {
  clientId: "T001",
  displayName: "ATTHA'S",
  defaultBrandKitId: "ATTHAS_WORKING_V1",
  approvedAssetRoot: "clients/T001-atthas/assets",
  brands: {
    ATTHAS_BURGER: {
      brandId: "ATTHAS_BURGER",
      displayName: "ATTHA'S Burger",
      displayFont: burgerDisplayFont,
      bodyFont: ATTHAS_TOKENS.typography.body,
      priceFont: ATTHAS_TOKENS.typography.price,
      artboardBackground: ATTHAS_TOKENS.colours.deepRed,
      primaryText: ATTHAS_TOKENS.colours.white,
      secondaryText: ATTHAS_TOKENS.colours.cream,
      ctaFill: ATTHAS_TOKENS.colours.primaryYellow,
      ctaText: ATTHAS_TOKENS.colours.ink,
      defaultPriceStyle: "BRAND_YELLOW",
      priceThemes: {
        BRAND_RED: { fill: ATTHAS_TOKENS.colours.primaryRed, text: ATTHAS_TOKENS.colours.white },
        BRAND_YELLOW: { fill: ATTHAS_TOKENS.colours.primaryYellow, text: ATTHAS_TOKENS.colours.ink },
      },
      logoLayerName: "Approved ATTHA'S Burger Logo",
      approvedLogoAsset: APPROVED_MASTER_SYMBOL,
      qa: qaGovernance(burgerDisplayFont),
    },
    ATTHAS_RESTAURANT: {
      brandId: "ATTHAS_RESTAURANT",
      displayName: "ATTHA'S Restaurant",
      displayFont: restaurantDisplayFont,
      bodyFont: ATTHAS_TOKENS.typography.body,
      priceFont: ATTHAS_TOKENS.typography.price,
      artboardBackground: ATTHAS_TOKENS.colours.cream,
      primaryText: ATTHAS_TOKENS.colours.ink,
      secondaryText: ATTHAS_TOKENS.colours.ink,
      ctaFill: ATTHAS_TOKENS.colours.primaryRed,
      ctaText: ATTHAS_TOKENS.colours.white,
      defaultPriceStyle: "BRAND_RED",
      priceThemes: {
        BRAND_RED: { fill: ATTHAS_TOKENS.colours.primaryRed, text: ATTHAS_TOKENS.colours.white },
        BRAND_YELLOW: { fill: ATTHAS_TOKENS.colours.primaryYellow, text: ATTHAS_TOKENS.colours.ink },
      },
      logoLayerName: "Approved ATTHA'S Restaurant Logo",
      approvedLogoAsset: APPROVED_MASTER_SYMBOL,
      qa: qaGovernance(restaurantDisplayFont),
    },
  },
};
