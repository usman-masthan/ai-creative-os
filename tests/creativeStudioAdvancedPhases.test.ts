import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { adaptCreativeDesign } from "../src/commands/adaptCreativeDesign.js";
import { segmentCreativeSubject } from "../src/commands/segmentCreativeSubject.js";
import { reviewLayeredDesignWithCreativeDirector } from "../src/creativeDirectorLayered.js";
import { runDesignQa } from "../src/creativeStudio/designQa.js";
import type { SubjectSegmentationProvider } from "../src/creativeStudio/segmentation/types.js";
import type { DesignDocument } from "../src/designDocument/types.js";
import type { CampaignGenerationProvider } from "../src/providers/types.js";

function layeredDocument(): DesignDocument {
  const at = "2026-08-28T17:00:00.000Z";
  return {
    schemaVersion: 1,
    id: "design-portrait",
    version: 3,
    campaignId: "campaign-advanced",
    truthSnapshotId: "task:truth-advanced",
    artboard: { width: 1080, height: 1350, background: "#820008" },
    brand: { clientId: "T001", brandId: "ATTHAS_BURGER", brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    layers: [
      {
        id: "background",
        name: "Background",
        type: "background",
        x: 0,
        y: 0,
        width: 1080,
        height: 1350,
        rotation: 0,
        opacity: 1,
        zIndex: 0,
        visible: true,
        locked: false,
        aiEditable: true,
        asset: {
          assetId: "approved-product-photo",
          source: "uploaded",
          uri: "/tmp/source.jpg",
          mimeType: "image/jpeg",
          visualTruthClass: "VERIFIED_PRODUCT_VISUAL",
        },
        fit: "cover",
      },
      {
        id: "headline",
        name: "Headline",
        type: "text",
        role: "headline",
        x: 65,
        y: 75,
        width: 580,
        height: 230,
        rotation: 0,
        opacity: 1,
        zIndex: 20,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "Crave the Tikka",
        fontFamily: "Oswald",
        fontSize: 82,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: -1,
        align: "left",
        fill: "#FFFFFF",
      },
      {
        id: "supporting-copy",
        name: "Supporting Copy",
        type: "text",
        role: "supporting",
        x: 65,
        y: 325,
        width: 540,
        height: 120,
        rotation: 0,
        opacity: 1,
        zIndex: 21,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "Big flavour. Wrapped fresh.",
        fontFamily: "Inter",
        fontSize: 31,
        fontWeight: 600,
        lineHeight: 1.2,
        letterSpacing: 0,
        align: "left",
        fill: "#FFF8E8",
      },
      {
        id: "cta",
        name: "CTA",
        type: "text",
        role: "cta",
        x: 65,
        y: 485,
        width: 250,
        height: 74,
        rotation: 0,
        opacity: 1,
        zIndex: 30,
        visible: true,
        locked: false,
        aiEditable: true,
        text: "Order Now",
        fontFamily: "Inter",
        fontSize: 28,
        fontWeight: 800,
        lineHeight: 1,
        letterSpacing: 0,
        align: "center",
        fill: "#171717",
      },
      {
        id: "price",
        name: "Price",
        type: "text",
        role: "price",
        x: 740,
        y: 100,
        width: 250,
        height: 90,
        rotation: 0,
        opacity: 1,
        zIndex: 32,
        visible: true,
        locked: false,
        aiEditable: false,
        text: "LKR 1,250",
        fontFamily: "Oswald",
        fontSize: 48,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: 0,
        align: "center",
        fill: "#FFD21A",
      },
      {
        id: "logo",
        name: "Approved ATTHA'S Logo",
        type: "logo",
        x: 850,
        y: 1180,
        width: 130,
        height: 62,
        rotation: 0,
        opacity: 1,
        zIndex: 50,
        visible: true,
        locked: true,
        aiEditable: false,
        asset: { assetId: "ATTHAS_MASTER_SYMBOL_A_FORK", source: "approved-brand", uri: "/tmp/logo.svg", mimeType: "image/svg+xml" },
        preserveAspectRatio: true,
        clearSpacePx: 16,
      },
    ],
    history: [{ version: 3, createdAt: at, summary: "Working version", actor: "human" }],
    createdAt: at,
    updatedAt: at,
  };
}

test("multi-format adaptation recomputes story geometry rather than stretching source", () => {
  const source = layeredDocument();
  const story = adaptCreativeDesign({
    document: source,
    preset: "instagram-story",
    newDesignId: "design-story",
    createdAt: "2026-08-28T17:05:00.000Z",
  });
  assert.equal(story.artboard.width, 1080);
  assert.equal(story.artboard.height, 1920);
  assert.equal(story.layoutId, "ATTHAS_BURGER_STORY_VERTICAL_V1");
  assert.equal(story.version, 1);
  const headline = story.layers.find((layer) => layer.id === "headline");
  const price = story.layers.find((layer) => layer.id === "price");
  const logo = story.layers.find((layer) => layer.id === "logo");
  assert.ok(headline);
  assert.notEqual(headline?.height, Math.round(230 * (1920 / 1350)));
  assert.equal(price?.type === "text" ? price.text : undefined, "LKR 1,250");
  assert.equal(logo?.type === "logo" ? logo.asset.assetId : undefined, "ATTHAS_MASTER_SYMBOL_A_FORK");
});

test("layered Creative Director validates structured review and uses client profile guidance", async () => {
  let prompt = "";
  const provider: CampaignGenerationProvider = {
    providerName: "mock-director",
    model: "mock-director",
    generate: async (value) => {
      prompt = value;
      return JSON.stringify({
        overallScore: 8.6,
        scores: {
          hierarchy: 9,
          composition: 8.5,
          balance: 8.4,
          typography: 8.8,
          brandConsistency: 9.2,
          productProminence: 8.1,
          ctaProminence: 8.2,
          readability: 9,
          whitespace: 8.3,
          visualDepth: 7.8,
          colorHarmony: 8.7,
          offerClarity: 8.9,
          imageQuality: 8.2,
          authenticity: 8.4,
          aiArtifactSafety: 9.1,
        },
        issues: [{ severity: "medium", layerId: "headline", message: "Headline can move slightly lower." }],
        recommendations: ["Move the headline down slightly."],
      });
    },
  };
  const document = layeredDocument();
  const qa = runDesignQa({ document });
  const review = await reviewLayeredDesignWithCreativeDirector({ document, deterministicQa: qa, provider });
  assert.match(prompt, /for ATTHA'S Burger/);
  assert.match(prompt, /Treat ATTHA'S BURGER as the required operating-brand identifier/);
  assert.match(prompt, /approved client-profile typography\/color constraints/);
  assert.equal(review.overallScore, 8.6);
  assert.equal(review.issues[0]?.layerId, "headline");
  assert.equal(review.scores.brandConsistency, 9.2);
});

test("subject segmentation creates independent background and protected verified subject layers", async () => {
  const root = await mkdtemp(join(tmpdir(), "creative-segmentation-"));
  const bytes = Buffer.alloc(1500, 7).toString("base64");
  const provider: SubjectSegmentationProvider = {
    providerName: "mock-segmentation",
    model: "mock-segmentation-v1",
    segment: async () => ({
      foregroundBase64: bytes,
      backgroundBase64: bytes,
      foregroundMimeType: "image/png",
      backgroundMimeType: "image/webp",
      confidence: 0.97,
    }),
  };
  try {
    const segmented = await segmentCreativeSubject({
      document: layeredDocument(),
      layerId: "background",
      imageBase64: bytes,
      mimeType: "image/jpeg",
      provider,
      outputDir: root,
      subjectHint: "Chicken Tikka Wrap",
      timestamp: "2026-08-28T17:10:00.000Z",
    });
    const background = segmented.layers.find((layer) => layer.id === "background");
    const subject = segmented.layers.find((layer) => layer.id === "product-subject");
    assert.ok(background?.type === "background" && background.asset?.uri?.endsWith(".webp"));
    assert.ok(subject?.type === "image");
    if (subject?.type === "image") {
      assert.equal(subject.asset.source, "verified-product");
      assert.equal(subject.asset.visualTruthClass, "VERIFIED_PRODUCT_VISUAL");
      assert.equal(subject.locked, true);
      assert.equal(subject.aiEditable, false);
      assert.ok((await readFile(subject.asset.uri!)).length >= 1000);
    }
    assert.equal(segmented.version, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
