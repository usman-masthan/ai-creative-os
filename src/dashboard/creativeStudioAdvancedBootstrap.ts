import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { FileCampaignStore } from "../operations/fileStore.js";

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioAdvancedBootstrapOptions {
  rootDir?: string;
}

export function createCreativeStudioAdvancedBootstrapHandler(
  options: CreativeStudioAdvancedBootstrapOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const designs = new FileDesignProjectStore(rootDir);
  const campaigns = new FileCampaignStore(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "GET" || url.pathname !== "/api/studio/bootstrap") return false;
    const [designStates, campaignRecords] = await Promise.all([
      designs.list(),
      campaigns.listCampaigns(),
    ]);
    sendJson(res, 200, {
      designs: designStates,
      campaigns: campaignRecords,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      paidMediaAllowed: process.env.ALLOW_PAID_MEDIA?.trim().toLowerCase() === "true",
      capabilities: {
        documentModel: "DesignDocument-v1",
        renderer: "DesignDocument HTML/SVG renderer",
        canvas: "native-svg-adapter",
        manualEditing: true,
        nativeTypography: true,
        undoRedo: true,
        versionHistory: {
          snapshots: true,
          compare: true,
          restoreAsNewRevision: true,
        },
        deterministicQa: true,
        layeredCreativeDirectorReview: true,
        aiTextEditing: "selected-layer-only",
        aiImageEditing: "isolated-layers-only",
        segmentation: {
          available: Boolean(process.env.GEMINI_API_KEY?.trim()),
          sourceForegroundPixelsPreserved: true,
          generatedBackgroundRepair: true,
          paidMediaRequired: true,
        },
        adaptationPresets: [
          "instagram-square",
          "instagram-portrait",
          "instagram-story",
          "facebook-post",
        ],
        exportFormats: ["png", "svg"],
        pngExportPresets: ["standard", "high-resolution", "4k"],
        jpgExport: false,
        genericMaskRendering: false,
      },
    });
    return true;
  };
}
