import assert from "node:assert/strict";
import test from "node:test";

import { adaptCreativeDesign } from "../src/commands/adaptCreativeDesign.js";
import {
  CREATIVE_OUTPUT_FORMAT_PRESETS,
  nearestSupportedImageAspectRatio,
  resolveCreativeOutputFormat,
} from "../src/creativeStudio/contracts/outputFormat.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import { creativeStudioFormattedHtml } from "../src/dashboard/creativeStudioFormattedHtml.js";
import { selectAtthasLayout } from "../src/layouts/atthas.js";
import { resolveProductionFormat } from "../src/platformFormat.js";
import type { CampaignCreativeOutput } from "../src/creativeTypes.js";

const creative: CampaignCreativeOutput = {
  concepts: [{
    id: "hero",
    strategicRole: "conversion",
    campaignName: "Hero",
    coreIdea: "Food hero",
    customerEmotion: "craving",
    headlineDirection: "bold",
    visualConcept: "product hero",
    cta: "Order Now",
    targetAudience: "customers",
    expectedStrength: 9,
    risks: [],
  }],
  recommendedConceptId: "hero",
  recommendationReason: "Strong hierarchy.",
  creativeBrief: {
    headline: "Crave It",
    supportingCopy: "Big flavour.",
    cta: "Order Now",
    visualDirection: "Premium food hero",
    composition: "Product-led composition",
    lighting: "Directional",
    photographyStyle: "Commercial food photography",
    aspectRatio: "4:5",
  },
  caption: "Crave it.",
  imageGeneration: {
    basePrompt: "Premium food photography without text.",
    negativePrompt: "text, logos, prices",
    visualConstraints: ["realistic food"],
    textPolicy: "NO_TEXT_OR_LOGOS",
  },
  overlaySpec: {
    headline: "Crave It",
    supportingCopy: "Big flavour.",
    cta: "Order Now",
    logoUsage: "APPROVED_ONLY",
    placementHints: { headline: "upper left", supportingCopy: "below", cta: "lower left", logo: "lower right" },
  },
  factualQaNotes: [],
};

function document(): DesignDocument {
  const at = "2026-08-29T00:50:00.000Z";
  return {
    schemaVersion: 1,
    id: "format-source",
    version: 2,
    campaignId: "format-campaign",
    truthSnapshotId: "task:format-truth",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    layers: [
      {
        id: "background", name: "Background", type: "background",
        x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0,
        visible: true, locked: false, aiEditable: true,
        asset: { assetId: "bg", source: "generated", visualTruthClass: "GENERIC_CONCEPT_VISUAL" },
        fit: "cover",
      },
      {
        id: "headline", name: "Headline", type: "text", role: "headline",
        x: 65, y: 75, width: 520, height: 180, rotation: 0, opacity: 1, zIndex: 20,
        visible: true, locked: false, aiEditable: true, text: "Crave It",
        fontFamily: "Oswald", fontSize: 76, fontWeight: 800, lineHeight: 1,
        letterSpacing: -1, align: "left", fill: "#FFFFFF",
      },
      {
        id: "logo", name: "Approved Logo", type: "logo",
        x: 850, y: 1180, width: 130, height: 62, rotation: 0, opacity: 1, zIndex: 50,
        visible: true, locked: true, aiEditable: false,
        asset: { assetId: "ATTHAS_MASTER_SYMBOL_A_FORK", source: "approved-brand" },
        preserveAspectRatio: true, clearSpacePx: 16,
      },
    ],
    history: [{ version: 2, createdAt: at, summary: "Source", actor: "human" }],
    createdAt: at,
    updatedAt: at,
  };
}

test("governed output registry exposes every CreativeBrief preset except custom", () => {
  assert.deepEqual(Object.keys(CREATIVE_OUTPUT_FORMAT_PRESETS), [
    "instagram-square",
    "instagram-portrait",
    "instagram-story",
    "facebook-post",
    "facebook-story",
    "digital-menu",
    "web-banner",
    "poster",
  ]);
  assert.deepEqual(resolveCreativeOutputFormat({ preset: "digital-menu" }), {
    ...CREATIVE_OUTPUT_FORMAT_PRESETS["digital-menu"],
  });
  assert.equal(resolveCreativeOutputFormat({ preset: "web-banner" }).aspectRatio, "21:9");
  const custom = resolveCreativeOutputFormat({ preset: "custom", customWidth: 1400, customHeight: 600 });
  assert.equal(custom.width, 1400);
  assert.equal(custom.height, 600);
  assert.equal(custom.aspectRatio, "7:3");
  assert.equal(custom.assetType, "custom-1400x600");
  assert.equal(nearestSupportedImageAspectRatio(custom.aspectRatio), "21:9");
});

