import { atthasBrandIdentifier, type AtthasOperatingBrand } from "../atthasTokens.js";

export interface FinalArtBrandReviewContext {
  brandDisplayName: string;
  expectedBrandIdentifier: string;
  finalArtReviewLabel: string;
}

export function atthasFinalArtReviewContext(brandId: AtthasOperatingBrand): FinalArtBrandReviewContext {
  const brandDisplayName = brandId === "ATTHAS_BURGER" ? "ATTHA'S Burger" : "ATTHA'S Restaurant";
  return {
    brandDisplayName,
    expectedBrandIdentifier: atthasBrandIdentifier(brandId),
    finalArtReviewLabel: `${brandDisplayName} advertising artwork`,
  };
}
