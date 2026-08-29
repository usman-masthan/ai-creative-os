import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, extname, join, resolve, sep } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import { editCreativeImageLayer, editCreativeTextLayer } from "../commands/editCreativeLayer.js";
import { openCreativeStudioDesign } from "../commands/openCreativeStudioDesign.js";
import { applyDesignOperation } from "../designDocument/operations.js";
import type { DesignAssetRef, DesignDocument, DesignLayer } from "../designDocument/types.js";
import { GeminiImageProvider } from "../imageProviders/gemini.js";
import { FileCampaignStore } from "../operations/fileStore.js";
import { CampaignWorkflow } from "../operations/workflow.js";
import { createGeminiCampaignProvider } from "../providers/gemini.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import { assertCreativeBrief, type CreativeBrief } from "../creativeStudio/contracts/creativeBrief.js";
import { runDesignQa, type DesignQaResult } from "../creativeStudio/designQa.js";
import { parseDesignOperation } from "../creativeStudio/operationValidation.js";
import {
  FileDesignProjectStore,
  type DesignProjectSnapshot,
} from "../creativeStudio/projectStore.js";
import {
  exportDesignDocumentPng,
  type DesignExportPreset,
} from "../creativeStudio/renderDesignDocument.js";
import { creativeStudioHtml } from "./creativeStudioHtml.js";

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
    if (bytes > 3 * 1024 * 1024) throw new Error("Creative Studio request exceeds 3 MB limit.");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function stringValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
}

function contentType(path: string, fallback?: string): string {
  if (fallback?.trim()) return fallback;
  switch (extname(path).toLowerCase()) {
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    case ".webp": return "image/webp";
    case ".html": return "text/html; charset=utf-8";
    default: return "image/jpeg";
  }
}

function layerAsset(layer: DesignLayer): DesignAssetRef | undefined {
  if (layer.type === "image" || layer.type === "logo") return layer.asset;
  if (layer.type === "background") return layer.asset;
  return undefined;
}

function clientDocument(document: DesignDocument): DesignDocument {
  return {
    ...document,
    layers: document.layers.map((layer): DesignLayer => {
      const uri = `/studio-asset/${encodeURIComponent(document.id)}/${encodeURIComponent(layer.id)}`;
      if (layer.type === "image" || layer.type === "logo") {
        return { ...layer, asset: { ...layer.asset, uri } };
      }
      if (layer.type === "background" && layer.asset) {
        return { ...layer, asset: { ...layer.asset, uri } };
      }
      return layer;
    }),
  };
}

function clientProject(project: DesignProjectSnapshot): Record<string, unknown> {
  return {
    ...project,
    document: clientDocument(project.document),
    exports: project.exports.map((record) => ({
      ...record,
      path: `/studio-media/${encodeURIComponent(project.document.id)}/${encodeURIComponent(basename(record.path))}`,
    })),
  };
}

function briefValue(value: unknown): CreativeBrief | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("brief must be an object.");
  return assertCreativeBrief(value as CreativeBrief);
}

function truthSnapshotFromTrace(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  if (!snapshot || typeof snapshot !== "object") return undefined;
  return snapshot as TaskTruthSnapshot;
}

async function campaignTruth(rootDir: string, campaignId: string): Promise<TaskTruthSnapshot> {
  const trace = await readAiTrace(join(rootDir, "outputs", campaignId));
  const snapshot = truthSnapshotFromTrace(trace.truth);
  if (!snapshot) throw new Error("TASK_TRUTH_SNAPSHOT_MISSING: cannot run governed Studio QA/editing.");
  return snapshot;
}

async function qaAndPersist(input: {
  store: FileDesignProjectStore;
  project: DesignProjectSnapshot;
  truth: TaskTruthSnapshot;
}): Promise<DesignQaResult> {
  const qa = runDesignQa({ document: input.project.document, truthSnapshot: input.truth });
  await input.store.saveQa(input.project.document.id, {
    checkedAt: qa.checkedAt,
    decision: qa.decision,
    issues: qa.issues,
  });
  return qa;
}

function exportPreset(value: unknown): DesignExportPreset {
  if (value === "high-resolution" || value === "4k") return value;
  return "standard";
}

