import { createCampaignPreflight } from "../src/commands/createCampaign.js";
import type { TruthRecord } from "../src/types.js";

const records: TruthRecord[] = [
  {
    key: "price",
    value: 950,
    status: "SOURCE_VERIFIED",
    sourceId: "UBER_BURGER_WELLAMPITIYA",
    scope: {
      tenantId: "T001",
      brandId: "ATTHAS_BURGER",
      branchId: "BURGER_WELLAMPITIYA",
      productId: "CRISPY_CHICKEN_BURGER",
      salesChannel: "UBER_EATS",
    },
  },
];

const result = createCampaignPreflight({
  campaignId: "DEMO-T001-001",
  tenantId: "T001",
  brandId: "ATTHAS_BURGER",
  branchId: "BURGER_WELLAMPITIYA",
  objective: "Promote the Crispy Chicken Burger on Uber Eats",
  channel: "instagram",
  assetType: "poster",
  requirements: [
    {
      key: "price",
      productId: "CRISPY_CHICKEN_BURGER",
      salesChannel: "UBER_EATS",
    },
  ],
  truthRecords: records,
  allowSourceVerified: true,
});

console.log(JSON.stringify(result, null, 2));
