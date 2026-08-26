import type { StructuredImageBrief } from "../structuredImageBrief.js";
import type {
  VisualCopyZoneId,
  VisualQaCompositionExpectation,
} from "./types.js";

const ALL_ZONES: VisualCopyZoneId[] = [
  "upperLeft",
  "upperRight",
  "lowerLeft",
  "lowerRight",
];

export function copyZonesFromQuietZoneText(values: string[]): VisualCopyZoneId[] {
  const zones = new Set<VisualCopyZoneId>();

  for (const value of values) {
    const normalized = value.toLowerCase().replace(/[_-]+/g, " ");
    const upper = /\bupper\b|\btop\b/.test(normalized);
    const lower = /\blower\b|\bbottom\b/.test(normalized);
    const left = /\bleft\b/.test(normalized);
    const right = /\bright\b/.test(normalized);

    if (upper && left) zones.add("upperLeft");
    if (upper && right) zones.add("upperRight");
    if (lower && left) zones.add("lowerLeft");
    if (lower && right) zones.add("lowerRight");
  }

  return ALL_ZONES.filter((zone) => zones.has(zone));
}

export function compositionExpectationFromBrief(
  brief: StructuredImageBrief | undefined,
): VisualQaCompositionExpectation | undefined {
  if (!brief) return undefined;
  const requestedQuietZones = copyZonesFromQuietZoneText(brief.composition.quietZones);
  return {
    heroPosition: brief.composition.heroPosition,
    heroScale: brief.composition.heroScale,
    cropBehavior: brief.composition.cropBehavior,
    ...(requestedQuietZones.length ? { requestedQuietZones } : {}),
  };
}