function ensureAssetPath(input: {
  path: string;
  asset: DesignAssetRef;
  rootDir: string;
  repoRoot: string;
}): string {
  const path = resolve(input.path);
  if (input.asset.source === "approved-brand") {
    const approvedRoot = resolve(input.repoRoot, "clients/T001-atthas/assets") + sep;
    if (!path.startsWith(approvedRoot)) throw new Error("BRAND_ASSET_PATH_BLOCK: approved asset is outside the controlled brand asset directory.");
    return path;
  }
  const runtimeRoot = resolve(input.rootDir) + sep;
  if (!path.startsWith(runtimeRoot)) throw new Error("ASSET_PATH_BLOCK: runtime asset is outside Creative OS storage.");
  return path;
}

export interface CreativeStudioHandlerOptions {
  rootDir?: string;
  repoRoot?: string;
}

export function createCreativeStudioHandler(options: CreativeStudioHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const designStore = new FileDesignProjectStore(rootDir);
  const campaignStore = new FileCampaignStore(rootDir);
  const workflow = new CampaignWorkflow(campaignStore);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/studio") {
      sendHtml(res, creativeStudioHtml());
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/studio/bootstrap") {
      const [designs, campaigns] = await Promise.all([
        designStore.list(),
        campaignStore.listCampaigns(),
      ]);
      sendJson(res, 200, {
        designs,
        campaigns,
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        paidMediaAllowed: process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true",
        capabilities: {
          renderer: "DesignDocument HTML renderer",
          canvas: "native-svg",
          manualEditing: true,
          undoRedo: true,
          deterministicQa: true,
          aiTextEditing: true,
          aiImageEditing: "isolated-layers-only",
          segmentation: false,
          exportFormats: ["png"],
          exportPresets: ["standard", "high-resolution", "4k"],
        },
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/open") {
      const data = await readBody(req);
      const campaignId = safeId(data.campaignId, "campaignId");
      const designId = data.designId === undefined
        ? `design-${campaignId}`
        : safeId(data.designId, "designId");
      const existing = await designStore.get(designId);
      if (existing) {
        sendJson(res, 200, clientProject(existing));
        return true;
      }
      const brief = briefValue(data.brief);
      const opened = await openCreativeStudioDesign({
        campaignId,
        outputDir: join(rootDir, "outputs", campaignId),
        repoRoot,
        designId,
        ...(brief ? { creativeBriefId: brief.id } : {}),
      });
      let project = await designStore.create({
        document: opened.document,
        ...(brief ? { brief } : {}),
      });
      const qa = await qaAndPersist({ store: designStore, project, truth: opened.truthSnapshot });
      project = { ...project, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
      sendJson(res, 201, clientProject(project));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/studio/project") {
      const designId = safeId(url.searchParams.get("designId") ?? "", "designId");
      const project = await designStore.get(designId);
      if (!project) {
        sendJson(res, 404, { error: "design_not_found" });
        return true;
      }
      sendJson(res, 200, clientProject(project));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/operation") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await designStore.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const operation = parseDesignOperation(data.operation);
      const document = applyDesignOperation(project.document, { ...operation, actor: "human" });
      let saved = await designStore.save(document);
      const truth = await campaignTruth(rootDir, document.campaignId);
      const qa = await qaAndPersist({ store: designStore, project: saved, truth });
      saved = { ...saved, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
      sendJson(res, 200, clientProject(saved));
      return true;
    }

    if (req.method === "POST" && (url.pathname === "/api/studio/undo" || url.pathname === "/api/studio/redo")) {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      let project = url.pathname.endsWith("undo")
        ? await designStore.undo(designId)
        : await designStore.redo(designId);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const qa = await qaAndPersist({ store: designStore, project, truth });
      project = { ...project, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
      sendJson(res, 200, clientProject(project));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/qa") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await designStore.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const qa = await qaAndPersist({ store: designStore, project, truth });
      sendJson(res, 200, qa);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/export") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await designStore.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const qa = await qaAndPersist({ store: designStore, project, truth });
      if (qa.decision === "BLOCK") {
        throw new Error(`FINAL_QA_BLOCK: ${qa.issues.filter((item) => item.blocker).map((item) => item.message).join(" ")}`);
      }
      const preset = exportPreset(data.preset);
      const exported = await exportDesignDocumentPng({
        document: project.document,
        outputDir: join(rootDir, "designs", designId, "exports"),
        preset,
        ...(process.env.CHROME_PATH?.trim() ? { chromePath: process.env.CHROME_PATH.trim() } : {}),
      });
      await designStore.appendExport(designId, {
        exportedAt: new Date().toISOString(),
        format: "png",
        preset,
        path: exported.outputPath,
        width: exported.width,
        height: exported.height,
      });
      sendJson(res, 200, {
        ...exported,
        htmlPath: undefined,
        outputPath: `/studio-media/${encodeURIComponent(designId)}/${encodeURIComponent(basename(exported.outputPath))}`,
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/ai/text") {
      if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is required for AI text editing.");
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const layerId = safeId(data.layerId, "layerId");
      const instruction = stringValue(data.instruction, "instruction");
      const project = await designStore.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const document = await editCreativeTextLayer({
        document: project.document,
        layerId,
        instruction,
        truthSnapshot: truth,
        provider: createGeminiCampaignProvider({ role: "creative" }),
      });
      let saved = await designStore.save(document);
      const qa = await qaAndPersist({ store: designStore, project: saved, truth });
      saved = { ...saved, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
      sendJson(res, 200, clientProject(saved));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/ai/image") {
      if (!process.env.GEMINI_API_KEY?.trim()) throw new Error("GEMINI_API_KEY is required for AI image editing.");
      if (process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() !== "true") {
        throw new Error("IMAGE_GENERATION_DISABLED: set ALLOW_PAID_MEDIA=true before paid AI image editing.");
      }
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const layerId = safeId(data.layerId, "layerId");
      const instruction = stringValue(data.instruction, "instruction");
      const project = await designStore.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const truth = await campaignTruth(rootDir, project.document.campaignId);
      const edited = await editCreativeImageLayer({
        document: project.document,
        layerId,
        instruction,
        truthSnapshot: truth,
        provider: new GeminiImageProvider({ role: "draft" }),
        outputDir: join(rootDir, "designs", designId, "assets"),
      });
      let saved = await designStore.save(edited.document);
      if (edited.costUsd !== undefined) {
        const campaign = await campaignStore.getCampaign(project.document.campaignId);
        if (campaign) {
          await workflow.addSpend({
            spendId: randomUUID(),
            campaignId: project.document.campaignId,
            createdAt: new Date().toISOString(),
            category: "image",
            provider: "gemini",
            model: edited.asset.generation?.model ?? "configured-image-model",
            amountUsd: edited.costUsd,
            description: `Creative Studio AI edit for layer ${layerId}`,
          });
        }
      }
      const qa = await qaAndPersist({ store: designStore, project: saved, truth });
      saved = { ...saved, qa: { checkedAt: qa.checkedAt, decision: qa.decision, issues: qa.issues } };
      sendJson(res, 200, clientProject(saved));
      return true;
    }

    const assetMatch = url.pathname.match(/^\/studio-asset\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && assetMatch) {
      const designId = safeId(decodeURIComponent(assetMatch[1]!), "designId");
      const layerId = safeId(decodeURIComponent(assetMatch[2]!), "layerId");
      const project = await designStore.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const layer = project.document.layers.find((candidate) => candidate.id === layerId);
      if (!layer) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${layerId}`);
      const asset = layerAsset(layer);
      if (!asset?.uri) throw new Error(`ASSET_MISSING: ${layerId} has no asset URI.`);
      if (asset.uri.startsWith("data:")) {
        const match = asset.uri.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) throw new Error("Invalid data URI asset.");
        const bytes = Buffer.from(match[2]!, "base64");
        res.writeHead(200, { "content-type": match[1]!, "content-length": bytes.length, "cache-control": "no-store" });
        res.end(bytes);
        return true;
      }
      const path = ensureAssetPath({ path: asset.uri, asset, rootDir, repoRoot });
      const bytes = await readFile(path);
      res.writeHead(200, {
        "content-type": contentType(path, asset.mimeType),
        "content-length": bytes.length,
        "cache-control": "no-store",
      });
      res.end(bytes);
      return true;
    }

    const mediaMatch = url.pathname.match(/^\/studio-media\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && mediaMatch) {
      const designId = safeId(decodeURIComponent(mediaMatch[1]!), "designId");
      const file = safeId(decodeURIComponent(mediaMatch[2]!), "file");
      const exportRoot = resolve(rootDir, "designs", designId, "exports");
      const path = resolve(exportRoot, file);
      if (!path.startsWith(exportRoot + sep)) throw new Error("Unsafe Studio media path.");
      const bytes = await readFile(path);
      res.writeHead(200, {
        "content-type": contentType(path),
        "content-length": bytes.length,
        "cache-control": "no-store",
      });
      res.end(bytes);
      return true;
    }

    return false;
  };
}
