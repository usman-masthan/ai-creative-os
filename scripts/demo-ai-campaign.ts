import { readFile } from "node:fs/promises";

import type { BrandGovernance } from "../src/brandGovernance.js";
import { generateCampaign } from "../src/commands/generateCampaign.js";
import { createCampaignProvider } from "../src/providers/providerRouter.js";
import type { TruthRecord } from "../src/types.js";

interface PricingSnapshot {
  tenantId: "T001";
  brandId: string;
  branchId: string;
  salesChannel: string;
  sourceId: string;
  status: "SOURCE_VERIFIED";
  prices: Array<{
    productId: string;
    name: string;
    price: number;
  }>;
}

const pricing = JSON.parse(
  await readFile(
    "clients/T001-atthas/truth/pricing/wellampitiya.json",
    "utf8",
  ),
) as PricingSnapshot;

const burgerRules = await readFile(
  "clients/T001-atthas/brands/burger/rules.md",
  "utf8",
);
const masterPositioning = await readFile(
  "clients/T001-atthas/brands/master/positioning.md",
  "utf8",
);
const brandGovernance = JSON.parse(
  await readFile(
    "clients/T001-atthas/brands/master/governance.json",
    "utf8",
  ),
) as BrandGovernance;

const crispy = pricing.prices.find(
  (item) => item.productId === "CRISPY_CHICKEN_BURGER",
);

if (!crispy) {
  throw new Error("Crispy Chicken Burger was not found in the pricing snapshot.");
}

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

let provider;
try {
  provider = createCampaignProvider();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.error(
  `Campaign AI provider: ${provider.providerName} | model: ${provider.model}`,
);

const result = await generateCampaign(
  {
    campaignId: "T001-AI-DEMO-001",
    tenantId: "T001",
    brandId: "ATTHAS_BURGER",
    branchId: "BURGER_WELLAMPITIYA",
    objective: "Drive Crispy Chicken Burger orders on Uber Eats",
    channel: "instagram",
    assetType: "poster",
    requirements: [
      {
        key: "productName",
        productId: crispy.productId,
        salesChannel: pricing.salesChannel,
      },
      {
        key: "price",
        productId: crispy.productId,
        salesChannel: pricing.salesChannel,
      },
    ],
    truthRecords,
    allowSourceVerified: true,
    brandContext: `${masterPositioning}\n\n${burgerRules}`,
    brandGovernance,
  },
  provider,
);

console.log(JSON.stringify(result, null, 2));
