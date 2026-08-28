import { getCreativeClientProfile } from "./clientProfiles/registry.js";
import type { CreativeClientProfile } from "./clientProfiles/types.js";
import { getCreativeLayoutProvider } from "./layoutProfiles/registry.js";
import type { CreativeLayoutProvider } from "./layoutProfiles/types.js";
import { getCreativeTruthProvider } from "./truthProviders/registry.js";
import type { CreativeTruthProviderDescriptor } from "./truthProviders/types.js";

export interface CreativeClientRegistrationValidation {
  valid: boolean;
  issues: string[];
}

function nonEmpty(value: string, label: string, issues: string[]): void {
  if (!value.trim()) issues.push(`${label} is required.`);
}

function safeRelativeAssetPath(value: string): boolean {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return false;
  return !normalized.split("/").some((segment) => segment === ".." || segment === "");
}

function validateProfile(profile: CreativeClientProfile, issues: string[]): void {
  nonEmpty(profile.clientId, "clientId", issues);
  nonEmpty(profile.displayName, `${profile.clientId}.displayName`, issues);
  nonEmpty(profile.defaultBrandKitId, `${profile.clientId}.defaultBrandKitId`, issues);
  nonEmpty(profile.approvedAssetRoot, `${profile.clientId}.approvedAssetRoot`, issues);

  const brands = Object.entries(profile.brands);
  if (!brands.length) issues.push(`${profile.clientId} requires at least one brand profile.`);
  for (const [brandKey, brand] of brands) {
    if (brandKey !== brand.brandId) {
      issues.push(`${profile.clientId} brand registry key ${brandKey} does not match brandId ${brand.brandId}.`);
    }
    nonEmpty(brand.brandId, `${profile.clientId}.${brandKey}.brandId`, issues);
    nonEmpty(brand.displayName, `${profile.clientId}.${brandKey}.displayName`, issues);
    nonEmpty(brand.displayFont, `${profile.clientId}.${brandKey}.displayFont`, issues);
    nonEmpty(brand.bodyFont, `${profile.clientId}.${brandKey}.bodyFont`, issues);
    nonEmpty(brand.priceFont, `${profile.clientId}.${brandKey}.priceFont`, issues);
    nonEmpty(brand.artboardBackground, `${profile.clientId}.${brandKey}.artboardBackground`, issues);
    nonEmpty(brand.logoLayerName, `${profile.clientId}.${brandKey}.logoLayerName`, issues);

    const asset = brand.approvedLogoAsset;
    nonEmpty(asset.assetId, `${profile.clientId}.${brandKey}.approvedLogoAsset.assetId`, issues);
    nonEmpty(asset.mimeType, `${profile.clientId}.${brandKey}.approvedLogoAsset.mimeType`, issues);
    if (!safeRelativeAssetPath(asset.relativePath)) {
      issues.push(`${profile.clientId}.${brandKey}.approvedLogoAsset.relativePath must be a safe relative path.`);
    }

    if (!brand.qa.approvedColours.length) issues.push(`${profile.clientId}.${brandKey}.qa requires approved colours.`);
    if (!brand.qa.approvedFonts.length) issues.push(`${profile.clientId}.${brandKey}.qa requires approved fonts.`);
    if (!Number.isFinite(brand.qa.safeAreaRatio) || brand.qa.safeAreaRatio < 0 || brand.qa.safeAreaRatio >= 0.5) {
      issues.push(`${profile.clientId}.${brandKey}.qa.safeAreaRatio must be from 0 inclusive to 0.5 exclusive.`);
    }
    if (!Number.isFinite(brand.qa.minimumLogoPx) || brand.qa.minimumLogoPx <= 0) {
      issues.push(`${profile.clientId}.${brandKey}.qa.minimumLogoPx must be positive.`);
    }
    if (brand.qa.logoRequired && !asset.assetId.trim()) {
      issues.push(`${profile.clientId}.${brandKey} requires a registered approved logo asset.`);
    }
    nonEmpty(brand.review.expectedBrandIdentifier, `${profile.clientId}.${brandKey}.review.expectedBrandIdentifier`, issues);
    nonEmpty(brand.review.finalArtReviewLabel, `${profile.clientId}.${brandKey}.review.finalArtReviewLabel`, issues);
    if (!brand.review.creativeDirectorGuidance.length || brand.review.creativeDirectorGuidance.some((item) => !item.trim())) {
      issues.push(`${profile.clientId}.${brandKey}.review requires non-empty Creative Director guidance.`);
    }
  }
}

