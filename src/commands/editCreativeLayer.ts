import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { applyDesignOperation } from "../designDocument/operations.js";
import type { DesignAssetRef, DesignDocument, DesignLayer } from "../designDocument/types.js";
import type { ImageDraftProvider, ImageDraftResult } from "../imageProviders/types.js";
import type { CampaignGenerationProvider } from "../providers/types.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

function selectedLayer(document: DesignDocument, layerId: string): DesignLayer {
  const layer = document.layers.find((candidate) => candidate.id === layerId);
  if (!layer) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${layerId}`);
  if (layer.locked) throw new Error(`DESIGN_LAYER_LOCKED: ${layerId}`);
  if (!layer.aiEditable) throw new Error(`AI_EDIT_NOT_ALLOWED: ${layerId}`);
  return layer;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1]!.trim() : trimmed;
}

function snapshotFacts(snapshot: TaskTruthSnapshot): string {
  return snapshot.facts
    .map((fact) => `${fact.key}: ${JSON.stringify(fact.value)}`)
    .join("\n");
}

function numberTokens(value: string): Set<string> {
  return new Set(value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []);
}

function allowedNumberTokens(snapshot: TaskTruthSnapshot, currentText: string): Set<string> {
  const allowed = numberTokens(currentText);
  for (const fact of snapshot.facts) {
    for (const token of numberTokens(JSON.stringify(fact.value))) allowed.add(token);
  }
  return allowed;
}

function assertNoInventedNumbers(output: string, snapshot: TaskTruthSnapshot, currentText: string): void {
  const allowed = allowedNumberTokens(snapshot, currentText);
  const invented = [...numberTokens(output)].filter((token) => !allowed.has(token));
  if (invented.length) {
    throw new Error(`FACT_GOVERNANCE_BLOCK: AI introduced unconfirmed numeric value(s): ${invented.join(", ")}.`);
  }
}

export async function editCreativeTextLayer(input: {
  document: DesignDocument;
  layerId: string;
  instruction: string;
  truthSnapshot: TaskTruthSnapshot;
  provider: CampaignGenerationProvider;
  timestamp?: string;
}): Promise<DesignDocument> {
  const layer = selectedLayer(input.document, input.layerId);
  if (layer.type !== "text") throw new Error("AI_TEXT_EDIT_REQUIRES_TEXT_LAYER.");
  if (layer.role === "price") throw new Error("FACT_GOVERNANCE_BLOCK: AI cannot rewrite the price layer.");
  if (!input.instruction.trim()) throw new Error("AI edit instruction is required.");

  const prompt = [
    "You are editing exactly one native text layer in a governed advertising design.",
    "Return JSON only in this exact shape: {\"text\":\"...\"}.",
    "Do not add prices, dates, discounts, ingredients, branch claims, contact details or any factual claim not explicitly present in CONFIRMED TASK TRUTH.",
    "Do not mention implementation details. Do not change any other layer.",
    `Layer role: ${layer.role}`,
    `Current text: ${JSON.stringify(layer.text)}`,
    `User instruction: ${input.instruction.trim()}`,
    "CONFIRMED TASK TRUTH:",
    snapshotFacts(input.truthSnapshot),
  ].join("\n");

  const raw = await input.provider.generate(prompt);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new Error("AI_TEXT_EDIT_INVALID_RESPONSE: provider did not return valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || typeof (parsed as { text?: unknown }).text !== "string") {
    throw new Error("AI_TEXT_EDIT_INVALID_RESPONSE: response must contain a text string.");
  }
  const text = (parsed as { text: string }).text.trim();
  if (!text) throw new Error("AI_TEXT_EDIT_INVALID_RESPONSE: rewritten text is blank.");
  const max = layer.role === "headline" ? 180 : layer.role === "cta" ? 80 : 600;
  if (text.length > max) throw new Error(`AI_TEXT_EDIT_INVALID_RESPONSE: ${layer.role} exceeds ${max} characters.`);
  assertNoInventedNumbers(text, input.truthSnapshot, layer.text);
  return applyDesignOperation(
    input.document,
    { type: "UPDATE_TEXT", layerId: input.layerId, text, actor: "ai" },
    input.timestamp,
  );
}

function extensionForMime(mimeType: string | undefined): string {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

async function persistImageResult(input: {
  result: ImageDraftResult;
  outputDir: string;
  filename: string;
  fetchFn: typeof fetch;
}): Promise<string> {
  await mkdir(input.outputDir, { recursive: true });
  const path = join(input.outputDir, `${input.filename}${extensionForMime(input.result.mimeType)}`);
  if (input.result.dataBase64) {
    const bytes = Buffer.from(input.result.dataBase64, "base64");
    if (bytes.length < 1_000) throw new Error("IMAGE_GENERATION_FAILED: generated image is unexpectedly small.");
    await writeFile(path, bytes);
    return path;
  }
  if (!input.result.imageUrl) throw new Error("IMAGE_GENERATION_FAILED: provider returned no image data.");
  const response = await input.fetchFn(input.result.imageUrl);
  if (!response.ok) throw new Error(`IMAGE_GENERATION_FAILED: download returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/")) throw new Error("IMAGE_GENERATION_FAILED: provider URL was not an image.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000) throw new Error("IMAGE_GENERATION_FAILED: downloaded image is unexpectedly small.");
  await writeFile(path, bytes);
  return path;
}

