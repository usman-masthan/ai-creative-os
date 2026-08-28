import { geminiTextModelForRole } from "../providers/geminiModels.js";
import {
  usageFromGenerateContent,
  type GeminiUsageTelemetry,
} from "../providers/geminiUsage.js";
import type {
  FinalArtQaCheckState,
  FinalArtQaChecks,
  FinalArtQaDecision,
  FinalArtQaDimensionEvidence,
  FinalArtQaEvidence,
  FinalArtQaEvidenceState,
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

const SCORE_SCHEMA = { type: "number", minimum: 0, maximum: 100 } as const;
const CHECK_SCHEMA = {
  type: "string",
  enum: ["PASS", "FAIL", "NOT_APPLICABLE"],
} as const;
const EVIDENCE_STATUS_SCHEMA = {
  type: "string",
  enum: ["PASS", "CONCERN", "FAIL", "NOT_APPLICABLE"],
} as const;
const EVIDENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: EVIDENCE_STATUS_SCHEMA,
    observations: { type: "array", items: { type: "string" } },
  },
  required: ["status", "observations"],
} as const;

const FINAL_ART_DIMENSIONS = [
  "brandVisibility",
  "headlineHierarchy",
  "ctaHierarchyPlacement",
  "priceVisibility",
  "safeAreas",
  "contrastLegibility",
  "productDominance",
  "platformReadability",
  "decorativeCoherence",
] as const satisfies readonly (keyof FinalArtQaScores)[];

const FINAL_ART_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: ["PASS", "REGENERATE", "HUMAN_REVIEW", "BLOCK"] },
    scores: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(FINAL_ART_DIMENSIONS.map((key) => [key, SCORE_SCHEMA])),
      required: [...FINAL_ART_DIMENSIONS],
    },
    checks: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(FINAL_ART_DIMENSIONS.map((key) => [key, CHECK_SCHEMA])),
      required: [...FINAL_ART_DIMENSIONS],
    },
    evidence: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(FINAL_ART_DIMENSIONS.map((key) => [key, EVIDENCE_SCHEMA])),
      required: [...FINAL_ART_DIMENSIONS],
    },
    issues: { type: "array", items: { type: "string" } },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["decision", "scores", "checks", "evidence", "issues", "notes"],
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
  if (!value || typeof value !== "object") {
    throw new Error("Gemini final-art QA returned invalid scores.");
  }
  const scores = value as Record<string, unknown>;
  return {
    brandVisibility: numberScore(scores.brandVisibility, "brandVisibility"),
    headlineHierarchy: numberScore(scores.headlineHierarchy, "headlineHierarchy"),
    ctaHierarchyPlacement: numberScore(scores.ctaHierarchyPlacement, "ctaHierarchyPlacement"),
    priceVisibility: numberScore(scores.priceVisibility, "priceVisibility"),
    safeAreas: numberScore(scores.safeAreas, "safeAreas"),
    contrastLegibility: numberScore(scores.contrastLegibility, "contrastLegibility"),
    productDominance: numberScore(scores.productDominance, "productDominance"),
    platformReadability: numberScore(scores.platformReadability, "platformReadability"),
    decorativeCoherence: numberScore(scores.decorativeCoherence, "decorativeCoherence"),
  };
}

function checkState(value: unknown, name: string): FinalArtQaCheckState {
  if (value !== "PASS" && value !== "FAIL" && value !== "NOT_APPLICABLE") {
    throw new Error(`Gemini final-art QA returned invalid ${name} check.`);
  }
  return value;
}

function parseChecks(value: unknown): FinalArtQaChecks {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini final-art QA returned invalid checks.");
  }
  const checks = value as Record<string, unknown>;
  return {
    brandVisibility: checkState(checks.brandVisibility, "brandVisibility"),
    headlineHierarchy: checkState(checks.headlineHierarchy, "headlineHierarchy"),
    ctaHierarchyPlacement: checkState(checks.ctaHierarchyPlacement, "ctaHierarchyPlacement"),
    priceVisibility: checkState(checks.priceVisibility, "priceVisibility"),
    safeAreas: checkState(checks.safeAreas, "safeAreas"),
    contrastLegibility: checkState(checks.contrastLegibility, "contrastLegibility"),
    productDominance: checkState(checks.productDominance, "productDominance"),
    platformReadability: checkState(checks.platformReadability, "platformReadability"),
    decorativeCoherence: checkState(checks.decorativeCoherence, "decorativeCoherence"),
  };
}

function evidenceState(value: unknown, name: string): FinalArtQaEvidenceState {
  if (value !== "PASS" && value !== "CONCERN" && value !== "FAIL" && value !== "NOT_APPLICABLE") {
    throw new Error(`Gemini final-art QA returned invalid ${name} evidence status.`);
  }
  return value;
}

function parseEvidenceItem(value: unknown, name: string): FinalArtQaDimensionEvidence {
  if (!value || typeof value !== "object") {
    throw new Error(`Gemini final-art QA returned invalid ${name} evidence.`);
  }
  const item = value as Record<string, unknown>;
  return {
    status: evidenceState(item.status, name),
    observations: strings(item.observations, `${name}.observations`),
  };
}