test("legacy production resolver routes all new Studio formats without a parallel pipeline", () => {
  assert.deepEqual(resolveProductionFormat("instagram", "square"), {
    channel: "instagram", assetType: "square", aspectRatio: "1:1", width: 1080, height: 1080,
  });
  assert.equal(resolveProductionFormat("facebook", "story").aspectRatio, "9:16");
  assert.deepEqual(resolveProductionFormat("digital-menu", "menu-board"), {
    channel: "digital-menu", assetType: "menu-board", aspectRatio: "16:9", width: 1920, height: 1080,
  });
  assert.deepEqual(resolveProductionFormat("web", "banner"), {
    channel: "web", assetType: "banner", aspectRatio: "21:9", width: 1680, height: 720,
  });
  assert.deepEqual(resolveProductionFormat("print", "poster"), {
    channel: "print", assetType: "poster", aspectRatio: "3:4", width: 1080, height: 1440,
  });
  const custom = resolveProductionFormat("custom", "custom-1234x777");
  assert.equal(custom.width, 1234);
  assert.equal(custom.height, 777);
  assert.equal(custom.aspectRatio, "1234:777");
});

test("Studio intake and adaptation panels expose the complete format set and custom dimensions", () => {
  const html = creativeStudioFormattedHtml();
  for (const preset of [
    "instagram-square", "instagram-portrait", "instagram-story", "facebook-post",
    "facebook-story", "digital-menu", "web-banner", "poster", "custom",
  ]) {
    assert.match(html, new RegExp(`value=\\"${preset}\\"`));
  }
  for (const id of ["customWidth", "customHeight", "adaptCustomWidth", "adaptCustomHeight"]) {
    assert.match(html, new RegExp(`id=\\"${id}\\"`));
  }
  assert.match(html, /assetType:'custom-'\+width\+'x'\+height/);
  assert.match(html, /payload\.customWidth/);
  assert.match(html, /payload\.customHeight/);
});

test("format adaptation recomposes wide, poster and custom artboards instead of stretching source", () => {
  const source = document();
  const banner = adaptCreativeDesign({
    document: source,
    preset: "web-banner",
    newDesignId: "format-banner",
    createdAt: "2026-08-29T00:51:00.000Z",
  });
  assert.equal(banner.artboard.width, 1680);
  assert.equal(banner.artboard.height, 720);
  assert.notEqual(banner.layers.find((layer) => layer.id === "headline")?.y, source.layers.find((layer) => layer.id === "headline")?.y);

  const poster = adaptCreativeDesign({
    document: source,
    preset: "poster",
    newDesignId: "format-poster",
    createdAt: "2026-08-29T00:52:00.000Z",
  });
  assert.deepEqual(poster.artboard, { width: 1080, height: 1440, background: "#820008" });

  const custom = adaptCreativeDesign({
    document: source,
    preset: "custom",
    customWidth: 1400,
    customHeight: 600,
    newDesignId: "format-custom",
    createdAt: "2026-08-29T00:53:00.000Z",
  });
  assert.equal(custom.artboard.width, 1400);
  assert.equal(custom.artboard.height, 600);
  assert.match(custom.history[0]!.summary, /custom \(7:3, 1400x600\)/);
});

test("layout selection uses artboard geometry for fluid and story-like custom formats", () => {
  const wide = selectAtthasLayout({
    brandId: "ATTHAS_BURGER",
    creative,
    format: { channel: "custom", assetType: "custom-1400x600", aspectRatio: "7:3", width: 1400, height: 600 },
  });
  assert.equal(wide.id, "ATTHAS_BURGER_HERO_PRODUCT_V1");

  const tall = selectAtthasLayout({
    brandId: "ATTHAS_BURGER",
    creative,
    format: { channel: "custom", assetType: "custom-800x1600", aspectRatio: "1:2", width: 800, height: 1600 },
  });
  assert.equal(tall.id, "ATTHAS_BURGER_STORY_VERTICAL_V1");
});
