import type { CampaignMoneyOverlay } from "./creativeTypes.js";

export function formatLkr(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error("Money formatting error: amount must be a finite number.");
  }

  return `LKR ${new Intl.NumberFormat("en-LK", {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)}`;
}

export function buildLkrOverlay(amount: number): CampaignMoneyOverlay {
  return {
    amount,
    currency: "LKR",
    display: formatLkr(amount),
  };
}