function parseEvidence(value: unknown): FinalArtQaEvidence {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini final-art QA returned invalid evidence.");
  }
  const evidence = value as Record<string, unknown>;
  return Object.fromEntries(
    FINAL_ART_DIMENSIONS.map((key) => [key, parseEvidenceItem(evidence[key], key)]),
  ) as FinalArtQaEvidence;
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
  const platforms = request.expectedPlatforms?.length
    ? request.expectedPlatforms.join(" / ")
    : "NONE";
  return [
    `You are reviewing the FINISHED ${request.finalArtReviewLabel} after deterministic text/price rendering.`,
    "Judge only the supplied pixels. Do not infer that an element exists because it appears in the expected-copy metadata.",
    "Inspect all nine M3.3 dimensions and return a 0-100 score, PASS/FAIL/NOT_APPLICABLE check, and evidence for each.",
    "",
    "M3.3 DIMENSIONS",
    "1. brandVisibility — the deterministic operating-brand identifier is clearly visible and not obscured.",
    "2. headlineHierarchy — the expected headline is readable, visually primary and clearly separated from supporting copy.",
    "3. ctaHierarchyPlacement — CTA is readable, action-like and structurally tied to the copy block rather than orphaned in an arbitrary corner.",
    "4. priceVisibility — when a price is expected, it is complete, readable, correctly formatted and not cropped. If no price is expected and none is visible, mark NOT_APPLICABLE.",
    "5. safeAreas — important text, CTA, brand identifier and price remain inside safe margins with no clipping or unsafe edge placement.",
    "6. contrastLegibility — all customer-facing text has sufficient contrast and clean line breaks at the intended platform size.",
    "7. productDominance — when a verified product is expected, the food/product hero remains visually dominant and is not hidden by overlays. If no product is expected, mark NOT_APPLICABLE.",
    "8. platformReadability — when a delivery/platform name is expected, it is visibly readable and unambiguous. If none is expected, mark NOT_APPLICABLE.",
    "9. decorativeCoherence — no accidental rectangles, duplicate/generated text, stray rails, rendering artifacts, arbitrary corner ornaments or incoherent graphic fragments.",
    "",
    "CHECK RULES",
    "- Always-applicable checks (brandVisibility, headlineHierarchy, ctaHierarchyPlacement, safeAreas, contrastLegibility, decorativeCoherence) must be PASS for the artwork to pass.",
    "- For non-applicable price/product/platform dimensions, use NOT_APPLICABLE and score 100 only when no conflicting unexpected element is visible.",
    "- If an unexpected price/platform/generated text or artifact is visible, use FAIL and explain it in issues.",
    "- Evidence status PASS means no material visible defect for that dimension; scores for PASS evidence must meet the deterministic pass floor.",
    "- Evidence status CONCERN means a concrete visible weakness or ambiguity. Name the actual pixel-level weakness in observations; do not use missing metadata or uncertainty as concern evidence.",
    "- Evidence status FAIL means a concrete visible defect. Name it in observations and issues.",
    "- NOT_APPLICABLE evidence is allowed only when the corresponding check is NOT_APPLICABLE.",
    "- Do not approve artwork if expected customer-facing copy is visibly missing, materially altered, duplicated, clipped or unreadable.",
    "",
    `Brand: ${request.brandDisplayName} (${request.brandId})`,
    `Expected brand identifier: ${request.expectedBrandIdentifier}`,
    `Layout: ${request.layoutId}`,
    `Platform: ${request.channel} ${request.assetType}`,
    `Expected dimensions: ${request.width}x${request.height}`,
    `Expected headline: ${request.expectedHeadline}`,
    `Expected supporting copy: ${request.expectedSupportingCopy}`,
    `Expected CTA: ${request.expectedCta}`,
    `Expected price: ${request.expectedPrice ?? "NONE"}`,
    `Expected product: ${request.expectedProductName ?? "NONE"}`,
    `Expected platform names: ${platforms}`,
    `Approved logo expected: ${request.logoExpected ? "YES" : "NO"}`,
    "",
    "Return only JSON matching the schema.",
  ].join("\n");
}

const REQUIRED_MINIMUMS: ReadonlyArray<[keyof FinalArtQaScores, number]> = [
  ["brandVisibility", 85],
  ["headlineHierarchy", 82],
  ["ctaHierarchyPlacement", 80],
  ["safeAreas", 82],
  ["contrastLegibility", 82],
  ["decorativeCoherence", 80],
];

