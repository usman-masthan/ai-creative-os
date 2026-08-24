import type {
  CampaignConcept,
  CampaignConceptRole,
  CampaignCreativeOutput,
} from "./creativeTypes.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  object: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid campaign creative output: ${path}.${key} must be a non-empty string.`);
  }
  return value;
}

function optionalString(
  object: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  const value = object[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`Invalid campaign creative output: ${path}.${key} must be a string when supplied.`);
  }
  return value;
}

function requireStringArray(
  object: Record<string, unknown>,
  key: string,
  path: string,
): string[] {
  const value = object[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`Invalid campaign creative output: ${path}.${key} must be a string array.`);
  }
  return value;
}

const expectedRoles: CampaignConceptRole[] = [
  "conversion",
  "crave-emotion",
  "brand-building",
];

function validateConcept(value: unknown, index: number): CampaignConcept {
  if (!isRecord(value)) {
    throw new Error(`Invalid campaign creative output: concepts[${index}] must be an object.`);
  }

  const strength = value.expectedStrength;
  if (
    typeof strength !== "number" ||
    !Number.isInteger(strength) ||
    strength < 1 ||
    strength > 10
  ) {
    throw new Error(
      `Invalid campaign creative output: concepts[${index}].expectedStrength must be an integer from 1 to 10.`,
    );
  }

  const strategicRole = requireString(value, "strategicRole", `concepts[${index}]`) as CampaignConceptRole;
  if (strategicRole !== expectedRoles[index]) {
    throw new Error(
      `Invalid campaign creative output: concepts[${index}].strategicRole must be ${expectedRoles[index]}.`,
    );
  }

  return {
    id: requireString(value, "id", `concepts[${index}]`),
    strategicRole,
    campaignName: requireString(value, "campaignName", `concepts[${index}]`),
    coreIdea: requireString(value, "coreIdea", `concepts[${index}]`),
    customerEmotion: requireString(value, "customerEmotion", `concepts[${index}]`),
    headlineDirection: requireString(value, "headlineDirection", `concepts[${index}]`),
    visualConcept: requireString(value, "visualConcept", `concepts[${index}]`),
    cta: requireString(value, "cta", `concepts[${index}]`),
    targetAudience: requireString(value, "targetAudience", `concepts[${index}]`),
    expectedStrength: strength,
    risks: requireStringArray(value, "risks", `concepts[${index}]`),
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("Invalid campaign creative output: provider did not return a JSON object.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence.slice(start, end + 1));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown JSON parse error";
    throw new Error(`Invalid campaign creative output: malformed JSON (${message}).`);
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid campaign creative output: root must be an object.");
  }

  return parsed;
}

export function parseCampaignCreativeOutput(raw: string): CampaignCreativeOutput {
  const root = parseJsonObject(raw);

  if (!Array.isArray(root.concepts) || root.concepts.length !== 3) {
    throw new Error("Invalid campaign creative output: exactly 3 concepts are required.");
  }

  const concepts = root.concepts.map(validateConcept);
  const ids = new Set(concepts.map((concept) => concept.id));

  if (ids.size !== 3) {
    throw new Error("Invalid campaign creative output: concept IDs must be unique.");
  }

  if (concepts[0]?.id !== "C1" || concepts[1]?.id !== "C2" || concepts[2]?.id !== "C3") {
    throw new Error("Invalid campaign creative output: concepts must use C1, C2, C3 in order.");
  }

  const recommendedConceptId = requireString(root, "recommendedConceptId", "root");
  if (!ids.has(recommendedConceptId)) {
    throw new Error(
      "Invalid campaign creative output: recommendedConceptId must reference one of the generated concepts.",
    );
  }

  const creativeBriefValue = root.creativeBrief;
  if (!isRecord(creativeBriefValue)) {
    throw new Error("Invalid campaign creative output: creativeBrief must be an object.");
  }

  const imageGenerationValue = root.imageGeneration;
  if (!isRecord(imageGenerationValue)) {
    throw new Error("Invalid campaign creative output: imageGeneration must be an object.");
  }

  const textPolicy = requireString(imageGenerationValue, "textPolicy", "imageGeneration");
  if (textPolicy !== "NO_TEXT_OR_LOGOS") {
    throw new Error(
      "Invalid campaign creative output: imageGeneration.textPolicy must be NO_TEXT_OR_LOGOS.",
    );
  }

  const overlaySpecValue = root.overlaySpec;
  if (!isRecord(overlaySpecValue)) {
    throw new Error("Invalid campaign creative output: overlaySpec must be an object.");
  }

  const logoUsage = requireString(overlaySpecValue, "logoUsage", "overlaySpec");
  if (logoUsage !== "APPROVED_ONLY" && logoUsage !== "OMIT") {
    throw new Error(
      "Invalid campaign creative output: overlaySpec.logoUsage must be APPROVED_ONLY or OMIT.",
    );
  }

  const placementHintsValue = overlaySpecValue.placementHints;
  if (!isRecord(placementHintsValue)) {
    throw new Error("Invalid campaign creative output: overlaySpec.placementHints must be an object.");
  }

  const price = optionalString(overlaySpecValue, "price", "overlaySpec");
  const pricePlacement = optionalString(placementHintsValue, "price", "overlaySpec.placementHints");

  return {
    concepts,
    recommendedConceptId,
    recommendationReason: requireString(root, "recommendationReason", "root"),
    creativeBrief: {
      headline: requireString(creativeBriefValue, "headline", "creativeBrief"),
      supportingCopy: requireString(creativeBriefValue, "supportingCopy", "creativeBrief"),
      cta: requireString(creativeBriefValue, "cta", "creativeBrief"),
      visualDirection: requireString(creativeBriefValue, "visualDirection", "creativeBrief"),
      composition: requireString(creativeBriefValue, "composition", "creativeBrief"),
      lighting: requireString(creativeBriefValue, "lighting", "creativeBrief"),
      photographyStyle: requireString(creativeBriefValue, "photographyStyle", "creativeBrief"),
      aspectRatio: requireString(creativeBriefValue, "aspectRatio", "creativeBrief"),
    },
    caption: requireString(root, "caption", "root"),
    imageGeneration: {
      basePrompt: requireString(imageGenerationValue, "basePrompt", "imageGeneration"),
      negativePrompt: requireString(imageGenerationValue, "negativePrompt", "imageGeneration"),
      visualConstraints: requireStringArray(imageGenerationValue, "visualConstraints", "imageGeneration"),
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: requireString(overlaySpecValue, "headline", "overlaySpec"),
      supportingCopy: requireString(overlaySpecValue, "supportingCopy", "overlaySpec"),
      ...(price ? { price } : {}),
      cta: requireString(overlaySpecValue, "cta", "overlaySpec"),
      logoUsage,
      placementHints: {
        headline: requireString(placementHintsValue, "headline", "overlaySpec.placementHints"),
        supportingCopy: requireString(
          placementHintsValue,
          "supportingCopy",
          "overlaySpec.placementHints",
        ),
        ...(pricePlacement ? { price: pricePlacement } : {}),
        cta: requireString(placementHintsValue, "cta", "overlaySpec.placementHints"),
        logo: requireString(placementHintsValue, "logo", "overlaySpec.placementHints"),
      },
    },
    factualQaNotes: requireStringArray(root, "factualQaNotes", "root"),
  };
}