function approximateAspectRatio(document: DesignDocument): string {
  const ratio = document.artboard.width / document.artboard.height;
  if (Math.abs(ratio - 1) < 0.03) return "1:1";
  if (Math.abs(ratio - 0.8) < 0.04) return "4:5";
  if (Math.abs(ratio - 0.5625) < 0.04) return "9:16";
  if (Math.abs(ratio - 1.7778) < 0.06) return "16:9";
  return "4:5";
}

function assertImageLayerIsolation(document: DesignDocument, layer: DesignLayer): void {
  if (layer.type === "background") {
    const independentSubject = document.layers.some(
      (candidate) =>
        candidate.visible &&
        candidate.type === "image" &&
        candidate.id !== layer.id &&
        (candidate.id === "product-subject" || candidate.asset.visualTruthClass === "VERIFIED_PRODUCT_VISUAL"),
    );
    if (!independentSubject) {
      throw new Error(
        "LAYER_ISOLATION_REQUIRED: the current background contains or may contain the product. Segment the subject into its own layer before AI background replacement.",
      );
    }
  }
  if (layer.type === "image" && layer.asset.visualTruthClass === "VERIFIED_PRODUCT_VISUAL") {
    throw new Error(
      "VISUAL_TRUTH_BLOCK: AI replacement of a verified product visual is disabled. Preserve the verified subject and edit its surrounding layers instead.",
    );
  }
}

export async function editCreativeImageLayer(input: {
  document: DesignDocument;
  layerId: string;
  instruction: string;
  truthSnapshot: TaskTruthSnapshot;
  provider: ImageDraftProvider;
  outputDir: string;
  fetchFn?: typeof fetch;
  timestamp?: string;
}): Promise<{ document: DesignDocument; asset: DesignAssetRef; costUsd?: number }> {
  const layer = selectedLayer(input.document, input.layerId);
  if (layer.type !== "background" && layer.type !== "image") {
    throw new Error("AI_IMAGE_EDIT_REQUIRES_IMAGE_LAYER.");
  }
  assertImageLayerIsolation(input.document, layer);
  if (!input.instruction.trim()) throw new Error("AI edit instruction is required.");

  const prompt = [
    "Generate only the replacement visual asset for one isolated design layer.",
    "Do not render promotional text, prices, numbers, logos, signs, labels, menus or watermarks.",
    "Use believable lighting, natural materials, realistic shadows and restrained editorial art direction.",
    "Avoid plastic texture, fake HDR, glowing edges, oversaturation, floating objects, excessive particles, generic neon advertising and malformed food/product details.",
    `Selected layer: ${layer.name} (${layer.type}).`,
    `Edit instruction: ${input.instruction.trim()}`,
    "Confirmed facts are context only; do not create visible textual claims from them:",
    snapshotFacts(input.truthSnapshot),
  ].join("\n\n");

  const result = await input.provider.generate({
    prompt,
    aspectRatio: approximateAspectRatio(input.document),
    resolution: process.env.GEMINI_IMAGE_RESOLUTION?.trim() || "1K",
    outputFormat: "jpeg",
  });
  const outputDir = resolve(input.outputDir);
  const path = await persistImageResult({
    result,
    outputDir,
    filename: `ai-edit-${input.layerId}-v${input.document.version + 1}`,
    fetchFn: input.fetchFn ?? fetch,
  });
  const asset: DesignAssetRef = {
    assetId: `ai-${input.layerId}-v${input.document.version + 1}`,
    source: "generated",
    uri: path,
    mimeType: result.mimeType ?? "image/jpeg",
    visualTruthClass: "GENERIC_CONCEPT_VISUAL",
    generation: {
      provider: result.provider,
      model: result.model,
    },
  };
  const document = applyDesignOperation(
    input.document,
    { type: "REPLACE_ASSET", layerId: input.layerId, asset, actor: "ai" },
    input.timestamp,
  );
  return {
    document,
    asset,
    ...(result.costUsd !== undefined ? { costUsd: result.costUsd } : {}),
  };
}
