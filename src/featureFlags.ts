export interface CreativeFeatureFlags {
  useStructuredBrief: boolean;
  useFoodComposer: boolean;
  useNewRenderer: boolean;
}

export const DEFAULT_CREATIVE_FEATURE_FLAGS: Readonly<CreativeFeatureFlags> = Object.freeze({
  useStructuredBrief: false,
  useFoodComposer: false,
  useNewRenderer: false,
});

const TRUE_VALUES = new Set(["1", "true", "yes", "on", "enabled"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off", "disabled"]);

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  throw new Error(`Invalid feature-flag value: ${value}.`);
}

export function resolveCreativeFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<CreativeFeatureFlags> = {},
): CreativeFeatureFlags {
  return {
    useStructuredBrief:
      overrides.useStructuredBrief ??
      parseFlag(env.AI_CREATIVE_USE_STRUCTURED_BRIEF, DEFAULT_CREATIVE_FEATURE_FLAGS.useStructuredBrief),
    useFoodComposer:
      overrides.useFoodComposer ??
      parseFlag(env.AI_CREATIVE_USE_FOOD_COMPOSER, DEFAULT_CREATIVE_FEATURE_FLAGS.useFoodComposer),
    useNewRenderer:
      overrides.useNewRenderer ??
      parseFlag(env.AI_CREATIVE_USE_NEW_RENDERER, DEFAULT_CREATIVE_FEATURE_FLAGS.useNewRenderer),
  };
}
