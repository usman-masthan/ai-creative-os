import type { AiTraceDocument, AiTraceStageStatus } from "../aiTrace.js";
import type { CampaignCreativeOutput } from "../creativeTypes.js";
import type { DesignDocument } from "../designDocument/types.js";
import { assertDesignDocument } from "../designDocument/validator.js";
import { getCreativeLayoutProvider } from "./layoutProfiles/registry.js";
import {
  assertCreativeOrchestrationPlan,
  type CreativeOrchestrationPlan,
  type CreativeSpecialistRole,
} from "./orchestrator.js";

export interface OrchestrationProviderModel {
  provider: string;
  model: string;
}

export interface OrchestrationSpecialistExecution {
  role: CreativeSpecialistRole;
  status: "COMPLETED";
  source: "EXISTING_GOVERNED_PIPELINE" | "DETERMINISTIC_LAYOUT_ENGINE";
  modelCalls: number;
  providerModels: OrchestrationProviderModel[];
  output: Record<string, unknown>;
}

export interface CreativeOrchestrationExecution {
  schemaVersion: 1;
  orchestrationId: string;
  campaignId: string;
  designId: string;
  designVersion: number;
  truthSnapshotId: string;
  clientId: string;
  brandId: string;
  specialistExecutions: OrchestrationSpecialistExecution[];
  creativeDirector: {
    status: AiTraceStageStatus;
    modelCalls: number;
    providerModels: OrchestrationProviderModel[];
    reviewPresent: boolean;
  };
  qa: {
    deterministicDesignQa?: "PASS" | "WARN" | "BLOCK";
    visualQa: AiTraceStageStatus;
    finalArtQa: AiTraceStageStatus;
  };
  renderer: {
    status: AiTraceStageStatus;
    deterministic: true;
    callCount: number;
  };
  extraModelCallsAddedByOrchestrator: 0;
  completedAt: string;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function finalCreative(trace: AiTraceDocument): CampaignCreativeOutput {
  const summary = objectValue(trace.finalizer.summary);
  const output = summary?.output;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new Error("ORCHESTRATION_EXECUTION_MISSING_CREATIVE: finalizer trace has no governed creative output.");
  }
  return output as CampaignCreativeOutput;
}

function providerModels(calls: AiTraceDocument["finalizer"]["calls"]): OrchestrationProviderModel[] {
  const unique = new Map<string, OrchestrationProviderModel>();
  for (const call of calls) {
    const key = `${call.provider}::${call.model}`;
    if (!unique.has(key)) unique.set(key, { provider: call.provider, model: call.model });
  }
  return [...unique.values()];
}

function mediaAssets(document: DesignDocument): Array<Record<string, unknown>> {
  return document.layers.flatMap((layer) => {
    const asset = layer.type === "image" || layer.type === "logo"
      ? layer.asset
      : layer.type === "background"
        ? layer.asset
        : undefined;
    if (!asset) return [];
    if (asset.source === "generated" && asset.visualTruthClass === "VERIFIED_PRODUCT_VISUAL") {
      throw new Error("ORCHESTRATION_EXECUTION_PROVENANCE_BLOCK: generated media cannot be a verified product visual.");
    }
    return [{
      layerId: layer.id,
      layerType: layer.type,
      assetId: asset.assetId,
      source: asset.source,
      ...(asset.visualTruthClass ? { visualTruthClass: asset.visualTruthClass } : {}),
      ...(asset.generation?.provider ? { generationProvider: asset.generation.provider } : {}),
      ...(asset.generation?.model ? { generationModel: asset.generation.model } : {}),
    }];
  });
}

