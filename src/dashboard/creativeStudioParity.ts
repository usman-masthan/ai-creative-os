import { join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

import { readAiTrace } from "../aiTrace.js";
import type { CampaignCreativeOutput, CampaignProductionFormat } from "../creativeTypes.js";
import { evaluateLayeredRenderParity } from "../creativeStudio/renderParity.js";
import { DesignVersionService } from "../creativeStudio/versioning.js";
import type { AtthasBrandId } from "../layouts/atthas.js";

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioParityHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioParityHandler(options: CreativeStudioParityHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const versions = new DesignVersionService(rootDir);
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "GET" || url.pathname !== "/api/studio/parity") return false;
    const designId = safeId(url.searchParams.get("designId") ?? "", "designId");
    const initial = await versions.readVersion(designId, 1);
    const trace = await readAiTrace(join(rootDir, "outputs", initial.campaignId));
    const finalizer = objectValue(trace.finalizer.summary);
    const creative = finalizer?.output as CampaignCreativeOutput | undefined;
    if (!creative) throw new Error("PARITY_INPUT_MISSING: final governed creative output is absent from campaign trace.");
    const rendererCall = [...trace.renderer.calls].reverse().find((call) => call.request);
    const renderer = objectValue(rendererCall?.request);
    const format = renderer?.format as CampaignProductionFormat | undefined;
    const layoutId = typeof renderer?.layoutId === "string" ? renderer.layoutId : initial.layoutId;
    const brandId = (typeof renderer?.brandId === "string" ? renderer.brandId : initial.brand.brandId) as AtthasBrandId;
    if (!format) throw new Error("PARITY_INPUT_MISSING: governed production format is absent from renderer trace.");
    if (brandId !== "ATTHAS_BURGER" && brandId !== "ATTHAS_RESTAURANT") {
      throw new Error(`PARITY_INPUT_INVALID: unsupported brand ${brandId}.`);
    }
    sendJson(res, 200, evaluateLayeredRenderParity({
      document: initial,
      creative,
      format,
      brandId,
      expectedLayoutId: layoutId,
    }));
    return true;
  };
}
