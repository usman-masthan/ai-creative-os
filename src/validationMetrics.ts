import type { CampaignSnapshot } from "./operations/types.js";

export interface AtthasValidationMetrics {
  campaigns: number;
  publishedCampaigns: number;
  archivedCampaigns: number;
  totalRevisions: number;
  averageRevisionsPerCampaign: number;
  totalSpendUsd: number;
  averageSpendUsd: number;
  visualQaPassRevisions: number;
  finalArtQaPassRevisions: number;
  publicationCount: number;
  campaignsWithPerformanceData: number;
  productionReadyRate: number;
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function computeAtthasValidationMetrics(
  snapshots: CampaignSnapshot[],
): AtthasValidationMetrics {
  const campaigns = snapshots.length;
  const totalRevisions = snapshots.reduce((sum, item) => sum + item.revisions.length, 0);
  const totalSpendUsd = snapshots.reduce(
    (sum, item) => sum + item.spend.reduce((inner, entry) => inner + entry.amountUsd, 0),
    0,
  );
  const productionStates = new Set(["PRODUCTION_READY", "PUBLISHED", "ARCHIVED"]);
  return {
    campaigns,
    publishedCampaigns: snapshots.filter((item) => item.campaign.state === "PUBLISHED").length,
    archivedCampaigns: snapshots.filter((item) => item.campaign.state === "ARCHIVED").length,
    totalRevisions,
    averageRevisionsPerCampaign: campaigns ? round(totalRevisions / campaigns) : 0,
    totalSpendUsd: round(totalSpendUsd),
    averageSpendUsd: campaigns ? round(totalSpendUsd / campaigns) : 0,
    visualQaPassRevisions: snapshots.reduce(
      (sum, item) => sum + item.revisions.filter((revision) => revision.visualQaDecision === "PASS").length,
      0,
    ),
    finalArtQaPassRevisions: snapshots.reduce(
      (sum, item) => sum + item.revisions.filter((revision) => revision.finalArtQaDecision === "PASS").length,
      0,
    ),
    publicationCount: snapshots.reduce((sum, item) => sum + item.publications.length, 0),
    campaignsWithPerformanceData: snapshots.filter((item) => item.performance.length > 0).length,
    productionReadyRate: campaigns
      ? round(snapshots.filter((item) => productionStates.has(item.campaign.state)).length / campaigns)
      : 0,
  };
}
