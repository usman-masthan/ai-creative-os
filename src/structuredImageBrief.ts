import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "./creativeTypes.js";

export type StructuredImageBriefVersion = 1;

export interface StructuredImageBriefScope {
  brandId: string;
  branchId?: string;
}

export interface StructuredImageBrief {
  version: StructuredImageBriefVersion;
  campaignId: string;
  scope: StructuredImageBriefScope;
  format: {
    aspectRatio: string;
    width: number;
    height: number;
  };
  subject: {
    direction: string;
    generationPrompt: string;
  };
  composition: {
    artDirection: string;
    requirements: string[];
  };
  photography: {
    style: string;
    lighting: string;
  };
  constraints: {
    visual: string[];
    negative: string[];
    textPolicy: "NO_TEXT_OR_LOGOS";
    generatedTextAllowed: false;
    generatedLogosAllowed: false;
  };
  correction?: {
    previousQaIssues: string[];
  };
}

export type StructuredImageBriefValidationCode =
  | "FAIL_IMAGE_BRIEF_EMPTY_FIELD"
  | "FAIL_IMAGE_BRIEF_FORMAT"
  | "FAIL_IMAGE_BRIEF_COMPOSITION"
  | "FAIL_IMAGE_BRIEF_TEXT_POLICY"
  | "FAIL_IMAGE_BRIEF_PRICE_LEAK"
  | "FAIL_IMAGE_BRIEF_LOGO_LEAK";

export interface StructuredImageBriefValidationIssue {
  code: StructuredImageBriefValidationCode;
  message: string;
}

export interface StructuredImageBriefValidationResult {
  valid: boolean;
  issues: StructuredImageBriefValidationIssue[];
}

export interface BuildStructuredImageBriefInput {
  campaignId: string;
  brandId: string;
  branchId?: string;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  compositionRequirements: string[];
  previousQaIssues?: string[];
}

function compactUnique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }
  return output;
}