export function buildCreativeOrchestrationExecution(input: {
  plan: CreativeOrchestrationPlan;
  trace: AiTraceDocument;
  document: DesignDocument;
  deterministicDesignQa?: "PASS" | "WARN" | "BLOCK";
  completedAt?: string;
}): CreativeOrchestrationExecution {
  const plan = assertCreativeOrchestrationPlan(input.plan);
  const document = assertDesignDocument(input.document);
  if (input.trace.campaignId !== plan.campaignId || document.campaignId !== plan.campaignId) {
    throw new Error("ORCHESTRATION_EXECUTION_CAMPAIGN_MISMATCH.");
  }
  if (document.truthSnapshotId !== plan.truthSnapshotId) {
    throw new Error("ORCHESTRATION_EXECUTION_TRUTH_MISMATCH.");
  }
  if (document.brand.clientId !== plan.clientId || document.brand.brandId !== plan.brandId) {
    throw new Error("ORCHESTRATION_EXECUTION_BRAND_MISMATCH.");
  }
  if (input.trace.finalizer.status !== "COMPLETED") {
    throw new Error(`ORCHESTRATION_EXECUTION_FINALIZER_INCOMPLETE: ${input.trace.finalizer.status}.`);
  }

  const creative = finalCreative(input.trace);
  const layout = getCreativeLayoutProvider(plan.clientId).get(document.layoutId);
  if (layout.brandId !== plan.brandId) throw new Error("ORCHESTRATION_EXECUTION_LAYOUT_BRAND_MISMATCH.");

  const textProviderModels = providerModels([
    ...input.trace.strategist.calls,
    ...input.trace.finalizer.calls,
  ]);
  const imageProviderModels = providerModels(input.trace.image.calls);
  const layoutProviderModels = providerModels(input.trace.strategist.calls);
  const specialistExecutions: OrchestrationSpecialistExecution[] = [
    {
      role: "COPY_CONTENT",
      status: "COMPLETED",
      source: "EXISTING_GOVERNED_PIPELINE",
      modelCalls: input.trace.strategist.calls.length + input.trace.finalizer.calls.length,
      providerModels: textProviderModels,
      output: {
        headline: creative.overlaySpec.headline,
        supportingCopy: creative.overlaySpec.supportingCopy,
        cta: creative.overlaySpec.cta,
        caption: creative.caption,
        priceIncluded: Boolean(creative.overlaySpec.price),
        factualQaNotes: [...creative.factualQaNotes],
        typographyRenderedAsNativeLayers: document.layers.some((layer) => layer.type === "text" && layer.role === "headline"),
      },
    },
    {
      role: "ASSET_DIRECTION",
      status: "COMPLETED",
      source: "EXISTING_GOVERNED_PIPELINE",
      modelCalls: input.trace.image.calls.length,
      providerModels: imageProviderModels,
      output: {
        basePrompt: creative.imageGeneration.basePrompt,
        negativePrompt: creative.imageGeneration.negativePrompt,
        visualConstraints: [...creative.imageGeneration.visualConstraints],
        textPolicy: creative.imageGeneration.textPolicy,
        mediaAssets: mediaAssets(document),
      },
    },
    {
      role: "LAYOUT_ART_DIRECTION",
      status: "COMPLETED",
      source: "DETERMINISTIC_LAYOUT_ENGINE",
      modelCalls: input.trace.strategist.calls.length,
      providerModels: layoutProviderModels,
      output: {
        visualDirection: creative.creativeBrief.visualDirection,
        composition: creative.creativeBrief.composition,
        placementHints: { ...creative.overlaySpec.placementHints },
        layoutId: layout.id,
        layoutName: layout.name,
        geometryProfile: layout.geometryProfile,
        deterministicGeometryApplied: true,
      },
    },
  ];

  const completedAt = input.completedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(completedAt))) throw new Error("ORCHESTRATION_EXECUTION_COMPLETED_AT_INVALID.");
  return {
    schemaVersion: 1,
    orchestrationId: plan.id,
    campaignId: plan.campaignId,
    designId: document.id,
    designVersion: document.version,
    truthSnapshotId: plan.truthSnapshotId,
    clientId: plan.clientId,
    brandId: plan.brandId,
    specialistExecutions,
    creativeDirector: {
      status: input.trace.creativeDirector.status,
      modelCalls: input.trace.creativeDirector.calls.length,
      providerModels: providerModels(input.trace.creativeDirector.calls),
      reviewPresent: input.trace.creativeDirector.status === "COMPLETED"
        && (input.trace.creativeDirector.calls.length > 0 || input.trace.creativeDirector.summary !== undefined),
    },
    qa: {
      ...(input.deterministicDesignQa ? { deterministicDesignQa: input.deterministicDesignQa } : {}),
      visualQa: input.trace.visualQa.status,
      finalArtQa: input.trace.finalArtQa.status,
    },
    renderer: {
      status: input.trace.renderer.status,
      deterministic: true,
      callCount: input.trace.renderer.calls.length,
    },
    extraModelCallsAddedByOrchestrator: 0,
    completedAt,
  };
}

export function assertCreativeOrchestrationExecution(
  value: CreativeOrchestrationExecution,
): CreativeOrchestrationExecution {
  if (value.schemaVersion !== 1 || !value.orchestrationId.trim() || !value.designId.trim()) {
    throw new Error("CREATIVE_ORCHESTRATION_EXECUTION_INVALID: identity fields are required.");
  }
  if (value.specialistExecutions.length !== 3) {
    throw new Error("CREATIVE_ORCHESTRATION_EXECUTION_INVALID: all three specialist executions are required.");
  }
  const roles = new Set(value.specialistExecutions.map((item) => item.role));
  if (!roles.has("COPY_CONTENT") || !roles.has("ASSET_DIRECTION") || !roles.has("LAYOUT_ART_DIRECTION")) {
    throw new Error("CREATIVE_ORCHESTRATION_EXECUTION_INVALID: specialist roles are incomplete.");
  }
  if (value.extraModelCallsAddedByOrchestrator !== 0) {
    throw new Error("CREATIVE_ORCHESTRATION_EXECUTION_INVALID: audit extraction must not add model calls.");
  }
  return value;
}
