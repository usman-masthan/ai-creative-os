import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve, sep } from "node:path";

import { readAiTrace } from "../aiTrace.js";
import { segmentCreativeSubject } from "../commands/segmentCreativeSubject.js";
import { runDesignQa } from "../creativeStudio/designQa.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { GeminiSubjectSegmentationProvider } from "../creativeStudio/segmentation/gemini.js";
import type { DesignAssetRef, DesignLayer } from "../designDocument/types.js";
import { FileCampaignStore } from "../operations/fileStore.js";
import { CampaignWorkflow } from "../operations/workflow.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 128 * 1024) throw new Error("Segmentation request exceeds 128 KB.");
    chunks.push(buffer);
  }
  return chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
    : {};
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function layerAsset(layer: DesignLayer): DesignAssetRef {
  if (layer.type === "image") return layer.asset;
  if (layer.type === "background" && layer.asset) return layer.asset;
  throw new Error("SEGMENTATION_REQUIRES_ASSET: selected layer has no image asset.");
}

function assetBytes(input: {
  asset: DesignAssetRef;
  rootDir: string;
}): Promise<{ bytes: Buffer; mimeType: string }> {
  const uri = input.asset.uri;
  if (!uri?.trim()) throw new Error("SEGMENTATION_REQUIRES_ASSET: selected layer has no runtime URI.");
  if (uri.startsWith("data:")) {
    const match = uri.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) throw new Error("SEGMENTATION_INPUT_INVALID: invalid image data URI.");
    return Promise.resolve({ bytes: Buffer.from(match[2]!, "base64"), mimeType: match[1]! });
  }
  const runtimeRoot = resolve(input.rootDir) + sep;
  const path = resolve(uri);
  if (!path.startsWith(runtimeRoot)) {
    throw new Error("SEGMENTATION_ASSET_BLOCK: only governed runtime campaign/design assets may be segmented.");
  }
  return readFile(path).then((bytes) => ({
    bytes,
    mimeType: input.asset.mimeType?.trim() || "image/jpeg",
  }));
}

function truthSnapshot(value: unknown): TaskTruthSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = (value as { snapshot?: unknown }).snapshot;
  return snapshot && typeof snapshot === "object" ? snapshot as TaskTruthSnapshot : undefined;
}

function truthValue(snapshot: TaskTruthSnapshot | undefined, key: string): string | undefined {
  const value = snapshot?.facts.find((fact) => fact.key === key)?.value;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioSegmentationHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioSegmentationHandler(options: CreativeStudioSegmentationHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const designStore = new FileDesignProjectStore(rootDir);
  const campaignStore = new FileCampaignStore(rootDir);
  const workflow = new CampaignWorkflow(campaignStore);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/segment") return false;
    if (!process.env.GEMINI_API_KEY?.trim()) {
      throw new Error("GEMINI_API_KEY is required for subject segmentation.");
    }
    if (process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() !== "true") {
      throw new Error("SEGMENTATION_DISABLED: set ALLOW_PAID_MEDIA=true before generative background repair.");
    }

    const data = await readBody(req);
    const designId = safeId(data.designId, "designId");
    const layerId = data.layerId === undefined ? "background" : safeId(data.layerId, "layerId");
    const project = await designStore.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const layer = project.document.layers.find((candidate) => candidate.id === layerId);
    if (!layer) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${layerId}`);
    if (layer.type !== "background" && layer.type !== "image") {
      throw new Error("SEGMENTATION_REQUIRES_IMAGE_LAYER.");
    }
    const asset = layerAsset(layer);
    const inputImage = await assetBytes({ asset, rootDir });
    if (!inputImage.mimeType.startsWith("image/")) {
      throw new Error("SEGMENTATION_INPUT_INVALID: selected asset is not an image.");
    }

    const trace = await readAiTrace(join(rootDir, "outputs", project.document.campaignId));
    const snapshot = truthSnapshot(trace.truth);
    const subjectHint = optionalString(data.subjectHint) ?? truthValue(snapshot, "productName");
    const provider = new GeminiSubjectSegmentationProvider();
    const document = await segmentCreativeSubject({
      document: project.document,
      layerId,
      imageBase64: inputImage.bytes.toString("base64"),
      mimeType: inputImage.mimeType,
      provider,
      outputDir: join(rootDir, "designs", designId, "assets"),
      ...(subjectHint ? { subjectHint } : {}),
    });
    const saved = await designStore.save(document);
    const qa = runDesignQa({ document: saved.document, ...(snapshot ? { truthSnapshot: snapshot } : {}) });
    await designStore.saveQa(designId, {
      checkedAt: qa.checkedAt,
      decision: qa.decision,
      issues: qa.issues,
    });

    if (provider.lastCostUsd !== undefined) {
      const campaign = await campaignStore.getCampaign(project.document.campaignId);
      if (campaign) {
        await workflow.addSpend({
          spendId: randomUUID(),
          campaignId: project.document.campaignId,
          createdAt: new Date().toISOString(),
          category: "image",
          provider: provider.providerName,
          model: provider.imageModel,
          amountUsd: provider.lastCostUsd,
          description: `Creative Studio subject separation for ${layerId}; foreground pixels preserved from original asset.`,
        });
      }
    }

    sendJson(res, 200, {
      designId,
      version: saved.document.version,
      subjectLayerId: "product-subject",
      sourcePixelsPreserved: true,
      backgroundRepairGenerated: true,
      ...(provider.lastCostUsd !== undefined ? { costUsd: provider.lastCostUsd } : {}),
      qa,
    });
    return true;
  };
}