function applyGuards(
  result: Omit<FinalArtQaResult, "provider" | "model" | "usage">,
  request: FinalArtQaRequest,
): Omit<FinalArtQaResult, "provider" | "model" | "usage"> {
  let decision = result.decision;
  const issues = [...result.issues];
  const notes = [...result.notes];
  const scores = { ...result.scores };

  const optional: Array<{
    key: "priceVisibility" | "productDominance" | "platformReadability";
    applicable: boolean;
    minimum: number;
  }> = [
    { key: "priceVisibility", applicable: Boolean(request.expectedPrice), minimum: 85 },
    { key: "productDominance", applicable: Boolean(request.expectedProductName), minimum: 80 },
    { key: "platformReadability", applicable: Boolean(request.expectedPlatforms?.length), minimum: 82 },
  ];
  const minimums = new Map<keyof FinalArtQaScores, number>([
    ...REQUIRED_MINIMUMS,
    ...optional.filter((item) => item.applicable).map((item) => [item.key, item.minimum] as const),
  ]);

  for (const key of FINAL_ART_DIMENSIONS) {
    const evidence = result.evidence[key];
    const check = result.checks[key];
    if (evidence.status === "CONCERN") {
      decision = decision === "BLOCK" ? "BLOCK" : "HUMAN_REVIEW";
      issues.push(`${key} has concrete visible concern evidence: ${evidence.observations.join("; ") || "unspecified concern"}.`);
      continue;
    }
    if (evidence.status === "FAIL") {
      if (decision !== "BLOCK") decision = "REGENERATE";
      issues.push(`${key} has concrete visible fail evidence: ${evidence.observations.join("; ") || "unspecified defect"}.`);
      continue;
    }
    if (evidence.status === "NOT_APPLICABLE" && check !== "NOT_APPLICABLE") {
      if (decision !== "BLOCK") decision = "REGENERATE";
      issues.push(`${key} evidence cannot be NOT_APPLICABLE when its check is ${check}.`);
      continue;
    }
    if (evidence.status === "PASS" && check === "PASS") {
      const minimum = minimums.get(key);
      if (minimum !== undefined && scores[key] < minimum) {
        notes.push(`Final-art QA evidence consistency normalized ${key} score from ${scores[key]} to ${minimum}.`);
        scores[key] = minimum;
      }
    }
  }

  for (const [key, minimum] of REQUIRED_MINIMUMS) {
    if (result.checks[key] !== "PASS") {
      if (decision !== "BLOCK") decision = "REGENERATE";
      issues.push(`${key} check must be PASS for finished artwork.`);
    }
    if (scores[key] < minimum) {
      if (decision !== "BLOCK") decision = "REGENERATE";
      issues.push(`${key} score ${scores[key]} is below required ${minimum}.`);
    }
  }

  for (const item of optional) {
    const state = result.checks[item.key];
    const evidence = result.evidence[item.key];
    if (item.applicable) {
      if (state !== "PASS") {
        if (decision !== "BLOCK") decision = "REGENERATE";
        issues.push(`${item.key} check must be PASS when the dimension is applicable.`);
      }
      if (scores[item.key] < item.minimum) {
        if (decision !== "BLOCK") decision = "REGENERATE";
        issues.push(`${item.key} score ${scores[item.key]} is below required ${item.minimum}.`);
      }
    } else {
      if (state !== "NOT_APPLICABLE") {
        if (decision !== "BLOCK") decision = "REGENERATE";
        issues.push(`${item.key} must be NOT_APPLICABLE when no corresponding verified element is expected.`);
      }
      if (evidence.status !== "NOT_APPLICABLE") {
        if (decision !== "BLOCK") decision = "REGENERATE";
        issues.push(`${item.key} evidence must be NOT_APPLICABLE when no corresponding verified element is expected.`);
      }
    }
  }

  const materialIssues = [...new Set(issues)];
  const allApplicableEvidencePass = FINAL_ART_DIMENSIONS.every((key) => {
    const state = result.checks[key];
    return state === "NOT_APPLICABLE"
      ? result.evidence[key].status === "NOT_APPLICABLE"
      : state === "PASS" && result.evidence[key].status === "PASS";
  });
  if (decision !== "BLOCK" && allApplicableEvidencePass && materialIssues.length === 0) {
    decision = "PASS";
  }

  return { ...result, decision, scores, issues: materialIssues, notes: [...new Set(notes)] };
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
    this.maxOutputTokens = options.maxOutputTokens ?? 2200;
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
            responseFormat: { text: { mimeType: "APPLICATION_JSON", schema: FINAL_ART_SCHEMA } },
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
    if (!response.ok) {
      throw new Error(
        `Gemini final-art QA failed: ${body.error?.message ?? `HTTP ${response.status}`}`,
      );
    }
    const text = extractText(body);
    if (!text) throw new Error("Gemini final-art QA returned no output.");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const guarded = applyGuards(
      {
        decision: parseDecision(parsed.decision),
        scores: parseScores(parsed.scores),
        checks: parseChecks(parsed.checks),
        evidence: parseEvidence(parsed.evidence),
        issues: strings(parsed.issues, "issues"),
        notes: strings(parsed.notes, "notes"),
      },
      request,
    );
    this.lastUsage = usageFromGenerateContent(this.model, body.usageMetadata);
    return {
      provider: this.providerName,
      model: this.model,
      ...guarded,
      ...(this.lastUsage ? { usage: this.lastUsage } : {}),
    };
  }
}
