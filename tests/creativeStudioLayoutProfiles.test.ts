import assert from "node:assert/strict";
import test from "node:test";

import { ATTHAS_TOKENS } from "../src/atthasTokens.js";
import { adaptCreativeDesign } from "../src/commands/adaptCreativeDesign.js";
import { getCreativeLayoutProvider } from "../src/creativeStudio/layoutProfiles/registry.js";
import type { DesignDocument } from "../src/designDocument/types.js";

function source(input: {
  brandId: "ATTHAS_BURGER" | "ATTHAS_RESTAURANT";
  layoutId: string;
  background: string;
}): DesignDocument {
  const at = "2026-08-28T20:00:00.000Z";
  return {
    schemaVersion: 1,
    id: `source-${input.brandId.toLowerCase()}`,
    version: 2,
    campaignId: `campaign-${input.brandId.toLowerCase()}`,
    truthSnapshotId: "task:layout-provider",
    artboard: { width: 1080, height: 1350, background: input.background },
    brand: { clientId: "T001", brandId: input.brandId, brandKitId: "ATTHAS_WORKING_V1" },
    layoutId: input.layoutId,
    layers: [
      {
        id: "background", name: "Background", type: "background",
        x: 0, y: 0, width: 1080, height: 1350, rotation: 0, opacity: 1, zIndex: 0,
        visible: true, locked: false, aiEditable: true, fill: input.background,
      },
      {
        id: "headline", name: "Headline", type: "text", role: "headline",
        x: 70, y: 80, width: 520, height: 220, rotation: 0, opacity: 1, zIndex: 20,
        visible: true, locked: false, aiEditable: true, text: "Profile adaptation",
        fontFamily: "Oswald", fontSize: 72, fontWeight: 800, lineHeight: 1,
        letterSpacing: 0, align: "left", fill: "#FFFFFF",
      },
    ],
    history: [{ version: 2, createdAt: at, summary: "Source", actor: "system" }],
    createdAt: at,
    updatedAt: at,
  };
}

test("ATTHAS layout provider lists, resolves and adapts existing layout families", () => {
  const provider = getCreativeLayoutProvider("T001");
  const burger = provider.list("ATTHAS_BURGER");
  const restaurant = provider.list("ATTHAS_RESTAURANT");
  assert.equal(burger.length, 5);
  assert.equal(restaurant.length, 5);
  assert.ok(burger.every((layout) => layout.brandId === "ATTHAS_BURGER"));
  assert.ok(restaurant.every((layout) => layout.brandId === "ATTHAS_RESTAURANT"));

  assert.equal(provider.adaptationLayout({
    brandId: "ATTHAS_BURGER",
    sourceLayoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    targetAspectRatio: "4:5",
  }).id, "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1");
  assert.equal(provider.adaptationLayout({
    brandId: "ATTHAS_BURGER",
    sourceLayoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    targetAspectRatio: "9:16",
  }).id, "ATTHAS_BURGER_STORY_VERTICAL_V1");
  assert.equal(provider.adaptationLayout({
    brandId: "ATTHAS_RESTAURANT",
    sourceLayoutId: "ATTHAS_RESTAURANT_EDITORIAL_V1",
    targetAspectRatio: "1:1",
  }).id, "ATTHAS_RESTAURANT_EDITORIAL_V1");
  assert.equal(provider.adaptationLayout({
    brandId: "ATTHAS_RESTAURANT",
    sourceLayoutId: "ATTHAS_RESTAURANT_EDITORIAL_V1",
    targetAspectRatio: "9:16",
  }).id, "ATTHAS_RESTAURANT_STORY_VERTICAL_V1");

  assert.throws(() => provider.adaptationLayout({
    brandId: "ATTHAS_RESTAURANT",
    sourceLayoutId: "ATTHAS_BURGER_HERO_PRODUCT_V1",
    targetAspectRatio: "4:5",
  }), /BRAND_MISMATCH/);
  assert.throws(() => getCreativeLayoutProvider("UNKNOWN"), /CREATIVE_LAYOUT_PROVIDER_NOT_FOUND/);
});

test("multi-format adaptation uses layout provider and client theme without changing truth binding", () => {
  const burger = source({
    brandId: "ATTHAS_BURGER",
    layoutId: "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
    background: ATTHAS_TOKENS.colours.deepRed,
  });
  const burgerStory = adaptCreativeDesign({
    document: burger,
    preset: "instagram-story",
    newDesignId: "burger-story-profile",
    createdAt: "2026-08-28T20:01:00.000Z",
  });
  assert.equal(burgerStory.layoutId, "ATTHAS_BURGER_STORY_VERTICAL_V1");
  assert.equal(burgerStory.artboard.width, 1080);
  assert.equal(burgerStory.artboard.height, 1920);
  assert.equal(burgerStory.artboard.background, ATTHAS_TOKENS.colours.deepRed);
  assert.equal(burgerStory.truthSnapshotId, burger.truthSnapshotId);
  assert.equal(burgerStory.campaignId, burger.campaignId);

  const restaurant = source({
    brandId: "ATTHAS_RESTAURANT",
    layoutId: "ATTHAS_RESTAURANT_EDITORIAL_V1",
    background: ATTHAS_TOKENS.colours.cream,
  });
  const restaurantSquare = adaptCreativeDesign({
    document: restaurant,
    preset: "instagram-square",
    newDesignId: "restaurant-square-profile",
    createdAt: "2026-08-28T20:02:00.000Z",
  });
  assert.equal(restaurantSquare.layoutId, "ATTHAS_RESTAURANT_EDITORIAL_V1");
  assert.equal(restaurantSquare.artboard.width, 1080);
  assert.equal(restaurantSquare.artboard.height, 1080);
  assert.equal(restaurantSquare.artboard.background, ATTHAS_TOKENS.colours.cream);
  assert.equal(restaurantSquare.truthSnapshotId, restaurant.truthSnapshotId);
  assert.equal(restaurantSquare.campaignId, restaurant.campaignId);
});
