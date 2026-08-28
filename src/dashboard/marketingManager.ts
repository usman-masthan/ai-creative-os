import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { AiTraceSession, readAiTrace } from "../aiTrace.js";
import type { BrandGovernance } from "../brandGovernance.js";
import {
  answerConfirmedCampaignTask,
  prepareConfirmedCampaignTask,
  runConfirmedCampaignTask,
} from "../commands/runConfirmedCampaignTask.js";
import { producePoster } from "../commands/producePoster.js";
import { GeminiFinalArtQaProvider } from "../finalArtQa/gemini.js";
import { GeminiImageProvider } from "../imageProviders/gemini.js";
import { FileCampaignStore } from "../operations/fileStore.js";
import { CampaignWorkflow } from "../operations/workflow.js";
import { createGeminiCampaignProvider } from "../providers/gemini.js";
import type { TaskTruthAnswer, TaskTruthSnapshot } from "../taskTruth.js";
import {
  WORKSPACE_PRODUCTION_PROFILE,
  assertWorkspaceProductionTruth,
  assertWorkspaceProductPhotoApproval,
  assertWorkspaceUploadedAssetMatchesTask,
  buildWorkspaceVisualQaContext,
  coerceWorkspaceTruthAnswers,
  type WorkspaceUploadedAsset,
} from "./workspaceProduction.js";
import { GeminiVisualQaProvider } from "../visualQa/gemini.js";
import {
  ATTHAS_BRANCH_OPTIONS,
  interpretAtthasTaskRequest,
  normalizeAtthasTaskIntent,
  type AtthasTaskIntent,
} from "../ui/taskIntent.js";
import {
  loadAtthasStoredTruth,
  RuntimeTruthStore,
} from "../ui/runtimeTruthStore.js";
import { marketingManagerHtml } from "./marketingManagerHtml.js";

const CAMPAIGN_TYPES = [
  "PRODUCT_PUSH",
  "DINE_IN",
  "DELIVERY",
  "BRAND_BUILDING",
  "ENGAGEMENT",
  "SEASONAL",
  "OFFER",
] as const;

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function sendHtml(res: ServerResponse, value: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(value);
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 22 * 1024 * 1024) throw new Error("Request body exceeds 22 MB limit.");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function boolValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function safeId(value: string, name: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(trimmed)) throw new Error(`${name} contains unsafe characters.`);
  return trimmed;
}

function parseIntent(value: unknown, rawRequest?: string): AtthasTaskIntent {
  if (!value || typeof value !== "object") {
    if (!rawRequest) throw new Error("intent is required.");
    return interpretAtthasTaskRequest(rawRequest);
  }
  const data = value as Record<string, unknown>;
  const request = typeof data.rawRequest === "string" && data.rawRequest.trim()
    ? data.rawRequest.trim()
    : stringValue(rawRequest, "request");
  const inferred = interpretAtthasTaskRequest(request);
  return {
    ...inferred,
    ...(data.brandId === "ATTHAS_BURGER" || data.brandId === "ATTHAS_RESTAURANT"
      ? { brandId: data.brandId }
      : {}),
    ...(typeof data.branchScope === "string" && data.branchScope.trim()
      ? { branchScope: data.branchScope.trim() }
      : {}),
    ...(typeof data.campaignType === "string" && CAMPAIGN_TYPES.includes(data.campaignType as (typeof CAMPAIGN_TYPES)[number])
      ? { campaignType: data.campaignType as (typeof CAMPAIGN_TYPES)[number] }
      : {}),
    objective: typeof data.objective === "string" ? data.objective : inferred.objective,
    audience: typeof data.audience === "string" ? data.audience : inferred.audience,
    channel: typeof data.channel === "string" ? data.channel : inferred.channel,
    assetType: typeof data.assetType === "string" ? data.assetType : inferred.assetType,
    ...(typeof data.productId === "string" && data.productId.trim()
      ? { productId: data.productId.trim() }
      : { productId: inferred.productId }),
    ...(typeof data.salesChannel === "string" && data.salesChannel.trim()
      ? { salesChannel: data.salesChannel.trim() }
      : { salesChannel: inferred.salesChannel }),
    showPrice: boolValue(data.showPrice, inferred.showPrice),
    mode: data.mode === "FINAL" ? "FINAL" : "DRAFT",
  };
}

