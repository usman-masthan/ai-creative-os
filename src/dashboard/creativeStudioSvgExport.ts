import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";

import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { exportDesignDocumentSvg } from "../creativeStudio/renderDesignDocument.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1024) throw new Error("SVG export request exceeds 64 KB.");
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

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioSvgExportHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioSvgExportHandler(options: CreativeStudioSvgExportHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const store = new FileDesignProjectStore(rootDir);
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method !== "POST" || url.pathname !== "/api/studio/export-svg") return false;
    const data = await readBody(req);
    const designId = safeId(data.designId, "designId");
    const project = await store.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    if (project.qa?.decision === "BLOCK") {
      throw new Error("FINAL_QA_BLOCK: resolve blocking deterministic QA issues before SVG export.");
    }
    const exported = await exportDesignDocumentSvg({
      document: project.document,
      outputDir: join(rootDir, "designs", designId, "exports"),
    });
    const exportedAt = new Date().toISOString();
    await store.appendExport(designId, {
      exportedAt,
      format: "svg",
      preset: "custom",
      path: exported.outputPath,
      width: exported.width,
      height: exported.height,
    });
    sendJson(res, 200, {
      format: "svg",
      width: exported.width,
      height: exported.height,
      outputPath: `/studio-media/${encodeURIComponent(designId)}/${encodeURIComponent(basename(exported.outputPath))}`,
    });
    return true;
  };
}
