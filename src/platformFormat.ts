import type { CampaignProductionFormat } from "./creativeTypes.js";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[ _-]+/g, "-");
}

export function resolveProductionFormat(
  channel: string,
  assetType: string,
): CampaignProductionFormat {
  const normalizedChannel = normalize(channel);
  const normalizedAsset = normalize(assetType);

  if (normalizedChannel === "instagram") {
    if (normalizedAsset.includes("story") || normalizedAsset.includes("reel")) {
      return {
        channel,
        assetType,
        aspectRatio: "9:16",
        width: 1080,
        height: 1920,
      };
    }

    return {
      channel,
      assetType,
      aspectRatio: "4:5",
      width: 1080,
      height: 1350,
    };
  }

  if (normalizedChannel === "tiktok") {
    return {
      channel,
      assetType,
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
    };
  }

  if (normalizedChannel === "facebook") {
    if (normalizedAsset.includes("story") || normalizedAsset.includes("reel")) {
      return {
        channel,
        assetType,
        aspectRatio: "9:16",
        width: 1080,
        height: 1920,
      };
    }

    return {
      channel,
      assetType,
      aspectRatio: "4:5",
      width: 1080,
      height: 1350,
    };
  }

  return {
    channel,
    assetType,
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
  };
}
