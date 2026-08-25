import { geminiTextModelForRole } from "../providers/geminiModels.js";
import {
  usageFromGenerateContent,
  type GeminiUsageTelemetry,
} from "../providers/geminiUsage.js";
import type {
  VisualQaDecision,
  VisualQaProvider,
  VisualQaRequest,
  VisualQaResult,
  VisualQaScores,
} from "./types.js";

interface GeminiVisualQaOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
  };
}

interface RawVisualQaOutput {
  decision?: unknown;
  scores?: unknown;
  issues?: unknown;
  observedIngredients?: unknown;
  unexpectedVisibleElements?: unknown;
  notes?: unknown;
}

const VISUAL_QA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: {
      type: "string",
      enum: ["PASS", "REGENERATE", "HUMAN_REVIEW", "BLOCK"],
    },
    scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        productTruth: { type: "number", minimum: 0, maximum: 100 },
        brandFit: { type: "number", minimum: 0, maximum: 100 },
        realism: { type: "number", minimum: 0, maximum: 100 },
        composition: { type: "number", minimum: 0, maximum: 100 },
        governance: { type: "number", minimum: 0, maximum: 100 },
        rights: { type: "number", minimum: 0, maximum: 100 },
      },
      required: [
        "productTruth",
        "brandFit",
        "realism",
        "composition",
        "governance",
        "rights",
      ],
    },
    issues: {
      type: "array",
      items: { type: "string" },
    },
    observedIngredients: {
      type: "array",
      items: { type: "string" },
    },
    unexpectedVisibleElements: {
      type: "array",
      items: { type: "string" },
    },
    notes: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "decision",
    "scores",
    "issues",
    "observedIngredients",
    "unexpectedVisibleElements",
    "notes",
  ],
} as const;

function extractText(body: GeminiGenerateContentResponse): string {
  const chunks: string[] = [];
  for (const candidate of body.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Gemini visual QA returned invalid ${field}.`);
  }
  return value as string[];
}

function score(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Gemini visual QA returned invalid score ${field}.`);
  }
  return value;
}

function parseScores(value: unknown): VisualQaScores {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini visual QA returned invalid scores.");
  }

  const scores = value as Record<string, unknown>;
  return {
    productTruth: score(scores.productTruth, "productTruth"),
    brandFit: score(scores.brandFit, "brandFit"),
    realism: score(scores.realism, "realism"),
    composition: score(scores.composition, "composition"),
    governance: score(scores.governance, "governance"),
    rights: score(scores.rights, "rights"),
  };
}

function parseDecision(value: unknown): VisualQaDecision {
  if (
    value !== "PASS" &&
    value !== "REGENERATE" &&
    value !== "HUMAN_REVIEW" &&
    value !== "BLOCK"
  ) {
    throw new Error("Gemini visual QA returned an invalid decision.");
  }
  return value;
}

function parseOutput(text: string): Omit<VisualQaResult, "provider" | "model" | "usage"> {
  let parsed: RawVisualQaOutput;
  try {
    parsed = JSON.parse(text) as RawVisualQaOutput;
  } catch {
    throw new Error("Gemini visual QA returned invalid JSON.");
  }

  return {
    decision: parseDecision(parsed.decision),
    scores: parseScores(parsed.scores),
    issues: stringArray(parsed.issues, "issues"),
    observedIngredients: stringArray(parsed.observedIngredients, "observedIngredients"),
    unexpectedVisibleElements: stringArray(
      parsed.unexpectedVisibleElements,
      "unexpectedVisibleElements",
    ),
    notes: stringArray(parsed.notes, "notes"),
  };
}

function buildPrompt(request: VisualQaRequest): string {
  const verifiedIngredients = request.verifiedVisibleIngredients ?? [];
  const mustInclude = request.mustInclude ?? [];
  const mustNotInclude = request.mustNotInclude ?? [];
  const compositionRequirements = request.compositionRequirements ?? [];

  return [
    "You are the ATTHA’S visual QA reviewer. Inspect the supplied image pixels; do not trust the generation prompt as evidence.",
    "Score six mandatory categories from 0 to 100: product truth, brand fit, realism, composition, governance and rights.",
    "ATTHA’S Burger should feel bold, energetic and craveable with realistic food texture. ATTHA’S Restaurant should feel warm, genuine, considered and welcoming.",
    "Never infer ingredients, ownership, advertising rights or product identity beyond the supplied verified facts.",
    `Brand: ${request.brandId}`,
    `Branch: ${request.branchId ?? "UNSPECIFIED"}`,
    `Product ID: ${request.productId ?? "UNSPECIFIED"}`,
    `Product name: ${request.productName ?? "UNSPECIFIED"}`,
    `Visual class: ${request.visualClass}`,
    `Rights status supplied by Creative OS: ${request.rightsStatus}`,
    `Verified visible ingredients: ${verifiedIngredients.length ? verifiedIngredients.join(", ") : "NONE PROVIDED"}`,
    `Must include: ${mustInclude.length ? mustInclude.join(", ") : "NONE"}`,
    `Must not include: ${mustNotInclude.length ? mustNotInclude.join(", ") : "NONE"}`,
    `Composition requirements: ${compositionRequirements.length ? compositionRequirements.join("; ") : "NONE"}`,
    "Reject or escalate if the image contains unverified visible ingredients, wrong product form, accidental text/logo, malformed food, impossible geometry, misleading portion perspective, missing copy-safe space, or brand-incompatible styling.",
    "Rights are deterministic input, not visual inference: blocked rights must BLOCK; unknown rights cannot PASS final production.",
    "GENERIC_CONCEPT_VISUAL cannot PASS as an actual product advertisement. It must be HUMAN_REVIEW or BLOCK even when aesthetically strong.",
    "Return only JSON matching the required schema.",
  ].join("\n");
}

