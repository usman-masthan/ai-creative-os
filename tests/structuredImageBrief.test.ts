import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignCreativeOutput, CampaignProductionFormat } from "../src/creativeTypes.js";
import {
  buildStructuredImageBrief,
  compileStructuredImagePrompt,
  validateStructuredImageBrief,
} from "../src/structuredImageBrief.js";

function creative(): CampaignCreativeOutput {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Direct Order",
        coreIdea: "Make the product easy to order.",
        customerEmotion: "clarity",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Hero product composition",
        cta: "Order Now",
        targetAudience: "Burger customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Crave Moment",
        coreIdea: "Build appetite through a close food moment.",
        customerEmotion: "craving",
        headlineDirection: "Crave the crunch",
        visualConcept: "Close sensory food crop",
        cta: "See More",
        targetAudience: "Food lovers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "Burger Ritual",
        coreIdea: "Build a repeatable burger-night memory.",
        customerEmotion: "belonging",
        headlineDirection: "Burger night",
        visualConcept: "Premium brand-led food scene",
        cta: "Visit Us",
        targetAudience: "Local diners",
        expectedStrength: 8,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "Clear conversion route.",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available on Uber Eats",
      cta: "Order on Uber Eats",
      visualDirection: "A believable crispy chicken burger hero with strong appetite appeal.",
      composition: "Large food hero with protected upper-left copy space.",
      lighting: "Warm directional studio light that reveals texture.",
      photographyStyle: "Premium commercial food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy Chicken Burger on Uber Eats.",
    imageGeneration: {
      basePrompt: "Professional food photograph of a crispy chicken burger on a dark neutral surface.",
      negativePrompt: "text, logos, watermarks, app screens, text",
      visualConstraints: [
        "clean background",
        "protected copy-safe negative space",
        "clean background",
      ],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available on Uber Eats",
      price: {
        amount: 1090,
        currency: "LKR",
        display: "LKR 1,090",
      },
      cta: "Order on Uber Eats",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
        price: "lower-left",
        cta: "bottom",
        logo: "omit",
      },
    },
    factualQaNotes: [],
  };
}

const format: CampaignProductionFormat = {
  channel: "instagram",
  assetType: "poster",
  aspectRatio: "4:5",
  width: 1080,
  height: 1350,
};

const compositionRequirements = [
  "Keep the upper-left message zone uncluttered",
  "Keep the food hero inside the lower-right focal region",
  "Keep the upper-left message zone uncluttered",
];

test("structured image brief matches the M2 physical, photography, composition and environment contract", () => {
  const input = {
    campaignId: "M2-BRIEF-001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    creative: creative(),
    format,
    compositionRequirements,
    verifiedFacts: [
      { key: "productName|CRISPY_CHICKEN_BURGER|UBER_EATS", value: "Crispy Chicken Burger (Large)" },
    ],
    previousQaIssues: [
      "message zone is visually cluttered",
      "message zone is visually cluttered",
    ],
  };

  const first = buildStructuredImageBrief(input);
  const second = buildStructuredImageBrief(input);
  assert.deepEqual(first, second);
  assert.equal(first.version, 2);
  assert.equal(first.subject.productName, "Crispy Chicken Burger (Large)");
  assert.equal(first.photography.preset, "QSR_MACRO_HERO");
  assert.equal(first.constraints.noText, true);
  assert.equal(first.constraints.noLogos, true);
  assert.equal(first.constraints.noPrices, true);
  assert.equal(first.constraints.noPrintedPackaging, true);
  assert.ok(first.constraints.prohibitedElements.includes("watermarks"));
  assert.equal(first.composition.quietZones.length, 1);
  assert.deepEqual(first.correction?.previousQaIssues, ["message zone is visually cluttered"]);

  const prompt = compileStructuredImagePrompt(first);
  assert.match(prompt, /STRUCTURED IMAGE BRIEF v2/);
  assert.match(prompt, /SUBJECT/);
  assert.match(prompt, /PHOTOGRAPHY/);
  assert.match(prompt, /COMPOSITION/);
  assert.match(prompt, /ENVIRONMENT/);
  assert.match(prompt, /CONSTRAINTS/);
  assert.match(prompt, /Preset: QSR_MACRO_HERO/);
  assert.match(prompt, /PREVIOUS VISUAL QA CORRECTIONS REQUIRED:/);
  assert.doesNotMatch(prompt, /LKR 1,090/);
});

test("structured image brief blocks customer-facing price leakage before image spend", () => {
  assert.throws(
    () =>
      buildStructuredImageBrief({
        campaignId: "M2-BRIEF-PRICE-LEAK",
        brandId: "ATTHAS_BURGER",
        creative: creative(),
        format,
        compositionRequirements: ["Keep a clean message zone"],
        subject: {
          compositionDescription: "Place LKR 1,090 visibly beside the food hero.",
        },
      }),
    /FAIL_IMAGE_BRIEF_PRICE_LEAK/,
  );
});

test("structured image brief blocks instructions to generate a logo", () => {
  assert.throws(
    () =>
      buildStructuredImageBrief({
        campaignId: "M2-BRIEF-LOGO-LEAK",
        brandId: "ATTHAS_BURGER",
        creative: creative(),
        format,
        compositionRequirements: ["Keep a clean message zone"],
        subject: {
          physicalState: "Show the burger and include the ATTHA'S logo in the upper corner.",
        },
      }),
    /FAIL_IMAGE_BRIEF_LOGO_LEAK/,
  );
});

test("structured image brief validator rejects missing deterministic quiet zones", () => {
  const brief = buildStructuredImageBrief({
    campaignId: "M2-BRIEF-COMPOSITION",
    brandId: "ATTHAS_BURGER",
    creative: creative(),
    format,
    compositionRequirements: ["Keep a clean message zone"],
  });
  const invalid = structuredClone(brief);
  invalid.composition.quietZones = [];

  const result = validateStructuredImageBrief(invalid);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0]?.code, "FAIL_IMAGE_BRIEF_COMPOSITION");
});
