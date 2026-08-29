import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { FileCreativeComponentImpactAnalyzer } from "../creativeStudio/componentImpact.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";

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

export interface CreativeStudioComponentImpactHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioComponentImpactHandler(
  options: CreativeStudioComponentImpactHandlerOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const impact = new FileCreativeComponentImpactAnalyzer(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "GET" || url.pathname !== "/api/studio/components/impact") return false;
    const designId = safeId(url.searchParams.get("designId"), "designId");
    const familyId = safeId(url.searchParams.get("familyId"), "familyId");
    const project = await projects.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const family = await impact.lifecycle.get(
      project.document.brand.clientId,
      project.document.brand.brandId,
      familyId,
    );
    if (!family) throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_FOUND: ${familyId}`);
    const targetComponentId = url.searchParams.get("targetComponentId")
      ? safeId(url.searchParams.get("targetComponentId"), "targetComponentId")
      : family.latestComponentId;
    const targetRef = family.versions.find((entry) => entry.componentId === targetComponentId);
    if (!targetRef) throw new Error("COMPONENT_IMPACT_TARGET_FAMILY_MISMATCH: target is not a version of the selected family.");
    const targetComponent = await impact.lifecycle.components.get(
      family.clientId,
      family.brandId,
      targetComponentId,
    );
    if (!targetComponent) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${targetComponentId}`);
    const report = await impact.analyze({ family, targetComponent, targetVersion: targetRef.version });
    sendJson(res, 200, { report });
    return true;
  };
}
