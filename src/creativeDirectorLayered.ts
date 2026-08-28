import type { CampaignGenerationProvider } from "./providers/types.js";
import type { DesignDocument } from "./designDocument/types.js";
import type { DesignQaResult } from "./creativeStudio/designQa.js";

export interface LayeredCreativeDirectorScores {
  hierarchy: number;
  composition: number;
  balance: number;
  typography: number;
  brandConsistency: number;
  productProminence: number;
  ctaProminence: number;
  readability: number;
  whitespace: number;
  visualDepth: number;
  colorHarmony: number;
  offerClarity: number;
  imageQuality: number;
  authenticity: number;
  aiArtifactSafety: number;
}

export interface LayeredCreativeDirectorIssue {
  severity: "low" | "medium" | "high";
  message: string;
  layerId?: string;
}

export interface LayeredCreativeDirectorReview {
  overallScore: number;
  scores: LayeredCreativeDirectorScores;
  issues: LayeredCreativeDirectorIssue[];
  recommendations: string[];
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1]!.trim() : trimmed;
}

function score(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) {
    throw new Error(`CREATIVE_DIRECTOR_INVALID: ${name} must be a number from 0 to 10.`);
  }
  return Math.round(value * 10) / 10;
}

function stringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`CREATIVE_DIRECTOR_INVALID: ${name} must be an array of non-empty strings.`);
  }
  return value.map((item) => String(item).trim());
}

function designSummary(document: DesignDocument): unknown {
  return {
    id: document.id,
    version: document.version,
    artboard: document.artboard,
    brand: document.brand,
    layoutId: document.layoutId,
    layers: document.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      type: layer.type,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      opacity: layer.opacity,
      zIndex: layer.zIndex,
      visible: layer.visible,
      locked: layer.locked,
      ...(layer.type === "text"
        ? {
            role: layer.role,
            text: layer.text,
            fontFamily: layer.fontFamily,
            fontSize: layer.fontSize,
            fontWeight: layer.fontWeight,
            lineHeight: layer.lineHeight,
            letterSpacing: layer.letterSpacing,
            align: layer.align,
            fill: layer.fill,
          }
        : {}),
      ...(layer.type === "image" || layer.type === "logo"
        ? { assetSource: layer.asset.source, visualTruthClass: layer.asset.visualTruthClass }
        : {}),
      ...(layer.type === "background" && layer.asset
        ? { assetSource: layer.asset.source, visualTruthClass: layer.asset.visualTruthClass }
        : {}),
    })),
  };
}

function parseReview(raw: string, document: DesignDocument): LayeredCreativeDirectorReview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new Error("CREATIVE_DIRECTOR_INVALID: review was not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("CREATIVE_DIRECTOR_INVALID: review must be an object.");
  const data = parsed as Record<string, unknown>;
  if (!data.scores || typeof data.scores !== "object") throw new Error("CREATIVE_DIRECTOR_INVALID: scores are required.");
  const scores = data.scores as Record<string, unknown>;
  const issuesRaw = data.issues;
  if (!Array.isArray(issuesRaw)) throw new Error("CREATIVE_DIRECTOR_INVALID: issues must be an array.");
  const knownLayerIds = new Set(document.layers.map((layer) => layer.id));
  const issues = issuesRaw.map((value): LayeredCreativeDirectorIssue => {
    if (!value || typeof value !== "object") throw new Error("CREATIVE_DIRECTOR_INVALID: each issue must be an object.");
    const item = value as Record<string, unknown>;
    if (item.severity !== "low" && item.severity !== "medium" && item.severity !== "high") {
      throw new Error("CREATIVE_DIRECTOR_INVALID: issue severity must be low, medium or high.");
    }
    if (typeof item.message !== "string" || !item.message.trim()) {
      throw new Error("CREATIVE_DIRECTOR_INVALID: issue message is required.");
    }
    if (item.layerId !== undefined && (typeof item.layerId !== "string" || !knownLayerIds.has(item.layerId))) {
      throw new Error(`CREATIVE_DIRECTOR_INVALID: issue references unknown layer ${String(item.layerId)}.`);
    }
    return {
      severity: item.severity,
      message: item.message.trim(),
      ...(typeof item.layerId === "string" ? { layerId: item.layerId } : {}),
    };
  });

  return {
    overallScore: score(data.overallScore, "overallScore"),
    scores: {
      hierarchy: score(scores.hierarchy, "scores.hierarchy"),
      composition: score(scores.composition, "scores.composition"),
      balance: score(scores.balance, "scores.balance"),
      typography: score(scores.typography, "scores.typography"),
      brandConsistency: score(scores.brandConsistency, "scores.brandConsistency"),
      productProminence: score(scores.productProminence, "scores.productProminence"),
      ctaProminence: score(scores.ctaProminence, "scores.ctaProminence"),
      readability: score(scores.readability, "scores.readability"),
      whitespace: score(scores.whitespace, "scores.whitespace"),
      visualDepth: score(scores.visualDepth, "scores.visualDepth"),
      colorHarmony: score(scores.colorHarmony, "scores.colorHarmony"),
      offerClarity: score(scores.offerClarity, "scores.offerClarity"),
      imageQuality: score(scores.imageQuality, "scores.imageQuality"),
      authenticity: score(scores.authenticity, "scores.authenticity"),
      aiArtifactSafety: score(scores.aiArtifactSafety, "scores.aiArtifactSafety"),
    },
    issues,
    recommendations: stringArray(data.recommendations, "recommendations"),
  };
}

export async function reviewLayeredDesignWithCreativeDirector(input: {
  document: DesignDocument;
  deterministicQa: DesignQaResult;
  provider: CampaignGenerationProvider;
}): Promise<LayeredCreativeDirectorReview> {
  const prompt = [
    "You are the existing AI Creative OS Creative Director reviewing the assembled structured design after layout and native typography have been applied.",
    "Review the design systemically; do not rewrite it and do not invent any new factual claims.",
    "Judge: visual hierarchy, composition, balance, typography, brand consistency, product prominence, CTA prominence, readability, whitespace, visual depth, color harmony, offer clarity, image quality, authenticity, and risk of obvious AI artifacts.",
    "Return JSON only with exactly these keys:",
    '{"overallScore":0,"scores":{"hierarchy":0,"composition":0,"balance":0,"typography":0,"brandConsistency":0,"productProminence":0,"ctaProminence":0,"readability":0,"whitespace":0,"visualDepth":0,"colorHarmony":0,"offerClarity":0,"imageQuality":0,"authenticity":0,"aiArtifactSafety":0},"issues":[{"severity":"low|medium|high","layerId":"optional-existing-layer-id","message":"..."}],"recommendations":["..."]}',
    "All scores are from 0 to 10. aiArtifactSafety is 10 when artifact risk is very low.",
    "Only reference a layerId that exists in DESIGN DOCUMENT.",
    "DETERMINISTIC QA:",
    JSON.stringify(input.deterministicQa),
    "DESIGN DOCUMENT:",
    JSON.stringify(designSummary(input.document)),
  ].join("\n\n");
  const raw = await input.provider.generate(prompt);
  return parseReview(raw, input.document);
}
