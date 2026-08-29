import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { FileCreativeComponentMigrationOperations } from "../creativeStudio/componentMigrationOperations.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 512 * 1024) throw new Error("Creative Studio migration operations request exceeds 512 KB.");
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

export interface CreativeStudioComponentMigrationOperationsHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioComponentMigrationOperationsHandler(
  options: CreativeStudioComponentMigrationOperationsHandlerOptions = {},
) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const projects = new FileDesignProjectStore(rootDir);
  const operations = new FileCreativeComponentMigrationOperations(rootDir);

  async function context(designIdValue: unknown) {
    const designId = safeId(designIdValue, "designId");
    const project = await projects.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    return {
      designId,
      project,
      clientId: project.document.brand.clientId,
      brandId: project.document.brand.brandId,
    };
  }

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/components/migration-history") {
      const ctx = await context(url.searchParams.get("designId"));
      const familyId = url.searchParams.get("familyId")
        ? safeId(url.searchParams.get("familyId"), "familyId")
        : undefined;
      const history = await operations.listHistory({
        clientId: ctx.clientId,
        brandId: ctx.brandId,
        ...(familyId ? { familyId } : {}),
      });
      sendJson(res, 200, history);
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/migration-recovery-preview") {
      const data = await readBody(req);
      const ctx = await context(data.designId);
      const preview = await operations.previewRecovery({
        clientId: ctx.clientId,
        brandId: ctx.brandId,
        planId: safeId(data.planId, "planId"),
        itemId: safeId(data.itemId, "itemId"),
      });
      sendJson(res, 200, { preview });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/studio/components/migration-recover") {
      const data = await readBody(req);
      const ctx = await context(data.designId);
      const result = await operations.restorePreMigration({
        clientId: ctx.clientId,
        brandId: ctx.brandId,
        planId: safeId(data.planId, "planId"),
        itemId: safeId(data.itemId, "itemId"),
        expectedPreviewToken: safeId(data.expectedPreviewToken, "expectedPreviewToken"),
        acknowledgeApprovedCurrent: data.acknowledgeApprovedCurrent === true,
      });
      sendJson(res, 200, {
        recovery: result.record,
        designId: result.document.id,
        designVersion: result.document.version,
        qa: result.qa,
      });
      return true;
    }

    return false;
  };
}
