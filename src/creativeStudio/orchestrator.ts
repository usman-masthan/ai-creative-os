import { assertCreativeBrief, type CreativeBrief } from "./contracts/creativeBrief.js";
import { getCreativeClientProfile, getCreativeBrandTheme } from "./clientProfiles/registry.js";
import { getCreativeLayoutProvider } from "./layoutProfiles/registry.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

export type CreativeSpecialistRole =
  | "COPY_CONTENT"
  | "ASSET_DIRECTION"
  | "LAYOUT_ART_DIRECTION";

export type CreativeExecutionMode = "AI_ASSISTED" | "DETERMINISTIC" | "HYBRID";

export interface CreativeSpecialistTask {
  id: string;
  role: CreativeSpecialistRole;
  executionMode: CreativeExecutionMode;
  canRunInParallel: boolean;
  dependsOn: Array<"CONFIRMED_TRUTH" | "BRAND_CONTEXT" | "CREATIVE_STRATEGY">;
  objective: string;
  constraints: string[];
}

export interface CreativeOrchestrationPlan {
  schemaVersion: 1;
  id: string;
  campaignId: string;
  briefId: string;
  clientId: string;
  brandId: string;
  truthSnapshotId: string;
  truthConfirmation: {
    sessionId: string;
    confirmedBy: string;
    confirmedAt: string;
    confirmedFactLabels: string[];
  };
  brandContext: {
    clientDisplayName: string;
    brandDisplayName: string;
    brandKitId: string;
    approvedLogoAssetId: string;
    typographyMode: "NATIVE_EDITABLE";
    logoPolicy: "APPROVED_SOURCE_ONLY";
    layoutProviderClientId: string;
    availableLayoutCount: number;
  };
  creativeStrategy: {
    goal: string;
    description: string;
    audience: string[];
    vibe: string[];
    format: CreativeBrief["format"];
    contentRequirements: CreativeBrief["contentRequirements"];
    product?: CreativeBrief["product"];
    branchId?: string;
    salesChannel?: string;
  };
  execution: {
    strategyFirst: true;
    specialistExecution: "PARALLEL_WHERE_INDEPENDENT";
    specialistTasks: CreativeSpecialistTask[];
    creativeDirectorReviewRequired: true;
    deterministicQaRequired: true;
  };
  productionGuards: {
    confirmedTruthOnly: true;
    nativeTypographyRequired: true;
    approvedLogoOnly: true;
    deterministicLayoutRequired: true;
    generatedMediaCannotBecomeVerifiedProductVisual: true;
    creativeDirectorReviewRequired: true;
  };
  status: "READY_FOR_GOVERNED_PRODUCTION";
  createdAt: string;
}

export interface CreateCreativeOrchestrationInput {
  campaignId: string;
  brief: CreativeBrief;
  truthSnapshot: TaskTruthSnapshot;
  createdAt?: string;
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(trimmed)) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return trimmed;
}

function assertConfirmedTruthBinding(input: {
  campaignId: string;
  brief: CreativeBrief;
  snapshot: TaskTruthSnapshot;
}): void {
  const expectedTruthSnapshotId = `task:${input.snapshot.sessionId}`;
  if (!input.brief.truthSnapshotId) {
    throw new Error("ORCHESTRATION_TRUTH_REQUIRED: CreativeBrief must be bound to a confirmed task truth snapshot.");
  }
  if (input.brief.truthSnapshotId !== expectedTruthSnapshotId) {
    throw new Error("ORCHESTRATION_TRUTH_MISMATCH: CreativeBrief truth snapshot does not match the confirmed task snapshot.");
  }
  if (input.snapshot.campaignId !== input.campaignId) {
    throw new Error("ORCHESTRATION_CAMPAIGN_MISMATCH: task truth belongs to a different campaign.");
  }
  if (input.snapshot.brandId !== input.brief.brandId) {
    throw new Error("ORCHESTRATION_BRAND_MISMATCH: task truth belongs to a different brand.");
  }
  if (input.brief.branchId && input.snapshot.branchId !== input.brief.branchId) {
    throw new Error("ORCHESTRATION_BRANCH_MISMATCH: task truth belongs to a different branch.");
  }
  if (!input.snapshot.confirmedBy.trim() || Number.isNaN(Date.parse(input.snapshot.confirmedAt))) {
    throw new Error("ORCHESTRATION_UNCONFIRMED_TRUTH: task truth is missing confirmation provenance.");
  }
}

