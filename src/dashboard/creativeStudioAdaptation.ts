import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import {
  adaptCreativeDesign,
  CREATIVE_ADAPTATION_TARGETS,
  type CreativeAdaptationPreset,
} from "../commands/adaptCreativeDesign.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 128 * 1024) throw new Error("Adaptation request exceeds 128 KB.");
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

function preset(value: unknown): CreativeAdaptationPreset {
  if (
    value === "instagram-square" ||
    value === "instagram-portrait" ||
    value === "instagram-story" ||
    value === "facebook-post"
  ) return value;
  throw new Error("Unsupported adaptation preset.");
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value, null, 2));
}

export interface CreativeStudioAdaptationHandlerOptions {
  rootDir?: string;
}

export function createCreativeStudioAdaptationHandler(options: CreativeStudioAdaptationHandlerOptions = {}) {
  const store = new FileDesignProjectStore(resolve(options.rootDir ?? ".atthas-os"));
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (req.method === "GET" && url.pathname === "/api/studio/adaptation-presets") {
      sendJson(res, 200, Object.values(CREATIVE_ADAPTATION_TARGETS));
      return true;
    }
    if (req.method !== "POST" || url.pathname !== "/api/studio/adapt") return false;
    const data = await readBody(req);
    const sourceDesignId = safeId(data.designId, "designId");
    const targetPreset = preset(data.preset);
    const newDesignId = data.newDesignId === undefined
      ? `${sourceDesignId}-${targetPreset}`
      : safeId(data.newDesignId, "newDesignId");
    const source = await store.get(sourceDesignId);
    if (!source) throw new Error(`Design project ${sourceDesignId} does not exist.`);
    if (await store.getState(newDesignId)) throw new Error(`Design project ${newDesignId} already exists.`);
    const document = adaptCreativeDesign({
      document: source.document,
      preset: targetPreset,
      newDesignId,
    });
    const created = await store.create({
      document,
      ...(source.brief
        ? {
            brief: {
              ...source.brief,
              id: `${source.brief.id}-${targetPreset}`,
              format: {
                preset: targetPreset,
                width: document.artboard.width,
                height: document.artboard.height,
              },
              createdAt: document.createdAt,
            },
          }
        : {}),
    });
    sendJson(res, 201, {
      designId: created.document.id,
      sourceDesignId,
      preset: targetPreset,
      width: created.document.artboard.width,
      height: created.document.artboard.height,
      layoutId: created.document.layoutId,
    });
    return true;
  };
}
