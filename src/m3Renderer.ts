import {
  ATTHAS_TOKENS,
  atthasBrandIdentifier,
  atthasCssVariables,
  atthasDisplayFont,
} from "./atthasTokens.js";
import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
  CampaignPriceStyle,
} from "./creativeTypes.js";
import {
  selectAtthasLayout,
  type AtthasBrandId,
  type AtthasLayoutId,
} from "./layouts/atthas.js";
import type { VisualCopyZoneId, VisualCopyZoneRating } from "./visualQa/types.js";

export type M3RendererMode = "M3_V2";
export type M3CopyZoneSource = "VISUAL_QA" | "DETERMINISTIC_FALLBACK";
export type M3CopyZones = Record<VisualCopyZoneId, VisualCopyZoneRating>;

export interface M3RendererPlan {
  mode: M3RendererMode;
  layoutId: AtthasLayoutId;
  copyZone: VisualCopyZoneId;
  copyZoneRating: VisualCopyZoneRating;
  copyZoneSource: M3CopyZoneSource;
  brandIdentifier: string;
  brandFont: string;
  priceStyle: CampaignPriceStyle;
}

export interface M3PosterTemplateInput {
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  baseImageDataUri: string;
  brandId: AtthasBrandId;
  layoutId?: AtthasLayoutId;
  copyZones?: M3CopyZones;
}

