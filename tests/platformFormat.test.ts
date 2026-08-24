import assert from "node:assert/strict";
import test from "node:test";

import { resolveProductionFormat } from "../src/platformFormat.js";

test("Instagram poster defaults to 1080x1350 4:5", () => {
  assert.deepEqual(resolveProductionFormat("instagram", "poster"), {
    channel: "instagram",
    assetType: "poster",
    aspectRatio: "4:5",
    width: 1080,
    height: 1350,
  });
});

test("Instagram story resolves to 1080x1920 9:16", () => {
  assert.equal(resolveProductionFormat("instagram", "story").aspectRatio, "9:16");
  assert.equal(resolveProductionFormat("instagram", "story").height, 1920);
});

test("TikTok resolves to vertical 9:16", () => {
  assert.equal(resolveProductionFormat("tiktok", "video").aspectRatio, "9:16");
});
