import {
  findUnsupportedClaimTermsInText,
  type ClaimGovernance,
} from "./claimGovernance.js";
import type { CampaignPreflight } from "./commands/createCampaign.js";
import type { CampaignCreativeOutput } from "./creativeTypes.js";
import type { CampaignGenerationProvider } from "./providers/types.js";
import {
  validateStructuredImageBrief,
  type StructuredImageBrief,
  type StructuredImageBriefSubject,
} from "./structuredImageBrief.js";

export type StructuredBriefGovernanceIssueCode =
  | "FAIL_STRUCTURED_BRIEF_BASE_CONTRACT"
  | "FAIL_STRUCTURED_BRIEF_UNSUPPORTED_CLAIM"
  | "FAIL_STRUCTURED_BRIEF_FABRICATED_PACKAGING"
  | "FAIL_STRUCTURED_BRIEF_GRAPHIC_DESIGN_LANGUAGE"
  | "FAIL_STRUCTURED_BRIEF_PROMOTIONAL_COPY"
  | "FAIL_STRUCTURED_BRIEF_REPAIR_OUTPUT";

export interface StructuredBriefGovernanceIssue {
  code: StructuredBriefGovernanceIssueCode;
  message: string;
  evidence?: string;
}

export interface StructuredBriefGovernanceValidation {
  valid: boolean;
  issues: StructuredBriefGovernanceIssue[];
}

export interface GovernStructuredImageBriefInput {
  brief: StructuredImageBrief;
  preflight: CampaignPreflight;
  creative: CampaignCreativeOutput;
  repairProvider: CampaignGenerationProvider;
  claimGovernance?: ClaimGovernance;
  maxRepairAttempts?: number;
}

export type GovernStructuredImageBriefResult =
  | {
      status: "VALID" | "REPAIRED";
      brief: StructuredImageBrief;
      repairs: number;
      issuesBeforeRepair: StructuredBriefGovernanceIssue[];
    }
  | {
      status: "HUMAN_REVIEW";
      brief: StructuredImageBrief;
      repairs: number;
      issues: StructuredBriefGovernanceIssue[];
      issuesBeforeRepair: StructuredBriefGovernanceIssue[];
    };

const GRAPHIC_DESIGN_PATTERNS: RegExp[] = [
  /\b(?:red|yellow|white|black|cream|grey|gray)\s+(?:rectangle|card|box|panel|strip|banner)\b/i,
  /\b(?:cta|headline|price|copy|text|offer)\s+(?:box|panel|card|strip|banner|badge)\b/i,
  /\b(?:top|bottom|side)\s+(?:strip|banner|panel)\b/i,
  /\bgraphic\s+(?:layout|design|element|device)\b/i,
];

const POSITIVE_PACKAGING_PATTERNS: RegExp[] = [
  /\b(?:branded|printed|logo(?:ed)?|custom)\s+(?:box|bag|wrapper|cup|bucket|packaging|container)\b/i,
  /\b(?:show|include|feature|display|place|add|with|beside|inside|served\s+in|packaged\s+in)\b[^.\n]{0,50}\b(?:box|bag|wrapper|cup|bucket|packaging|container)\b/i,
];

function generatedVisualText(brief: StructuredImageBrief): string {
  return [
    brief.subject.productName,
    brief.subject.physicalState,
    brief.subject.compositionDescription,
    brief.subject.textureDescription,
    brief.subject.ingredientInteraction,
    brief.subject.scaleAndProportion,
    brief.photography.perspective,
    brief.photography.lensFeel,
    brief.photography.lighting,
    brief.photography.depthOfField,
    brief.photography.realism,
    brief.composition.heroPosition,
    brief.composition.heroScale,
    ...brief.composition.quietZones,
    brief.composition.cropBehavior,
    brief.environment.background,
    brief.environment.atmosphere ?? "",
  ].join("\n");
}

