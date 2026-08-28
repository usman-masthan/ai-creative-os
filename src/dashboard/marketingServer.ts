import { createServer } from "node:http";

import { createCreativeStudioAdaptationHandler } from "./creativeStudioAdaptation.js";
import { createCreativeStudioAdvancedBootstrapHandler } from "./creativeStudioAdvancedBootstrap.js";
import { createCreativeStudioApprovalHandler } from "./creativeStudioApproval.js";
import { createCreativeStudioAssetServingHandler } from "./creativeStudioAssetServing.js";
import { createCreativeStudioAutoPolishHandler } from "./creativeStudioAutoPolish.js";
import { createCreativeStudioCampaignHandoffHandler } from "./creativeStudioCampaignHandoff.js";
import { createCreativeStudioDirectionsHandler } from "./creativeStudioDirections.js";
import { createCreativeStudioDirectorHandler } from "./creativeStudioDirector.js";
import { createCreativeStudioEnhancedHandler } from "./creativeStudioEnhanced.js";
import { createCreativeStudioFinalVisualQaHandler } from "./creativeStudioFinalVisualQa.js";
import { createCreativeStudioHandler } from "./creativeStudio.js";
import { createCreativeStudioParityHandler } from "./creativeStudioParity.js";
import { createCreativeStudioSegmentationHandler } from "./creativeStudioSegmentation.js";
import { createCreativeStudioSvgExportHandler } from "./creativeStudioSvgExport.js";
import { createCreativeStudioVersionsHandler } from "./creativeStudioVersions.js";
import { createMarketingManagerHandler, type MarketingManagerHandlerOptions } from "./marketingManager.js";

export function createAtthasMarketingManagerServer(options: MarketingManagerHandlerOptions = {}) {
  const handleMarketing = createMarketingManagerHandler(options);
  const handleStudio = createCreativeStudioHandler(options);
  const handleStudioEnhanced = createCreativeStudioEnhancedHandler();
  const handleStudioBootstrap = createCreativeStudioAdvancedBootstrapHandler(options);
  const handleStudioApproval = createCreativeStudioApprovalHandler(options);
  const handleStudioAssetServing = createCreativeStudioAssetServingHandler(options);
  const handleStudioCampaignHandoff = createCreativeStudioCampaignHandoffHandler(options);
  const handleStudioAutoPolish = createCreativeStudioAutoPolishHandler(options);
  const handleStudioDirections = createCreativeStudioDirectionsHandler(options);
  const handleStudioParity = createCreativeStudioParityHandler(options);
  const handleStudioDirector = createCreativeStudioDirectorHandler(options);
  const handleStudioFinalVisualQa = createCreativeStudioFinalVisualQaHandler(options);
  const handleStudioAdaptation = createCreativeStudioAdaptationHandler(options);
  const handleStudioVersions = createCreativeStudioVersionsHandler(options);
  const handleStudioSvgExport = createCreativeStudioSvgExportHandler(options);
  const handleStudioSegmentation = createCreativeStudioSegmentationHandler(options);
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/workspace", "http://localhost");
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(302, { location: "/workspace" });
        res.end();
        return;
      }
      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, service: "atthas-marketing-manager", creativeStudio: true }));
        return;
      }
      if (await handleStudioBootstrap(req, res, url)) return;
      if (await handleStudioApproval(req, res, url)) return;
      if (await handleStudioAssetServing(req, res, url)) return;
      if (await handleStudioCampaignHandoff(req, res, url)) return;
      if (await handleStudioAutoPolish(req, res, url)) return;
      if (await handleStudioDirections(req, res, url)) return;
      if (await handleStudioParity(req, res, url)) return;
      if (await handleStudioDirector(req, res, url)) return;
      if (await handleStudioFinalVisualQa(req, res, url)) return;
      if (await handleStudioAdaptation(req, res, url)) return;
      if (await handleStudioVersions(req, res, url)) return;
      if (await handleStudioSvgExport(req, res, url)) return;
      if (await handleStudioSegmentation(req, res, url)) return;
      if (await handleStudioEnhanced(req, res, url)) return;
      if (await handleStudio(req, res, url)) return;
      if (await handleMarketing(req, res, url)) return;
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "not_found" }));
    } catch (error) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}
