import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "./creativeTypes.js";
import type { AtthasLayoutDefinition } from "./layouts/atthas.js";
import {
  getPhotographyPreset,
  selectPhotographyPresetId,
  type PhotographyPresetId,
} from "./photographyPresets.js";

export type StructuredImageBriefVersion = 2;

export interface StructuredImageBriefScope {
  brandId: string;
  branchId?: string;
}

export interface StructuredImageBriefSubject {
  productName: string;
  physicalState: string;
  compositionDescription: string;
  textureDescription: string;
  ingredientInteraction: string;
  scaleAndProportion: string;
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
  subject: StructuredImageBriefSubject;
  photography: {
    preset: PhotographyPresetId;
    perspective: string;
    lensFeel: string;
    lighting: string;
    depthOfField: string;
    realism: string;
  };
  composition: {
    heroPosition: string;
    heroScale: string;
    quietZones: string[];
    cropBehavior: string;
  };
  environment: {
    background: string;
    atmosphere?: string;
  };
  constraints: {
    noText: true;
    noLogos: true;
    noPrices: true;
    noPrintedPackaging: true;
    prohibitedElements: string[];
  };
  correction?: {
    previousQaIssues: string[];
  };
}

export type StructuredImageBriefValidationCode =
  | "FAIL_IMAGE_BRIEF_EMPTY_FIELD"
  | "FAIL_IMAGE_BRIEF_FORMAT"
  | "FAIL_IMAGE_BRIEF_COMPOSITION"
  | "FAIL_IMAGE_BRIEF_CONSTRAINT_POLICY"
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

export interface StructuredImageBriefFact {
  key: string;
  value: unknown;
}

