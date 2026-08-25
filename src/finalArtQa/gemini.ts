import { geminiTextModelForRole } from "../providers/geminiModels.js";
import {
  usageFromGenerateContent,
  type GeminiUsageTelemetry,
} from "../providers/geminiUsage.js";
import type {
  FinalArtQaDecision,
  FinalArtQaProvider,
  FinalArtQaRequest,
  FinalArtQaResult,
  FinalArtQaScores,
} from "./types.js";

interface GeminiFinalArtQaOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
}

const FINAL_ART_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: ["PASS", "REGENERATE", "HUMAN_REVIEW", "BLOCK"] },
    scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        legibility: { type: "number", minimum: 0, maximum: 100 },
        hierarchy: { type: "number", minimum: 0, maximum: 100 },
        safeArea: { type: "number", minimum: 0, maximum: 100 },
        contrast: { type: "number", minimum: 0, maximum: 100 },
        brandFit: { type: "number", minimum: 0, maximum: 100 },
        platformFit: { type: "number", minimum: 0, maximum: 100 },
      },
      required: ["legibility", "hierarchy", "safeArea", "contrast", "brandFit", "platformFit"],
    },
    issues: { type: "array", items: { type: "string" } },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["decision", "scores", "issues", "notes"],
} as const;

function extractText(body: GeminiResponse): string {
  return (body.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function numberScore(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Gemini final-art QA returned invalid ${name} score.`);
  }
  return value;
}

function parseScores(value: unknown): FinalArtQaScores {
  if (!value || typeof value !== "object") throw new Error("Gemini final-art QA returned invalid scores.");
  const scores = value as Record<string, unknown>;
  return {
    legibility: numberScore(scores.legibility, "legibility"),
    hierarchy: numberScore(scores.hierarchy, "hierarchy"),
    safeArea: numberScore(scores.safeArea, "safeArea"),
    contrast: numberScore(scores.contrast, "contrast"),
    brandFit: numberScore(scores.brandFit, "brandFit"),
    platformFit: numberScore(scores.platformFit, "platformFit"),
  };
}

function strings(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Gemini final-art QA returned invalid ${name}.`);
  }
  return value as string[];
}

function parseDecision(value: unknown): FinalArtQaDecision {
  if (value !== "PASS" && value !== "REGENERATE" && value !== "HUMAN_REVIEW" && value !== "BLOCK") {
    throw new Error("Gemini final-art QA returned invalid decision.");
  }
  return value;
}

function buildPrompt(request: FinalArtQaRequest): string {
  return [
    "You are reviewing the finished ATTHA’S advertising artwork, including deterministic text overlays.",
    "Inspect the supplied pixels. Check legibility, hierarchy, safe areas, contrast, brand fit and platform fit.",
    "Reject clipping, unreadable copy, bad line breaks, overlapping text, duplicate/generated text, weak CTA visibility, cropped price, unsafe edge placement or obvious spelling mismatch.",
    `Brand: ${request.brandId}`,
    `Layout: ${request.layoutId}`,
    `Platform: ${request.channel} ${request.assetType}`,
    `Expected dimensions: ${request.width}x${request.height}`,
    `Expected headline: ${request.expectedHeadline}`,
    `Expected supporting copy: ${request.expectedSupportingCopy}`,
    `Expected CTA: ${request.expectedCta}`,
    `Expected price: ${request.expectedPrice ?? "NONE"}`,
    `Approved logo expected: ${request.logoExpected ? "YES" : "NO"}`,
    "Do not approve artwork if expected customer-facing copy is visibly missing or materially altered.",
    "Return only JSON matching the schema.",
  ].join("\n");
}

function applyGuards(result: Omit<FinalArtQaResult, "provider" | "model" | "usage">) {
  let decision = result.decision;
  const issues = [...result.issues];
  const minimums: Array<[keyof FinalArtQaScores, number]> = [
    ["legibility", 80],
    ["safeArea", 80],
    ["contrast", 75],
    ["platformFit", 75],
    ["brandFit", 70],
  ];
  if (decision === "PASS") {
    for (const [key, min] of minimums) {
      if (result.scores[key] < min) {
        decision = "REGENERATE";
        issues.push(`${key} score ${result.scores[key]} is below required ${min}.`);
      }
    }
  }
  return { ...result, decision, issues: [...new Set(issues)] };
}

export class GeminiFinalArtQaProvider implements FinalArtQaProvider {
  readonly providerName = "gemini";
  readonly model: string;
  lastUsage: GeminiUsageTelemetry | undefined;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiFinalArtQaOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) throw new Error("GEMINI_API_KEY is required to use GeminiFinalArtQaProvider.");
    this.apiKey = apiKey.trim();
    this.model = options.model?.trim() || geminiTextModelForRole("advanced");
    this.baseUrl = options.baseUrl?.replace(/\/$/, "") ?? "https://generativelanguage.googleapis.com/v1beta";
    this.maxOutputTokens = options.maxOutputTokens ?? 1600;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async review(request: FinalArtQaRequest): Promise<FinalArtQaResult> {
    if (!request.imageBase64.trim()) throw new Error("Final-art QA requires imageBase64.");
    const response = await this.fetchImpl(
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: request.mimeType, data: request.imageBase64 } },
              { text: buildPrompt(request) },
            ],
          }],
          generationConfig: {
            maxOutputTokens: this.maxOutputTokens,
            responseFormat: { text: { mimeType: "application/json", schema: FINAL_ART_SCHEMA } },
          },
        }),
      },
    );
    let body: GeminiResponse;
    try {
      body = (await response.json()) as GeminiResponse;
    } catch {
      throw new Error(`Gemini final-art QA returned non-JSON (HTTP ${response.status}).`);
    }
    if (!response.ok) throw new Error(`Gemini final-art QA failed: ${body.error?.message ?? `HTTP ${response.status}`}`);
    const text = extractText(body);
    if (!text) throw new Error("Gemini final-art QA returned no output.");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const guarded = applyGuards({
      decision: parseDecision(parsed.decision),
      scores: parseScores(parsed.scores),
      issues: strings(parsed.issues, "issues"),
      notes: strings(parsed.notes, "notes"),
    });
    this.lastUsage = usageFromGenerateContent(this.model, body.usageMetadata);
    return {
      provider: this.providerName,
      model: this.model,
      ...guarded,
      ...(this.lastUsage ? { usage: this.lastUsage } : {}),
    };
  }
}
