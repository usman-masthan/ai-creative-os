import { ATTHAS_TOKENS, atthasCssVariables } from "./atthasTokens.js";
import { buildM3PosterHtml, type M3CopyZones } from "./m3Renderer.js";
import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "./creativeTypes.js";
import {
  selectAtthasLayout,
  type AtthasBrandId,
  type AtthasLayoutId,
} from "./layouts/atthas.js";

export interface PosterTemplateInput {
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  baseImageDataUri: string;
  brandId?: AtthasBrandId;
  layoutId?: AtthasLayoutId;
  rendererMode?: "LEGACY" | "M3_V2";
  copyZones?: M3CopyZones;
}

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

export function buildPosterHtml(input: PosterTemplateInput): string {
  const { creative, format, baseImageDataUri } = input;
  const brandId = input.brandId ?? "ATTHAS_BURGER";
  if (input.rendererMode === "M3_V2") {
    return buildM3PosterHtml({
      creative,
      format,
      baseImageDataUri,
      brandId,
      ...(input.layoutId ? { layoutId: input.layoutId } : {}),
      ...(input.copyZones ? { copyZones: input.copyZones } : {}),
    });
  }
  const layout = selectAtthasLayout({
    brandId,
    creative,
    format,
    ...(input.layoutId ? { preferredLayoutId: input.layoutId } : {}),
  });
  const overlay = creative.overlaySpec;
  const headline = escapeHtml(overlay.headline);
  const supportingCopy = escapeHtml(overlay.supportingCopy);
  const price = escapeHtml(overlay.price?.display ?? "");
  const cta = escapeHtml(overlay.cta);
  const restaurant = brandId === "ATTHAS_RESTAURANT";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${format.width}, initial-scale=1" />
<style>
  :root {
    ${atthasCssVariables()}
    --safe: 5%;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    width: ${format.width}px;
    height: ${format.height}px;
    overflow: hidden;
  }
  body {
    font-family: "${ATTHAS_TOKENS.typography.body}", Arial, Helvetica, sans-serif;
    background: var(--atthas-ink);
  }
  .poster {
    position: relative;
    width: ${format.width}px;
    height: ${format.height}px;
    overflow: hidden;
    isolation: isolate;
    background-image: url("${cssString(baseImageDataUri)}");
    background-size: cover;
    background-position: center;
    color: var(--atthas-white);
  }
  .poster::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
  .brand-rail {
    position: absolute;
    z-index: 5;
    top: 0;
    left: 0;
    right: 0;
    height: 14px;
    background: var(--atthas-gold-flame);
  }
  .message-zone {
    position: absolute;
    z-index: 3;
    left: 6%;
    top: 6%;
    max-width: 68%;
  }
  .headline {
    font-family: "${ATTHAS_TOKENS.typography.burgerDisplay}", "Arial Narrow", Arial, sans-serif;
    font-size: clamp(58px, 7.4vw, 88px);
    line-height: .96;
    font-weight: 800;
    letter-spacing: -1.8px;
    text-wrap: balance;
  }
  .supporting {
    margin-top: 20px;
    max-width: 620px;
    font-size: clamp(24px, 2.7vw, 34px);
    line-height: 1.2;
    font-weight: 600;
  }
  .price-zone {
    position: absolute;
    z-index: 4;
    top: 6%;
    right: 6%;
  }
  .price {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 18px 26px;
    min-height: 70px;
    border-radius: 12px;
    background: var(--atthas-gold-flame);
    color: var(--atthas-ink);
    font-family: "${ATTHAS_TOKENS.typography.price}", "Arial Narrow", Arial, sans-serif;
    font-size: clamp(38px, 4.4vw, 54px);
    line-height: 1;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 12px 30px rgba(23,23,23,.24);
  }
  .action-zone {
    position: absolute;
    z-index: 4;
    right: 6%;
    bottom: 6%;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 64px;
    padding: 18px 30px;
    border-radius: 8px;
    background: ${restaurant ? "var(--atthas-red-deep)" : "var(--atthas-gold-flame)"};
    color: ${restaurant ? "var(--atthas-white)" : "var(--atthas-ink)"};
    font-size: clamp(24px, 2.6vw, 30px);
    line-height: 1;
    font-weight: 800;
    box-shadow: 0 10px 28px rgba(23,23,23,.28);
  }
  .compliance-accent {
    position: absolute;
    z-index: 4;
    left: 6%;
    bottom: 6%;
    width: 96px;
    height: 8px;
    border-radius: 999px;
    background: var(--atthas-gold-flame);
  }

  /* Burger — hero product */
  [data-template-id="ATTHAS_BURGER_HERO_PRODUCT_V1"]::after {
    background:
      linear-gradient(180deg, rgba(130,0,8,.92) 0%, rgba(181,0,8,.58) 26%, rgba(23,23,23,0) 58%),
      linear-gradient(0deg, rgba(23,23,23,.68) 0%, rgba(23,23,23,0) 42%);
  }
  [data-template-id="ATTHAS_BURGER_HERO_PRODUCT_V1"] .headline,
  [data-template-id="ATTHAS_BURGER_HERO_PRODUCT_V1"] .supporting {
    text-shadow: 0 3px 16px rgba(23,23,23,.30);
  }

  /* Burger — promotional price */
  [data-template-id="ATTHAS_BURGER_PROMOTIONAL_PRICE_V1"]::after {
    background:
      linear-gradient(90deg, rgba(130,0,8,.94) 0%, rgba(181,0,8,.78) 37%, rgba(181,0,8,.06) 68%),
      linear-gradient(0deg, rgba(23,23,23,.58) 0%, rgba(23,23,23,0) 45%);
  }
  [data-template-id="ATTHAS_BURGER_PROMOTIONAL_PRICE_V1"] .message-zone {
    max-width: 54%;
    top: 9%;
  }
  [data-template-id="ATTHAS_BURGER_PROMOTIONAL_PRICE_V1"] .price-zone {
    top: auto;
    right: auto;
    left: 6%;
    bottom: 17%;
  }
  [data-template-id="ATTHAS_BURGER_PROMOTIONAL_PRICE_V1"] .price {
    min-height: 92px;
    padding: 22px 32px;
    font-size: clamp(54px, 6.3vw, 76px);
    border: 3px solid rgba(255,255,255,.82);
  }

  /* Burger — offer / deal */
  [data-template-id="ATTHAS_BURGER_OFFER_DEAL_V1"]::after {
    background:
      linear-gradient(135deg, rgba(181,0,8,.96) 0%, rgba(181,0,8,.86) 38%, rgba(23,23,23,.08) 68%),
      linear-gradient(0deg, rgba(23,23,23,.60) 0%, rgba(23,23,23,0) 43%);
  }
  [data-template-id="ATTHAS_BURGER_OFFER_DEAL_V1"] .message-zone {
    top: 8%;
    max-width: 58%;
    padding: 28px 30px 30px;
    border-left: 12px solid var(--atthas-gold-flame);
    background: rgba(130,0,8,.72);
    backdrop-filter: blur(2px);
  }
  [data-template-id="ATTHAS_BURGER_OFFER_DEAL_V1"] .price {
    transform: rotate(2deg);
    border: 4px solid var(--atthas-white);
  }

  /* Burger — minimal premium */
  [data-template-id="ATTHAS_BURGER_MINIMAL_PREMIUM_V1"]::after {
    background:
      linear-gradient(90deg, rgba(23,23,23,.78) 0%, rgba(23,23,23,.38) 38%, rgba(23,23,23,.02) 68%),
      linear-gradient(0deg, rgba(23,23,23,.48) 0%, rgba(23,23,23,0) 40%);
  }
  [data-template-id="ATTHAS_BURGER_MINIMAL_PREMIUM_V1"] .brand-rail {
    width: 38%;
    right: auto;
  }
  [data-template-id="ATTHAS_BURGER_MINIMAL_PREMIUM_V1"] .message-zone {
    top: 12%;
    max-width: 48%;
  }
  [data-template-id="ATTHAS_BURGER_MINIMAL_PREMIUM_V1"] .headline {
    font-size: clamp(52px, 6.3vw, 76px);
  }

  /* Shared story vertical geometry */
  [data-template-id$="STORY_VERTICAL_V1"]::after {
    background:
      linear-gradient(180deg, rgba(23,23,23,.66) 0%, rgba(23,23,23,.06) 38%, rgba(23,23,23,.05) 58%, rgba(23,23,23,.82) 100%);
  }
  [data-template-id$="STORY_VERTICAL_V1"] .message-zone {
    top: 8%;
    max-width: 82%;
  }
  [data-template-id$="STORY_VERTICAL_V1"] .headline {
    font-size: clamp(64px, 8.4vw, 96px);
  }
  [data-template-id$="STORY_VERTICAL_V1"] .price-zone {
    top: auto;
    bottom: 15%;
    right: 6%;
  }
  [data-template-id$="STORY_VERTICAL_V1"] .action-zone {
    left: 6%;
    right: auto;
    bottom: 6%;
  }
  [data-template-id$="STORY_VERTICAL_V1"] .compliance-accent {
    left: auto;
    right: 6%;
  }
  [data-template-id="ATTHAS_BURGER_STORY_VERTICAL_V1"] .brand-rail {
    height: 18px;
  }

  /* Restaurant — common warmth */
  [data-brand-id="ATTHAS_RESTAURANT"] {
    color: var(--atthas-ink);
  }
  [data-brand-id="ATTHAS_RESTAURANT"] .brand-rail {
    background: var(--atthas-red-deep);
  }
  [data-brand-id="ATTHAS_RESTAURANT"] .headline {
    font-family: "${ATTHAS_TOKENS.typography.restaurantDisplay}", Georgia, serif;
    letter-spacing: -1px;
    line-height: 1.02;
  }
  [data-brand-id="ATTHAS_RESTAURANT"] .supporting {
    color: var(--atthas-grey);
    font-weight: 500;
  }
  [data-brand-id="ATTHAS_RESTAURANT"] .compliance-accent {
    background: var(--atthas-red-deep);
  }

  /* Restaurant — food hero */
  [data-template-id="ATTHAS_RESTAURANT_FOOD_HERO_V1"]::after {
    background:
      linear-gradient(90deg, rgba(255,248,232,.96) 0%, rgba(255,248,232,.90) 43%, rgba(255,248,232,.02) 68%),
      linear-gradient(0deg, rgba(23,23,23,.38) 0%, rgba(23,23,23,0) 40%);
  }
  [data-template-id="ATTHAS_RESTAURANT_FOOD_HERO_V1"] .message-zone {
    top: 10%;
    max-width: 45%;
  }
  [data-template-id="ATTHAS_RESTAURANT_FOOD_HERO_V1"] .price-zone {
    top: auto;
    left: 6%;
    right: auto;
    bottom: 18%;
  }

  /* Restaurant — editorial */
  [data-template-id="ATTHAS_RESTAURANT_EDITORIAL_V1"]::after {
    background: linear-gradient(90deg, rgba(255,248,232,.98) 0%, rgba(255,248,232,.96) 45%, rgba(255,248,232,.10) 62%, rgba(255,248,232,0) 100%);
  }
  [data-template-id="ATTHAS_RESTAURANT_EDITORIAL_V1"] .message-zone {
    top: 14%;
    max-width: 41%;
  }
  [data-template-id="ATTHAS_RESTAURANT_EDITORIAL_V1"] .headline {
    font-size: clamp(48px, 5.8vw, 70px);
  }
  [data-template-id="ATTHAS_RESTAURANT_EDITORIAL_V1"] .action-zone {
    left: 6%;
    right: auto;
  }

  /* Restaurant — multi dish */
  [data-template-id="ATTHAS_RESTAURANT_MULTI_DISH_V1"]::after {
    background: linear-gradient(0deg, rgba(255,248,232,.98) 0%, rgba(255,248,232,.92) 36%, rgba(255,248,232,0) 62%);
  }
  [data-template-id="ATTHAS_RESTAURANT_MULTI_DISH_V1"] .message-zone {
    top: auto;
    bottom: 8%;
    max-width: 62%;
  }
  [data-template-id="ATTHAS_RESTAURANT_MULTI_DISH_V1"] .price-zone {
    top: auto;
    bottom: 20%;
  }
  [data-template-id="ATTHAS_RESTAURANT_MULTI_DISH_V1"] .action-zone {
    bottom: 8%;
  }
  [data-template-id="ATTHAS_RESTAURANT_MULTI_DISH_V1"] .compliance-accent {
    top: 6%;
    bottom: auto;
  }

  /* Restaurant — hospitality */
  [data-template-id="ATTHAS_RESTAURANT_HOSPITALITY_V1"]::after {
    background: linear-gradient(90deg, rgba(255,248,232,.94) 0%, rgba(255,248,232,.78) 42%, rgba(255,248,232,0) 70%);
  }
  [data-template-id="ATTHAS_RESTAURANT_HOSPITALITY_V1"] .message-zone {
    top: 12%;
    max-width: 48%;
    padding: 34px 36px;
    background: rgba(255,248,232,.86);
    border-bottom: 6px solid var(--atthas-gold-toasted);
  }
  [data-template-id="ATTHAS_RESTAURANT_HOSPITALITY_V1"] .action-zone {
    left: 6%;
    right: auto;
  }

  /* Restaurant — story */
  [data-template-id="ATTHAS_RESTAURANT_STORY_VERTICAL_V1"] {
    color: var(--atthas-white);
  }
  [data-template-id="ATTHAS_RESTAURANT_STORY_VERTICAL_V1"]::after {
    background:
      linear-gradient(180deg, rgba(130,0,8,.80) 0%, rgba(130,0,8,.08) 38%, rgba(23,23,23,.10) 58%, rgba(23,23,23,.78) 100%);
  }
  [data-template-id="ATTHAS_RESTAURANT_STORY_VERTICAL_V1"] .supporting {
    color: var(--atthas-cream);
  }
</style>
</head>
<body>
  <main
    class="poster"
    data-width="${format.width}"
    data-height="${format.height}"
    data-brand-id="${brandId}"
    data-template-id="${layout.id}"
  >
    <div class="brand-rail" aria-hidden="true"></div>
    <section class="message-zone">
      <div class="headline">${headline}</div>
      ${supportingCopy ? `<div class="supporting">${supportingCopy}</div>` : ""}
    </section>
    ${price ? `<section class="price-zone"><div class="price">${price}</div></section>` : ""}
    <div class="compliance-accent" aria-hidden="true"></div>
    <section class="action-zone">
      <div class="cta">${cta}</div>
    </section>
  </main>
</body>
</html>`;
}