function normalizedFactText(preflight: CampaignPreflight): string {
  return preflight.facts
    .map((fact) => {
      if (Array.isArray(fact.value)) return fact.value.join(" ");
      if (typeof fact.value === "object" && fact.value !== null) return JSON.stringify(fact.value);
      return String(fact.value);
    })
    .join("\n")
    .toLowerCase();
}

function firstPatternEvidence(text: string, patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return undefined;
}

function promotionalLeak(
  briefText: string,
  creative: CampaignCreativeOutput,
  productName: string,
): string | undefined {
  const normalized = briefText.toLowerCase();
  const product = productName.trim().toLowerCase();
  const candidates = [
    creative.overlaySpec.supportingCopy,
    creative.overlaySpec.cta,
    creative.overlaySpec.price?.display,
    creative.creativeBrief.supportingCopy,
    creative.creativeBrief.cta,
    creative.overlaySpec.headline,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length >= 3)
    .filter((value) => value.toLowerCase() !== product);

  return candidates.find((value) => normalized.includes(value.toLowerCase()));
}

export function validateStructuredBriefGovernance(input: {
  brief: StructuredImageBrief;
  preflight: CampaignPreflight;
  creative: CampaignCreativeOutput;
  claimGovernance?: ClaimGovernance;
}): StructuredBriefGovernanceValidation {
  const issues: StructuredBriefGovernanceIssue[] = [];
  const base = validateStructuredImageBrief(input.brief, input.creative);
  for (const issue of base.issues) {
    issues.push({
      code: "FAIL_STRUCTURED_BRIEF_BASE_CONTRACT",
      message: issue.message,
      evidence: issue.code,
    });
  }

  const visualText = generatedVisualText(input.brief);
  const verifiedText = normalizedFactText(input.preflight);

  const unsupported = findUnsupportedClaimTermsInText(
    visualText,
    input.preflight,
    input.claimGovernance ?? {},
  );
  for (const term of unsupported) {
    issues.push({
      code: "FAIL_STRUCTURED_BRIEF_UNSUPPORTED_CLAIM",
      message: `Generated visual brief contains unsupported claim or ingredient language: ${term}.`,
      evidence: term,
    });
  }

  const packaging = firstPatternEvidence(visualText, POSITIVE_PACKAGING_PATTERNS);
  if (packaging && !verifiedText.includes(packaging.toLowerCase())) {
    issues.push({
      code: "FAIL_STRUCTURED_BRIEF_FABRICATED_PACKAGING",
      message: "Generated visual brief introduces packaging or branded-container direction that is not verified.",
      evidence: packaging,
    });
  }

  const graphicDesign = firstPatternEvidence(visualText, GRAPHIC_DESIGN_PATTERNS);
  if (graphicDesign) {
    issues.push({
      code: "FAIL_STRUCTURED_BRIEF_GRAPHIC_DESIGN_LANGUAGE",
      message: "Generated visual brief contains graphic-layout language. Layout graphics belong to the deterministic renderer, not the image model.",
      evidence: graphicDesign,
    });
  }

  const leakedCopy = promotionalLeak(
    visualText,
    input.creative,
    input.brief.subject.productName,
  );
  if (leakedCopy) {
    issues.push({
      code: "FAIL_STRUCTURED_BRIEF_PROMOTIONAL_COPY",
      message: "Promotional/customer-facing copy leaked into the generated visual brief.",
      evidence: leakedCopy,
    });
  }

  return { valid: issues.length === 0, issues };
}

function normalizeRepairAttempts(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isInteger(value) || value < 0 || value > 2) {
    throw new Error("maxStructuredBriefRepairAttempts must be an integer from 0 to 2.");
  }
  return value;
}