async function loadBrandProductionContext(repoRoot: string, brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT") {
  const brandRulesPath = brandId === "ATTHAS_BURGER"
    ? "clients/T001-atthas/brands/burger/rules.md"
    : "clients/T001-atthas/brands/restaurant/rules.md";
  const [brandRules, masterPositioning, governanceRaw] = await Promise.all([
    readFile(join(repoRoot, brandRulesPath), "utf8"),
    readFile(join(repoRoot, "clients/T001-atthas/brands/master/positioning.md"), "utf8"),
    readFile(join(repoRoot, "clients/T001-atthas/brands/master/governance.json"), "utf8"),
  ]);
  return {
    brandContext: `${masterPositioning}\n\n${brandRules}`,
    brandGovernance: JSON.parse(governanceRaw) as BrandGovernance,
  };
}

function answerArray(value: unknown): TaskTruthAnswer[] {
  if (!Array.isArray(value)) throw new Error("answers must be an array.");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Each task truth answer must be an object.");
    const record = item as Record<string, unknown>;
    const action = record.action;
    if (action !== "CONFIRM" && action !== "PROVIDE" && action !== "REPLACE") {
      throw new Error("Invalid task truth answer action.");
    }
    return {
      label: stringValue(record.label, "answer.label"),
      action,
      ...(record.value !== undefined ? { value: record.value } : {}),
      updateStoredTruth: record.updateStoredTruth === true,
    };
  });
}

function snapshotValue(value: unknown): TaskTruthSnapshot {
  if (!value || typeof value !== "object") throw new Error("taskTruthSnapshot is required.");
  return value as TaskTruthSnapshot;
}

function mimeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png": return "image/png";
    case ".webp": return "image/webp";
    case ".html": return "text/html; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    default: return "image/jpeg";
  }
}

function mediaUrl(campaignId: string, path: string): string {
  return `/media/${encodeURIComponent(campaignId)}/${encodeURIComponent(path.split(/[\\/]/).at(-1) ?? "poster.png")}`;
}

async function persistProducedCampaign(input: {
  store: FileCampaignStore;
  workflow: CampaignWorkflow;
  campaignId: string;
  snapshot: TaskTruthSnapshot;
  production: Awaited<ReturnType<typeof runConfirmedCampaignTask>>;
}): Promise<void> {
  if (input.production.status !== "TASK_CONFIRMED_AND_PRODUCED") return;
  const result = input.production.production;
  if (result.status !== "DRAFT_RENDERED" && result.status !== "FINAL_RENDERED") return;

  const truthVersion = `TASK:${input.snapshot.sessionId}`;
  const brandVersion = "ATTHAS_WORKING_V1";
  let campaign = await input.store.getCampaign(input.campaignId);
  if (!campaign) {
    campaign = await input.workflow.create({
      campaignId: input.campaignId,
      brandId: result.campaign.preflight.facts.some((fact) => fact.key.includes("RESTAURANT"))
        ? "ATTHAS_RESTAURANT"
        : input.snapshot.brandId as "ATTHAS_BURGER" | "ATTHAS_RESTAURANT",
      ...(input.snapshot.branchId ? { branchId: input.snapshot.branchId } : {}),
      truthVersion,
      brandVersion,
      selectedConceptId: result.campaign.creative.recommendedConceptId,
    });
  }
  if (campaign.truthVersion !== truthVersion) {
    throw new Error("Campaign already exists with a different task-truth version. Start a new campaign task.");
  }

  const assetId = randomUUID();
  const revision = campaign.currentRevision + 1;
  await input.workflow.addAsset({
    assetId,
    campaignId: input.campaignId,
    revision,
    kind: "poster",
    path: result.poster.pngPath,
    channel: result.campaign.production.format.channel,
    assetType: result.campaign.production.format.assetType,
    truthVersion,
    brandVersion,
    createdAt: new Date().toISOString(),
    metadata: {
      layoutId: result.poster.layout.id,
      productionStatus: result.status,
    },
  });
  await input.workflow.addRevision({
    campaignId: input.campaignId,
    createdBy: input.snapshot.confirmedBy,
    summary: `${result.status} from task-confirmed truth snapshot.`,
    assetIds: [assetId],
    ...(result.visualQa ? { visualQaDecision: result.visualQa.decision } : {}),
    ...(result.poster.finalArtQa ? { finalArtQaDecision: result.poster.finalArtQa.decision } : {}),
  });

  for (const attempt of result.imageAttempts) {
    if (attempt.costUsd === undefined) continue;
    await input.workflow.addSpend({
      spendId: randomUUID(),
      campaignId: input.campaignId,
      createdAt: new Date().toISOString(),
      category: "image",
      provider: attempt.provider,
      model: attempt.model,
      amountUsd: attempt.costUsd,
      description: `Image attempt ${attempt.attempt}`,
    });
  }

  if (result.status === "FINAL_RENDERED" && campaign.state === "DRAFT") {
    await input.workflow.transition({
      campaignId: input.campaignId,
      to: "INTERNAL_REVIEW",
      actorId: "marketing-manager-workspace",
      actorRole: "system",
      note: "Final + QA output rendered successfully and is ready for human internal review.",
    });
  }
}

