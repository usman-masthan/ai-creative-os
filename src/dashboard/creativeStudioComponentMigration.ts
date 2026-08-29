import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { FileCreativeComponentMigrationPlanner } from "../creativeStudio/componentMigration.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 512 * 1024) throw new Error("Creative Studio component migration request exceeds 512 KB.");
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
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,180}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function selectedIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length) throw new Error("selectedItemIds must be a non-empty array.");
  return value.map((entry, index) => safeId(entry, `selectedItemIds[${index}]`));
}

export interface CreativeStudioComponentMigrationHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioComponentMigrationHandler(
  options: CreativeStudioComponentMigrationHandlerOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const planner = new FileCreativeComponentMigrationPlanner(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "POST" && url.pathname === "/api/studio/components/migration-plan") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const familyId = safeId(data.familyId, "familyId");
      const family = await planner.lifecycle.get(
        project.document.brand.clientId,
        project.document.brand.brandId,
        familyId,
      );
      if (!family) throw new Error(`CREATIVE_COMPONENT_FAMILY_NOT_FOUND: ${familyId}`);
      const targetComponentId = data.targetComponentId === undefined
        ? family.latestComponentId
        : safeId(data.targetComponentId, "targetComponentId");
      const targetRef = family.versions.find((entry) => entry.componentId === targetComponentId);
      if (!targetRef) throw new Error("COMPONENT_MIGRATION_TARGET_FAMILY_MISMATCH: target is not a version of the selected family.");
      const targetComponent = await planner.lifecycle.components.get(family.clientId, family.brandId, targetComponentId);
      if (!targetComponent) throw new Error(`CREATIVE_COMPONENT_NOT_FOUND: ${targetComponentId}`);
      const plan = await planner.createPlan({ family, targetComponent, targetVersion: targetRef.version });
      sendJson(res, 201, { plan });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/studio/components/migration-plan") {
      const designId = safeId(url.searchParams.get("designId"), "designId");
      const planId = safeId(url.searchParams.get("planId"), "planId");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const plan = await planner.store.getPlan(
        project.document.brand.clientId,
        project.document.brand.brandId,
        planId,
      );
      if (!plan) throw new Error(`COMPONENT_MIGRATION_PLAN_NOT_FOUND: ${planId}`);
      sendJson(res, 200, { plan });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/migration-execute") {
      const data = await readBody(req);
      const designId = safeId(data.designId, "designId");
      const planId = safeId(data.planId, "planId");
      const expectedPlanToken = safeId(data.expectedPlanToken, "expectedPlanToken");
      const project = await projects.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const plan = await planner.store.getPlan(
        project.document.brand.clientId,
        project.document.brand.brandId,
        planId,
      );
      if (!plan) throw new Error(`COMPONENT_MIGRATION_PLAN_NOT_FOUND: ${planId}`);
      if (plan.planToken !== expectedPlanToken) throw new Error("COMPONENT_MIGRATION_PLAN_TOKEN_MISMATCH: reload the immutable plan before execution.");
      const record = await planner.execute({
        plan,
        selectedItemIds: selectedIds(data.selectedItemIds),
      });
      sendJson(res, 200, { execution: record });
      return true;
    }

    return false;
  };
}
