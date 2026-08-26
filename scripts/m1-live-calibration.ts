import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { AiTraceSession } from "../src/aiTrace.js";
import type { BrandGovernance } from "../src/brandGovernance.js";
import { generateCampaign, type GenerateCampaignRequest } from "../src/commands/generateCampaign.js";
import { conceptDifferentiationScore } from "../src/conceptDifferentiation.js";
import { createGeminiCampaignProvider } from "../src/providers/gemini.js";
import { confirmTaskTruth, type TaskTruthQuestionnaire } from "../src/taskTruth.js";
import type { TruthRecord, TruthRequirement } from "../src/types.js";

type BrandId = "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";

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

function pairwiseConceptSimilarity(concepts: Awaited<ReturnType<typeof generateCampaign>> extends infer _T ? any[] : never) {
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

async function runScenario(
  scenario: CalibrationScenario,
  outputRoot: string,
): Promise<CalibrationResult> {
  const outputDir = join(outputRoot, scenario.id);
  await mkdir(outputDir, { recursive: true });
  const trace = new AiTraceSession(scenario.request.campaignId);
  trace.setRequest({
    campaignId: scenario.request.campaignId,
    brandId: scenario.request.brandId,
    branchId: scenario.request.branchId,
    objective: scenario.request.objective,
    channel: scenario.request.channel,
    assetType: scenario.request.assetType,
    requirements: scenario.request.requirements,
  });
  trace.setTruth(scenario.request.truthRecords);
  const provider = trace.wrapCampaignProvider("strategist", createGeminiCampaignProvider());

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
    trace.recordOutcome({ status: "PASS", maxPairwiseSimilarity });
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

const truthGuard = assertTruthInstructionGuard();
const results: CalibrationResult[] = [];
for (const scenario of scenarios) {
  results.push(await runScenario(scenario, outputRoot));
}

const report = {
  generatedAt: new Date().toISOString(),
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