function specialistTasks(brief: CreativeBrief): CreativeSpecialistTask[] {
  const factualConstraints = [
    "Use only facts present in the immutable confirmed task truth snapshot.",
    "Never invent prices, offers, ingredients, branch information, contact details or campaign dates.",
  ];
  return [
    {
      id: "copy-content",
      role: "COPY_CONTENT",
      executionMode: "AI_ASSISTED",
      canRunInParallel: true,
      dependsOn: ["CONFIRMED_TRUTH", "BRAND_CONTEXT", "CREATIVE_STRATEGY"],
      objective: "Develop headline, supporting copy, CTA and optional caption/microcopy within the confirmed campaign strategy.",
      constraints: [
        ...factualConstraints,
        "Keep promotional typography as native editable text; do not bake copy into generated imagery.",
        ...(brief.contentRequirements.headlineDirection
          ? [`Follow headline direction: ${brief.contentRequirements.headlineDirection}.`]
          : []),
      ],
    },
    {
      id: "asset-direction",
      role: "ASSET_DIRECTION",
      executionMode: "HYBRID",
      canRunInParallel: true,
      dependsOn: ["CONFIRMED_TRUTH", "BRAND_CONTEXT", "CREATIVE_STRATEGY"],
      objective: "Plan or generate only the visual assets needed for the composition while preserving product-visual provenance.",
      constraints: [
        ...factualConstraints,
        "Do not generate promotional text, prices or logos inside media assets.",
        "Generated media must never be reclassified as a verified product visual.",
        "Use approved source-controlled logo assets only.",
      ],
    },
    {
      id: "layout-art-direction",
      role: "LAYOUT_ART_DIRECTION",
      executionMode: "HYBRID",
      canRunInParallel: true,
      dependsOn: ["CONFIRMED_TRUTH", "BRAND_CONTEXT", "CREATIVE_STRATEGY"],
      objective: "Choose art direction and governed layout semantics while leaving exact geometry to deterministic layout software.",
      constraints: [
        ...factualConstraints,
        "Do not use free-form LLM coordinates for final positioning.",
        "Typography, logos, CTA elements and price elements remain structural native layers.",
      ],
    },
  ];
}

