import { resolve } from "node:path";

import { readAiTrace, type AiTraceDocument } from "../aiTrace.js";
import type { CampaignCreativeOutput, CampaignProductionFormat } from "../creativeTypes.js";
import { findCreativeClientProfileForBrand, getCreativeBrandTheme } from "../creativeStudio/clientProfiles/registry.js";
import type { CreativeClientProfile, CreativeBrandTheme } from "../creativeStudio/clientProfiles/types.js";
import { getCreativeLayoutProvider } from "../creativeStudio/layoutProfiles/registry.js";
import type { DesignAssetRef, DesignDocument, VisualTruthClass } from "../designDocument/types.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import type { DesignCopyZone } from "../layoutEngine/resolver.js";
import { generateCreativeDesign } from "./generateCreativeDesign.js";

interface RendererTraceRequest {
  campaignId?: string;
  brandId?: string;
  layoutId?: string;
  baseImagePath?: string;
  format?: CampaignProductionFormat;
}

interface FinalizerSummary {
  output?: CampaignCreativeOutput;
}

interface TruthTrace {
  snapshot?: TaskTruthSnapshot;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function finalCreative(trace: AiTraceDocument): CampaignCreativeOutput {
  const summary = objectValue(trace.finalizer.summary) as FinalizerSummary | undefined;
  if (!summary?.output) {
    throw new Error("DESIGN_IMPORT_FAILED: AI trace does not contain the final governed creative output.");
  }
  return summary.output;
}

function rendererRequest(trace: AiTraceDocument): RendererTraceRequest {
  const call = [...trace.renderer.calls].reverse().find((candidate) => candidate.request);
  const request = objectValue(call?.request) as RendererTraceRequest | undefined;
  if (!request?.baseImagePath || !request.format) {
    throw new Error("DESIGN_IMPORT_FAILED: renderer trace is missing base image or format metadata.");
  }
  return request;
}

function truthSnapshot(trace: AiTraceDocument): TaskTruthSnapshot {
  const truth = objectValue(trace.truth) as TruthTrace | undefined;
  if (!truth?.snapshot) {
    throw new Error("DESIGN_IMPORT_FAILED: immutable task truth snapshot is missing from the AI trace.");
  }
  return truth.snapshot;
}

function confirmedValue(snapshot: TaskTruthSnapshot, key: string): unknown {
  return snapshot.facts.find((fact) => fact.key === key)?.value;
}

function visualTruth(snapshot: TaskTruthSnapshot, generated: boolean): VisualTruthClass {
  const approved = confirmedValue(snapshot, "approvedProductVisual");
  if (!generated && approved === "APPROVED_REAL_PRODUCT_PHOTO") return "VERIFIED_PRODUCT_VISUAL";
  if (generated && confirmedValue(snapshot, "productName")) return "CONSTRAINED_PRODUCT_GENERATION";
  return "GENERIC_CONCEPT_VISUAL";
}

function backgroundAsset(input: {
  trace: AiTraceDocument;
  snapshot: TaskTruthSnapshot;
  path: string;
}): DesignAssetRef {
  const generated = input.trace.image.calls.length > 0;
  const lastImage = input.trace.image.calls.at(-1);
  return {
    assetId: `campaign-base-${input.trace.campaignId}`,
    source: generated ? "generated" : "uploaded",
    uri: resolve(input.path),
    visualTruthClass: visualTruth(input.snapshot, generated),
    ...(generated
      ? {
          generation: {
            ...(lastImage?.provider ? { provider: lastImage.provider } : {}),
            ...(lastImage?.model ? { model: lastImage.model } : {}),
          },
        }
      : {}),
  };
}

function approvedLogoAsset(
  repoRoot: string,
  profile: CreativeClientProfile,
  theme: CreativeBrandTheme,
): DesignAssetRef {
  return {
    assetId: theme.approvedLogoAsset.assetId,
    source: "approved-brand",
    uri: resolve(repoRoot, profile.approvedAssetRoot, theme.approvedLogoAsset.relativePath),
    mimeType: theme.approvedLogoAsset.mimeType,
  };
}

export async function openCreativeStudioDesign(input: {
  campaignId: string;
  outputDir: string;
  repoRoot: string;
  designId?: string;
  creativeBriefId?: string;
  copyZone?: DesignCopyZone;
  createdAt?: string;
}): Promise<{ document: DesignDocument; truthSnapshot: TaskTruthSnapshot }> {
  const trace = await readAiTrace(input.outputDir);
  if (trace.campaignId !== input.campaignId) {
    throw new Error("DESIGN_IMPORT_FAILED: campaign ID does not match the persisted AI trace.");
  }
  const creative = finalCreative(trace);
  const renderer = rendererRequest(trace);
  const snapshot = truthSnapshot(trace);
  const brandId = renderer.brandId ?? snapshot.brandId;
  const profile = findCreativeClientProfileForBrand(brandId);
  const theme = getCreativeBrandTheme(profile.clientId, brandId);
  const layoutProvider = getCreativeLayoutProvider(profile.clientId);
  const layout = layoutProvider.select({
    brandId,
    creative,
    format: renderer.format!,
    ...(renderer.layoutId ? { preferredLayoutId: renderer.layoutId } : {}),
  });
  const document = generateCreativeDesign({
    designId: input.designId ?? `design-${input.campaignId}`,
    campaignId: input.campaignId,
    ...(input.creativeBriefId ? { creativeBriefId: input.creativeBriefId } : {}),
    truthSnapshotId: `task:${snapshot.sessionId}`,
    clientId: profile.clientId,
    brandId,
    brandKitId: profile.defaultBrandKitId,
    creative,
    format: renderer.format!,
    layout,
    backgroundAsset: backgroundAsset({
      trace,
      snapshot,
      path: renderer.baseImagePath!,
    }),
    logoAsset: approvedLogoAsset(input.repoRoot, profile, theme),
    ...(input.copyZone ? { copyZone: input.copyZone } : {}),
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  });
  return { document, truthSnapshot: snapshot };
}
