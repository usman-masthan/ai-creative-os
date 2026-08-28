import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve } from "node:path";

import { resolveGovernedStudioAssetPath } from "../creativeStudio/assetPathGovernance.js";
import { FileDesignProjectStore } from "../creativeStudio/projectStore.js";
import type { DesignAssetRef, DesignLayer } from "../designDocument/types.js";

function safeId(value: string, name: string): string {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(value.trim())) throw new Error(`${name} contains unsafe characters.`);
  return value.trim();
}

function layerAsset(layer: DesignLayer): DesignAssetRef | undefined {
  if (layer.type === "image" || layer.type === "logo") return layer.asset;
  if (layer.type === "background") return layer.asset;
  return undefined;
}

function contentType(path: string, fallback?: string): string {
  if (fallback?.trim()) return fallback;
  switch (extname(path).toLowerCase()) {
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    case ".webp": return "image/webp";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    default: return "application/octet-stream";
  }
}

export interface CreativeStudioAssetServingHandlerOptions {
  rootDir?: string;
  repoRoot?: string;
}

export function createCreativeStudioAssetServingHandler(options: CreativeStudioAssetServingHandlerOptions = {}) {
  const rootDir = resolve(options.rootDir ?? ".atthas-os");
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const projects = new FileDesignProjectStore(rootDir);

  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const match = url.pathname.match(/^\/studio-asset\/([^/]+)\/([^/]+)$/);
    if (req.method !== "GET" || !match) return false;

    const designId = safeId(decodeURIComponent(match[1]!), "designId");
    const layerId = safeId(decodeURIComponent(match[2]!), "layerId");
    const project = await projects.get(designId);
    if (!project) throw new Error(`Design project ${designId} does not exist.`);
    const layer = project.document.layers.find((candidate) => candidate.id === layerId);
    if (!layer) throw new Error(`DESIGN_LAYER_NOT_FOUND: ${layerId}`);
    const asset = layerAsset(layer);
    if (!asset?.uri) throw new Error(`ASSET_MISSING: ${layerId} has no asset URI.`);

    if (asset.uri.startsWith("data:")) {
      const data = asset.uri.match(/^data:([^;]+);base64,(.+)$/s);
      if (!data) throw new Error("Invalid data URI asset.");
      const bytes = Buffer.from(data[2]!, "base64");
      res.writeHead(200, {
        "content-type": data[1]!,
        "content-length": bytes.length,
        "cache-control": "no-store",
      });
      res.end(bytes);
      return true;
    }

    const path = resolveGovernedStudioAssetPath({
      path: asset.uri,
      asset,
      clientId: project.document.brand.clientId,
      rootDir,
      repoRoot,
    });
    const bytes = await readFile(path);
    res.writeHead(200, {
      "content-type": contentType(path, asset.mimeType),
      "content-length": bytes.length,
      "cache-control": "no-store",
    });
    res.end(bytes);
    return true;
  };
}
