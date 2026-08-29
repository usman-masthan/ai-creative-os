import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { handoffApprovedDesignToCampaign } from "../creativeStudio/campaignHandoff.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new Error("Campaign handoff request exceeds 64 KB.");
    chunks.push(buffer);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> : {};
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function registeredBy(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120) {
    throw new Error("registeredBy is required and must be 120 characters or fewer.");
  }
  return value.trim();
}

function preset(value: unknown): "standard" | "high-resolution" | "4k" | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "standard" || value === "high-resolution" || value === "4k") return value;
  throw new Error("Unsupported approved export preset.");
}

export interface CreativeStudioCampaignHandoffHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioCampaignHandoffHandler(
  options: CreativeStudioCampaignHandoffHandlerOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/register-approved-asset") return false;
    const data = await readBody(req);
    const selectedPreset = preset(data.preset);
    const result = await handoffApprovedDesignToCampaign({
      rootDir,
      designId: safeId(data.designId, "designId"),
      registeredBy: registeredBy(data.registeredBy),
      ...(selectedPreset ? { preset: selectedPreset } : {}),
    });
    res.writeHead(result.alreadyRegistered ? 200 : 201, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(result, null, 2));
    return true;
  };
}
