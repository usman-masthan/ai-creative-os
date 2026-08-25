import assert from "node:assert/strict";
import test from "node:test";

import { generateAtthasMarketingPlan } from "../src/commands/generateMarketingPlan.js";
import { buildMonthlyCalendarSlots, deriveTruthReadiness } from "../src/marketingPlannerPolicy.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";

const branches = [
  {
    branchId: "BURGER_WELLAMPITIYA",
    brandId: "ATTHAS_BURGER" as const,
    name: "ATTHA’S Burger — Wellampitiya",
  },
  {
    branchId: "RESTAURANT_COLOMBO_06",
    brandId: "ATTHAS_RESTAURANT" as const,
    name: "ATTHA’S Restaurant — Wellawatte",
  },
];

function validPlan() {
  return {
    month: "2026-09",
    northStar: "Build repeatable appetite and hospitality demand without outrunning verified truth.",
    strategicObjectives: ["Grow qualified attention", "Balance Burger and Restaurant visibility"],
    audiencePriorities: ["Urban food discovery audiences", "Existing customers considering another visit"],
    contentPillars: [
      {
        id: "P1",
        name: "Crave",
        purpose: "Create Burger appetite through product-safe creative direction.",
        weightPercent: 50,
        businessUnits: ["ATTHAS_BURGER"],
      },
      {
        id: "P2",
        name: "Welcome",
        purpose: "Build Restaurant consideration around hospitality and shared dining.",
        weightPercent: 50,
        businessUnits: ["ATTHAS_RESTAURANT"],
      },
    ],
    monthlyBalance: {
      brandBuilding: 25,
      productPush: 25,
      dineIn: 25,
      delivery: 0,
      engagement: 25,
      seasonalOrOffer: 0,
    },
    weeklyPlans: [
      { weekId: "W1", startDate: "2026-09-01", endDate: "2026-09-06", focus: "Brand familiarity", slotIds: ["S01"] },
      { weekId: "W2", startDate: "2026-09-07", endDate: "2026-09-13", focus: "Product planning", slotIds: ["S02"] },
      { weekId: "W3", startDate: "2026-09-14", endDate: "2026-09-20", focus: "Restaurant visit consideration", slotIds: ["S03"] },
      { weekId: "W4", startDate: "2026-09-21", endDate: "2026-09-30", focus: "Engagement", slotIds: ["S04"] },
    ],
    calendar: [
      {
        slotId: "S01",
        date: "2026-09-03",
        brandId: "ATTHAS_BURGER",
        branchScope: "BRAND_WIDE",
        campaignType: "BRAND_BUILDING",
        objective: "Strengthen Burger recognition",
        audience: "Urban burger audiences",
        channel: "instagram",
        assetType: "poster",
        priority: "P1",
        conceptDirection: "Bold brand-led appetite composition without specific product claims.",
        additionalTruthNeeded: [],
      },
      {
        slotId: "S02",
        date: "2026-09-10",
        brandId: "ATTHAS_BURGER",
        branchScope: "BURGER_WELLAMPITIYA",
        campaignType: "PRODUCT_PUSH",
        objective: "Prepare a branch product spotlight",
        audience: "Nearby burger buyers",
        channel: "instagram",
        assetType: "poster",
        priority: "P1",
        conceptDirection: "Plan a product spotlight once a product and approved visual are verified.",
        additionalTruthNeeded: [],
      },
      {
        slotId: "S03",
        date: "2026-09-17",
        brandId: "ATTHAS_RESTAURANT",
        branchScope: "RESTAURANT_COLOMBO_06",
        campaignType: "DINE_IN",
        objective: "Build visit consideration",
        audience: "Colombo dine-in audiences",
        channel: "facebook",
        assetType: "poster",
        priority: "P2",
        conceptDirection: "Warm hospitality-led visit reminder grounded in verified branch details.",
        additionalTruthNeeded: [],
      },
      {
        slotId: "S04",
        date: "2026-09-24",
        brandId: "ATTHAS_RESTAURANT",
        branchScope: "BRAND_WIDE",
        campaignType: "ENGAGEMENT",
        objective: "Encourage non-factual audience interaction",
        audience: "Existing followers",
        channel: "instagram",
        assetType: "story",
        priority: "P3",
        conceptDirection: "Simple preference-led social interaction without menu or offer claims.",
        additionalTruthNeeded: [],
      },
    ],
    planningNotes: ["Product-specific production remains gated until deferred truth is supplied."],
  };
}

function provider(factory: () => unknown): CampaignGenerationProvider {
  return {
    providerName: "mock",
    model: "mock-planner",
    async generate() {
      return JSON.stringify(factory());
    },
  };
}

