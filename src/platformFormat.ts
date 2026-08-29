import type { CampaignProductionFormat } from "./creativeTypes.js";
import { aspectRatioForDimensions } from "./creativeStudio/contracts/outputFormat.js";

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[ _-]+/g, "-");
}

function customFormat(channel: string, assetType: string): CampaignProductionFormat | undefined {
  if (normalize(channel) !== "custom") return undefined;
  const match = normalize(assetType).match(/^custom-(\d+)x(\d+)$/);
  if (!match) throw new Error("Custom production format must use assetType custom-WIDTHxHEIGHT.");
  const width = Number(match[1]);
  const height = Number(match[2]);
  return {
    channel,
    assetType,
    aspectRatio: aspectRatioForDimensions(width, height),
    width,
    height,
  };
}

export function resolveProductionFormat(
  channel: string,
  assetType: string,
): CampaignProductionFormat {
  const custom = customFormat(channel, assetType);
  if (custom) return custom;

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
    if (normalizedAsset.includes("square")) {
      return {
        channel,
        assetType,
        aspectRatio: "1:1",
        width: 1080,
        height: 1080,
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

  if (normalizedChannel === "digital-menu" || normalizedAsset.includes("menu-board")) {
    return {
      channel,
      assetType,
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
    };
  }

  if (normalizedChannel === "web" && normalizedAsset.includes("banner")) {
    return {
      channel,
      assetType,
      aspectRatio: "21:9",
      width: 1680,
      height: 720,
    };
  }

  if (normalizedChannel === "print" && normalizedAsset.includes("poster")) {
    return {
      channel,
      assetType,
      aspectRatio: "3:4",
      width: 1080,
      height: 1440,
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
