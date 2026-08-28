import { geminiTextModelForRole } from "../providers/geminiModels.js";
import {
  usageFromGenerateContent,
  type GeminiUsageTelemetry,
} from "../providers/geminiUsage.js";
import type {
  VisualCompositionMatch,
  VisualCopyZoneRating,
  VisualQaCompositionEvidence,
  VisualQaDecision,
  VisualQaProvider,
  VisualQaRequest,
  VisualQaResult,
  VisualQaScores,
  VisualQaScoreEvidence,
  VisualQaEvidenceStatus,
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
  compositionEvidence?: unknown;
  scoreEvidence?: unknown;
}

const COPY_ZONE_PROPERTIES = {
  upperLeft: { type: "string", enum: ["GOOD", "ACCEPTABLE", "POOR"] },
  upperRight: { type: "string", enum: ["GOOD", "ACCEPTABLE", "POOR"] },
  lowerLeft: { type: "string", enum: ["GOOD", "ACCEPTABLE", "POOR"] },
  lowerRight: { type: "string", enum: ["GOOD", "ACCEPTABLE", "POOR"] },
} as const;

const SCORE_EVIDENCE_ITEM = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["PASS", "CONCERN", "FAIL"] },
    observations: { type: "array", items: { type: "string" } },
  },
  required: ["status", "observations"],
} as const;