function splitNegativePrompt(value: string): string[] {
  return compactUnique(
    value
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function generatedVisualText(brief: StructuredImageBrief): string {
  return [
    brief.subject.direction,
    brief.subject.generationPrompt,
    brief.composition.artDirection,
    brief.photography.style,
    brief.photography.lighting,
    ...brief.composition.requirements,
    ...brief.constraints.visual,
  ].join("\n");
}

function priceLeaksIntoGeneratedVisual(
  brief: StructuredImageBrief,
  creative: CampaignCreativeOutput | undefined,
): boolean {
  const price = creative?.overlaySpec.price;
  if (!price) return false;
  const text = generatedVisualText(brief).toLowerCase();
  const amount = String(price.amount);
  const display = price.display.toLowerCase();
  const compactDisplay = price.display.replace(/[^0-9]/g, "");
  const compactText = generatedVisualText(brief).replace(/[^0-9]/g, "");
  return (
    text.includes(display) ||
    new RegExp(`\\b${amount.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`).test(text) ||
    (compactDisplay.length >= 3 && compactText.includes(compactDisplay))
  );
}

function asksModelToRenderLogo(brief: StructuredImageBrief): boolean {
  const text = generatedVisualText(brief).toLowerCase();
  return /\b(?:show|include|feature|display|place|render|add|with)\b[^.\n]{0,40}\blogo\b/.test(text);
}

export function validateStructuredImageBrief(
  brief: StructuredImageBrief,
  creative?: CampaignCreativeOutput,
): StructuredImageBriefValidationResult {
  const issues: StructuredImageBriefValidationIssue[] = [];
  const requiredText: Array<[string, string]> = [
    ["campaignId", brief.campaignId],
    ["scope.brandId", brief.scope.brandId],
    ["format.aspectRatio", brief.format.aspectRatio],
    ["subject.direction", brief.subject.direction],
    ["subject.generationPrompt", brief.subject.generationPrompt],
    ["composition.artDirection", brief.composition.artDirection],
    ["photography.style", brief.photography.style],
    ["photography.lighting", brief.photography.lighting],
  ];

  for (const [path, value] of requiredText) {
    if (!value.trim()) {
      issues.push({
        code: "FAIL_IMAGE_BRIEF_EMPTY_FIELD",
        message: `${path} must be a non-empty string.`,
      });
    }
  }

  if (
    !Number.isInteger(brief.format.width) ||
    !Number.isInteger(brief.format.height) ||
    brief.format.width <= 0 ||
    brief.format.height <= 0
  ) {
    issues.push({
      code: "FAIL_IMAGE_BRIEF_FORMAT",
      message: "format width and height must be positive integers.",
    });
  }

  if (brief.composition.requirements.length === 0) {
    issues.push({
      code: "FAIL_IMAGE_BRIEF_COMPOSITION",
      message: "At least one deterministic layout composition requirement is required.",
    });
  }

  if (
    brief.constraints.textPolicy !== "NO_TEXT_OR_LOGOS" ||
    brief.constraints.generatedTextAllowed !== false ||
    brief.constraints.generatedLogosAllowed !== false
  ) {
    issues.push({
      code: "FAIL_IMAGE_BRIEF_TEXT_POLICY",
      message: "Generated text and logos must remain disabled in the image brief.",
    });
  }

  if (priceLeaksIntoGeneratedVisual(brief, creative)) {
    issues.push({
      code: "FAIL_IMAGE_BRIEF_PRICE_LEAK",
      message: "Customer-facing price data leaked into the generated-visual portion of the image brief.",
    });
  }

  if (asksModelToRenderLogo(brief)) {
    issues.push({
      code: "FAIL_IMAGE_BRIEF_LOGO_LEAK",
      message: "The image brief asks the generative model to render a logo.",
    });
  }

  return { valid: issues.length === 0, issues };
}

export function assertStructuredImageBrief(
  brief: StructuredImageBrief,
  creative?: CampaignCreativeOutput,
): void {
  const validation = validateStructuredImageBrief(brief, creative);
  if (validation.valid) return;
  throw new Error(
    validation.issues
      .map((issue) => `${issue.code}: ${issue.message}`)
      .join(" | "),
  );
}

export function buildStructuredImageBrief(
  input: BuildStructuredImageBriefInput,
): StructuredImageBrief {
  const brief: StructuredImageBrief = {
    version: 1,
    campaignId: input.campaignId,
    scope: {
      brandId: input.brandId,
      ...(input.branchId ? { branchId: input.branchId } : {}),
    },
    format: {
      aspectRatio: input.format.aspectRatio,
      width: input.format.width,
      height: input.format.height,
    },
    subject: {
      direction: input.creative.creativeBrief.visualDirection.trim(),
      generationPrompt: input.creative.imageGeneration.basePrompt.trim(),
    },
    composition: {
      artDirection: input.creative.creativeBrief.composition.trim(),
      requirements: compactUnique(input.compositionRequirements),
    },
    photography: {
      style: input.creative.creativeBrief.photographyStyle.trim(),
      lighting: input.creative.creativeBrief.lighting.trim(),
    },
    constraints: {
      visual: compactUnique(input.creative.imageGeneration.visualConstraints),
      negative: splitNegativePrompt(input.creative.imageGeneration.negativePrompt),
      textPolicy: "NO_TEXT_OR_LOGOS",
      generatedTextAllowed: false,
      generatedLogosAllowed: false,
    },
    ...(input.previousQaIssues?.length
      ? { correction: { previousQaIssues: compactUnique(input.previousQaIssues) } }
      : {}),
  };

  assertStructuredImageBrief(brief, input.creative);
  return brief;
}

function bulletBlock(title: string, values: string[]): string {
  if (values.length === 0) return "";
  return `${title}\n${values.map((value) => `- ${value}`).join("\n")}`;
}

export function compileStructuredImagePrompt(brief: StructuredImageBrief): string {
  assertStructuredImageBrief(brief);
  return [
    "STRUCTURED IMAGE BRIEF v1",
    `Campaign: ${brief.campaignId}`,
    `Scope: ${brief.scope.brandId}${brief.scope.branchId ? ` / ${brief.scope.branchId}` : ""}`,
    `Output format: ${brief.format.aspectRatio} (${brief.format.width}x${brief.format.height})`,
    `Subject direction:\n${brief.subject.direction}`,
    `Primary generation direction:\n${brief.subject.generationPrompt}`,
    `Art direction:\n${brief.composition.artDirection}`,
    bulletBlock("Deterministic composition requirements:", brief.composition.requirements),
    `Photography style:\n${brief.photography.style}`,
    `Lighting:\n${brief.photography.lighting}`,
    bulletBlock("Hard visual constraints:", brief.constraints.visual),
    bulletBlock("Avoid:", brief.constraints.negative),
    brief.correction
      ? bulletBlock(
          "Previous visual QA corrections required:",
          brief.correction.previousQaIssues,
        )
      : "",
    "OUTPUT CONTRACT\n- Return an image only.\n- Do not render promotional copy, letters, numbers, prices, logos, badges, labels, app UI or watermarks.\n- Do not invent product facts, ingredients, offers or branded assets.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