const COPY_ZONE_PRIORITY: readonly VisualCopyZoneId[] = [
  "upperLeft",
  "upperRight",
  "lowerLeft",
  "lowerRight",
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function selectM3CopyZone(copyZones?: M3CopyZones): {
  zone: VisualCopyZoneId;
  rating: VisualCopyZoneRating;
  source: M3CopyZoneSource;
} {
  if (!copyZones) {
    return {
      zone: "upperLeft",
      rating: "ACCEPTABLE",
      source: "DETERMINISTIC_FALLBACK",
    };
  }

  for (const rating of ["GOOD", "ACCEPTABLE"] as const) {
    const zone = COPY_ZONE_PRIORITY.find((candidate) => copyZones[candidate] === rating);
    if (zone) return { zone, rating, source: "VISUAL_QA" };
  }

  throw new Error(
    "M3 renderer requires at least one GOOD or ACCEPTABLE Visual QA copy zone; all supplied zones are POOR.",
  );
}

export function resolveM3PriceStyle(
  brandId: AtthasBrandId,
  requested?: CampaignPriceStyle,
): CampaignPriceStyle {
  if (requested) return requested;
  return brandId === "ATTHAS_RESTAURANT" ? "BRAND_RED" : "BRAND_YELLOW";
}

export function buildM3RendererPlan(input: {
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  brandId: AtthasBrandId;
  layoutId?: AtthasLayoutId;
  copyZones?: M3CopyZones;
}): M3RendererPlan {
  const layout = selectAtthasLayout({
    brandId: input.brandId,
    creative: input.creative,
    format: input.format,
    ...(input.layoutId ? { preferredLayoutId: input.layoutId } : {}),
  });
  const selected = selectM3CopyZone(input.copyZones);

  return {
    mode: "M3_V2",
    layoutId: layout.id,
    copyZone: selected.zone,
    copyZoneRating: selected.rating,
    copyZoneSource: selected.source,
    brandIdentifier: atthasBrandIdentifier(input.brandId),
    brandFont: atthasDisplayFont(input.brandId),
    priceStyle: resolveM3PriceStyle(input.brandId, input.creative.overlaySpec.price?.priceStyle),
  };
}

export function assertM3RendererTokenOnlyColours(html: string): void {
  const approved = new Set(
    Object.values(ATTHAS_TOKENS.colours).map((value) => value.toUpperCase()),
  );
  const usedHex = html.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  const arbitrary = [...new Set(usedHex.map((value) => value.toUpperCase()))].filter(
    (value) => !approved.has(value),
  );
  if (arbitrary.length) {
    throw new Error(`M3 renderer emitted non-token colours: ${arbitrary.join(", ")}.`);
  }
}

export function buildM3PosterHtml(input: M3PosterTemplateInput): string {
  const overlay = input.creative.overlaySpec;
  const plan = buildM3RendererPlan(input);
  const restaurant = input.brandId === "ATTHAS_RESTAURANT";
  const headline = escapeHtml(overlay.headline);
  const supportingCopy = escapeHtml(overlay.supportingCopy);
  const cta = escapeHtml(overlay.cta);
  const price = escapeHtml(overlay.price?.display ?? "");
  const brandIdentifier = escapeHtml(plan.brandIdentifier);
  const gradientAngle: Record<VisualCopyZoneId, string> = {
    upperLeft: "135deg",
    upperRight: "225deg",
    lowerLeft: "45deg",
    lowerRight: "315deg",
  };
  const gradientToken = restaurant ? "--atthas-cream" : "--atthas-red-ember";
  const copyWidth = input.format.aspectRatio === "9:16" ? "76%" : "52%";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${input.format.width}, initial-scale=1" />
<style>
  :root {
    ${atthasCssVariables()}
    --safe: 6%;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    width: ${input.format.width}px;
    height: ${input.format.height}px;
    overflow: hidden;
  }
  body {
    font-family: "${ATTHAS_TOKENS.typography.body}", Arial, Helvetica, sans-serif;
    background: var(--atthas-ink);
  }
  .poster {
    position: relative;
    width: ${input.format.width}px;
    height: ${input.format.height}px;
    overflow: hidden;
    isolation: isolate;
    background-image: url("${cssString(input.baseImageDataUri)}");
    background-size: cover;
    background-position: center;
    color: ${restaurant ? "var(--atthas-ink)" : "var(--atthas-white)"};
  }
  .poster::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: linear-gradient(
      ${gradientAngle[plan.copyZone]},
      color-mix(in srgb, var(${gradientToken}) 94%, transparent) 0%,
      color-mix(in srgb, var(${gradientToken}) 78%, transparent) 24%,
      color-mix(in srgb, var(${gradientToken}) 28%, transparent) 46%,
      transparent 66%
    );
  }
  .copy-block {
    position: absolute;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: min(${copyWidth}, 680px);
    max-width: 82%;
  }
  [data-copy-zone="upperLeft"] .copy-block { left: var(--safe); top: var(--safe); }
  [data-copy-zone="upperRight"] .copy-block {
    right: var(--safe);
    top: var(--safe);
    align-items: flex-end;
    text-align: right;
  }
  [data-copy-zone="lowerLeft"] .copy-block { left: var(--safe); bottom: var(--safe); }
  [data-copy-zone="lowerRight"] .copy-block {
    right: var(--safe);
    bottom: var(--safe);
    align-items: flex-end;
    text-align: right;
  }
  .brand-identifier {
    font-family: "${plan.brandFont}", ${restaurant ? "Georgia, serif" : '"Arial Narrow", Arial, sans-serif'};
    font-size: clamp(20px, 2.25vw, 28px);
    line-height: 1;
    font-weight: ${restaurant ? "700" : "800"};
    letter-spacing: ${restaurant ? "0" : "0.8px"};
    margin-bottom: 24px;
    color: ${restaurant ? "var(--atthas-red-deep)" : "var(--atthas-white)"};
  }
  .headline {
    font-family: "${plan.brandFont}", ${restaurant ? "Georgia, serif" : '"Arial Narrow", Arial, sans-serif'};
    font-size: clamp(54px, 7vw, 88px);
    line-height: ${restaurant ? "1.02" : ".96"};
    font-weight: ${restaurant ? "700" : "800"};
    letter-spacing: ${restaurant ? "-1px" : "-1.6px"};
    text-wrap: balance;
    text-shadow: 0 3px 18px color-mix(in srgb, var(--atthas-ink) 24%, transparent);
  }
  .supporting {
    margin-top: 18px;
    max-width: 620px;
    font-size: clamp(23px, 2.65vw, 34px);
    line-height: 1.22;
    font-weight: ${restaurant ? "500" : "600"};
    color: ${restaurant ? "var(--atthas-ink)" : "var(--atthas-cream)"};
  }
  .conversion-stack {
    display: flex;
    flex-direction: column;
    align-items: inherit;
    gap: 14px;
    margin-top: 28px;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 58px;
    padding: 16px 26px;
    border-radius: 8px;
    background: ${restaurant ? "var(--atthas-red-deep)" : "var(--atthas-gold-flame)"};
    color: ${restaurant ? "var(--atthas-white)" : "var(--atthas-ink)"};
    font-size: clamp(22px, 2.35vw, 29px);
    line-height: 1;
    font-weight: 800;
    box-shadow: 0 10px 26px color-mix(in srgb, var(--atthas-ink) 24%, transparent);
  }
  .price {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 66px;
    padding: 17px 25px;
    border-radius: 10px;
    font-family: "${ATTHAS_TOKENS.typography.price}", "Arial Narrow", Arial, sans-serif;
    font-size: clamp(36px, 4.15vw, 52px);
    line-height: 1;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 10px 26px color-mix(in srgb, var(--atthas-ink) 24%, transparent);
  }
  [data-price-style="BRAND_RED"] .price {
    background: var(--atthas-red-deep);
    color: var(--atthas-white);
  }
  [data-price-style="BRAND_YELLOW"] .price {
    background: var(--atthas-gold-flame);
    color: var(--atthas-ink);
  }
</style>
</head>
<body>
  <main
    class="poster m3-poster"
    data-renderer="M3_V2"
    data-width="${input.format.width}"
    data-height="${input.format.height}"
    data-brand-id="${input.brandId}"
    data-template-id="${plan.layoutId}"
    data-copy-zone="${plan.copyZone}"
    data-copy-zone-rating="${plan.copyZoneRating}"
    data-copy-zone-source="${plan.copyZoneSource}"
    data-price-style="${plan.priceStyle}"
  >
    <section class="copy-block">
      <div class="brand-identifier">${brandIdentifier}</div>
      <div class="headline">${headline}</div>
      ${supportingCopy ? `<div class="supporting">${supportingCopy}</div>` : ""}
      <div class="conversion-stack">
        <div class="cta">${cta}</div>
        ${price ? `<div class="price">${price}</div>` : ""}
      </div>
    </section>
  </main>
</body>
</html>`;

  assertM3RendererTokenOnlyColours(html);
  return html;
}