const SCORE_EVIDENCE_PROPERTIES = {
  productTruth: SCORE_EVIDENCE_ITEM,
  brandFit: SCORE_EVIDENCE_ITEM,
  realism: SCORE_EVIDENCE_ITEM,
  foodTexture: SCORE_EVIDENCE_ITEM,
  composition: SCORE_EVIDENCE_ITEM,
  copyZoneSuitability: SCORE_EVIDENCE_ITEM,
  governance: SCORE_EVIDENCE_ITEM,
  rights: SCORE_EVIDENCE_ITEM,
} as const;

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
        foodTexture: { type: "number", minimum: 0, maximum: 100 },
        composition: { type: "number", minimum: 0, maximum: 100 },
        copyZoneSuitability: { type: "number", minimum: 0, maximum: 100 },
        governance: { type: "number", minimum: 0, maximum: 100 },
        rights: { type: "number", minimum: 0, maximum: 100 },
      },
      required: [
        "productTruth",
        "brandFit",
        "realism",
        "foodTexture",
        "composition",
        "copyZoneSuitability",
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
    scoreEvidence: {
      type: "object",
      additionalProperties: false,
      properties: SCORE_EVIDENCE_PROPERTIES,
      required: [
        "productTruth",
        "brandFit",
        "realism",
        "foodTexture",
        "composition",
        "copyZoneSuitability",
        "governance",
        "rights",
      ],
    },
    compositionEvidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        heroPlacement: {
          type: "string",
          enum: ["MATCH", "ACCEPTABLE", "MISMATCH"],
        },
        heroScale: {
          type: "string",
          enum: ["MATCH", "ACCEPTABLE", "MISMATCH"],
        },
        cropQuality: {
          type: "string",
          enum: ["GOOD", "ACCEPTABLE", "POOR"],
        },
        copyZones: {
          type: "object",
          additionalProperties: false,
          properties: COPY_ZONE_PROPERTIES,
          required: ["upperLeft", "upperRight", "lowerLeft", "lowerRight"],
        },
        notes: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["heroPlacement", "heroScale", "cropQuality", "copyZones", "notes"],
    },
  },
  required: [
    "decision",
    "scores",
    "issues",
    "observedIngredients",
    "unexpectedVisibleElements",
    "notes",
    "scoreEvidence",
    "compositionEvidence",
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
    foodTexture: score(scores.foodTexture, "foodTexture"),
    composition: score(scores.composition, "composition"),
    copyZoneSuitability: score(scores.copyZoneSuitability, "copyZoneSuitability"),
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

function parseEvidenceStatus(value: unknown, field: string): VisualQaEvidenceStatus {
  if (value !== "PASS" && value !== "CONCERN" && value !== "FAIL") {
    throw new Error(`Gemini visual QA returned invalid ${field}.status.`);
  }
  return value;
}

function parseScoreEvidence(value: unknown): VisualQaScoreEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini visual QA returned invalid scoreEvidence.");
  }
  const evidence = value as Record<string, unknown>;
  const parseDimension = (dimension: keyof VisualQaScores) => {
    const raw = evidence[dimension];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Gemini visual QA returned invalid scoreEvidence.${dimension}.`);
    }
    const item = raw as Record<string, unknown>;
    return {
      status: parseEvidenceStatus(item.status, `scoreEvidence.${dimension}`),
      observations: stringArray(item.observations, `scoreEvidence.${dimension}.observations`),
    };
  };
  return {
    productTruth: parseDimension("productTruth"),
    brandFit: parseDimension("brandFit"),
    realism: parseDimension("realism"),
    foodTexture: parseDimension("foodTexture"),
    composition: parseDimension("composition"),
    copyZoneSuitability: parseDimension("copyZoneSuitability"),
    governance: parseDimension("governance"),
    rights: parseDimension("rights"),
  };
}

function parseCompositionMatch(value: unknown, field: string): VisualCompositionMatch {
  if (value !== "MATCH" && value !== "ACCEPTABLE" && value !== "MISMATCH") {
    throw new Error(`Gemini visual QA returned invalid ${field}.`);
  }
  return value;
}

function parseCopyZoneRating(value: unknown, field: string): VisualCopyZoneRating {
  if (value !== "GOOD" && value !== "ACCEPTABLE" && value !== "POOR") {
    throw new Error(`Gemini visual QA returned invalid ${field}.`);
  }
  return value;
}

function parseCompositionEvidence(value: unknown): VisualQaCompositionEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Gemini visual QA returned invalid compositionEvidence.");
  }
  const evidence = value as Record<string, unknown>;
  if (!evidence.copyZones || typeof evidence.copyZones !== "object" || Array.isArray(evidence.copyZones)) {
    throw new Error("Gemini visual QA returned invalid compositionEvidence.copyZones.");
  }
  const zones = evidence.copyZones as Record<string, unknown>;
  return {
    heroPlacement: parseCompositionMatch(evidence.heroPlacement, "compositionEvidence.heroPlacement"),
    heroScale: parseCompositionMatch(evidence.heroScale, "compositionEvidence.heroScale"),
    cropQuality: parseCopyZoneRating(evidence.cropQuality, "compositionEvidence.cropQuality"),
    copyZones: {
      upperLeft: parseCopyZoneRating(zones.upperLeft, "copyZones.upperLeft"),
      upperRight: parseCopyZoneRating(zones.upperRight, "copyZones.upperRight"),
      lowerLeft: parseCopyZoneRating(zones.lowerLeft, "copyZones.lowerLeft"),
      lowerRight: parseCopyZoneRating(zones.lowerRight, "copyZones.lowerRight"),
    },
    notes: stringArray(evidence.notes, "compositionEvidence.notes"),
  };
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
    ...(parsed.scoreEvidence !== undefined
      ? { scoreEvidence: parseScoreEvidence(parsed.scoreEvidence) }
      : {}),
    compositionEvidence: parseCompositionEvidence(parsed.compositionEvidence),
  };
}

function buildPrompt(request: VisualQaRequest): string {
  const verifiedIngredients = request.verifiedVisibleIngredients ?? [];
  const verifiedCookingMethods = request.verifiedCookingMethods ?? [];
  const mustInclude = request.mustInclude ?? [];
  const mustNotInclude = request.mustNotInclude ?? [];
  const compositionRequirements = request.compositionRequirements ?? [];
  const expectation = request.compositionExpectation;

  return [
    "You are the ATTHA’S visual QA reviewer. Inspect the supplied image pixels; do not trust the generation prompt as evidence.",
    "Score eight mandatory categories from 0 to 100: product truth, brand fit, realism, food texture, composition, copy-zone suitability, governance and rights.",
    "ATTHA’S Burger should feel bold, energetic and craveable with realistic food texture. ATTHA’S Restaurant should feel warm, genuine, considered and welcoming.",
    "Never infer ingredients, ownership, advertising rights or product identity beyond the supplied verified facts.",
    "Use evidence-anchored scoring rather than a generic conservative default.",
    "For every numeric score, scoreEvidence is mandatory. PASS means no material visible defect for that dimension; CONCERN requires a concrete visible ambiguity or weakness; FAIL requires a concrete visible defect. Every CONCERN or FAIL observation must describe what is actually visible in the supplied pixels.",
    "A PASS status must meet these evidence-consistency floors: productTruth 90, brandFit 70, realism 85, foodTexture 82, composition 83, copyZoneSuitability 75, governance 90. Do not return a lower score with PASS evidence.",
    "Do not use missing reference photography, synthetic calibration status, absent cooking-method metadata, or general uncertainty as a CONCERN/FAIL observation unless it causes a concrete visible mismatch.",
    "Product truth rubric: 90-100 when the visible product form matches the supplied product identity, verified visible ingredients are represented without unverified additions, and there is no visible contradiction; 80-89 only for a concrete ambiguity or partial occlusion; below 80 requires a specific visible mismatch, missing/extra ingredient, wrong product form or other stated evidence in issues/notes.",
    "Governance rubric: 90-100 when no prohibited text, logo, price, branded packaging, badge, label, UI or other forbidden graphic element is visible; below 90 requires the specific visible governance defect to be stated in issues/notes.",
    "Do not reduce product-truth or governance scores merely because the campaign is synthetic/internal calibration, because no reference photograph was supplied, or because a verified cooking method was intentionally absent.",
    "Rights score is about the supplied deterministic rights status, not visual confidence: cleared should score 100, unknown cannot score as cleared, blocked must score 0 and BLOCK.",
    `Brand: ${request.brandId}`,
    `Branch: ${request.branchId ?? "UNSPECIFIED"}`,
    `Product ID: ${request.productId ?? "UNSPECIFIED"}`,
    `Product name: ${request.productName ?? "UNSPECIFIED"}`,
    `Visual class: ${request.visualClass}`,
    `Rights status supplied by Creative OS: ${request.rightsStatus}`,
    `Verified visible ingredients: ${verifiedIngredients.length ? verifiedIngredients.join(", ") : "NONE PROVIDED"}`,
    `Verified cooking methods: ${verifiedCookingMethods.length ? verifiedCookingMethods.join(", ") : "NONE PROVIDED"}`,
    `Deterministic food template: ${request.foodTemplateId ?? "UNSPECIFIED"}`,
    `Must include: ${mustInclude.length ? mustInclude.join(", ") : "NONE"}`,
    `Must not include: ${mustNotInclude.length ? mustNotInclude.join(", ") : "NONE"}`,
    `Composition requirements: ${compositionRequirements.length ? compositionRequirements.join("; ") : "NONE"}`,
    `Expected hero position: ${expectation?.heroPosition ?? "UNSPECIFIED"}`,
    `Expected hero scale: ${expectation?.heroScale ?? "UNSPECIFIED"}`,
    `Expected crop behavior: ${expectation?.cropBehavior ?? "UNSPECIFIED"}`,
    `Requested quiet copy zones: ${expectation?.requestedQuietZones?.length ? expectation.requestedQuietZones.join(", ") : "NONE"}`,
    "Composition evidence is mandatory. Judge hero placement, hero scale and crop quality from the pixels.",
    "Rate each copy zone independently: GOOD = structurally calm/low-detail and suitable for copy; ACCEPTABLE = usable but may need a mild deterministic mask/gradient; POOR = busy subject detail, high contrast, highlights or edges make copy unsafe.",
    "Do not rate a zone GOOD merely because no text is currently present. Inspect visual detail, contrast and subject occupancy.",
    "Reject or escalate if the image contains unverified visible ingredients, wrong product form, accidental text/logo, malformed food, impossible geometry, misleading portion perspective, missing requested copy-safe space, unsafe crop, or brand-incompatible styling.",
    "Serving configuration is part of product truth. A verified ingredient shown as a separate side dish, side salad, dipping bowl or ramekin is still an unverified serving element unless the supplied must-include contract explicitly authorizes that separate serving.",
    "When the deterministic food template is WRAP_ROLL, inspect the full frame for side bowls, ramekins, salads, fries, garnish dishes or duplicated serving components outside the wrap. If any are visible without explicit authorization, list them in unexpectedVisibleElements and productTruth cannot be PASS.",
    "Cooking-method cues are also product truth. When verified cooking methods are NONE PROVIDED, visible grill marks, griddle marks, toast marks, sear marks or deliberate charring that communicate a preparation method must be a productTruth CONCERN/FAIL and must not PASS merely because the underlying ingredient is verified.",
    "Rights are deterministic input, not visual inference: blocked rights must BLOCK; unknown rights cannot PASS final production.",
    "GENERIC_CONCEPT_VISUAL cannot PASS as an actual product advertisement. It must be HUMAN_REVIEW or BLOCK even when aesthetically strong.",
    "Return only JSON matching the required schema.",
  ].join("\n");
}

const EVIDENCE_PASS_FLOORS: Partial<Record<keyof VisualQaScores, number>> = {
  productTruth: 90,
  brandFit: 70,
  realism: 85,
  foodTexture: 82,
  composition: 83,
  copyZoneSuitability: 75,
  governance: 90,
};

function normalizeEvidenceBackedReview(
  request: VisualQaRequest,
  result: Omit<VisualQaResult, "provider" | "model" | "usage">,
): Omit<VisualQaResult, "provider" | "model" | "usage"> {
  const evidence = result.scoreEvidence;
  if (!evidence) return result;

  const scores = { ...result.scores };
  const notes = [...result.notes];
  const issues = [...result.issues];
  let decision = result.decision;

  for (const [dimension, floor] of Object.entries(EVIDENCE_PASS_FLOORS) as Array<[keyof VisualQaScores, number]>) {
    if (evidence[dimension].status === "PASS" && scores[dimension] < floor) {
      notes.push(`QA evidence-consistency normalized ${dimension} from ${scores[dimension]} to ${floor} because the reviewer marked that dimension PASS.`);
      scores[dimension] = floor;
    }
  }

  const expectedRights = request.rightsStatus === "cleared" ? 100 : request.rightsStatus === "blocked" ? 0 : 50;
  if (scores.rights !== expectedRights) {
    notes.push(`QA evidence-consistency normalized deterministic rights score from ${scores.rights} to ${expectedRights}.`);
    scores.rights = expectedRights;
  }

  const scoredDimensions: Array<keyof VisualQaScores> = [
    "productTruth", "brandFit", "realism", "foodTexture", "composition", "copyZoneSuitability", "governance",
  ];
  const allVisualEvidencePass = scoredDimensions.every((dimension) => evidence[dimension].status === "PASS");

  if (decision === "REGENERATE" && allVisualEvidencePass && issues.length === 0 && result.unexpectedVisibleElements.length === 0) {
    decision = "PASS";
    notes.push("QA evidence-consistency replaced an unsupported REGENERATE decision with PASS because every scored visual dimension was marked PASS and no issue or unexpected element was reported.");
  }

  const contradictoryFail = scoredDimensions.filter(
    (dimension) => evidence[dimension].status === "FAIL" && scores[dimension] >= (EVIDENCE_PASS_FLOORS[dimension] ?? 101),
  );
  if (contradictoryFail.length && decision === "PASS") {
    decision = "HUMAN_REVIEW";
    issues.push(`QA evidence is internally inconsistent for: ${contradictoryFail.join(", ")}.`);
  }

  return {
    ...result,
    decision,
    scores,
    issues: [...new Set(issues)],
    notes: [...new Set(notes)],
  };
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

  const evidenceText = [
    ...result.issues,
    ...result.notes,
    ...result.unexpectedVisibleElements,
    ...Object.values(result.scoreEvidence ?? {}).flatMap((item) => item.observations),
  ]
    .join(" ")
    .toLowerCase();

  if (
    request.foodTemplateId === "WRAP_ROLL" &&
    /\b(side salad|salad bowl|side dish|side bowl|dipping sauce|dip bowl|sauce ramekin|ramekin)\b/.test(evidenceText)
  ) {
    decision = "REGENERATE";
    issues.push("Separate serving elements are outside the verified WRAP_ROLL presentation contract.");
  }

  if (
    (request.verifiedCookingMethods?.length ?? 0) === 0 &&
    /\b(grill marks?|griddle marks?|toast marks?|sear marks?|char marks?)\b/.test(evidenceText)
  ) {
    decision = "REGENERATE";
    issues.push("Visible preparation cues imply a cooking method that was not separately verified.");
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

  if (decision === "PASS" && request.compositionExpectation) {
    const evidence = result.compositionEvidence;
    if (!evidence) {
      decision = "HUMAN_REVIEW";
      issues.push("Composition-aware QA evidence is missing for a structured composition expectation.");
    } else {
      const poorRequestedZones = (request.compositionExpectation.requestedQuietZones ?? []).filter(
        (zone) => evidence.copyZones[zone] === "POOR",
      );
      if (poorRequestedZones.length) {
        decision = "REGENERATE";
        issues.push(`Requested copy-safe zones are visually unsafe: ${poorRequestedZones.join(", ")}.`);
      }
      if (evidence.heroPlacement === "MISMATCH") {
        decision = "REGENERATE";
        issues.push("Observed hero placement does not match the structured brief.");
      }
      if (evidence.heroScale === "MISMATCH") {
        decision = "REGENERATE";
        issues.push("Observed hero scale does not match the structured brief.");
      }
      if (evidence.cropQuality === "POOR") {
        decision = "REGENERATE";
        issues.push("Observed crop quality is poor for the structured composition.");
      }
    }
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
    this.maxOutputTokens = options.maxOutputTokens ?? 2200;
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
                mimeType: "APPLICATION_JSON",
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
    const normalized = normalizeEvidenceBackedReview(request, parseOutput(text));
    const guarded = applyDeterministicGuards(request, normalized);

    return {
      provider: this.providerName,
      model: this.model,
      ...guarded,
      ...(this.lastUsage ? { usage: this.lastUsage } : {}),
    };
  }
}
