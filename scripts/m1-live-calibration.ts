import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { AiTraceSession } from "../src/aiTrace.js";
import type { BrandGovernance } from "../src/brandGovernance.js";
import { generateCampaign, type GenerateCampaignRequest } from "../src/commands/generateCampaign.js";
import { conceptDifferentiationScore } from "../src/conceptDifferentiation.js";
import type { CampaignConcept } from "../src/creativeTypes.js";
import { createGeminiCampaignProvider } from "../src/providers/gemini.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";
import { confirmTaskTruth, type TaskTruthQuestionnaire } from "../src/taskTruth.js";
import type { TruthRecord, TruthRequirement } from "../src/types.js";

type BrandId = "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
type CalibrationMode = "LIVE_GEMINI" | "DETERMINISTIC_FALLBACK";

interface BranchMaster {
  tenantId: "T001";
  sourceId: string;
  status: "VERIFIED";
  branches: Array<{
    branchId: string;
    brandId: BrandId;
    name: string;
    canonicalPhysicalAddress: string;
    officialPhone: string;
    physicalOpeningHours: { daily: string };
  }>;
}

interface PricingSnapshot {
  tenantId: "T001";
  brandId: "ATTHAS_BURGER";
  branchId: string;
  salesChannel: string;
  sourceId: string;
  status: "SOURCE_VERIFIED";
  prices: Array<{ productId: string; name: string; price: number }>;
}

interface CalibrationScenario {
  id: string;
  label: string;
  request: GenerateCampaignRequest;
}