function parseRepairSubject(raw: string, expectedProductName: string): StructuredImageBriefSubject {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced);
  } catch {
    throw new Error("Structured brief repair output must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Structured brief repair output must be a JSON object.");
  }
  const value = parsed as Record<string, unknown>;
  const keys: Array<keyof StructuredImageBriefSubject> = [
    "productName",
    "physicalState",
    "compositionDescription",
    "textureDescription",
    "ingredientInteraction",
    "scaleAndProportion",
  ];
  const output = {} as StructuredImageBriefSubject;
  for (const key of keys) {
    const item = value[key];
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`Structured brief repair output requires non-empty ${key}.`);
    }
    output[key] = item.trim();
  }
  if (output.productName !== expectedProductName) {
    throw new Error("Structured brief repair cannot change the verified product identity.");
  }
  return output;
}

export function buildStructuredBriefRepairPrompt(input: {
  brief: StructuredImageBrief;
  preflight: CampaignPreflight;
  issues: StructuredBriefGovernanceIssue[];
}): string {
  return [
    "You are repairing only the SUBJECT portion of a governed image-generation brief.",
    "Return JSON only. Do not use markdown.",
    "",
    "HARD RULES",
    "- Keep productName exactly unchanged.",
    "- Remove graphic layout instructions.",
    "- Preserve photographic/physical composition intent only when it is fact-safe.",
    "- Do not add facts, ingredients, cooking methods, qualities, portion claims, packaging, offers, prices, logos, text, labels or promotional copy.",
    "- Use only facts present in VERIFIED FACTS.",
    "- Do not modify photography preset, lens, lighting, quiet zones, crop behavior, environment or hard constraints; those are deterministic and are not part of your output.",
    "",
    `GOVERNANCE ISSUES\n${input.issues.map((issue) => `- ${issue.code}: ${issue.message}${issue.evidence ? ` [${issue.evidence}]` : ""}`).join("\n")}`,
    "",
    `VERIFIED FACTS\n${JSON.stringify(input.preflight.facts, null, 2)}`,
    "",
    `CURRENT SUBJECT\n${JSON.stringify(input.brief.subject, null, 2)}`,
    "",
    "OUTPUT JSON SCHEMA",
    JSON.stringify(
      {
        productName: input.brief.subject.productName,
        physicalState: "string",
        compositionDescription: "string",
        textureDescription: "string",
        ingredientInteraction: "string",
        scaleAndProportion: "string",
      },
      null,
      2,
    ),
  ].join("\n");
}

export async function governStructuredImageBrief(
  input: GovernStructuredImageBriefInput,
): Promise<GovernStructuredImageBriefResult> {
  const maxRepairs = normalizeRepairAttempts(input.maxRepairAttempts);
  let current = input.brief;
  let validation = validateStructuredBriefGovernance({
    brief: current,
    preflight: input.preflight,
    creative: input.creative,
    ...(input.claimGovernance ? { claimGovernance: input.claimGovernance } : {}),
  });
  const issuesBeforeRepair = [...validation.issues];
  if (validation.valid) {
    return { status: "VALID", brief: current, repairs: 0, issuesBeforeRepair };
  }

  let repairs = 0;
  while (repairs < maxRepairs) {
    repairs += 1;
    const prompt = buildStructuredBriefRepairPrompt({
      brief: current,
      preflight: input.preflight,
      issues: validation.issues,
    });

    try {
      const raw = await input.repairProvider.generate(prompt);
      const subject = parseRepairSubject(raw, current.subject.productName);
      current = { ...current, subject };
      validation = validateStructuredBriefGovernance({
        brief: current,
        preflight: input.preflight,
        creative: input.creative,
        ...(input.claimGovernance ? { claimGovernance: input.claimGovernance } : {}),
      });
    } catch (error) {
      validation = {
        valid: false,
        issues: [
          {
            code: "FAIL_STRUCTURED_BRIEF_REPAIR_OUTPUT",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }

    if (validation.valid) {
      return { status: "REPAIRED", brief: current, repairs, issuesBeforeRepair };
    }
  }

  return {
    status: "HUMAN_REVIEW",
    brief: current,
    repairs,
    issues: validation.issues,
    issuesBeforeRepair,
  };
}
