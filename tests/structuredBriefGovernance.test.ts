import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignPreflight } from "../src/commands/createCampaign.js";
import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../src/creativeTypes.js";
import { ATTHAS_LAYOUTS } from "../src/layouts/atthas.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import { buildStructuredImageBrief } from "../src/structuredImageBrief.js";
import {
  governStructuredImageBrief,
  validateStructuredBriefGovernance,
} from "../src/structuredBriefGovernance.js";

function creative(): CampaignCreativeOutput {
  return {
    concepts: [
      {
        id: "C1",
        strategicRole: "conversion",
        campaignName: "Direct Choice",
        coreIdea: "Make the verified product identity easy to act on.",
        customerEmotion: "clarity",
        headlineDirection: "Crispy Chicken Burger",
        visualConcept: "Single food hero.",
        cta: "Order Now",
        targetAudience: "Burger customers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C2",
        strategicRole: "crave-emotion",
        campaignName: "Product Moment",
        coreIdea: "Build anticipation around the named product without adding claims.",
        customerEmotion: "anticipation",
        headlineDirection: "Your Burger Moment",
        visualConcept: "Close food moment.",
        cta: "See More",
        targetAudience: "Food lovers",
        expectedStrength: 8,
        risks: [],
      },
      {
        id: "C3",
        strategicRole: "brand-building",
        campaignName: "ATTHA'S Choice",
        coreIdea: "Build a repeatable ATTHA'S Burger product association.",
        customerEmotion: "familiarity",
        headlineDirection: "ATTHA'S Burger",
        visualConcept: "Simple food-led brand territory.",
        cta: "Visit Us",
        targetAudience: "Local diners",
        expectedStrength: 7,
        risks: [],
      },
    ],
    recommendedConceptId: "C1",
    recommendationReason: "Direct product route.",
    creativeBrief: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available at Wellampitiya",
      cta: "Order Now",
      visualDirection: "Single believable food hero with clean negative space.",
      composition: "Keep the food hero centre-right with upper-left visually quiet.",
      lighting: "Controlled directional commercial food light.",
      photographyStyle: "Believable commercial food photography.",
      aspectRatio: "4:5",
    },
    caption: "Crispy Chicken Burger at Wellampitiya.",
    imageGeneration: {
      basePrompt: "Commercial food photograph of the verified product identity.",
      negativePrompt: "text, logos, prices, labels, watermarks",
      visualConstraints: ["single food hero", "clean overlay-safe negative space"],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "Crispy Chicken Burger",
      supportingCopy: "Available at Wellampitiya",
      cta: "Order Now",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
        cta: "lower-right",
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

const layout = ATTHAS_LAYOUTS.find(
  (item) => item.id === "ATTHAS_BURGER_MINIMAL_PREMIUM_V1",
)!;

function preflight(extraFacts: CampaignPreflight["facts"] = []): CampaignPreflight {
  return {
    status: "READY_FOR_CREATIVE",
    factGate: "PASS",
    missing: [],
    conflicts: [],
    facts: [
      {
        key: "productName|product=CRISPY_CHICKEN_BURGER",
        value: "Crispy Chicken Burger",
        verified: true,
        status: "VERIFIED",
      },
      ...extraFacts,
    ],
    riskLevel: "low",
    humanApprovalRequired: false,
  };
}

function baseBrief() {
  return buildStructuredImageBrief({
    campaignId: "M2-GOV-001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    creative: creative(),
    format,
    layout,
    verifiedFacts: preflight().facts,
  });
}

function provider(output: unknown): CampaignGenerationProvider {
  return {
    providerName: "mock-repair",
    model: "mock-repair-model",
    async generate() {
      return typeof output === "string" ? output : JSON.stringify(output);
    },
  };
}

function safeSubject(productName = "Crispy Chicken Burger") {
  return {
    productName,
    physicalState: "A physically credible single food subject matching only the verified product identity.",
    compositionDescription: "Keep one coherent food hero with simple physical grouping and no graphic-layout elements.",
    textureDescription: "Show neutral directly visible material texture without quality claims.",
    ingredientInteraction: "Do not infer ingredients or preparation details that are not verified.",
    scaleAndProportion: "Use believable relative scale and gravity without portion claims.",
  };
}

test("structured brief governance rejects renderer-style graphic design language", () => {
  const brief = baseBrief();
  brief.subject.compositionDescription =
    "Place the product beside a red rectangle and a CTA box in the upper-left.";

  const result = validateStructuredBriefGovernance({
    brief,
    preflight: preflight(),
    creative: creative(),
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "FAIL_STRUCTURED_BRIEF_GRAPHIC_DESIGN_LANGUAGE",
    ),
  );
});

test("structured brief governance rejects unsupported claim or ingredient language", () => {
  const brief = baseBrief();
  brief.subject.textureDescription = "Show juicy chicken with fresh lettuce.";

  const result = validateStructuredBriefGovernance({
    brief,
    preflight: preflight(),
    creative: creative(),
  });

  const unsupported = result.issues.filter(
    (issue) => issue.code === "FAIL_STRUCTURED_BRIEF_UNSUPPORTED_CLAIM",
  );
  assert.ok(unsupported.some((issue) => issue.evidence === "juicy"));
  assert.ok(unsupported.some((issue) => issue.evidence === "fresh"));
  assert.ok(unsupported.some((issue) => issue.evidence === "lettuce"));
});

test("structured brief governance rejects fabricated branded packaging", () => {
  const brief = baseBrief();
  brief.subject.compositionDescription =
    "Show the product served in a branded box beside the food hero.";

  const result = validateStructuredBriefGovernance({
    brief,
    preflight: preflight(),
    creative: creative(),
  });

  assert.ok(
    result.issues.some(
      (issue) => issue.code === "FAIL_STRUCTURED_BRIEF_FABRICATED_PACKAGING",
    ),
  );
});

test("structured brief governance rejects customer-facing CTA leakage", () => {
  const brief = baseBrief();
  brief.subject.physicalState = "A food hero with the words Order Now beside it.";

  const result = validateStructuredBriefGovernance({
    brief,
    preflight: preflight(),
    creative: creative(),
  });

  assert.ok(
    result.issues.some(
      (issue) => issue.code === "FAIL_STRUCTURED_BRIEF_PROMOTIONAL_COPY",
    ),
  );
});

test("bounded repair changes only subject fields and preserves deterministic photography/composition", async () => {
  const brief = baseBrief();
  brief.subject.compositionDescription =
    "Use a yellow card and headline panel behind the product.";
  const originalPhotography = structuredClone(brief.photography);
  const originalComposition = structuredClone(brief.composition);
  const originalEnvironment = structuredClone(brief.environment);
  const originalConstraints = structuredClone(brief.constraints);

  const result = await governStructuredImageBrief({
    brief,
    preflight: preflight(),
    creative: creative(),
    repairProvider: provider(safeSubject()),
  });

  assert.equal(result.status, "REPAIRED");
  assert.equal(result.repairs, 1);
  assert.equal(result.brief.subject.productName, "Crispy Chicken Burger");
  assert.deepEqual(result.brief.photography, originalPhotography);
  assert.deepEqual(result.brief.composition, originalComposition);
  assert.deepEqual(result.brief.environment, originalEnvironment);
  assert.deepEqual(result.brief.constraints, originalConstraints);
});

test("repair cannot mutate verified product identity and escalates to human review", async () => {
  const brief = baseBrief();
  brief.subject.compositionDescription = "Place the product on a red rectangle.";

  const result = await governStructuredImageBrief({
    brief,
    preflight: preflight(),
    creative: creative(),
    repairProvider: provider(safeSubject("Different Product")),
    maxRepairAttempts: 1,
  });

  assert.equal(result.status, "HUMAN_REVIEW");
  assert.equal(result.repairs, 1);
  if (result.status !== "HUMAN_REVIEW") return;
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "FAIL_STRUCTURED_BRIEF_REPAIR_OUTPUT",
    ),
  );
});
