import assert from "node:assert/strict";
import test from "node:test";

import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "../src/creativeTypes.js";
import { assertPosterHtmlContract, readPngDimensions } from "../src/posterQa.js";
import { buildPosterHtml } from "../src/posterTemplate.js";

const format: CampaignProductionFormat = {
  channel: "instagram",
  assetType: "poster",
  aspectRatio: "4:5",
  width: 1080,
  height: 1350,
};

const creative: CampaignCreativeOutput = {
  concepts: [],
  recommendedConceptId: "C1",
  recommendationReason: "test",
  creativeBrief: {
    headline: "Crispy Chicken Burger",
    supportingCopy: "Now on Uber Eats",
    cta: "Order on Uber Eats",
    visualDirection: "food hero",
    composition: "centered",
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
    headline: "Crispy Chicken Burger",
    supportingCopy: "Now on Uber Eats",
    price: { amount: 950, currency: "LKR", display: "LKR 950" },
    cta: "Order on Uber Eats",
    logoUsage: "OMIT",
    placementHints: {
      headline: "top-left",
      supportingCopy: "below",
      price: "top-right",
      cta: "bottom-right",
      logo: "none",
    },
  },
  factualQaNotes: [],
};

test("poster template renders deterministic ATTHAS Burger price layout at exact campaign dimensions", () => {
  const html = buildPosterHtml({
    creative,
    format,
    baseImageDataUri: "data:image/jpeg;base64,ZmFrZQ==",
  });

  assert.match(html, /width: 1080px/);
  assert.match(html, /height: 1350px/);
  assert.match(html, /Crispy Chicken Burger/);
  assert.match(html, /LKR 950/);
  assert.match(html, /Order on Uber Eats/);
  assert.match(html, /data:image\/jpeg;base64,ZmFrZQ==/);
  assert.match(html, /data-brand-id="ATTHAS_BURGER"/);
  assert.match(html, /data-template-id="ATTHAS_BURGER_PROMOTIONAL_PRICE_V1"/);
  assert.match(html, /--atthas-red-deep: #B50008/);
  assert.match(html, /--atthas-gold-flame: #FFD21A/);
  assert.doesNotMatch(html, /<img[^>]+logo/i);
  assert.doesNotThrow(() => assertPosterHtmlContract(html, creative, format));
});

test("poster template can render an approved Restaurant editorial family", () => {
  const restaurantCreative: CampaignCreativeOutput = {
    ...creative,
    overlaySpec: {
      ...creative.overlaySpec,
      price: undefined,
      headline: "An evening at ATTHA’S",
      supportingCopy: "Warm food. Shared moments.",
      cta: "Visit Wellawatte",
    },
  };
  const html = buildPosterHtml({
    creative: restaurantCreative,
    format,
    baseImageDataUri: "data:image/jpeg;base64,ZmFrZQ==",
    brandId: "ATTHAS_RESTAURANT",
    layoutId: "ATTHAS_RESTAURANT_EDITORIAL_V1",
  });

  assert.match(html, /data-brand-id="ATTHAS_RESTAURANT"/);
  assert.match(html, /data-template-id="ATTHAS_RESTAURANT_EDITORIAL_V1"/);
  assert.match(html, /Libre Baskerville/);
  assert.match(html, /Visit Wellawatte/);
  assert.doesNotMatch(html, /<div class="price">/);
});

test("poster template escapes customer-facing HTML", () => {
  const escapedCreative: CampaignCreativeOutput = {
    ...creative,
    overlaySpec: {
      ...creative.overlaySpec,
      headline: "Crispy <Chicken> & Burger",
    },
  };
  const html = buildPosterHtml({
    creative: escapedCreative,
    format,
    baseImageDataUri: "data:image/jpeg;base64,ZmFrZQ==",
  });
  assert.match(html, /Crispy &lt;Chicken&gt; &amp; Burger/);
});

test("PNG dimension parser reads IHDR dimensions deterministically", () => {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer, 0);
  buffer.writeUInt32BE(1080, 16);
  buffer.writeUInt32BE(1350, 20);

  assert.deepEqual(readPngDimensions(buffer), { width: 1080, height: 1350 });
});