test("deterministic monthly slots preserve requested cadence", () => {
  const slots = buildMonthlyCalendarSlots({ month: "2026-09", postsPerWeek: 1 });
  assert.deepEqual(
    slots.map((slot) => slot.date),
    ["2026-09-03", "2026-09-10", "2026-09-17", "2026-09-24"],
  );
});

test("truth readiness blocks product work while allowing brand and verified dine-in work", () => {
  assert.deepEqual(
    deriveTruthReadiness({
      campaignType: "PRODUCT_PUSH",
      availableTruthKeys: ["branchPhysicalAddress", "physicalOpeningHours"],
    }),
    {
      requiredTruth: ["productName", "branchAvailability", "approvedProductVisual"],
      missingTruth: ["productName", "branchAvailability", "approvedProductVisual"],
      truthReadiness: "NEEDS_TRUTH_BEFORE_PRODUCTION",
    },
  );
  assert.equal(
    deriveTruthReadiness({
      campaignType: "DINE_IN",
      availableTruthKeys: ["branchPhysicalAddress", "physicalOpeningHours"],
    }).truthReadiness,
    "READY_WITH_CURRENT_TRUTH",
  );
});

test("generates a validated monthly plan and computes readiness deterministically", async () => {
  const result = await generateAtthasMarketingPlan(
    {
      month: "2026-09",
      objectives: ["Grow ATTHA'S consideration"],
      brandContext: "Burger is bold and crave-led. Restaurant is warm and hospitality-led.",
      branches,
      postsPerWeek: 1,
      channels: ["instagram", "facebook"],
      assetTypes: ["poster", "story"],
      availableTruthKeys: ["branchPhysicalAddress", "physicalOpeningHours", "officialPhone"],
      maxRepairAttempts: 0,
    },
    provider(validPlan),
  );

  assert.equal(result.status, "PLANNED");
  assert.equal(result.trace.generatedSlots, 4);
  assert.equal(result.trace.readyForProduction, 3);
  assert.equal(result.trace.blockedPendingTruth, 1);
  assert.equal(result.plan.calendar[1]?.truthReadiness, "NEEDS_TRUTH_BEFORE_PRODUCTION");
  assert.deepEqual(result.plan.calendar[1]?.missingTruth, [
    "productName",
    "branchAvailability",
    "approvedProductVisual",
  ]);
  assert.equal(result.plan.calendar[2]?.truthReadiness, "READY_WITH_CURRENT_TRUTH");
});

test("rejects a branch scope attached to the wrong operating brand", async () => {
  await assert.rejects(
    () =>
      generateAtthasMarketingPlan(
        {
          month: "2026-09",
          objectives: ["Grow consideration"],
          brandContext: "ATTHA'S",
          branches,
          postsPerWeek: 1,
          channels: ["instagram", "facebook"],
          assetTypes: ["poster", "story"],
          maxRepairAttempts: 0,
        },
        provider(() => {
          const plan = validPlan();
          plan.calendar[0]!.branchScope = "RESTAURANT_COLOMBO_06";
          return plan;
        }),
      ),
    /branchScope does not belong to ATTHAS_BURGER/,
  );
});

test("rejects customer-facing price or offer claims inside internal concept direction", async () => {
  await assert.rejects(
    () =>
      generateAtthasMarketingPlan(
        {
          month: "2026-09",
          objectives: ["Grow consideration"],
          brandContext: "ATTHA'S",
          branches,
          postsPerWeek: 1,
          channels: ["instagram", "facebook"],
          assetTypes: ["poster", "story"],
          maxRepairAttempts: 0,
        },
        provider(() => {
          const plan = validPlan();
          plan.calendar[0]!.conceptDirection = "Push LKR 950 as the hero message.";
          return plan;
        }),
      ),
    /customer-facing price\/offer claims/,
  );
});

test("repairs invalid planner output within the configured bound", async () => {
  let calls = 0;
  const repairProvider: CampaignGenerationProvider = {
    providerName: "mock",
    model: "mock-planner",
    async generate() {
      calls += 1;
      if (calls === 1) {
        const bad = validPlan();
        bad.monthlyBalance.brandBuilding = 30;
        return JSON.stringify(bad);
      }
      return JSON.stringify(validPlan());
    },
  };

  const result = await generateAtthasMarketingPlan(
    {
      month: "2026-09",
      objectives: ["Grow consideration"],
      brandContext: "ATTHA'S",
      branches,
      postsPerWeek: 1,
      channels: ["instagram", "facebook"],
      assetTypes: ["poster", "story"],
      maxRepairAttempts: 1,
    },
    repairProvider,
  );

  assert.equal(result.trace.attempts, 2);
  assert.equal(result.trace.repairs, 1);
});
