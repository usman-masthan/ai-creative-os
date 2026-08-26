import { mkdir, writeFile } from "node:fs/promises";

import { createGeminiCampaignProvider } from "../src/providers/gemini.js";

interface PrototypeCase {
  id: string;
  productLabel: string;
  confirmedIngredients: string[];
  confirmedCookingMethods: string[];
}

interface ComposerOutput {
  physicalState: string;
  compositionDescription: string;
  textureDescription: string;
  ingredientInteraction: string;
  scaleAndProportion: string;
  ingredientsReferenced: string[];
  cookingMethodsReferenced: string[];
  qualityClaims: string[];
}

interface PrototypeResult {
  id: string;
  productLabel: string;
  status: "PASS" | "FAIL";
  issues: string[];
  output?: ComposerOutput;
  raw?: string;
}

const cases: PrototypeCase[] = [
  {
    id: "P01",
    productLabel: "Chicken tikka layered sandwich prototype",
    confirmedIngredients: ["chicken tikka", "sauce", "lettuce", "onion", "tomato", "coriander"],
    confirmedCookingMethods: [],
  },
  {
    id: "P02",
    productLabel: "Beef burger prototype",
    confirmedIngredients: ["beef patty", "cheese", "lettuce", "onion", "sauce", "burger bun"],
    confirmedCookingMethods: [],
  },
  {
    id: "P03",
    productLabel: "Crispy chicken burger prototype",
    confirmedIngredients: ["crispy chicken fillet", "cheese", "lettuce", "sauce", "burger bun"],
    confirmedCookingMethods: [],
  },
  {
    id: "P04",
    productLabel: "Chicken wrap prototype",
    confirmedIngredients: ["chicken", "tortilla", "lettuce", "tomato", "onion", "sauce"],
    confirmedCookingMethods: [],
  },
  {
    id: "P05",
    productLabel: "Confirmed grilled chicken wrap prototype",
    confirmedIngredients: ["chicken", "tortilla", "lettuce", "sauce"],
    confirmedCookingMethods: ["grilled"],
  },
  {
    id: "P06",
    productLabel: "Confirmed fried chicken sandwich prototype",
    confirmedIngredients: ["chicken", "bread", "lettuce", "sauce"],
    confirmedCookingMethods: ["fried"],
  },
  {
    id: "P07",
    productLabel: "Chicken kebab plate prototype",
    confirmedIngredients: ["chicken kebab", "onion", "tomato", "coriander", "sauce"],
    confirmedCookingMethods: [],
  },
  {
    id: "P08",
    productLabel: "Rice and chicken curry prototype",
    confirmedIngredients: ["rice", "chicken curry", "onion", "coriander"],
    confirmedCookingMethods: [],
  },
  {
    id: "P09",
    productLabel: "Vegetarian sandwich prototype",
    confirmedIngredients: ["cheese", "lettuce", "tomato", "onion", "sauce", "bread"],
    confirmedCookingMethods: [],
  },
  {
    id: "P10",
    productLabel: "Shared table prototype",
    confirmedIngredients: ["rice", "chicken curry", "flatbread", "salad"],
    confirmedCookingMethods: [],
  },
];

const forbiddenQualityTerms = [
  "fresh",
  "freshly",
  "juicy",
  "smoky",
  "premium",
  "homemade",
  "organic",
  "spicy",
  "tender",
  "succulent",
  "authentic",
  "best",
  "delicious",
  "mouthwatering",
];

const knownCookingMethods = [
  "grilled",
  "fried",
  "deep-fried",
  "baked",
  "roasted",
  "smoked",
  "steamed",
  "boiled",
  "braised",
  "barbecued",
  "chargrilled",
  "tandoori",
];

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseJson(raw: string): unknown {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Composer did not return a JSON object.");
  return JSON.parse(trimmed.slice(start, end + 1));
}

function requireString(record: Record<string, unknown>, key: keyof ComposerOutput): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${String(key)} must be a non-empty string.`);
  }
  return value.trim();
}

function requireStringArray(record: Record<string, unknown>, key: keyof ComposerOutput): string[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${String(key)} must be a string array.`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseComposerOutput(raw: string): ComposerOutput {
  const value = parseJson(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Composer output root must be an object.");
  }
  const record = value as Record<string, unknown>;
  return {
    physicalState: requireString(record, "physicalState"),
    compositionDescription: requireString(record, "compositionDescription"),
    textureDescription: requireString(record, "textureDescription"),
    ingredientInteraction: requireString(record, "ingredientInteraction"),
    scaleAndProportion: requireString(record, "scaleAndProportion"),
    ingredientsReferenced: requireStringArray(record, "ingredientsReferenced"),
    cookingMethodsReferenced: requireStringArray(record, "cookingMethodsReferenced"),
    qualityClaims: requireStringArray(record, "qualityClaims"),
  };
}

function textFields(output: ComposerOutput): string {
  return [
    output.physicalState,
    output.compositionDescription,
    output.textureDescription,
    output.ingredientInteraction,
    output.scaleAndProportion,
  ].join("\n").toLowerCase();
}