export interface BuildStructuredImageBriefInput {
  campaignId: string;
  brandId: string;
  branchId?: string;
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  layout?: AtthasLayoutDefinition;
  compositionRequirements?: string[];
  verifiedFacts?: StructuredImageBriefFact[];
  subject?: Partial<StructuredImageBriefSubject>;
  photographyPresetId?: PhotographyPresetId;
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

function splitDelimited(value: string): string[] {
  return compactUnique(
    value
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function verifiedProductName(facts: StructuredImageBriefFact[] | undefined): string | undefined {
  const fact = facts?.find((item) => item.key === "productName" || item.key.startsWith("productName|"));
  if (typeof fact?.value !== "string") return undefined;
  const value = fact.value.trim();
  return value || undefined;
}

function firstMatchingRequirement(
  requirements: string[],
  patterns: RegExp[],
  fallback: string,
): string {
  return (
    requirements.find((requirement) => patterns.some((pattern) => pattern.test(requirement))) ??
    fallback
  );
}

function deriveQuietZones(requirements: string[]): string[] {
  const quiet = requirements.filter((requirement) =>
    /reserve|protect|quiet|uncluttered|negative space|message zone|action zone/i.test(requirement),
  );
  return compactUnique(quiet.length ? quiet : ["preserve one visually quiet overlay-safe area"]);
}

function fallbackPresetId(brandId: string): PhotographyPresetId {
  return brandId === "ATTHAS_RESTAURANT" ? "RESTAURANT_PLATED" : "QSR_MACRO_HERO";
}

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

function priceLeaksIntoGeneratedVisual(
  brief: StructuredImageBrief,
  creative: CampaignCreativeOutput | undefined,
): boolean {
  const price = creative?.overlaySpec.price;
  if (!price) return false;
  const visualText = generatedVisualText(brief);
  const text = visualText.toLowerCase();
  const amount = String(price.amount);
  const display = price.display.toLowerCase();
  const compactDisplay = price.display.replace(/[^0-9]/g, "");
  const compactText = visualText.replace(/[^0-9]/g, "");
  return (
    text.includes(display) ||
    new RegExp(`\\b${amount}\\b`).test(text) ||
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
    ["subject.productName", brief.subject.productName],
    ["subject.physicalState", brief.subject.physicalState],
    ["subject.compositionDescription", brief.subject.compositionDescription],
    ["subject.textureDescription", brief.subject.textureDescription],
    ["subject.ingredientInteraction", brief.subject.ingredientInteraction],
    ["subject.scaleAndProportion", brief.subject.scaleAndProportion],
    ["photography.perspective", brief.photography.perspective],
    ["photography.lensFeel", brief.photography.lensFeel],
    ["photography.lighting", brief.photography.lighting],
    ["photography.depthOfField", brief.photography.depthOfField],
    ["photography.realism", brief.photography.realism],
    ["composition.heroPosition", brief.composition.heroPosition],
    ["composition.heroScale", brief.composition.heroScale],
    ["composition.cropBehavior", brief.composition.cropBehavior],
    ["environment.background", brief.environment.background],
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

  if (brief.composition.quietZones.length === 0) {
    issues.push({
      code: "FAIL_IMAGE_BRIEF_COMPOSITION",
      message: "At least one deterministic quiet zone is required.",
    });
  }

  if (
    brief.constraints.noText !== true ||
    brief.constraints.noLogos !== true ||
    brief.constraints.noPrices !== true ||
    brief.constraints.noPrintedPackaging !== true
  ) {
    issues.push({
      code: "FAIL_IMAGE_BRIEF_CONSTRAINT_POLICY",
      message: "Text, logos, prices and printed packaging must remain prohibited.",
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
  const presetId = input.photographyPresetId
    ? input.photographyPresetId
    : input.layout
      ? selectPhotographyPresetId({ brandId: input.brandId, layout: input.layout })
      : fallbackPresetId(input.brandId);
  const preset = getPhotographyPreset(presetId);
  const requirements = compactUnique(
    input.layout?.imageCompositionRequirements ?? input.compositionRequirements ?? [],
  );
  const visualConstraints = compactUnique(input.creative.imageGeneration.visualConstraints);
  const subject: StructuredImageBriefSubject = {
    productName:
      input.subject?.productName?.trim() ||
      verifiedProductName(input.verifiedFacts) ||
      "Generic concept visual — no verified product identity",
    physicalState:
      input.subject?.physicalState?.trim() ||
      "physically plausible generic concept subject; do not imply a specific menu item, preparation method or product identity",
    compositionDescription:
      input.subject?.compositionDescription?.trim() ||
      compactUnique([
        input.creative.creativeBrief.visualDirection,
        input.creative.creativeBrief.composition,
        ...visualConstraints,
      ]).join("; "),
    textureDescription:
      input.subject?.textureDescription?.trim() ||
      "show only neutral, directly visible material texture; do not infer unverified condition, temperature, moisture, preparation or sensory attributes",
    ingredientInteraction:
      input.subject?.ingredientInteraction?.trim() ||
      "do not add or infer ingredients; ingredient layering or contact must come from verified product facts or a governed physical-food composition",
    scaleAndProportion:
      input.subject?.scaleAndProportion?.trim() ||
      "believable food scale with physically credible relative proportions and gravity",
  };

  const brief: StructuredImageBrief = {
    version: 2,
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
    subject,
    photography: {
      preset: preset.id,
      perspective: preset.perspective,
      lensFeel: preset.lensFeel,
      lighting: preset.lighting,
      depthOfField: preset.depthOfField,
      realism: preset.realism,
    },
    composition: {
      heroPosition: firstMatchingRequirement(
        requirements,
        [/hero/i, /subject/i, /food/i],
        "place the primary subject in the layout-defined focal region",
      ),
      heroScale:
        input.layout?.copyDensity === "low"
          ? "single dominant subject with generous breathing room"
          : "dominant food subject with enough scale to remain immediately readable",
      quietZones: deriveQuietZones(requirements),
      cropBehavior: firstMatchingRequirement(
        requirements,
        [/crop/i, /safe area/i, /outer/i, /platform ui/i],
        `compose safely for ${input.format.aspectRatio} without cutting critical subject detail`,
      ),
    },
    environment: {
      background: preset.background,
      ...(preset.atmosphere ? { atmosphere: preset.atmosphere } : {}),
    },
    constraints: {
      noText: true,
      noLogos: true,
      noPrices: true,
      noPrintedPackaging: true,
      prohibitedElements: compactUnique([
        ...splitDelimited(input.creative.imageGeneration.negativePrompt),
        "promotional copy",
        "letters or numbers",
        "prices",
        "logos",
        "badges",
        "labels",
        "printed packaging",
        "app UI",
        "watermarks",
      ]),
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
    "STRUCTURED IMAGE BRIEF v2",
    `Campaign: ${brief.campaignId}`,
    `Scope: ${brief.scope.brandId}${brief.scope.branchId ? ` / ${brief.scope.branchId}` : ""}`,
    `Output format: ${brief.format.aspectRatio} (${brief.format.width}x${brief.format.height})`,
    [
      "SUBJECT",
      `Product identity: ${brief.subject.productName}`,
      `Physical state: ${brief.subject.physicalState}`,
      `Physical composition: ${brief.subject.compositionDescription}`,
      `Surface texture: ${brief.subject.textureDescription}`,
      `Ingredient interaction: ${brief.subject.ingredientInteraction}`,
      `Scale and proportion: ${brief.subject.scaleAndProportion}`,
    ].join("\n"),
    [
      "PHOTOGRAPHY",
      `Preset: ${brief.photography.preset}`,
      `Perspective: ${brief.photography.perspective}`,
      `Lens feel: ${brief.photography.lensFeel}`,
      `Lighting: ${brief.photography.lighting}`,
      `Depth of field: ${brief.photography.depthOfField}`,
      `Realism: ${brief.photography.realism}`,
    ].join("\n"),
    [
      "COMPOSITION",
      `Hero position: ${brief.composition.heroPosition}`,
      `Hero scale: ${brief.composition.heroScale}`,
      `Crop behavior: ${brief.composition.cropBehavior}`,
      bulletBlock("Quiet zones:", brief.composition.quietZones),
    ].filter(Boolean).join("\n"),
    [
      "ENVIRONMENT",
      `Background: ${brief.environment.background}`,
      ...(brief.environment.atmosphere
        ? [`Atmosphere: ${brief.environment.atmosphere}`]
        : []),
    ].join("\n"),
    [
      "CONSTRAINTS",
      "- No text",
      "- No logos",
      "- No prices",
      "- No printed packaging",
      ...brief.constraints.prohibitedElements.map((value) => `- Prohibit: ${value}`),
    ].join("\n"),
    brief.correction
      ? bulletBlock(
          "PREVIOUS VISUAL QA CORRECTIONS REQUIRED:",
          brief.correction.previousQaIssues,
        )
      : "",
    "OUTPUT CONTRACT\nReturn an image only. Do not invent product facts, ingredients, cooking methods, offers or branded assets.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
