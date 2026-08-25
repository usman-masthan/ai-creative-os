import type {
  AtthasAdaptationTarget,
  RawAtthasAdaptationOutput,
  RawAtthasFormatVariant,
} from "./multiFormatTypes.js";

function nonEmptyString(value: unknown, field: string, maxChars?: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`ATTHA'S adaptation returned invalid ${field}.`);
  }
  const trimmed = value.trim();
  if (maxChars !== undefined && trimmed.length > maxChars) {
    throw new Error(`ATTHA'S adaptation ${field} exceeds ${maxChars} characters.`);
  }
  return trimmed;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`ATTHA'S adaptation returned invalid ${field}.`);
  }
  return value.map((item) => (item as string).trim());
}

function parsePlacementHints(value: unknown, hasPrice: boolean, targetId: string) {
  if (!value || typeof value !== "object") {
    throw new Error(`ATTHA'S adaptation ${targetId} has invalid placementHints.`);
  }
  const hints = value as Record<string, unknown>;
  const parsed = {
    headline: nonEmptyString(hints.headline, `${targetId}.placementHints.headline`, 100),
    supportingCopy: nonEmptyString(
      hints.supportingCopy,
      `${targetId}.placementHints.supportingCopy`,
      100,
    ),
    cta: nonEmptyString(hints.cta, `${targetId}.placementHints.cta`, 100),
    logo: nonEmptyString(hints.logo, `${targetId}.placementHints.logo`, 100),
    ...(hasPrice
      ? { price: nonEmptyString(hints.price, `${targetId}.placementHints.price`, 100) }
      : {}),
  };
  return parsed;
}

function parseVariant(
  value: unknown,
  target: AtthasAdaptationTarget,
  hasPrice: boolean,
): RawAtthasFormatVariant {
  if (!value || typeof value !== "object") {
    throw new Error(`ATTHA'S adaptation target ${target.id} is invalid.`);
  }
  const raw = value as Record<string, unknown>;
  if (raw.targetId !== target.id) {
    throw new Error(`ATTHA'S adaptation target order/id mismatch: expected ${target.id}.`);
  }
  return {
    targetId: target.id,
    headline: nonEmptyString(raw.headline, `${target.id}.headline`, target.headlineMaxChars),
    supportingCopy: nonEmptyString(
      raw.supportingCopy,
      `${target.id}.supportingCopy`,
      target.supportingCopyMaxChars,
    ),
    cta: nonEmptyString(raw.cta, `${target.id}.cta`, target.ctaMaxChars),
    caption: nonEmptyString(raw.caption, `${target.id}.caption`, target.captionMaxChars),
    composition: nonEmptyString(raw.composition, `${target.id}.composition`, 400),
    placementHints: parsePlacementHints(raw.placementHints, hasPrice, target.id),
  };
}

export function parseAtthasMultiFormatOutput(
  rawOutput: string,
  targets: AtthasAdaptationTarget[],
  hasPrice: boolean,
): RawAtthasAdaptationOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    throw new Error("ATTHA'S adaptation provider returned invalid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("ATTHA'S adaptation output must be an object.");
  }
  const object = parsed as Record<string, unknown>;
  if (!Array.isArray(object.variants) || object.variants.length !== targets.length) {
    throw new Error(`ATTHA'S adaptation must return exactly ${targets.length} variants.`);
  }

  const seen = new Set<string>();
  for (const item of object.variants) {
    if (!item || typeof item !== "object" || typeof (item as Record<string, unknown>).targetId !== "string") {
      throw new Error("ATTHA'S adaptation contains a variant without a targetId.");
    }
    const id = String((item as Record<string, unknown>).targetId);
    if (seen.has(id)) throw new Error(`ATTHA'S adaptation duplicated target ${id}.`);
    seen.add(id);
  }
  const expected = new Set(targets.map((target) => target.id));
  if ([...seen].some((id) => !expected.has(id as never))) {
    throw new Error("ATTHA'S adaptation returned an unrequested target.");
  }

  const byId = new Map(
    object.variants.map((item) => [String((item as Record<string, unknown>).targetId), item]),
  );
  return {
    variants: targets.map((target) => parseVariant(byId.get(target.id), target, hasPrice)),
    adaptationNotes: stringArray(object.adaptationNotes ?? [], "adaptationNotes"),
  };
}