export interface MarketingManagerHandlerOptions {
  rootDir?: string;
  repoRoot?: string;
}

export function createMarketingManagerHandler(options: MarketingManagerHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const runtimeTruth = new RuntimeTruthStore(rootDir);
  const campaignStore = new FileCampaignStore(rootDir);
  const workflow = new CampaignWorkflow(campaignStore);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/workspace") {
      sendHtml(res, marketingManagerHtml());
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/ui/bootstrap") {
      const truth = await loadAtthasStoredTruth({ repoRoot, runtimeStore: runtimeTruth });
      const campaigns = await campaignStore.listCampaigns();
      sendJson(res, 200, {
        branches: ATTHAS_BRANCH_OPTIONS,
        campaignTypes: CAMPAIGN_TYPES,
        channels: ["instagram", "facebook", "whatsapp"],
        assetTypes: ["poster", "story", "reel-cover", "status"],
        salesChannels: ["DINE_IN", "TAKEAWAY", "UBER_EATS", "PICKME"],
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        paidMediaAllowed: process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true",
        productionProfile: WORKSPACE_PRODUCTION_PROFILE,
        storedTruthCount: truth.records.length,
        runtimeTruthCount: truth.runtimeRecords.length,
        campaigns,
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/ui/truth") {
      const truth = await loadAtthasStoredTruth({ repoRoot, runtimeStore: runtimeTruth });
      sendJson(res, 200, truth);
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/ui/trace") {
      const campaignId = safeId(url.searchParams.get("campaignId") ?? "", "campaignId");
      try {
        const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
        sendJson(res, 200, trace);
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
        if (code === "ENOENT") {
          sendJson(res, 404, { error: "No AI trace exists for this campaign. Produce it again with AI Trace enabled." });
        } else {
          throw error;
        }
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/ui/interpret") {
      const data = await readBody(req);
      const intent = interpretAtthasTaskRequest(stringValue(data.request, "request"));
      sendJson(res, 200, intent);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/ui/prepare") {
      const data = await readBody(req);
      const intent = parseIntent(data.intent, typeof data.request === "string" ? data.request : undefined);
      const normalized = normalizeAtthasTaskIntent(intent);
      const campaignId = safeId(
        typeof data.campaignId === "string" && data.campaignId.trim()
          ? data.campaignId
          : `ATTHAS-UI-${Date.now()}-${randomUUID().slice(0, 8)}`,
        "campaignId",
      );
      const sessionId = safeId(
        typeof data.sessionId === "string" && data.sessionId.trim()
          ? data.sessionId
          : `task-${randomUUID()}`,
        "sessionId",
      );
      const truth = await loadAtthasStoredTruth({ repoRoot, runtimeStore: runtimeTruth });
      const questionnaire = prepareConfirmedCampaignTask({
        campaignId,
        entry: normalized.entry,
        truthRecords: truth.records,
        requirementScopes: normalized.requirementScopes,
        sessionId,
      });
      sendJson(res, 200, {
        campaignId,
        sessionId,
        intent: normalized.intent,
        entry: normalized.entry,
        requirementScopes: normalized.requirementScopes,
        questionnaire,
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/ui/confirm") {
      const data = await readBody(req);
      const campaignId = safeId(stringValue(data.campaignId, "campaignId"), "campaignId");
      const sessionId = safeId(stringValue(data.sessionId, "sessionId"), "sessionId");
      const intent = parseIntent(data.intent);
      const normalized = normalizeAtthasTaskIntent(intent);
      const truth = await loadAtthasStoredTruth({ repoRoot, runtimeStore: runtimeTruth });
      const questionnaire = prepareConfirmedCampaignTask({
        campaignId,
        entry: normalized.entry,
        truthRecords: truth.records,
        requirementScopes: normalized.requirementScopes,
        sessionId,
      });
      const snapshot = answerConfirmedCampaignTask({
        questionnaire,
        answers: coerceWorkspaceTruthAnswers(questionnaire, answerArray(data.answers)),
        confirmedBy: stringValue(data.confirmedBy, "confirmedBy"),
      });
      const writeBacks = await runtimeTruth.writeBackRequested(snapshot);
      sendJson(res, 200, { snapshot, writeBacks });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/ui/upload") {
      const data = await readBody(req);
      const sessionId = safeId(stringValue(data.sessionId, "sessionId"), "sessionId");
      const campaignId = safeId(stringValue(data.campaignId, "campaignId"), "campaignId");
      const brandId = data.brandId === "ATTHAS_BURGER" || data.brandId === "ATTHAS_RESTAURANT"
        ? data.brandId
        : undefined;
      if (!brandId) throw new Error("A valid operating brand is required for image upload.");
      const branchId = typeof data.branchId === "string" && data.branchId.trim()
        ? safeId(data.branchId.trim(), "branchId")
        : undefined;
      const productId = typeof data.productId === "string" && data.productId.trim()
        ? data.productId.trim()
        : undefined;
      const filename = stringValue(data.filename, "filename").slice(0, 180);
      const approvedForAds = data.approvedForAds === true;
      const appearanceVerified = data.appearanceVerified === true;
      const ingredientMatchVerified = data.ingredientMatchVerified === true;
      assertWorkspaceProductPhotoApproval({
        ...(productId ? { productId } : {}),
        approvedForAds,
        appearanceVerified,
        ingredientMatchVerified,
      });
      const dataUrl = stringValue(data.dataUrl, "dataUrl");
      const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
      if (!match) throw new Error("Only PNG, JPEG and WebP image uploads are supported.");
      const bytes = Buffer.from(match[2]!, "base64");
      if (bytes.length < 1_000) throw new Error("Uploaded image is unexpectedly small.");
      if (bytes.length > 15 * 1024 * 1024) throw new Error("Uploaded image exceeds 15 MB limit.");
      const extension = match[1] === "image/png" ? ".png" : match[1] === "image/webp" ? ".webp" : ".jpg";
      const dir = join(rootDir, "uploads", sessionId);
      await mkdir(dir, { recursive: true });
      const assetId = safeId(`asset-${randomUUID()}`, "assetId");
      const path = join(dir, `${assetId}${extension}`);
      await writeFile(path, bytes);
      const asset: WorkspaceUploadedAsset = {
        schemaVersion: 1,
        assetId,
        sessionId,
        campaignId,
        filename,
        path,
        mimeType: match[1] as WorkspaceUploadedAsset["mimeType"],
        bytes: bytes.length,
        brandId,
        ...(branchId ? { branchId } : {}),
        ...(productId ? { productId } : {}),
        sourceType: "owner_supplied",
        approvedForAds,
        appearanceVerified,
        ingredientMatchVerified,
        createdAt: new Date().toISOString(),
      };
      await writeFile(join(dir, `${assetId}.json`), JSON.stringify(asset, null, 2), "utf8");
      sendJson(res, 201, asset);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/ui/produce") {
      const data = await readBody(req);
      if (!process.env.GEMINI_API_KEY?.trim()) {
        throw new Error("GEMINI_API_KEY is required before the workspace can generate a campaign.");
      }
      const campaignId = safeId(stringValue(data.campaignId, "campaignId"), "campaignId");
      const sessionId = safeId(stringValue(data.sessionId, "sessionId"), "sessionId");
      const intent = parseIntent(data.intent);
      const normalized = normalizeAtthasTaskIntent(intent);
      const snapshot = snapshotValue(data.taskTruthSnapshot);
      const truth = await loadAtthasStoredTruth({ repoRoot, runtimeStore: runtimeTruth });
      const mode = data.mode === "FINAL" ? "FINAL" : "DRAFT";
      const assetId = typeof data.baseImageAssetId === "string" && data.baseImageAssetId.trim()
        ? safeId(data.baseImageAssetId.trim(), "baseImageAssetId")
        : undefined;
      let uploadedAsset: WorkspaceUploadedAsset | undefined;
      let baseImagePath: string | undefined;
      if (assetId) {
        const assetPath = join(rootDir, "uploads", sessionId, `${assetId}.json`);
        uploadedAsset = JSON.parse(await readFile(assetPath, "utf8")) as WorkspaceUploadedAsset;
        assertWorkspaceUploadedAssetMatchesTask({
          asset: uploadedAsset,
          campaignId,
          sessionId,
          brandId: normalized.intent.brandId,
          ...(normalized.intent.branchScope !== "BRAND_WIDE" ? { branchId: normalized.intent.branchScope } : {}),
          ...(normalized.intent.productId ? { productId: normalized.intent.productId } : {}),
        });
        baseImagePath = resolve(uploadedAsset.path);
        const uploadRoot = resolve(rootDir, "uploads", sessionId) + sep;
        if (!baseImagePath.startsWith(uploadRoot)) {
          throw new Error("Workspace base images must come from the governed task upload area.");
        }
        await readFile(baseImagePath);
      }
      assertWorkspaceProductionTruth({
        snapshot,
        campaignType: normalized.intent.campaignType,
        ...(uploadedAsset ? { uploadedAsset } : {}),
      });
      const paidMediaAllowed = process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true";
      if (!baseImagePath && !paidMediaAllowed) {
        throw new Error("Upload a product/base image or explicitly set ALLOW_PAID_MEDIA=true for AI image generation.");
      }

      const brand = await loadBrandProductionContext(repoRoot, normalized.intent.brandId);
      const outputDir = join(rootDir, "outputs", campaignId);
      const trace = new AiTraceSession(campaignId);
      trace.setRequest({
        campaignId,
        sessionId,
        rawRequest: intent.rawRequest,
        mode,
        entry: normalized.entry,
      });
      trace.setIntent(normalized.intent);
      trace.setTruth({
        requiredTruth: normalized.entry.requiredTruth,
        requirementScopes: normalized.requirementScopes,
        snapshot,
      });

      const generationProvider = createGeminiCampaignProvider({ role: "default" });
      const directorProvider = createGeminiCampaignProvider({ role: "creative" });
      const finalizerProvider = createGeminiCampaignProvider({ role: "default" });
      const generation = trace.wrapCampaignProvider("strategist", generationProvider);
      const director = trace.wrapCampaignProvider("creativeDirector", directorProvider);
      const finalizer = trace.wrapCampaignProvider("finalizer", finalizerProvider);

      const imageProvider = !baseImagePath && mode !== "FINAL"
        ? new GeminiImageProvider({ role: "draft" })
        : undefined;
      const image = imageProvider ? trace.wrapImageProvider(imageProvider) : undefined;
      const imageTiers = !baseImagePath && mode === "FINAL"
        ? {
            FLASH_LITE: trace.wrapImageProvider(new GeminiImageProvider({ role: "draft" })),
            FLASH: trace.wrapImageProvider(new GeminiImageProvider({ role: "production" })),
            PRO: trace.wrapImageProvider(new GeminiImageProvider({ role: "premium" })),
          }
        : undefined;
      if (baseImagePath) {
        trace.markSkipped("image", `Approved/local base image supplied: ${baseImagePath}`);
      }

      const visualQaProvider = mode === "FINAL" ? new GeminiVisualQaProvider() : undefined;
      const visualQa = visualQaProvider ? trace.wrapVisualQaProvider(visualQaProvider) : undefined;
      if (mode !== "FINAL") trace.markSkipped("visualQa", "DRAFT mode does not run visual QA.");

      const finalArtQaProvider = mode === "FINAL" ? new GeminiFinalArtQaProvider() : undefined;
      const finalArtQa = finalArtQaProvider ? trace.wrapFinalArtQaProvider(finalArtQaProvider) : undefined;
      if (mode !== "FINAL") trace.markSkipped("finalArtQa", "DRAFT mode does not run final-art QA.");

      try {
        const result = await runConfirmedCampaignTask({
          sessionId,
          taskTruthSnapshot: snapshot,
          productionRequest: {
            campaignId,
            entry: normalized.entry,
            truthRecords: truth.records,
            requirementScopes: normalized.requirementScopes,
            brandContext: brand.brandContext,
            brandGovernance: brand.brandGovernance,
            outputDir,
            mode,
            featureFlags: WORKSPACE_PRODUCTION_PROFILE,
            providers: {
              generation,
              director,
              finalizer,
              ...(image ? { image } : {}),
              ...(imageTiers ? { imageTiers } : {}),
              ...(visualQa ? { visualQa } : {}),
            },
            ...(baseImagePath ? { baseImagePath } : {}),
            ...(mode === "FINAL"
              ? {
                  visualQaContext: (() => {
                    const context = buildWorkspaceVisualQaContext({
                      campaignType: normalized.intent.campaignType,
                      snapshot,
                      ...(uploadedAsset ? { uploadedAsset } : {}),
                    });
                    return {
                      ...context,
                      mustNotInclude: [
                        ...(context.mustNotInclude ?? []),
                        "generated ATTHA'S signage",
                        "generated menu text",
                        "unconfirmed product ingredients or product presentation",
                      ],
                    };
                  })(),
                }
              : {}),
            posterProducer: async (request) => {
              trace.recordRendererStart({
                campaignId: request.campaignId,
                brandId: request.brandId,
                layoutId: request.layoutId,
                baseImagePath: request.baseImagePath,
                outputDir: request.outputDir,
                overlaySpec: request.campaign.creative.overlaySpec,
                format: request.campaign.production.format,
              });
              try {
                const poster = await producePoster({
                  ...request,
                  ...(finalArtQa ? { finalArtQa: { provider: finalArtQa } } : {}),
                });
                trace.recordRendererResult({
                  status: poster.status,
                  layout: poster.layout,
                  htmlPath: poster.htmlPath,
                  pngPath: poster.pngPath,
                  qa: poster.qa,
                  ...(poster.finalArtQa ? { finalArtQa: poster.finalArtQa } : {}),
                });
                return poster;
              } catch (error) {
                trace.recordRendererFailure(error);
                throw error;
              }
            },
          },
        });

        if (result.status === "TASK_CONFIRMED_AND_PRODUCED") {
          const production = result.production;
          if ("campaign" in production && production.campaign.status === "GENERATED") {
            trace.setStageSummary("strategist", production.campaign.generation);
            if ("creativeDirector" in production.campaign) {
              trace.setStageSummary("creativeDirector", {
                provider: production.campaign.creativeDirector.director,
                review: production.campaign.creativeDirector.review,
              });
              trace.setStageSummary("finalizer", {
                provider: production.campaign.creativeDirector.finalizer,
                finalization: production.campaign.creativeDirector.finalization,
                output: production.campaign.creative,
              });
            }
          }
          trace.setStageSummary("image", { attempts: production.imageAttempts });
          if ("visualQa" in production && production.visualQa) {
            trace.setStageSummary("visualQa", production.visualQa);
          }
        }

        await persistProducedCampaign({
          store: campaignStore,
          workflow,
          campaignId,
          snapshot,
          production: result,
        });

        trace.recordOutcome({
          taskStatus: result.status,
          productionStatus: result.status === "TASK_CONFIRMED_AND_PRODUCED"
            ? result.production.status
            : undefined,
        });
        await trace.persist(outputDir);

        let posterUrl: string | undefined;
        if (result.status === "TASK_CONFIRMED_AND_PRODUCED") {
          const production = result.production;
          if (production.status === "DRAFT_RENDERED" || production.status === "FINAL_RENDERED") {
            posterUrl = mediaUrl(campaignId, production.poster.pngPath);
          }
        }
        sendJson(res, 200, { ...result, ...(posterUrl ? { posterUrl } : {}), traceAvailable: true });
      } catch (error) {
        trace.recordFailure(error);
        await trace.persist(outputDir);
        throw error;
      }
      return true;
    }

    const mediaMatch = url.pathname.match(/^\/media\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && mediaMatch) {
      const campaignId = safeId(decodeURIComponent(mediaMatch[1]!), "campaignId");
      const file = safeId(decodeURIComponent(mediaMatch[2]!), "file");
      const outputRoot = resolve(rootDir, "outputs", campaignId);
      const path = resolve(outputRoot, file);
      if (!path.startsWith(outputRoot + sep)) throw new Error("Unsafe media path.");
      const bytes = await readFile(path);
      res.writeHead(200, {
        "content-type": mimeFor(path),
        "content-length": bytes.length,
        "cache-control": "no-store",
      });
      res.end(bytes);
      return true;
    }

    return false;
  };
}
