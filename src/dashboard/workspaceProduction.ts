import type { CreativeFeatureFlags } from "../featureFlags.js";
import type {
  TaskTruthAnswer,
  TaskTruthQuestionnaire,
  TaskTruthSnapshot,
} from "../taskTruth.js";
import type { PlannedVisualQaContext } from "../commands/producePlannedCampaign.js";

export const WORKSPACE_PRODUCTION_PROFILE: Readonly<CreativeFeatureFlags> = Object.freeze({
  useStructuredBrief: true,
  useFoodComposer: true,
  useNewRenderer: true,
});

export const WORKSPACE_PRODUCT_VISUAL_SOURCES = [
  "APPROVED_REAL_PRODUCT_PHOTO",
  "AI_GENERATION_ALLOWED",
] as const;

export type WorkspaceProductVisualSource = (typeof WORKSPACE_PRODUCT_VISUAL_SOURCES)[number];

export interface WorkspaceUploadedAsset {
  schemaVersion: 1;
  assetId: string;
  sessionId: string;
  campaignId: string;
  filename: string;
  path: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  bytes: number;
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  branchId?: string;
  productId?: string;
  sourceType: "owner_supplied";
  approvedForAds: boolean;
  appearanceVerified: boolean;
  ingredientMatchVerified: boolean;
  createdAt: string;
}

const BOOLEAN_KEYS = new Set(["branchAvailability"]);
const NUMBER_KEYS = new Set(["price"]);
const ARRAY_KEYS = new Set([
  "ingredients",
  "mustInclude",
  "mustNotInclude",
  "cookingMethods",
  "requestedProductClaims",
]);

