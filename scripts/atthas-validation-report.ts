import { FileCampaignStore } from "../src/operations/fileStore.js";
import { computeAtthasValidationMetrics } from "../src/validationMetrics.js";

const store = new FileCampaignStore(process.env.ATTHAS_STORE_DIR?.trim() || ".atthas-os");
const campaigns = await store.listCampaigns();
const snapshots = (
  await Promise.all(campaigns.map((campaign) => store.getSnapshot(campaign.campaignId)))
).filter((value): value is NonNullable<typeof value> => Boolean(value));

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), metrics: computeAtthasValidationMetrics(snapshots) }, null, 2));
