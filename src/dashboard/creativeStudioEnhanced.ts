import type { IncomingMessage, ServerResponse } from "node:http";

import { creativeStudioComponentImpactHtml } from "./creativeStudioComponentImpactHtml.js";

function sendHtml(res: ServerResponse, value: string): void {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(value);
}

export function createCreativeStudioEnhancedHandler() {
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "GET" || url.pathname !== "/studio") return false;
    sendHtml(res, creativeStudioComponentImpactHtml());
    return true;
  };
}
