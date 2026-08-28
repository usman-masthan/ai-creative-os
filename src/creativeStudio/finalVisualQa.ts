import { readFile } from "node:fs/promises";

import type { CampaignProductionFormat } from "../creativeTypes.js";
import type { DesignDocument, DesignTextLayer } from "../designDocument/types.js";
import type { FinalArtQaProvider, FinalArtQaResult } from "../finalArtQa/types.js";
import type { TaskTruthSnapshot } from "../taskTruth.js";

function textByRole(document: DesignDocument, role: DesignTextLayer["role"]): string {
  const layer = document.layers.find(
    (candidate) => candidate.type === "text" && candidate.role === role && candidate.visible,
  );
  return layer?.type === "text" ? layer.text : "";
}

function stringsFromUnknown(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(stringsFromUnknown);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(stringsFromUnknown);
  }
  return [];
}

function truthStrings(snapshot: TaskTruthSnapshot, key: string): string[] {
  return [...new Set(snapshot.facts.filter((fact) => fact.key === key).flatMap((fact) => stringsFromUnknown(fact.value)))];
}

export async function reviewLayeredFinalVisual(input: {
  document: DesignDocument;
  truthSnapshot: TaskTruthSnapshot;
  format: CampaignProductionFormat;
  pngPath: string;
  provider: FinalArtQaProvider;
}): Promise<FinalArtQaResult> {
  if (input.document.brand.brandId !== "ATTHAS_BURGER" && input.document.brand.brandId !== "ATTHAS_RESTAURANT") {
    throw new Error(`FINAL_VISUAL_QA_UNSUPPORTED_BRAND: ${input.document.brand.brandId}.`);
  }
  const bytes = await readFile(input.pngPath);
  if (bytes.length < 1_000) throw new Error("FINAL_VISUAL_QA_INVALID_IMAGE: rendered PNG is unexpectedly small.");
  const productNames = truthStrings(input.truthSnapshot, "productName");
  const platforms = truthStrings(input.truthSnapshot, "deliveryChannel");
  const price = textByRole(input.document, "price");
  const logoExpected = input.document.layers.some((layer) => layer.type === "logo" && layer.visible);

  return input.provider.review({
    imageBase64: bytes.toString("base64"),
    mimeType: "image/png",
    brandId: input.document.brand.brandId,
    layoutId: input.document.layoutId,
    channel: input.format.channel,
    assetType: input.format.assetType,
    width: input.document.artboard.width,
    height: input.document.artboard.height,
    expectedHeadline: textByRole(input.document, "headline"),
    expectedSupportingCopy: textByRole(input.document, "supporting"),
    expectedCta: textByRole(input.document, "cta"),
    ...(price ? { expectedPrice: price } : {}),
    ...(productNames[0] ? { expectedProductName: productNames[0] } : {}),
    ...(platforms.length ? { expectedPlatforms: platforms } : {}),
    logoExpected,
  });
}
