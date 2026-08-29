import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { assertCreativeClientRegistration } from "../creativeStudio/clientRegistration.js";
import { listCreativeClientProfiles } from "../creativeStudio/clientProfiles/registry.js";
import { getCreativeLayoutProvider } from "../creativeStudio/layoutProfiles/registry.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { getCreativeTruthProvider } from "../creativeStudio/truthProviders/registry.js";
import { FileCampaignStore } from "../operations/fileStore.js";

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioAdvancedBootstrapOptions {
  rootDir?: string;
}

export function createCreativeStudioAdvancedBootstrapHandler(
  options: CreativeStudioAdvancedBootstrapOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const designs = new FileDesignProjectStore(rootDir);
  const campaigns = new FileCampaignStore(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "GET" || url.pathname !== "/api/studio/bootstrap") return false;
    const [designStates, campaignRecords] = await Promise.all([
      designs.list(),
      campaigns.listCampaigns(),
    ]);
    const clientProfiles = listCreativeClientProfiles().map((profile) => {
      const layouts = getCreativeLayoutProvider(profile.clientId);
      const truthProvider = getCreativeTruthProvider(profile.clientId);
      assertCreativeClientRegistration({ profile, layoutProvider: layouts, truthProvider });
      return {
        clientId: profile.clientId,
        displayName: profile.displayName,
        defaultBrandKitId: profile.defaultBrandKitId,
        registrationValidated: true,
        truthProvider: {
          providerId: truthProvider.providerId,
          endpoints: truthProvider.endpoints,
          confirmationRequired: truthProvider.confirmationRequired,
          immutableSnapshotRequired: truthProvider.immutableSnapshotRequired,
          factGateMode: truthProvider.factGateMode,
        },
        brands: Object.values(profile.brands).map((brand) => ({
          brandId: brand.brandId,
          displayName: brand.displayName,
          layoutCount: layouts.list(brand.brandId).length,
          reviewContextRegistered: true,
          brandKitPreview: {
            logoUrl: `/studio-brand-asset/${encodeURIComponent(profile.clientId)}/${encodeURIComponent(brand.brandId)}/logo`,
            approvedLogoAssetId: brand.approvedLogoAsset.assetId,
            colours: [...brand.qa.approvedColours],
            semanticColours: {
              artboardBackground: brand.artboardBackground,
              primaryText: brand.primaryText,
              secondaryText: brand.secondaryText,
              ctaFill: brand.ctaFill,
              ctaText: brand.ctaText,
            },
            typography: {
              display: brand.displayFont,
              body: brand.bodyFont,
              price: brand.priceFont,
            },
            approvedGraphicElements: [...brand.brandKitPreview.approvedGraphicElements],
            photographyDirection: [...brand.brandKitPreview.photographyDirection],
          },
        })),
      };
    });
    sendJson(res, 200, {
      designs: designStates,
      campaigns: campaignRecords,
      clientProfiles,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      paidMediaAllowed: process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true",
      capabilities: {
        documentModel: "DesignDocument-v1",
        renderer: "DesignDocument HTML/SVG renderer",
        canvas: "native-svg-adapter",
        clientProfileRegistry: true,
        clientLayoutProviderRegistry: true,
        clientTruthProviderRegistry: true,
        clientReviewContextRegistry: true,
        failClosedClientRegistration: true,
        brandKitPreview: {
          profileDriven: true,
          approvedLogoAssetServing: true,
          palette: true,
          typography: true,
          approvedGraphicElements: true,
          photographyDirection: true,
        },
        truthGate: {
          explicitConfirmationRequired: true,
          immutableSnapshotRequired: true,
          providerDispatched: true,
        },
        creativeOrchestrator: {
          persistedPlans: true,
          runsAfterTruthConfirmation: true,
          requiredBeforeStudioProduction: true,
          coordinatesExistingProductionPipeline: true,
          parallelSpecialistResponsibilities: ["COPY_CONTENT", "ASSET_DIRECTION", "LAYOUT_ART_DIRECTION"],
          extraModelCallsForPlanning: 0,
          projectProvenanceLink: true,
          executionAuditFromExistingTrace: true,
          executionAuditImmutable: true,
          executionAuditExtraModelCalls: 0,
        },
        activeClientProfiles: clientProfiles.length,
        manualEditing: true,
        reusableComponents: {
          brandScoped: true,
          immutableLibraryEntries: true,
          immutableFamilyVersions: true,
          lifecycleStates: ["ACTIVE", "DEPRECATED", "ARCHIVED"],
          noAutomaticInstanceUpdates: true,
          explicitUpgradeOnly: true,
          upgradeDestinationTruthRevalidation: true,
          detachToNativeLayers: true,
          structureStyleOnly: true,
          destinationTextRoleRebind: true,
          destinationTruthRevalidation: true,
          componentInstanceProvenance: true,
          assetBackedTemplates: false,
          governedVersionAuthoring: true,
          authoringPreviewDiff: true,
          authoringCompatibilityStates: ["COMPATIBLE", "REVIEW_REQUIRED", "BLOCKED"],
          authoringMandatoryVersionNotes: true,
          authoringStalePreviewGuard: true,
          authoringExplicitReviewAcknowledgement: true,
          authoringMutatesSourceDesign: false,
          dependencyImpactAnalysis: true,
          dependencyImpactApprovedFreezeDetection: true,
          dependencyImpactTruthAndRoleSimulation: true,
          dependencyImpactTokenGuard: true,
          lifecycleImpactRequiredForDeprecateArchive: true,
          semanticAuthoringImpactRequired: true,
          dependencyImpactMutatesDesigns: false,
          impactAwareMigrationPlanning: true,
          immutableMigrationPlans: true,
          migrationDesignLevelAtomicity: true,
          migrationExcludesApprovedFrozen: true,
          migrationSelectedBatchPreflightBeforeSave: true,
          migrationDeterministicQaRequired: true,
          migrationExecutionAuditImmutable: true,
          migrationMutatesOnlySelectedEligibleDesigns: true,
          extraModelCalls: 0,
        },
        nativeTypography: true,
        undoRedo: true,
        versionHistory: {
          snapshots: true,
          compare: true,
          restoreAsNewRevision: true,
        },
        deterministicQa: true,
        deterministicAutoPolish: true,
        layeredCreativeDirectorReview: true,
        flattenedFinalVisualQa: Boolean(process.env.GEMINI_API_KEY?.trim()),
        versionBoundApproval: {
          finalVisualQaPassRequired: true,
          explicitHumanApprovalRequired: true,
          staleApprovalRejectedAfterEdit: true,
          approvedPngExport: true,
          campaignAssetHandoff: true,
        },
        initialRendererParityGate: true,
        designDirections: {
          count: 3,
          additionalGenerationCalls: 0,
          sideBySidePreview: true,
        },
        aiTextEditing: "selected-layer-only",
        aiImageEditing: "isolated-layers-only",
        segmentation: {
          available: Boolean(process.env.GEMINI_API_KEY?.trim()),
          sourceForegroundPixelsPreserved: true,
          generatedBackgroundRepair: true,
          paidMediaRequired: true,
        },
        adaptationPresets: [
          "instagram-square",
          "instagram-portrait",
          "instagram-story",
          "facebook-post",
        ],
        exportFormats: ["png", "svg"],
        pngExportPresets: ["standard", "high-resolution", "4k"],
        jpgExport: false,
        genericMaskRendering: {
          rect: true,
          ellipse: true,
          multipleVisibleMasksPerTarget: false,
        },
      },
    });
    return true;
  };
}
