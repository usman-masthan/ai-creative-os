import assert from "node:assert/strict";
import test from "node:test";

import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../src/creativeTypes.js";
import {
  assertM3RendererTokenOnlyColours,
  buildM3RendererPlan,
  selectM3CopyZone,
  type M3CopyZones,
} from "../src/m3Renderer.js";
import { buildPosterHtml } from "../src/posterTemplate.js";

const format: CampaignProductionFormat = {
  channel: "instagram",
  assetType: "poster",
  aspectRatio: "4:5",
  width: 1080,
  height: 1350,
};

function creative(priceStyle?: "BRAND_RED" | "BRAND_YELLOW"): CampaignCreativeOutput {
  return {
    concepts: [],
    recommendedConceptId: "C1",
    recommendationReason: "renderer contract test",
    creativeBrief: {
      headline: "Unwrap the flavour",
      supportingCopy: "Chicken Tikka Wrap",
      cta: "Try It Today",
      visualDirection: "food hero",
      composition: "copy-safe food hero",
      lighting: "soft",
      photographyStyle: "realistic",
      aspectRatio: "4:5",
    },
    caption: "test",
    imageGeneration: {
      basePrompt: "food hero",
      negativePrompt: "no text",
      visualConstraints: [],
      textPolicy: "NO_TEXT_OR_LOGOS",
    },
    overlaySpec: {
      headline: "UNWRAP THE FLAVOUR",
      supportingCopy: "CHICKEN TIKKA WRAP",
      price: {
        amount: 1290,
        currency: "LKR",
        display: "LKR 1,290",
        ...(priceStyle ? { priceStyle } : {}),
      },
      cta: "TRY IT TODAY",
      logoUsage: "OMIT",
      placementHints: {
        headline: "upper-left",
        supportingCopy: "below headline",
        price: "with conversion block",
        cta: "with copy block",
        logo: "omit",
      },
    },
    factualQaNotes: [],
  };
}

const measuredZones: M3CopyZones = {
  upperLeft: "POOR",
  upperRight: "GOOD",
  lowerLeft: "ACCEPTABLE",
  lowerRight: "POOR",
};

test("M3 Burger renderer uses measured QA zone, mandatory brand identifier and no legacy rails", () => {
  const html = buildPosterHtml({
    creative: creative(),
    format,
    baseImageDataUri: "data:image/jpeg;base64,ZmFrZQ==",
    brandId: "ATTHAS_BURGER",
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    rendererMode: "M3_V2",
    copyZones: measuredZones,
  });

  assert.match(html, /data-renderer="M3_V2"/);
  assert.match(html, /data-copy-zone="upperRight"/);
  assert.match(html, /data-copy-zone-source="VISUAL_QA"/);
  assert.match(html, /<div class="brand-identifier">ATTHA&#039;S BURGER<\/div>/);
  assert.match(html, /font-family: "Oswald"/);
  assert.doesNotMatch(html, /brand-rail/);
  assert.doesNotMatch(html, /compliance-accent/);
  assert.doesNotMatch(html, /action-zone/);
  assert.match(html, /<section class="copy-block">[\s\S]*<div class="conversion-stack">[\s\S]*<div class="cta">TRY IT TODAY<\/div>/);
  assert.doesNotThrow(() => assertM3RendererTokenOnlyColours(html));
});

test("M3 Restaurant renderer uses mandatory Restaurant identifier and Libre Baskerville", () => {
  const html = buildPosterHtml({
    creative: creative(),
    format,
    baseImageDataUri: "data:image/jpeg;base64,ZmFrZQ==",
    brandId: "ATTHAS_RESTAURANT",
    layoutId: "ATTHAS_RESTAURANT_FOOD_HERO_V1",
    rendererMode: "M3_V2",
    copyZones: {
      upperLeft: "GOOD",
      upperRight: "POOR",
      lowerLeft: "ACCEPTABLE",
      lowerRight: "POOR",
    },
  });

  assert.match(html, /ATTHA&#039;S RESTAURANT/);
  assert.match(html, /font-family: "Libre Baskerville"/);
  assert.match(html, /data-price-style="BRAND_RED"/);
});

test("M3 renderer resolves semantic price style only through approved brand tokens", () => {
  const red = buildPosterHtml({
    creative: creative("BRAND_RED"),
    format,
    baseImageDataUri: "data:image/jpeg;base64,ZmFrZQ==",
    brandId: "ATTHAS_BURGER",
    rendererMode: "M3_V2",
    copyZones: measuredZones,
  });
  assert.match(red, /data-price-style="BRAND_RED"/);
  assert.match(red, /\[data-price-style="BRAND_RED"\] \.price \{[\s\S]*background: var\(--atthas-red-deep\)/);

  const yellow = buildPosterHtml({
    creative: creative("BRAND_YELLOW"),
    format,
    baseImageDataUri: "data:image/jpeg;base64,ZmFrZQ==",
    brandId: "ATTHAS_BURGER",
    rendererMode: "M3_V2",
    copyZones: measuredZones,
  });
  assert.match(yellow, /data-price-style="BRAND_YELLOW"/);
  assert.match(yellow, /\[data-price-style="BRAND_YELLOW"\] \.price \{[\s\S]*background: var\(--atthas-gold-flame\)/);
});

test("M3 copy-zone policy refuses to invent a safe area when all measured zones are POOR", () => {
  assert.throws(
    () =>
      selectM3CopyZone({
        upperLeft: "POOR",
        upperRight: "POOR",
        lowerLeft: "POOR",
        lowerRight: "POOR",
      }),
    /at least one GOOD or ACCEPTABLE Visual QA copy zone/,
  );
});

test("M3 draft fallback is explicit and traced when Visual QA copy zones are unavailable", () => {
  const plan = buildM3RendererPlan({
    creative: creative(),
    format,
    brandId: "ATTHAS_BURGER",
  });
  assert.equal(plan.copyZone, "upperLeft");
  assert.equal(plan.copyZoneSource, "DETERMINISTIC_FALLBACK");
  assert.equal(plan.priceStyle, "BRAND_YELLOW");
});
