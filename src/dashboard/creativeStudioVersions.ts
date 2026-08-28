import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { DesignVersionService } from "../creativeStudio/versioning.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 128 * 1024) throw new Error("Version request exceeds 128 KB.");
    chunks.push(buffer);
  }
  return chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
    : {};
}

function safeId(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function version(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioVersionsHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioVersionsHandler(options: CreativeStudioVersionsHandlerOptions = {}) {
  const service = new DesignVersionService(resolve(options.rootDir ?? ".atthas-os"));
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/version") {
      const designId = safeId(url.searchParams.get("designId") ?? "", "designId");
      const requestedVersion = Number(url.searchParams.get("version"));
      const document = await service.readVersion(designId, version(requestedVersion, "version"));
      sendJson(res, 200, document);
      return true;
    }

    if (req.method !== "POST") return false;
    if (url.pathname === "/api/studio/compare") {
      const data = await readBody(req);
      const comparison = await service.compare(
        safeId(data.designId, "designId"),
        version(data.fromVersion, "fromVersion"),
        version(data.toVersion, "toVersion"),
      );
      sendJson(res, 200, comparison);
      return true;
    }
    if (url.pathname === "/api/studio/restore") {
      const data = await readBody(req);
      const project = await service.restore(
        safeId(data.designId, "designId"),
        version(data.sourceVersion, "sourceVersion"),
      );
      sendJson(res, 200, {
        designId: project.document.id,
        restoredVersion: project.document.version,
        sourceVersion: data.sourceVersion,
      });
      return true;
    }
    return false;
  };
}
