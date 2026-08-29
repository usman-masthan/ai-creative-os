import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import { generateDesignDirections } from "../commands/generateDesignDirections.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import { buildDesignDocumentSvg } from "../creativeStudio/renderDesignDocument.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 128 * 1024) throw new Error("Direction request exceeds 128 KB.");
    chunks.push(buffer);
  }
  return chunks.length
    ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
    : {};
}

function safeId(value: unknown, name: string, max = 160): string {
  if (typeof value !== "string" || !new RegExp(`^[A-Za-z0-9._-]{1,${max}}$`).test(value.trim())) {
    throw new Error(`${name} contains unsafe characters.`);
  }
  return value.trim();
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioDirectionsHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioDirectionsHandler(options: CreativeStudioDirectionsHandlerOptions = {}) {
  const store = new FileDesignProjectStore(resolve(options.rootDir ?? ".atthas-os"));
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const preview = url.pathname.match(/^\/studio-preview\/([^/]+)\.svg$/);
    if (req.method === "GET" && preview) {
      const designId = safeId(decodeURIComponent(preview[1]!), "designId");
      const project = await store.get(designId);
      if (!project) throw new Error(`Design project ${designId} does not exist.`);
      const svg = await buildDesignDocumentSvg(project.document);
      res.writeHead(200, {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(svg);
      return true;
    }

    if (req.method !== "POST" || url.pathname !== "/api/studio/directions") return false;
    const data = await readBody(req);
    const designId = safeId(data.designId, "designId");
    const source = await store.get(designId);
    if (!source) throw new Error(`Design project ${designId} does not exist.`);
    const prefix = data.newDesignPrefix === undefined
      ? `${designId}-directions-${Date.now()}`
      : safeId(data.newDesignPrefix, "newDesignPrefix", 140);
    const directions = generateDesignDirections({
      document: source.document,
      newDesignPrefix: prefix,
    });

    for (const direction of directions) {
      if (await store.getState(direction.document.id)) {
        throw new Error(`Design project ${direction.document.id} already exists.`);
      }
    }
    await Promise.all(directions.map((direction) => store.create({
      document: direction.document,
      ...(source.brief
        ? {
            brief: {
              ...source.brief,
              id: `${source.brief.id}-direction-${direction.id.toLowerCase()}`,
              createdAt: direction.document.createdAt,
            },
          }
        : {}),
    })));

    sendJson(res, 201, {
      sourceDesignId: designId,
      directions: directions.map((direction) => ({
        id: direction.id,
        name: direction.name,
        rationale: direction.rationale,
        designId: direction.document.id,
        layoutId: direction.document.layoutId,
        previewUrl: `/studio-preview/${encodeURIComponent(direction.document.id)}.svg`,
      })),
    });
    return true;
  };
}