function normalizedString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} requires a non-empty value.`);
  }
  return value.trim();
}

export function coerceWorkspaceTruthValue(key: string, value: unknown): unknown {
  if (BOOLEAN_KEYS.has(key)) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1"].includes(normalized)) return true;
      if (["false", "no", "0"].includes(normalized)) return false;
    }
    throw new Error(`${key} must be confirmed as Yes or No.`);
  }

  if (NUMBER_KEYS.has(key)) {
    const numeric = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`${key} must be a positive numeric value.`);
    }
    return numeric;
  }

  if (ARRAY_KEYS.has(key)) {
    const raw = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(/[,\n]/)
        : [];
    const items = raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    if (key === "ingredients" && items.length === 0) {
      throw new Error("ingredients requires at least one verified visible ingredient for product production.");
    }
    return [...new Set(items)];
  }

  if (key === "approvedProductVisual") {
    const source = normalizedString(value, key);
    if (!WORKSPACE_PRODUCT_VISUAL_SOURCES.includes(source as WorkspaceProductVisualSource)) {
      throw new Error(
        "approvedProductVisual must be APPROVED_REAL_PRODUCT_PHOTO or AI_GENERATION_ALLOWED.",
      );
    }
    return source;
  }

  if (typeof value === "string") return value.trim();
  return value;
}

export function coerceWorkspaceTruthAnswers(
  questionnaire: TaskTruthQuestionnaire,
  answers: TaskTruthAnswer[],
): TaskTruthAnswer[] {
  const byLabel = new Map(questionnaire.questions.map((question) => [question.label, question]));
  return answers.map((answer) => {
    if (answer.action === "CONFIRM" || answer.value === undefined) return answer;
    const question = byLabel.get(answer.label);
    if (!question) throw new Error(`Unexpected task truth answer: ${answer.label}.`);
    return {
      ...answer,
      value: coerceWorkspaceTruthValue(question.requirement.key, answer.value),
    };
  });
}

export function taskSnapshotFact(snapshot: TaskTruthSnapshot, key: string): unknown {
  return snapshot.facts.find((fact) => fact.key === key)?.value;
}

function taskStringArray(snapshot: TaskTruthSnapshot, key: string): string[] {
  const value = taskSnapshotFact(snapshot, key);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

export function assertWorkspaceProductionTruth(input: {
  snapshot: TaskTruthSnapshot;
  campaignType: string;
  uploadedAsset?: WorkspaceUploadedAsset;
}): void {
  if (input.campaignType !== "PRODUCT_PUSH") return;
  if (taskSnapshotFact(input.snapshot, "branchAvailability") !== true) {
    throw new Error("This product is not confirmed as currently available at the selected branch.");
  }
  const ingredients = taskStringArray(input.snapshot, "ingredients");
  if (!ingredients.length) {
    throw new Error("Product production requires verified visible ingredients.");
  }
  const source = taskSnapshotFact(input.snapshot, "approvedProductVisual");
  if (source === "APPROVED_REAL_PRODUCT_PHOTO") {
    if (!input.uploadedAsset) {
      throw new Error("The task confirms an approved real product photo, but no governed photo asset is uploaded and bound.");
    }
    if (
      !input.uploadedAsset.approvedForAds ||
      !input.uploadedAsset.appearanceVerified ||
      !input.uploadedAsset.ingredientMatchVerified
    ) {
      throw new Error("The uploaded product photo is not fully approved for advertising/product identity use.");
    }
  } else if (source === "AI_GENERATION_ALLOWED") {
    if (input.uploadedAsset) {
      throw new Error("This task selected AI generation, but a real base photo is also bound. Choose one governed visual source.");
    }
  } else {
    throw new Error("Product visual source is not confirmed for this task.");
  }
}

export function assertWorkspaceUploadedAssetMatchesTask(input: {
  asset: WorkspaceUploadedAsset;
  campaignId: string;
  sessionId: string;
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  branchId?: string;
  productId?: string;
}): void {
  const a = input.asset;
  if (a.campaignId !== input.campaignId) throw new Error("Uploaded asset campaign binding mismatch.");
  if (a.sessionId !== input.sessionId) throw new Error("Uploaded asset session binding mismatch.");
  if (a.brandId !== input.brandId) throw new Error("Uploaded asset brand binding mismatch.");
  if ((a.branchId ?? undefined) !== (input.branchId ?? undefined)) {
    throw new Error("Uploaded asset branch binding mismatch.");
  }
  if ((a.productId ?? undefined) !== (input.productId ?? undefined)) {
    throw new Error("Uploaded asset product binding mismatch.");
  }
}

export function buildWorkspaceVisualQaContext(input: {
  campaignType: string;
  snapshot: TaskTruthSnapshot;
  uploadedAsset?: WorkspaceUploadedAsset;
}): PlannedVisualQaContext {
  const productScoped = input.campaignType === "PRODUCT_PUSH";
  const productName = taskSnapshotFact(input.snapshot, "productName");
  const ingredients = taskStringArray(input.snapshot, "ingredients");
  const mustInclude = taskStringArray(input.snapshot, "mustInclude");
  const mustNotInclude = taskStringArray(input.snapshot, "mustNotInclude");
  const source = taskSnapshotFact(input.snapshot, "approvedProductVisual");

  if (input.uploadedAsset) {
    return {
      visualClass: productScoped ? "VERIFIED_PRODUCT_VISUAL" : "GENERIC_CONCEPT_VISUAL",
      rightsStatus: input.uploadedAsset.approvedForAds ? "cleared" : "blocked",
      ...(productScoped && input.uploadedAsset.productId
        ? { productId: input.uploadedAsset.productId }
        : {}),
      ...(productScoped && typeof productName === "string" ? { productName } : {}),
      ...(ingredients.length ? { verifiedVisibleIngredients: ingredients } : {}),
      ...(mustInclude.length ? { mustInclude } : {}),
      ...(mustNotInclude.length ? { mustNotInclude } : {}),
      approvedReferenceImageIds: [input.uploadedAsset.assetId],
    };
  }

  return {
    visualClass: productScoped ? "CONSTRAINED_PRODUCT_GENERATION" : "GENERIC_CONCEPT_VISUAL",
    rightsStatus: "cleared",
    ...(productScoped && typeof productName === "string" ? { productName } : {}),
    ...(ingredients.length ? { verifiedVisibleIngredients: ingredients } : {}),
    ...(mustInclude.length ? { mustInclude } : {}),
    ...(mustNotInclude.length ? { mustNotInclude } : {}),
    ...(source === "AI_GENERATION_ALLOWED" ? {} : {}),
  };
}
