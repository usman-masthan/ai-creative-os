import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { FileCreativeComponentImpactAnalyzer } from "../creativeStudio/componentImpact.js";
import type { CreativeComponentFamilyStatus } from "../creativeStudio/componentLifecycle.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 256 * 1024) throw new Error("Creative Studio component lifecycle request exceeds 256 KB.");
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function statusValue(value: unknown): CreativeComponentFamilyStatus {
  if (value === "ACTIVE" || value === "DEPRECATED" || value === "ARCHIVED") return value;
  throw new Error("status must be ACTIVE, DEPRECATED or ARCHIVED.");
}

export interface CreativeStudioComponentLifecycleGuardOptions {
  rootDir?: string;
}

export function createCreativeStudioComponentLifecycleGuard(
  options: CreativeStudioComponentLifecycleGuardOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const impact = new FileCreativeComponentImpactAnalyzer(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/components/status") return false;
    const data = await readBody(req);
    const designId = safeId(data.designId, "designId");
    const familyId = safeId(data.familyId, "familyId");
    const nextStatus = statusValue(data.status);
    const project = await projects.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const family = await impact.lifecycle.get(
      project.document.brand.clientId,
      project.document.brand.brandId,
      familyId,
    );
    if (!family) throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_FOUND: ${familyId}`);

    let verifiedImpactToken: string | undefined;
    if (nextStatus === "DEPRECATED" || nextStatus === "ARCHIVED") {
      const targetComponent = await impact.lifecycle.components.get(
        family.clientId,
        family.brandId,
        family.latestComponentId,
      );
      if (!targetComponent) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${family.latestComponentId}`);
      const report = await impact.analyze({
        family,
        targetComponent,
        targetVersion: family.latestVersion,
      });
      const supplied = typeof data.impactToken === "string" ? data.impactToken.trim() : "";
      if (!supplied || supplied !== report.impactToken) {
        throw new Error("COMPONENT_IMPACT_PREVIEW_REQUIRED: analyze the current family dependency impact before deprecating or archiving it.");
      }
      verifiedImpactToken = report.impactToken;
    }

    const updated = await impact.lifecycle.setStatus({
      clientId: family.clientId,
      brandId: family.brandId,
      familyId,
      status: nextStatus,
    });
    sendJson(res, 200, {
      family: updated,
      ...(verifiedImpactToken ? { verifiedImpactToken } : {}),
    });
    return true;
  };
}