function validateOutput(testCase: PrototypeCase, output: ComposerOutput): string[] {
  const issues: string[] = [];
  const text = textFields(output);
  const allowedIngredients = new Set(testCase.confirmedIngredients.map(normalize));
  const allowedMethods = new Set(testCase.confirmedCookingMethods.map(normalize));

  for (const ingredient of output.ingredientsReferenced) {
    if (!allowedIngredients.has(normalize(ingredient))) {
      issues.push(`UNVERIFIED_INGREDIENT: ${ingredient}`);
    }
  }

  for (const method of output.cookingMethodsReferenced) {
    if (!allowedMethods.has(normalize(method))) {
      issues.push(`UNVERIFIED_COOKING_METHOD: ${method}`);
    }
  }

  if (output.qualityClaims.length > 0) {
    issues.push(`QUALITY_CLAIM_ARRAY_NOT_EMPTY: ${output.qualityClaims.join(", ")}`);
  }

  for (const term of forbiddenQualityTerms) {
    const pattern = new RegExp(`\\b${term.replace("-", "[- ]")}\\b`, "i");
    if (pattern.test(text)) issues.push(`FORBIDDEN_QUALITY_TERM: ${term}`);
  }

  for (const method of knownCookingMethods) {
    const pattern = new RegExp(`\\b${method.replace("-", "[- ]")}\\b`, "i");
    if (pattern.test(text) && !allowedMethods.has(normalize(method))) {
      issues.push(`UNVERIFIED_COOKING_METHOD_IN_TEXT: ${method}`);
    }
  }

  if (/\b(?:large|small|medium|double|triple|2x|3x|portion|serving size|extra)\b/i.test(text)) {
    issues.push("UNVERIFIED_PORTION_OR_SIZE_CLAIM");
  }

  if (/\b(?:packaging|package|wrapper|box|bag|label|logo|branded)\b/i.test(text)) {
    issues.push("UNAPPROVED_PACKAGING_OR_BRANDING_REFERENCE");
  }

  return [...new Set(issues)];
}

function buildPrompt(testCase: PrototypeCase): string {
  return `You are running a CONTROLLED PHYSICAL FOOD COMPOSER PROTOTYPE.

This input is synthetic prototype data and MUST NOT be treated as real ATTHA'S product truth outside this test.

PRODUCT LABEL
${testCase.productLabel}

CONFIRMED INGREDIENTS — these are the only ingredient names you may reference
${testCase.confirmedIngredients.map((item) => `- ${item}`).join("\n")}

CONFIRMED COOKING METHODS — do not name any cooking method not listed here
${testCase.confirmedCookingMethods.length ? testCase.confirmedCookingMethods.map((item) => `- ${item}`).join("\n") : "- NONE"}

ALLOWED CREATIVE INTERPRETATION
- arrangement and layering
- compression/contact between confirmed ingredients
- cutting angle without claiming a portion size
- visible surface texture such as sauce coating, flour dusting or small char spots
- relative scale and proportion
- lighting response such as highlight, shadow or gloss

FORBIDDEN FACTUAL INVENTION
- any ingredient outside CONFIRMED INGREDIENTS
- any cooking method outside CONFIRMED COOKING METHODS
- ingredient/product qualities such as fresh, juicy, smoky, premium, homemade, organic, spicy, tender, succulent, authentic, best or delicious
- portion size, serving size, quantity or spice-level claims
- packaging, labels, logos, branded wrappers or delivery claims
- health, nutrition, origin or preparation claims

Describe only how the confirmed components could exist together as a physically credible photographic food subject. Do not write advertising copy. Do not praise the food. Do not mention a forbidden item merely to say it is absent.

Return JSON only with exactly this shape:
{
  "physicalState": "...",
  "compositionDescription": "...",
  "textureDescription": "...",
  "ingredientInteraction": "...",
  "scaleAndProportion": "...",
  "ingredientsReferenced": ["copy ingredient names exactly from the confirmed list when used"],
  "cookingMethodsReferenced": ["copy methods exactly from the confirmed list when used"],
  "qualityClaims": []
}`;
}

const provider = createGeminiCampaignProvider();
const outputDir = "output/m2-food-composer-prototype";
await mkdir(outputDir, { recursive: true });

const results: PrototypeResult[] = [];
for (const testCase of cases) {
  const prompt = buildPrompt(testCase);
  try {
    const raw = await provider.generate(prompt);
    const output = parseComposerOutput(raw);
    const issues = validateOutput(testCase, output);
    results.push({
      id: testCase.id,
      productLabel: testCase.productLabel,
      status: issues.length === 0 ? "PASS" : "FAIL",
      issues,
      output,
      raw,
    });
  } catch (error) {
    results.push({
      id: testCase.id,
      productLabel: testCase.productLabel,
      status: "FAIL",
      issues: [error instanceof Error ? error.message : String(error)],
    });
  }
}

const passed = results.filter((result) => result.status === "PASS").length;
const failed = results.length - passed;
const decision = failed === 0 ? "OPEN_ENDED_COMPOSER_CANDIDATE" : "USE_DETERMINISTIC_SLOT_TEMPLATES";
const report = {
  generatedAt: new Date().toISOString(),
  model: provider.model,
  prototypeOnly: true,
  truthWarning: "Inputs are synthetic prototype data and must never be promoted into ATTHA'S truth records.",
  governedBoundary: {
    allowed: [
      "arrangement",
      "layering",
      "compression/contact",
      "cut angle",
      "visible surface texture",
      "scale/proportion",
      "lighting response",
    ],
    blocked: [
      "unverified ingredients",
      "unverified cooking methods",
      "quality claims",
      "portion/size claims",
      "packaging/branding claims",
    ],
  },
  total: results.length,
  passed,
  failed,
  decision,
  results,
};

await writeFile(`${outputDir}/report.json`, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));

if (failed > 0) process.exitCode = 1;
