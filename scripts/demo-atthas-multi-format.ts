import { readFile } from "node:fs/promises";

import type { BrandGovernance } from "../src/brandGovernance.js";
import { adaptDirectedCampaign } from "../src/commands/adaptCampaign.js";
import { directGeneratedCampaign } from "../src/commands/directCampaign.js";
import {
  generateCampaign,
  type GenerateCampaignRequest,
} from "../src/commands/generateCampaign.js";
import { createGeminiCampaignProvider } from "../src/providers/gemini.js";
import type { TruthRecord } from "../src/types.js";

interface PricingSnapshot {
  tenantId: "T001";
  brandId: string;
  branchId: string;
  salesChannel: string;
  sourceId: string;
  status: "SOURCE_VERIFIED";
  observedAt?: string;
  prices: Array<{
    productId: string;
    name: string;
    price: number;
  }>;
}

const campaignId = process.env.ADAPTATION_CAMPAIGN_ID?.trim() || "T001-ADAPT-DEMO-001";
const pricing = JSON.parse(
  await readFile("clients/T001-atthas/truth/pricing/wellampitiya.json", "utf8"),
) as PricingSnapshot;
const burgerRules = await readFile("clients/T001-atthas/brands/burger/rules.md", "utf8");
const masterPositioning = await readFile(
  "clients/T001-atthas/brands/master/positioning.md",
  "utf8",
);
const brandGovernance = JSON.parse(
  await readFile("clients/T001-atthas/brands/master/governance.json", "utf8"),
) as BrandGovernance;

const crispy = pricing.prices.find((item) => item.productId === "CRISPY_CHICKEN_BURGER");
if (!crispy) throw new Error("Crispy Chicken Burger was not found in the pricing snapshot.");

const truthRecords: TruthRecord[] = [
  {
    key: "price",
    value: crispy.price,
    status: pricing.status,
    sourceId: pricing.sourceId,
    scope: {
      tenantId: pricing.tenantId,
      brandId: pricing.brandId,
      branchId: pricing.branchId,
      productId: crispy.productId,
      salesChannel: pricing.salesChannel,
    },
  },
  {
    key: "productName",
    value: crispy.name,
    status: pricing.status,
    sourceId: pricing.sourceId,
    scope: {
      tenantId: pricing.tenantId,
      brandId: pricing.brandId,
      branchId: pricing.branchId,
      productId: crispy.productId,
      salesChannel: pricing.salesChannel,
    },
  },
];

const request: GenerateCampaignRequest = {
  campaignId,
  tenantId: "T001",
  brandId: "ATTHAS_BURGER",
  branchId: "BURGER_WELLAMPITIYA",
  objective: "Drive Crispy Chicken Burger orders on Uber Eats",
  channel: "instagram",
  assetType: "poster",
  requirements: [
    { key: "productName", productId: crispy.productId, salesChannel: pricing.salesChannel },
    { key: "price", productId: crispy.productId, salesChannel: pricing.salesChannel },
  ],
  truthRecords,
  allowSourceVerified: true,
  brandContext: `${masterPositioning}\n\n${burgerRules}`,
  brandGovernance,
};

const generationProvider = createGeminiCampaignProvider({ role: "default" });
const directorProvider = createGeminiCampaignProvider({ role: "creative" });
const finalizerProvider = createGeminiCampaignProvider({ role: "default" });
const adaptationProvider = createGeminiCampaignProvider({ role: "default" });

const generated = await generateCampaign(request, generationProvider);
if (generated.status !== "GENERATED") {
  throw new Error(`Campaign did not reach generation: ${generated.status}`);
}
const directed = await directGeneratedCampaign(
  { request, campaign: generated },
  { director: directorProvider, finalizer: finalizerProvider },
);

const bundle = await adaptDirectedCampaign({
  campaignId,
  brandId: "ATTHAS_BURGER",
  campaign: directed,
  provider: adaptationProvider,
  truthVersion: pricing.observedAt ? `public-pricing-${pricing.observedAt}` : "public-pricing-current-snapshot",
  brandVersion: "atthas-brand-v0.1",
  brandGovernance,
});

console.log(
  JSON.stringify(
    {
      source: {
        campaignId,
        selectedConcept: directed.creative.recommendedConceptId,
        price: directed.creative.overlaySpec.price,
      },
      adaptation: bundle,
      usage: {
        generation: generationProvider.lastUsage,
        creativeDirector: directorProvider.lastUsage,
        finalization: finalizerProvider.lastUsage,
        adaptation: adaptationProvider.lastUsage,
      },
    },
    null,
    2,
  ),
);
