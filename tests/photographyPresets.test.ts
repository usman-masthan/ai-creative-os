import assert from "node:assert/strict";
import test from "node:test";

import {
  getPhotographyPreset,
  PHOTOGRAPHY_PRESETS,
  selectPhotographyPresetId,
} from "../src/photographyPresets.js";
import { ATTHAS_LAYOUTS } from "../src/layouts/atthas.js";

const expectedIds = [
  "QSR_MACRO_HERO",
  "QSR_LIFESTYLE",
  "RESTAURANT_PLATED",
  "RESTAURANT_AMBIENCE",
  "BRAND_ATMOSPHERE",
  "DELIVERY_CONTEXT",
] as const;

test("M2 photography preset registry contains every roadmap preset", () => {
  assert.deepEqual(Object.keys(PHOTOGRAPHY_PRESETS), expectedIds);
  for (const id of expectedIds) {
    const preset = getPhotographyPreset(id);
    assert.equal(preset.id, id);
    assert.ok(preset.perspective.length > 0);
    assert.ok(preset.lensFeel.length > 0);
    assert.ok(preset.lighting.length > 0);
    assert.ok(preset.depthOfField.length > 0);
    assert.ok(preset.realism.length > 0);
    assert.ok(preset.background.length > 0);
  }
});

test("preset selection is deterministic and based on operating brand/layout, not product content", () => {
  const burgerPrice = ATTHAS_LAYOUTS.find(
    (layout) => layout.id === "ATTHAS_BURGER_PROMOTIONAL_PRICE_V1",
  )!;
  const restaurantHospitality = ATTHAS_LAYOUTS.find(
    (layout) => layout.id === "ATTHAS_RESTAURANT_HOSPITALITY_V1",
  )!;
  const restaurantFood = ATTHAS_LAYOUTS.find(
    (layout) => layout.id === "ATTHAS_RESTAURANT_FOOD_HERO_V1",
  )!;

  assert.equal(
    selectPhotographyPresetId({ brandId: "ATTHAS_BURGER", layout: burgerPrice }),
    "QSR_MACRO_HERO",
  );
  assert.equal(
    selectPhotographyPresetId({
      brandId: "ATTHAS_RESTAURANT",
      layout: restaurantHospitality,
    }),
    "RESTAURANT_AMBIENCE",
  );
  assert.equal(
    selectPhotographyPresetId({ brandId: "ATTHAS_RESTAURANT", layout: restaurantFood }),
    "RESTAURANT_PLATED",
  );
});

test("an explicit governed preset overrides automatic layout selection", () => {
  const burgerHero = ATTHAS_LAYOUTS.find(
    (layout) => layout.id === "ATTHAS_BURGER_HERO_PRODUCT_V1",
  )!;
  assert.equal(
    selectPhotographyPresetId({
      brandId: "ATTHAS_BURGER",
      layout: burgerHero,
      explicitPreset: "DELIVERY_CONTEXT",
    }),
    "DELIVERY_CONTEXT",
  );
});