function validateLayouts(profile: CreativeClientProfile, provider: CreativeLayoutProvider, issues: string[]): void {
  if (provider.clientId !== profile.clientId) {
    issues.push(`Layout provider ${provider.clientId} does not match profile ${profile.clientId}.`);
  }
  const seen = new Set<string>();
  for (const brand of Object.values(profile.brands)) {
    const layouts = provider.list(brand.brandId);
    if (!layouts.length) issues.push(`${profile.clientId}/${brand.brandId} requires at least one governed layout.`);
    for (const layout of layouts) {
      if (layout.brandId !== brand.brandId) {
        issues.push(`Layout ${layout.id} belongs to ${layout.brandId}, not ${brand.brandId}.`);
      }
      if (seen.has(layout.id)) issues.push(`Duplicate layout id ${layout.id}.`);
      seen.add(layout.id);
      if (!layout.supportedAspectRatios.length) issues.push(`Layout ${layout.id} requires a supported aspect ratio.`);
      if (!layout.imageCompositionRequirements.length) issues.push(`Layout ${layout.id} requires image composition requirements.`);
      nonEmpty(layout.name, `Layout ${layout.id}.name`, issues);
      nonEmpty(layout.intent, `Layout ${layout.id}.intent`, issues);
    }
  }
}

function validateTruth(profile: CreativeClientProfile, provider: CreativeTruthProviderDescriptor, issues: string[]): void {
  if (provider.clientId !== profile.clientId) {
    issues.push(`Truth provider ${provider.clientId} does not match profile ${profile.clientId}.`);
  }
  nonEmpty(provider.providerId, `${profile.clientId}.truthProvider.providerId`, issues);
  if (provider.confirmationRequired !== true) issues.push(`${profile.clientId} truth provider must require explicit confirmation.`);
  if (provider.immutableSnapshotRequired !== true) issues.push(`${profile.clientId} truth provider must require an immutable snapshot.`);
  if (provider.factGateMode !== "QUESTIONNAIRE_CONFIRMATION") {
    issues.push(`${profile.clientId} truth provider must use QUESTIONNAIRE_CONFIRMATION.`);
  }
  const endpoints = Object.entries(provider.endpoints);
  const values = new Set<string>();
  for (const [name, endpoint] of endpoints) {
    if (!endpoint.startsWith("/") || endpoint.includes("..")) {
      issues.push(`${profile.clientId}.truthProvider.${name} must be an absolute in-app path without traversal.`);
    }
    if (values.has(endpoint)) issues.push(`${profile.clientId} truth provider reuses endpoint ${endpoint}.`);
    values.add(endpoint);
  }
}

export function validateCreativeClientRegistration(input: {
  profile: CreativeClientProfile;
  layoutProvider: CreativeLayoutProvider;
  truthProvider: CreativeTruthProviderDescriptor;
}): CreativeClientRegistrationValidation {
  const issues: string[] = [];
  validateProfile(input.profile, issues);
  validateLayouts(input.profile, input.layoutProvider, issues);
  validateTruth(input.profile, input.truthProvider, issues);
  return { valid: issues.length === 0, issues };
}

export function assertCreativeClientRegistration(input: {
  profile: CreativeClientProfile;
  layoutProvider: CreativeLayoutProvider;
  truthProvider: CreativeTruthProviderDescriptor;
}): void {
  const result = validateCreativeClientRegistration(input);
  if (!result.valid) {
    throw new Error(`CREATIVE_CLIENT_REGISTRATION_INVALID: ${result.issues.join(" ")}`);
  }
}

export function assertRegisteredCreativeClient(clientId: string): void {
  const profile = getCreativeClientProfile(clientId);
  assertCreativeClientRegistration({
    profile,
    layoutProvider: getCreativeLayoutProvider(profile.clientId),
    truthProvider: getCreativeTruthProvider(profile.clientId),
  });
}