function applyDeterministicGuards(
  request: VisualQaRequest,
  result: Omit<VisualQaResult, "provider" | "model" | "usage">,
): Omit<VisualQaResult, "provider" | "model" | "usage"> {
  let decision = result.decision;
  const issues = [...result.issues];
  const notes = [...result.notes];

  if (request.rightsStatus === "blocked") {
    decision = "BLOCK";
    issues.push("Commercial-use rights are explicitly blocked.");
  } else if (request.rightsStatus === "unknown" && decision === "PASS") {
    decision = "HUMAN_REVIEW";
    issues.push("Commercial-use rights are not confirmed.");
  }

  if (request.visualClass === "GENERIC_CONCEPT_VISUAL" && decision === "PASS") {
    decision = "HUMAN_REVIEW";
    issues.push("Generic concept imagery cannot pass as verified product advertising.");
  }

  const productScoped = Boolean(request.productId || request.productName);
  if (
    productScoped &&
    request.visualClass !== "GENERIC_CONCEPT_VISUAL" &&
    (request.verifiedVisibleIngredients?.length ?? 0) === 0 &&
    decision === "PASS"
  ) {
    decision = "HUMAN_REVIEW";
    issues.push("No verified visible-ingredient list was supplied for a product-scoped visual.");
  }

  if (
    decision === "PASS" &&
    (result.scores.productTruth < 80 || result.scores.realism < 75 || result.scores.brandFit < 70)
  ) {
    decision = "REGENERATE";
    notes.push("Deterministic minimum score thresholds prevented PASS.");
  }

  return {
    ...result,
    decision,
    issues: [...new Set(issues)],
    notes: [...new Set(notes)],
  };
}

export class GeminiVisualQaProvider implements VisualQaProvider {
  readonly providerName = "gemini";
  readonly model: string;
  lastUsage: GeminiUsageTelemetry | undefined;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiVisualQaOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error("GEMINI_API_KEY is required to use GeminiVisualQaProvider.");
    }

    this.apiKey = apiKey.trim();
    this.model = options.model?.trim() || geminiTextModelForRole("advanced");
    this.baseUrl =
      options.baseUrl?.replace(/\/$/, "") ??
      "https://generativelanguage.googleapis.com/v1beta";
    this.maxOutputTokens = options.maxOutputTokens ?? 1800;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async review(request: VisualQaRequest): Promise<VisualQaResult> {
    if (!request.imageBase64.trim()) {
      throw new Error("Visual QA requires non-empty imageBase64.");
    }
    if (!request.mimeType.startsWith("image/")) {
      throw new Error("Visual QA requires an image MIME type.");
    }

    const response = await this.fetchImpl(
      `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: request.mimeType,
                    data: request.imageBase64,
                  },
                },
                { text: buildPrompt(request) },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: this.maxOutputTokens,
            responseFormat: {
              text: {
                mimeType: "application/json",
                schema: VISUAL_QA_SCHEMA,
              },
            },
          },
        }),
      },
    );

    let body: GeminiGenerateContentResponse;
    try {
      body = (await response.json()) as GeminiGenerateContentResponse;
    } catch {
      throw new Error(`Gemini visual QA returned a non-JSON response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Gemini visual QA failed: ${detail}`);
    }

    const text = extractText(body);
    if (!text) {
      throw new Error("Gemini visual QA returned no output text.");
    }

    this.lastUsage = usageFromGenerateContent(this.model, body.usageMetadata);
    const guarded = applyDeterministicGuards(request, parseOutput(text));

    return {
      provider: this.providerName,
      model: this.model,
      ...guarded,
      ...(this.lastUsage ? { usage: this.lastUsage } : {}),
    };
  }
}
