import type { StructuredImageBriefSubject } from "./structuredImageBrief.js";
import type { VerifiedFact } from "./types.js";

export type PhysicalFoodTemplateId =
  | "BURGER_STACK"
  | "WRAP_ROLL"
  | "SANDWICH_STACK"
  | "KEBAB_CLUSTER"
  | "RICE_OR_CURRY_PLATE"
  | "GENERIC_FOOD_HERO";

export interface DeterministicFoodComposition {
  templateId: PhysicalFoodTemplateId;
  productName: string;
  confirmedIngredients: string[];
  confirmedCookingMethods: string[];
  subject: StructuredImageBriefSubject;
}

export type DeterministicFoodComposerResult =
  | {
      status: "NOT_APPLICABLE";
      reason: "NO_VERIFIED_PRODUCT_NAME";
    }
  | {
      status: "BLOCKED_MISSING_VERIFIED_INGREDIENTS";
      productName: string;
      missingFactKeys: ["ingredients"];
    }
  | {
      status: "COMPOSED";
      composition: DeterministicFoodComposition;
    };

function baseFactKey(key: string): string {
  return key.split("|")[0]?.trim() ?? key.trim();
}

function firstFact(facts: VerifiedFact[], keys: string[]): VerifiedFact | undefined {
  const allowed = new Set(keys);
  return facts.find((fact) => fact.verified && allowed.has(baseFactKey(fact.key)));
}

function stringFact(facts: VerifiedFact[], keys: string[]): string | undefined {
  const value = firstFact(facts, keys)?.value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function stringArrayFact(facts: VerifiedFact[], keys: string[]): string[] | undefined {
  const value = firstFact(facts, keys)?.value;
  if (!Array.isArray(value)) return undefined;
  const output = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (output.length !== value.length || output.length === 0) return undefined;
  return [...new Set(output)];
}

export function selectPhysicalFoodTemplate(productName: string): PhysicalFoodTemplateId {
  const value = productName.toLowerCase();
  if (/\bwrap\b/.test(value)) return "WRAP_ROLL";
  if (/\b(?:burger|hamburger)\b/.test(value)) return "BURGER_STACK";
  if (/\b(?:sandwich|submarine|sub)\b/.test(value)) return "SANDWICH_STACK";
  if (/\bkebab\b/.test(value)) return "KEBAB_CLUSTER";
  if (/\b(?:rice|curry|biryani|biriyani|fried rice|kottu)\b/.test(value)) {
    return "RICE_OR_CURRY_PLATE";
  }
  return "GENERIC_FOOD_HERO";
}

function arrangementFor(templateId: PhysicalFoodTemplateId): string {
  switch (templateId) {
    case "BURGER_STACK":
      return "Arrange only the confirmed ingredients as a compact vertical food stack. Use any confirmed bread or bun component only where physically appropriate; do not invent garnish, fillings, sauces, wrappers or extra layers.";
    case "WRAP_ROLL":
      return "Arrange only the confirmed ingredients as a compact wrap-style subject. A rolled or enclosing wrapper may be shown only when that wrapper is itself present in the confirmed ingredient list; otherwise do not invent one.";
    case "SANDWICH_STACK":
      return "Arrange only the confirmed ingredients as a compact layered sandwich-style subject. Use any confirmed bread component only where physically appropriate and do not add unconfirmed fillings or garnish.";
    case "KEBAB_CLUSTER":
      return "Arrange only the confirmed ingredients as a simple food cluster with clear physical separation and contact. Do not invent skewers, garnish, side dishes or cooking marks unless separately confirmed.";
    case "RICE_OR_CURRY_PLATE":
      return "Arrange only the confirmed ingredients as a restrained plated-food grouping with clear boundaries between components. Do not invent sides, garnish, sauces, serving quantities or preparation details.";
    case "GENERIC_FOOD_HERO":
      return "Arrange only the confirmed ingredients as one coherent food hero using simple contact, overlap and grouping. Do not invent internal construction, garnish, sides or preparation details.";
  }
}

function cookingState(methods: string[]): string {
  if (methods.length === 0) {
    return "Do not imply a cooking method, preparation technique or temperature state because none is separately verified.";
  }
  return `The only preparation-method language allowed is the separately verified method set: ${methods.join(", ")}. Do not imply any additional method or temperature state.`;
}

function ingredientInteraction(ingredients: string[]): string {
  const hasSauce = ingredients.some((item) => /\b(?:sauce|gravy|dressing)\b/i.test(item));
  const base = "Allow only physically plausible contact, overlap or gentle compression among the confirmed ingredients.";
  const sauce = hasSauce
    ? " A confirmed sauce/gravy/dressing component may contact or coat adjacent confirmed ingredients without implying flavour, freshness or quantity."
    : " Do not invent dripping, coating, melting, steam, crumbs, char, browning or moisture effects.";
  return `${base}${sauce} Do not add an ingredient or state that is not explicitly confirmed.`;
}

export function composeDeterministicFoodSubject(input: {
  productName: string;
  confirmedIngredients: string[];
  confirmedCookingMethods?: string[];
}): DeterministicFoodComposition {
  const productName = input.productName.trim();
  const confirmedIngredients = [...new Set(input.confirmedIngredients.map((item) => item.trim()).filter(Boolean))];
  const confirmedCookingMethods = [
    ...new Set((input.confirmedCookingMethods ?? []).map((item) => item.trim()).filter(Boolean)),
  ];

  if (!productName) throw new Error("Deterministic food composer requires a verified product name.");
  if (confirmedIngredients.length === 0) {
    throw new Error("Deterministic food composer requires at least one verified ingredient.");
  }

  const templateId = selectPhysicalFoodTemplate(productName);
  return {
    templateId,
    productName,
    confirmedIngredients,
    confirmedCookingMethods,
    subject: {
      productName,
      physicalState: `Create a physically credible depiction of the verified product identity using only these confirmed ingredients: ${confirmedIngredients.join(", ")}. ${cookingState(confirmedCookingMethods)}`,
      compositionDescription: arrangementFor(templateId),
      textureDescription: "Show only neutral, directly visible material texture of confirmed ingredients. Do not add quality adjectives or infer crispness, juiciness, freshness, tenderness, premium quality, heat, smoke or preparation state.",
      ingredientInteraction: ingredientInteraction(confirmedIngredients),
      scaleAndProportion: "Use believable relative scale and gravity while avoiding portion-size, serving-size, quantity, count, oversized, undersized, double, triple or named-size claims.",
    },
  };
}

export function composeDeterministicFoodSubjectFromFacts(
  facts: VerifiedFact[],
): DeterministicFoodComposerResult {
  const productName = stringFact(facts, ["productName"]);
  if (!productName) {
    return {
      status: "NOT_APPLICABLE",
      reason: "NO_VERIFIED_PRODUCT_NAME",
    };
  }

  const ingredients = stringArrayFact(facts, ["ingredients"]);
  if (!ingredients) {
    return {
      status: "BLOCKED_MISSING_VERIFIED_INGREDIENTS",
      productName,
      missingFactKeys: ["ingredients"],
    };
  }

  const cookingMethods = stringArrayFact(facts, ["cookingMethods"]) ?? [];
  return {
    status: "COMPOSED",
    composition: composeDeterministicFoodSubject({
      productName,
      confirmedIngredients: ingredients,
      confirmedCookingMethods: cookingMethods,
    }),
  };
}
