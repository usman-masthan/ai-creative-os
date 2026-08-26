import assert from "node:assert/strict";
import test from "node:test";

import {
  compositionExpectationFromBrief,
  copyZonesFromQuietZoneText,
} from "../src/visualQa/compositionExpectation.js";
import type { StructuredImageBrief } from "../src/structuredImageBrief.js";

test("quiet-zone language maps deterministically to renderer copy-zone ids", () => {
  assert.deepEqual(
    copyZonesFromQuietZoneText([
      "Keep the upper-left message zone visually quiet",
      "Protect lower right action zone",
      "Preserve top-right negative space",
    ]),
    ["upperLeft", "upperRight", "lowerRight"],
  );
});

test("ambiguous quiet-zone language is not invented into a quadrant", () => {
  assert.deepEqual(
    copyZonesFromQuietZoneText(["preserve one visually quiet overlay-safe area"]),
    [],
  );
});

test("composition expectation preserves hero and crop contract from structured brief", () => {
  const brief = {
    composition: {
      heroPosition: "centre-right",
      heroScale: "about 60% frame height",
      quietZones: ["Keep upper-left visually quiet"],
      cropBehavior: "protect complete food silhouette",
    },
  } as StructuredImageBrief;

  assert.deepEqual(compositionExpectationFromBrief(brief), {
    heroPosition: "centre-right",
    heroScale: "about 60% frame height",
    cropBehavior: "protect complete food silhouette",
    requestedQuietZones: ["upperLeft"],
  });
});
