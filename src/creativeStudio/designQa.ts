import { getCreativeBrandTheme } from "./clientProfiles/registry.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";
import type { DesignDocument, DesignLayer, DesignTextLayer } from "../designDocument/types.js";
import { validateDesignDocument } from "../designDocument/validator.js";
import { safeAreaRect } from "../layoutEngine/geometry.js";

export type DesignQaSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface DesignQaIssue {
  code: string;
  severity: DesignQaSeverity;
  message: string;
  blocker: boolean;
  layerId?: string;
}

export interface DesignQaResult {
  checkedAt: string;
  decision: "PASS" | "WARN" | "BLOCK";
  issues: DesignQaIssue[];
  scores: {
    structure: number;
    brand: number;
    layout: number;
    factual: number;
  };
}

function issue(
  code: string,
  severity: DesignQaSeverity,
  message: string,
  blocker = false,
  layerId?: string,
): DesignQaIssue {
  return { code, severity, message, blocker, ...(layerId ? { layerId } : {}) };
}

function normalizeColour(value: string | undefined): string | undefined {
  return value?.trim().toUpperCase();
}

function isInsideSafeArea(layer: DesignLayer, document: DesignDocument, ratio: number): boolean {
  const safe = safeAreaRect(
    { width: document.artboard.width, height: document.artboard.height },
    ratio,
  );
  return (
    layer.x >= safe.x &&
    layer.y >= safe.y &&
    layer.x + layer.width <= safe.x + safe.width &&
    layer.y + layer.height <= safe.y + safe.height
  );
}

function importantLayer(layer: DesignLayer): boolean {
  return (
    layer.type === "logo" ||
    (layer.type === "text" && ["headline", "cta", "price", "disclaimer"].includes(layer.role))
  );
}

function overlapArea(a: DesignLayer, b: DesignLayer): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function estimatedTextCapacity(layer: DesignTextLayer): number {
  const approximateCharactersPerLine = Math.max(1, Math.floor(layer.width / Math.max(1, layer.fontSize * 0.55)));
  const linePixelHeight = Math.max(1, layer.fontSize * layer.lineHeight);
  const lines = Math.max(1, Math.floor(layer.height / linePixelHeight));
  return approximateCharactersPerLine * lines;
}

