import { createServer } from "node:http";

import { createMarketingManagerHandler, type MarketingManagerHandlerOptions } from "./marketingManager.js";

export function createAtthasMarketingManagerServer(options: MarketingManagerHandlerOptions = {}) {
  const handle = createMarketingManagerHandler(options);
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
        res.end(JSON.stringify({ ok: true, service: "atthas-marketing-manager" }));
        return;
      }
      if (await handle(req, res, url)) return;
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "not_found" }));
    } catch (error) {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}