interface CalibrationResult {
  id: string;
  label: string;
  status: "PASS" | "FAIL";
  attempts?: number;
  repairs?: number;
  concepts?: Array<{
    id: string;
    role: string;
    campaignName: string;
    coreIdea: string;
  }>;
  pairwiseSimilarity?: Array<{
    pair: string;
    similarity: number;
  }>;
  maxPairwiseSimilarity?: number;
  tracePath: string;
  error?: string;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function branchTruthRecords(master: BranchMaster, branchId: string): TruthRecord[] {
  const branch = master.branches.find((item) => item.branchId === branchId);
  if (!branch) throw new Error(`Branch ${branchId} not found in owner-confirmed branch master.`);
  return [
    {
      key: "branchPhysicalAddress",
      value: branch.canonicalPhysicalAddress,
      status: master.status,
      sourceId: master.sourceId,
      scope: {
        tenantId: master.tenantId,
        brandId: branch.brandId,
        branchId: branch.branchId,
      },
    },
    {
      key: "physicalOpeningHours",
      value: branch.physicalOpeningHours.daily,
      status: master.status,
      sourceId: master.sourceId,
      scope: {
        tenantId: master.tenantId,
        brandId: branch.brandId,
        branchId: branch.branchId,
      },
    },
  ];
}

function productTruthRecords(pricing: PricingSnapshot, productId: string): TruthRecord[] {
  const product = pricing.prices.find((item) => item.productId === productId);
  if (!product) throw new Error(`Product ${productId} not found in pricing snapshot.`);
  return [
    {
      key: "productName",
      value: product.name,
      status: pricing.status,
      sourceId: pricing.sourceId,
      scope: {
        tenantId: pricing.tenantId,
        brandId: pricing.brandId,
        branchId: pricing.branchId,
        productId: product.productId,
        salesChannel: pricing.salesChannel,
      },
    },
    {
      key: "price",
      value: product.price,
      status: pricing.status,
      sourceId: pricing.sourceId,
      scope: {
        tenantId: pricing.tenantId,
        brandId: pricing.brandId,
        branchId: pricing.branchId,
        productId: product.productId,
        salesChannel: pricing.salesChannel,
      },
    },
  ];
}

function branchRequirements(): TruthRequirement[] {
  return [
    { key: "branchPhysicalAddress" },
    { key: "physicalOpeningHours" },
  ];
}

function assertTruthInstructionGuard(): { pass: true; blockedValue: string } {
  const questionnaire: TaskTruthQuestionnaire = {
    schemaVersion: 1,
    sessionId: "M1-CALIBRATION-TRUTH-GUARD",
    campaignId: "M1-CALIBRATION-TRUTH-GUARD",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    createdAt: new Date().toISOString(),
    questions: [
      {
        label: "price",
        requirement: { key: "price" },
        scope: { tenantId: "T001", brandId: "ATTHAS_BURGER" },
        kind: "PROVIDE_MISSING",
        prompt: "Please provide the current price.",
      },
    ],
  };
  const blockedValue = "Please provide the current price";
  try {
    confirmTaskTruth({
      questionnaire,
      confirmedBy: "m1-calibration",
      answers: [{ label: "price", action: "PROVIDE", value: blockedValue }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/instruction rather than a confirmed fact/i.test(message)) {
      return { pass: true, blockedValue };
    }
    throw error;
  }
  throw new Error("Truth semantic guard regression: instructional value was accepted as a confirmed fact.");
}

function pairwiseConceptSimilarity(concepts: CampaignConcept[]) {
  const pairs: Array<{ pair: string; similarity: number }> = [];
  for (let i = 0; i < concepts.length; i += 1) {
    for (let j = i + 1; j < concepts.length; j += 1) {
      const left = concepts[i]!;
      const right = concepts[j]!;
      pairs.push({
        pair: `${left.id}-${right.id}`,
        similarity: Number(conceptDifferentiationScore(left, right).toFixed(4)),
      });
    }
  }
  return pairs;
}

function factValue(request: GenerateCampaignRequest, key: string): unknown {
  return request.truthRecords.find((record) => record.key === key)?.value;
}

function deterministicCreative(request: GenerateCampaignRequest): unknown {
  const productName = String(factValue(request, "productName") ?? "");
  const priceRaw = factValue(request, "price");
  const price = typeof priceRaw === "number" ? priceRaw : undefined;
  const address = String(factValue(request, "branchPhysicalAddress") ?? "");
  const hours = String(factValue(request, "physicalOpeningHours") ?? "");
  const restaurant = request.brandId === "ATTHAS_RESTAURANT";
  const productScenario = Boolean(productName && price !== undefined);

  const concepts = productScenario
    ? [
        {
          id: "C1",
          strategicRole: "conversion",
          campaignName: "Straight to the Order",
          coreIdea: "Make the verified burger identity and Uber Eats action the shortest path from interest to order.",
          customerEmotion: "decisiveness",
          headlineDirection: productName,
          visualConcept: "A clean product-led hero with obvious overlay space and no generated text.",
          cta: "Order on Uber Eats",
          targetAudience: "Delivery customers ready to choose a burger",
          expectedStrength: 9,
          risks: [],
        },
        {
          id: "C2",
          strategicRole: "crave-emotion",
          campaignName: "Craving Has a Moment",
          coreIdea: "Build appetite around a close, warm, sensory burger moment while keeping claims limited to verified identity.",
          customerEmotion: "desire",
          headlineDirection: "Make the craving the hero.",
          visualConcept: "Tight appetite photography with warm directional light, texture and restrained negative space.",
          cta: "Order on Uber Eats",
          targetAudience: "Social-first burger buyers responding to appetite cues",
          expectedStrength: 9,
          risks: [],
        },
        {
          id: "C3",
          strategicRole: "brand-building",
          campaignName: "Burger Night Ritual",
          coreIdea: "Create a repeatable ATTHA'S burger-night memory territory that can recur beyond a single performance post.",
          customerEmotion: "familiarity",
          headlineDirection: "A burger-night ritual worth remembering.",
          visualConcept: "A restrained recurring brand-world composition focused on mood and recognisable campaign rhythm.",
          cta: "Discover ATTHA'S",
          targetAudience: "Urban customers building repeat brand preference",
          expectedStrength: 8,
          risks: [],
        },
      ]
    : [
        {
          id: "C1",
          strategicRole: "conversion",
          campaignName: "Know Where, Know When",
          coreIdea: "Turn branch intent into a visit decision by making the confirmed location and opening time functional decision aids.",
          customerEmotion: "certainty",
          headlineDirection: restaurant ? "Your Wellawatte table starts here." : "Wellampitiya, your next stop is clear.",
          visualConcept: "A clean hospitality-led scene with strong deterministic space for branch facts and CTA.",
          cta: "Visit Us",
          targetAudience: "Nearby customers considering a dine-in visit",
          expectedStrength: 8,
          risks: [],
        },
        {
          id: "C2",
          strategicRole: "crave-emotion",
          campaignName: restaurant ? "A Table to Come Back To" : "Tonight Feels Like ATTHA'S",
          coreIdea: restaurant
            ? "Build emotional anticipation around a warm shared dining occasion without inventing dish or service claims."
            : "Build evening appetite and social energy around the idea of choosing ATTHA'S without inventing product claims.",
          customerEmotion: restaurant ? "togetherness" : "anticipation",
          headlineDirection: restaurant ? "Make room for the people who matter." : "Give tonight a little more flavour.",
          visualConcept: restaurant
            ? "Warm shared-table hospitality imagery with human-scale ambience and no generated signage."
            : "Energetic evening food-culture ambience with negative space and no specific unverified menu item.",
          cta: "Visit Us",
          targetAudience: restaurant ? "Families and groups planning a meal together" : "Friends and nearby evening diners",
          expectedStrength: 9,
          risks: [],
        },
        {
          id: "C3",
          strategicRole: "brand-building",
          campaignName: restaurant ? "The Familiar Table" : "The Neighborhood Ritual",
          coreIdea: restaurant
            ? "Build a repeatable memory territory around ATTHA'S as a familiar place for people to gather."
            : "Build a repeatable neighborhood ritual around ATTHA'S Burger as a familiar evening choice.",
          customerEmotion: "belonging",
          headlineDirection: restaurant ? "Some tables become traditions." : "Make it part of the night.",
          visualConcept: "A restrained, repeatable brand-world composition designed for recognition across future campaigns.",
          cta: "Discover ATTHA'S",
          targetAudience: "Customers who can develop long-term brand familiarity",
          expectedStrength: 8,
          risks: [],
        },
      ];

  const headline = productScenario
    ? productName
    : restaurant
      ? "Your Wellawatte table starts here."
      : "Wellampitiya, your next stop is clear.";
  const supportingCopy = productScenario
    ? "Available on Uber Eats"
    : `${address} · Open ${hours}`;
  const cta = productScenario ? "Order on Uber Eats" : "Visit Us";
  const caption = productScenario
    ? `${productName} on Uber Eats${price !== undefined ? ` for LKR ${price.toLocaleString("en-US")}` : ""}.`
    : `${headline} ${address}. Open ${hours}.`;

  return {
    concepts,
    recommendedConceptId: productScenario ? "C1" : "C2",
    recommendationReason: productScenario
      ? "C1 provides the clearest verified conversion path while C2 and C3 retain distinct emotional and brand-building territories."
      : "C2 creates the strongest emotional reason to visit while C1 remains functional and C3 builds longer-term memory.",
    creativeBrief: {
      headline,
      supportingCopy,
      cta,
      visualDirection: productScenario
        ? "Believable commercial burger concept photography with clean overlay-safe negative space."
        : restaurant
          ? "Warm, believable hospitality photography with people-scale ambience and clean overlay-safe space."
          : "Energetic evening hospitality imagery with believable lighting and clean overlay-safe space.",
      composition: "Single clear focal area with protected upper-left message space and lower-right CTA space.",
      lighting: restaurant ? "Warm naturalistic restaurant light." : "Warm directional commercial light.",
      photographyStyle: "Believable commercial food and hospitality photography; restrained, non-synthetic styling.",
      aspectRatio: "4:5",
    },
    caption,
    imageGeneration: {
      basePrompt: productScenario
        ? `Generic ${productName} concept image, believable commercial burger photography, neutral unbranded setting, clean overlay-safe negative space, no exact served-product guarantee.`
        : restaurant
          ? "Generic warm shared-table restaurant ambience, believable hospitality photography, no specific dishes, no signage, clean overlay-safe negative space."
          : "Generic energetic evening burger-dining ambience, no specific menu item, no signage, clean overlay-safe negative space.",
      negativePrompt: "No text, numbers, logos, badges, menus, signs, watermarks or invented product details.",
      visualConstraints: ["no generated text", "no logos", "no unsupported product or service claims"],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline,
      supportingCopy,
      ...(price !== undefined ? { price: { amount: price, currency: "LKR" } } : {}),
      cta,
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
        ...(price !== undefined ? { price: "upper-right" } : {}),
        cta: "lower-right",
        logo: "omit",
      },
    },
    factualQaNotes: productScenario
      ? ["Use only the verified product identity and Uber Eats scoped price; do not infer ingredients or dine-in pricing."]
      : ["Use only owner-confirmed branch address and physical opening hours; do not infer delivery hours or menu details."],
  };
}

function deterministicProvider(request: GenerateCampaignRequest): CampaignGenerationProvider {
  return {
    providerName: "m1-calibration-fixture",
    model: "deterministic-strategy-fixture-v1",
    async generate() {
      return JSON.stringify(deterministicCreative(request));
    },
  };
}

function calibrationMode(): CalibrationMode {
  return process.env.GEMINI_API_KEY?.trim() ? "LIVE_GEMINI" : "DETERMINISTIC_FALLBACK";
}

function providerFor(request: GenerateCampaignRequest, mode: CalibrationMode): CampaignGenerationProvider {
  return mode === "LIVE_GEMINI"
    ? createGeminiCampaignProvider()
    : deterministicProvider(request);
}

async function runScenario(
  scenario: CalibrationScenario,
  outputRoot: string,
  mode: CalibrationMode,
): Promise<CalibrationResult> {
  const outputDir = join(outputRoot, scenario.id);
  await mkdir(outputDir, { recursive: true });
  const trace = new AiTraceSession(scenario.request.campaignId);
  trace.setRequest({
    calibrationMode: mode,
    campaignId: scenario.request.campaignId,
    brandId: scenario.request.brandId,
    branchId: scenario.request.branchId,
    objective: scenario.request.objective,
    channel: scenario.request.channel,
    assetType: scenario.request.assetType,
    requirements: scenario.request.requirements,
  });
  trace.setTruth(scenario.request.truthRecords);
  const provider = trace.wrapCampaignProvider("strategist", providerFor(scenario.request, mode));

  try {
    const result = await generateCampaign(scenario.request, provider);
    if (result.status !== "GENERATED") {
      throw new Error(`Scenario blocked before generation: ${result.status}`);
    }

    const similarities = pairwiseConceptSimilarity(result.creative.concepts);
    const maxPairwiseSimilarity = Math.max(...similarities.map((item) => item.similarity), 0);
    const concepts = result.creative.concepts.map((concept) => ({
      id: concept.id,
      role: concept.strategicRole,
      campaignName: concept.campaignName,
      coreIdea: concept.coreIdea,
    }));

    trace.setStageSummary("strategist", {
      calibrationMode: mode,
      attempts: result.generation.attempts,
      repairs: result.generation.repairs,
      concepts,
      pairwiseSimilarity: similarities,
      maxPairwiseSimilarity,
    });
    trace.markSkipped("image", "M1 calibration stops after strategist output; image pipeline begins in M2/M3.");
    trace.markSkipped("visualQa", "M1 calibration is text-strategy and truth-safety only.");
    trace.markSkipped("renderer", "Renderer intentionally excluded from M1 calibration.");
    trace.markSkipped("finalArtQa", "Final-art QA intentionally excluded from M1 calibration.");
    trace.recordOutcome({ status: "PASS", calibrationMode: mode, maxPairwiseSimilarity });
    const tracePath = await trace.persist(outputDir);

    return {
      id: scenario.id,
      label: scenario.label,
      status: "PASS",
      attempts: result.generation.attempts,
      repairs: result.generation.repairs,
      concepts,
      pairwiseSimilarity: similarities,
      maxPairwiseSimilarity,
      tracePath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trace.recordFailure(error);
    const tracePath = await trace.persist(outputDir);
    return {
      id: scenario.id,
      label: scenario.label,
      status: "FAIL",
      tracePath,
      error: message,
    };
  }
}

const outputRoot = "output/m1-calibration";
await mkdir(outputRoot, { recursive: true });

const [branchMaster, pricing, governance, masterPositioning, burgerRules, restaurantRules] = await Promise.all([
  readJson<BranchMaster>("clients/T001-atthas/truth/branch-master.json"),
  readJson<PricingSnapshot>("clients/T001-atthas/truth/pricing/wellampitiya.json"),
  readJson<BrandGovernance>("clients/T001-atthas/brands/master/governance.json"),
  readFile("clients/T001-atthas/brands/master/positioning.md", "utf8"),
  readFile("clients/T001-atthas/brands/burger/rules.md", "utf8"),
  readFile("clients/T001-atthas/brands/restaurant/rules.md", "utf8"),
]);

const crispyProductId = "CRISPY_CHICKEN_BURGER";
const scenarios: CalibrationScenario[] = [
  {
    id: "01-burger-uber-price",
    label: "Burger delivery conversion with verified product + Uber Eats price",
    request: {
      campaignId: "M1-CAL-01-BURGER-UBER",
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: pricing.branchId,
      objective: "Drive orders for the verified Crispy Chicken Burger product on Uber Eats.",
      channel: "instagram",
      assetType: "poster",
      requirements: [
        { key: "productName", productId: crispyProductId, salesChannel: pricing.salesChannel },
        { key: "price", productId: crispyProductId, salesChannel: pricing.salesChannel },
      ],
      truthRecords: productTruthRecords(pricing, crispyProductId),
      allowSourceVerified: true,
      brandContext: `${masterPositioning}\n\n${burgerRules}`,
      brandGovernance: governance,
    },
  },
  {
    id: "02-burger-dine-in",
    label: "Burger Wellampitiya branch dine-in campaign using owner-confirmed branch facts",
    request: {
      campaignId: "M1-CAL-02-BURGER-DINEIN",
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
      objective: "Increase dine-in consideration for ATTHA'S Burger Wellampitiya using only confirmed branch information.",
      channel: "instagram",
      assetType: "poster",
      requirements: branchRequirements(),
      truthRecords: branchTruthRecords(branchMaster, "BURGER_WELLAMPITIYA"),
      brandContext: `${masterPositioning}\n\n${burgerRules}`,
      brandGovernance: governance,
    },
  },
  {
    id: "03-restaurant-family-dining",
    label: "Restaurant Wellawatte family-dining brand campaign using owner-confirmed branch facts",
    request: {
      campaignId: "M1-CAL-03-RESTAURANT-FAMILY",
      tenantId: "T001",
      brandId: "ATTHAS_RESTAURANT",
      branchId: "RESTAURANT_COLOMBO_06",
      objective: "Build warm family-dining consideration for ATTHA'S Restaurant Wellawatte using only confirmed branch information.",
      channel: "instagram",
      assetType: "poster",
      requirements: branchRequirements(),
      truthRecords: branchTruthRecords(branchMaster, "RESTAURANT_COLOMBO_06"),
      brandContext: `${masterPositioning}\n\n${restaurantRules}`,
      brandGovernance: governance,
    },
  },
];

const mode = calibrationMode();
const truthGuard = assertTruthInstructionGuard();
const results: CalibrationResult[] = [];
for (const scenario of scenarios) {
  results.push(await runScenario(scenario, outputRoot, mode));
}

const report = {
  generatedAt: new Date().toISOString(),
  mode,
  liveGeminiExecuted: mode === "LIVE_GEMINI",
  liveGeminiBlocker:
    mode === "LIVE_GEMINI"
      ? null
      : "GEMINI_API_KEY is not configured as a GitHub Actions repository secret; deterministic fallback executed instead.",
  truthGuard,
  total: results.length,
  passed: results.filter((item) => item.status === "PASS").length,
  failed: results.filter((item) => item.status === "FAIL").length,
  results,
};
await writeFile(join(outputRoot, "summary.json"), JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));

if (report.failed > 0) {
  process.exitCode = 1;
}