export function createCreativeOrchestrationPlan(
  input: CreateCreativeOrchestrationInput,
): CreativeOrchestrationPlan {
  const campaignId = safeId(input.campaignId, "campaignId");
  const brief = assertCreativeBrief(input.brief);
  assertConfirmedTruthBinding({ campaignId, brief, snapshot: input.truthSnapshot });

  const profile = getCreativeClientProfile(brief.clientId);
  const theme = getCreativeBrandTheme(brief.clientId, brief.brandId);
  const layoutProvider = getCreativeLayoutProvider(brief.clientId);
  if (!profile.brands[brief.brandId]) {
    throw new Error(`ORCHESTRATION_BRAND_PROFILE_MISSING: ${brief.clientId}/${brief.brandId}.`);
  }
  if (brief.brandKitId !== profile.defaultBrandKitId) {
    throw new Error("ORCHESTRATION_BRAND_KIT_MISMATCH: CreativeBrief brand kit is not the registered client brand kit.");
  }
  if (layoutProvider.clientId !== brief.clientId) {
    throw new Error("ORCHESTRATION_LAYOUT_PROVIDER_MISMATCH: layout provider belongs to a different client.");
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("ORCHESTRATION_CREATED_AT_INVALID.");
  const planId = safeId(
    `${campaignId}.orchestration.${input.truthSnapshot.sessionId}.${brief.id}`,
    "orchestrationId",
  );

  return {
    schemaVersion: 1,
    id: planId,
    campaignId,
    briefId: brief.id,
    clientId: brief.clientId,
    brandId: brief.brandId,
    truthSnapshotId: brief.truthSnapshotId,
    truthConfirmation: {
      sessionId: input.truthSnapshot.sessionId,
      confirmedBy: input.truthSnapshot.confirmedBy,
      confirmedAt: input.truthSnapshot.confirmedAt,
      confirmedFactLabels: [...new Set(input.truthSnapshot.facts.map((fact) => fact.label))],
    },
    brandContext: {
      clientDisplayName: profile.displayName,
      brandDisplayName: theme.displayName,
      brandKitId: brief.brandKitId,
      approvedLogoAssetId: theme.approvedLogoAsset.assetId,
      typographyMode: "NATIVE_EDITABLE",
      logoPolicy: "APPROVED_SOURCE_ONLY",
      layoutProviderClientId: layoutProvider.clientId,
      availableLayoutCount: layoutProvider.list(brief.brandId).length,
    },
    creativeStrategy: {
      goal: brief.goal,
      description: brief.description,
      audience: [...brief.audience],
      vibe: [...brief.vibe],
      format: { ...brief.format },
      contentRequirements: { ...brief.contentRequirements },
      ...(brief.product ? { product: { ...brief.product } } : {}),
      ...(brief.branchId ? { branchId: brief.branchId } : {}),
      ...(brief.salesChannel ? { salesChannel: brief.salesChannel } : {}),
    },
    execution: {
      strategyFirst: true,
      specialistExecution: "PARALLEL_WHERE_INDEPENDENT",
      specialistTasks: specialistTasks(brief),
      creativeDirectorReviewRequired: true,
      deterministicQaRequired: true,
    },
    productionGuards: {
      confirmedTruthOnly: true,
      nativeTypographyRequired: true,
      approvedLogoOnly: true,
      deterministicLayoutRequired: true,
      generatedMediaCannotBecomeVerifiedProductVisual: true,
      creativeDirectorReviewRequired: true,
    },
    status: "READY_FOR_GOVERNED_PRODUCTION",
    createdAt,
  };
}

export function assertCreativeOrchestrationPlan(value: CreativeOrchestrationPlan): CreativeOrchestrationPlan {
  if (value.schemaVersion !== 1) throw new Error("CREATIVE_ORCHESTRATION_INVALID: schemaVersion must be 1.");
  safeId(value.id, "orchestrationId");
  safeId(value.campaignId, "campaignId");
  safeId(value.briefId, "briefId");
  if (!value.clientId.trim() || !value.brandId.trim() || !value.truthSnapshotId.trim()) {
    throw new Error("CREATIVE_ORCHESTRATION_INVALID: client, brand and truth snapshot bindings are required.");
  }
  if (value.status !== "READY_FOR_GOVERNED_PRODUCTION") {
    throw new Error("CREATIVE_ORCHESTRATION_INVALID: plan is not ready for governed production.");
  }
  if (value.execution.specialistTasks.length !== 3) {
    throw new Error("CREATIVE_ORCHESTRATION_INVALID: exactly three core specialist responsibilities are required.");
  }
  const roles = new Set(value.execution.specialistTasks.map((task) => task.role));
  if (!roles.has("COPY_CONTENT") || !roles.has("ASSET_DIRECTION") || !roles.has("LAYOUT_ART_DIRECTION")) {
    throw new Error("CREATIVE_ORCHESTRATION_INVALID: core specialist responsibilities are incomplete.");
  }
  if (!value.productionGuards.confirmedTruthOnly
    || !value.productionGuards.nativeTypographyRequired
    || !value.productionGuards.approvedLogoOnly
    || !value.productionGuards.deterministicLayoutRequired
    || !value.productionGuards.generatedMediaCannotBecomeVerifiedProductVisual
    || !value.productionGuards.creativeDirectorReviewRequired) {
    throw new Error("CREATIVE_ORCHESTRATION_INVALID: production governance cannot be weakened.");
  }
  return value;
}