function snapshotFact(snapshot: TaskTruthSnapshot | undefined, key: string): unknown {
  return snapshot?.facts.find((fact) => fact.key === key)?.value;
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function scoreFromIssues(issues: DesignQaIssue[], predicate: (item: DesignQaIssue) => boolean): number {
  let score = 10;
  for (const item of issues.filter(predicate)) {
    score -= item.severity === "HIGH" ? 2.5 : item.severity === "MEDIUM" ? 1.25 : 0.5;
  }
  return Math.max(0, Math.round(score * 10) / 10);
}

export function runDesignQa(input: {
  document: DesignDocument;
  truthSnapshot?: TaskTruthSnapshot;
  checkedAt?: string;
}): DesignQaResult {
  const { document } = input;
  const issues: DesignQaIssue[] = [];
  const structural = validateDesignDocument(document);
  for (const message of structural.issues) {
    issues.push(issue("DESIGN_DOCUMENT_INVALID", "HIGH", message, true));
  }

  const theme = getCreativeBrandTheme(document.brand.clientId, document.brand.brandId);
  const approvedColours = new Set(theme.qa.approvedColours.map((value) => value.toUpperCase()));
  const approvedFonts = new Set(theme.qa.approvedFonts);
  const safePercent = Math.round(theme.qa.safeAreaRatio * 100);
  const visible = document.layers.filter((layer) => layer.visible);

  const background = visible.find((layer) => layer.type === "background");
  if (!background) {
    issues.push(issue("BACKGROUND_MISSING", "HIGH", "The design requires a visible background layer.", true));
  }

  const logo = visible.find((layer) => layer.type === "logo");
  if (theme.qa.logoRequired && !logo) {
    issues.push(issue("LOGO_MISSING", "HIGH", `The design requires an ${theme.qa.logoRequirementLabel} layer.`, true));
  } else if (logo) {
    if (Math.min(logo.width, logo.height) < theme.qa.minimumLogoPx) {
      issues.push(issue(
        "LOGO_TOO_SMALL",
        "HIGH",
        `The approved logo/symbol is below the ${theme.qa.minimumLogoPx}px digital minimum.`,
        true,
        logo.id,
      ));
    }
    if (!isInsideSafeArea(logo, document, theme.qa.safeAreaRatio)) {
      issues.push(issue("LOGO_SAFE_AREA", "MEDIUM", `The logo is outside the recommended ${safePercent}% safe area.`, false, logo.id));
    }
  }

  for (const layer of visible) {
    if (importantLayer(layer) && !isInsideSafeArea(layer, document, theme.qa.safeAreaRatio)) {
      issues.push(issue("SAFE_MARGIN", "MEDIUM", `${layer.name} crosses the recommended ${safePercent}% safe area.`, false, layer.id));
    }
    if (layer.type === "text") {
      if (!approvedFonts.has(layer.fontFamily)) {
        issues.push(issue("NON_BRAND_FONT", "MEDIUM", `${layer.name} uses non-approved font ${layer.fontFamily}.`, false, layer.id));
      }
      const fill = normalizeColour(layer.fill);
      if (fill && !approvedColours.has(fill)) {
        issues.push(issue("NON_BRAND_COLOUR", "MEDIUM", `${layer.name} uses a non-token text colour ${layer.fill}.`, false, layer.id));
      }
      if (layer.text.length > estimatedTextCapacity(layer) * 1.15) {
        issues.push(issue("TEXT_OVERFLOW_RISK", "HIGH", `${layer.name} is likely to overflow its text box.`, false, layer.id));
      }
      if (layer.role === "price" && input.truthSnapshot) {
        const confirmedPrice = numericValue(snapshotFact(input.truthSnapshot, "price"));
        const renderedPrice = numericValue(layer.text);
        if (confirmedPrice !== undefined && renderedPrice !== confirmedPrice) {
          issues.push(issue("PRICE_TRUTH_MISMATCH", "HIGH", `Rendered price ${layer.text} differs from confirmed task truth.`, true, layer.id));
        }
      }
    }
    if (layer.type === "shape") {
      const fill = normalizeColour(layer.fill);
      const stroke = normalizeColour(layer.stroke);
      if (fill && !approvedColours.has(fill)) {
        issues.push(issue("NON_BRAND_COLOUR", "MEDIUM", `${layer.name} uses a non-token fill ${layer.fill}.`, false, layer.id));
      }
      if (stroke && !approvedColours.has(stroke)) {
        issues.push(issue("NON_BRAND_COLOUR", "MEDIUM", `${layer.name} uses a non-token stroke ${layer.stroke}.`, false, layer.id));
      }
    }
  }

  const important = visible.filter(importantLayer);
  for (let i = 0; i < important.length; i += 1) {
    const a = important[i]!;
    for (let j = i + 1; j < important.length; j += 1) {
      const b = important[j]!;
      const area = overlapArea(a, b);
      if (!area) continue;
      const smaller = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
      if (area / smaller > 0.12) {
        issues.push(issue("IMPORTANT_LAYER_COLLISION", "MEDIUM", `${a.name} substantially overlaps ${b.name}.`, false, a.id));
      }
    }
  }

  const confirmedBranchAvailability = snapshotFact(input.truthSnapshot, "branchAvailability");
  if (confirmedBranchAvailability === false) {
    issues.push(issue("BRANCH_UNAVAILABLE", "HIGH", "Confirmed task truth says the selected branch is unavailable for this product/campaign.", true));
  }

  const blockers = issues.some((item) => item.blocker);
  const decision: DesignQaResult["decision"] = blockers ? "BLOCK" : issues.length ? "WARN" : "PASS";
  return {
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    decision,
    issues,
    scores: {
      structure: scoreFromIssues(issues, (item) => item.code === "DESIGN_DOCUMENT_INVALID" || item.code === "BACKGROUND_MISSING"),
      brand: scoreFromIssues(issues, (item) => item.code.includes("BRAND") || item.code.startsWith("LOGO") || item.code === "NON_BRAND_FONT" || item.code === "NON_BRAND_COLOUR"),
      layout: scoreFromIssues(issues, (item) => item.code === "SAFE_MARGIN" || item.code === "IMPORTANT_LAYER_COLLISION" || item.code === "TEXT_OVERFLOW_RISK"),
      factual: scoreFromIssues(issues, (item) => item.code === "PRICE_TRUTH_MISMATCH" || item.code === "BRANCH_UNAVAILABLE"),
    },
  };
}
