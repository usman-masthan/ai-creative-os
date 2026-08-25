import { readFile } from "node:fs/promises";

import { generateAtthasMarketingPlan } from "../src/commands/generateMarketingPlan.js";
import type { PlanningBranch } from "../src/marketingPlannerTypes.js";
import { createGeminiCampaignProvider } from "../src/providers/gemini.js";

interface BranchMaster {
  branches: Array<{
    branchId: string;
    brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
    name: string;
  }>;
}

const month = process.env.MARKETING_PLAN_MONTH?.trim() || "2026-09";
const objectives = (process.env.MARKETING_OBJECTIVES?.split("|") ?? [
  "Increase qualified awareness and consideration for ATTHA'S Burger and ATTHA'S Restaurant",
  "Create a balanced monthly content system that can feed the Creative Director without inventing deferred facts",
])
  .map((value) => value.trim())
  .filter(Boolean);

const branchMaster = JSON.parse(
  await readFile("clients/T001-atthas/truth/branch-master.json", "utf8"),
) as BranchMaster;
const brandTokens = await readFile(
  "clients/T001-atthas/brands/brand-system/tokens.json",
  "utf8",
);
const burgerRules = await readFile("clients/T001-atthas/brands/burger/rules.md", "utf8");
const restaurantRules = await readFile(
  "clients/T001-atthas/brands/restaurant/rules.md",
  "utf8",
);

const branches: PlanningBranch[] = branchMaster.branches.map((branch) => ({
  branchId: branch.branchId,
  brandId: branch.brandId,
  name: branch.name,
}));

const provider = createGeminiCampaignProvider({ role: "creative", maxOutputTokens: 8000 });
console.error(`Marketing planner: ${provider.providerName} | ${provider.model}`);

const result = await generateAtthasMarketingPlan(
  {
    month,
    objectives,
    brandContext: `${brandTokens}\n\nBURGER RULES\n${burgerRules}\n\nRESTAURANT RULES\n${restaurantRules}`,
    branches,
    postsPerWeek: Number(process.env.MARKETING_POSTS_PER_WEEK ?? "3"),
    channels: ["instagram", "facebook"],
    assetTypes: ["poster", "story", "reel_cover"],
    availableTruthKeys: ["branchPhysicalAddress", "physicalOpeningHours", "officialPhone"],
  },
  provider,
);

console.log(
  JSON.stringify(
    {
      ...result,
      usage: provider.lastUsage,
    },
    null,
    2,
  ),
);
