export const GEMINI_MODEL_STACK = {
  text: {
    default: "gemini-3.5-flash-lite",
    creative: "gemini-3.6-flash",
    advanced: "gemini-3.7-flash",
    review: "gemini-3.1-pro-preview",
  },
  image: {
    draft: "gemini-3.1-flash-lite-image",
    production: "gemini-3.1-flash-image",
    premium: "gemini-3-pro-image",
  },
  audio: {
    tts: "gemini-3.1-flash-tts-preview",
  },
  video: {
    lite: "veo-3.1-lite-generate-preview",
    fast: "veo-3.1-fast-generate-preview",
    premium: "veo-3.1-generate-preview",
  },
} as const;

export type GeminiTextRole = keyof typeof GEMINI_MODEL_STACK.text;
export type GeminiImageRole = keyof typeof GEMINI_MODEL_STACK.image;
export type GeminiVideoRole = keyof typeof GEMINI_MODEL_STACK.video;

const TEXT_ENV_BY_ROLE: Record<GeminiTextRole, string> = {
  default: "GEMINI_CAMPAIGN_MODEL",
  creative: "GEMINI_CREATIVE_MODEL",
  advanced: "GEMINI_ADVANCED_FLASH_MODEL",
  review: "GEMINI_REVIEW_MODEL",
};

const IMAGE_ENV_BY_ROLE: Record<GeminiImageRole, string> = {
  draft: "GEMINI_IMAGE_DRAFT_MODEL",
  production: "GEMINI_IMAGE_PRODUCTION_MODEL",
  premium: "GEMINI_IMAGE_PREMIUM_MODEL",
};

const VIDEO_ENV_BY_ROLE: Record<GeminiVideoRole, string> = {
  lite: "GEMINI_VIDEO_LITE_MODEL",
  fast: "GEMINI_VIDEO_FAST_MODEL",
  premium: "GEMINI_VIDEO_PREMIUM_MODEL",
};

function modelFromEnvironment(variable: string): string | undefined {
  const value = process.env[variable]?.trim();
  return value || undefined;
}

export function geminiTextModelForRole(role: GeminiTextRole): string {
  return modelFromEnvironment(TEXT_ENV_BY_ROLE[role]) ?? GEMINI_MODEL_STACK.text[role];
}

export function geminiImageModelForRole(role: GeminiImageRole): string {
  return modelFromEnvironment(IMAGE_ENV_BY_ROLE[role]) ?? GEMINI_MODEL_STACK.image[role];
}

export function geminiVideoModelForRole(role: GeminiVideoRole): string {
  return modelFromEnvironment(VIDEO_ENV_BY_ROLE[role]) ?? GEMINI_MODEL_STACK.video[role];
}

export function geminiTtsModel(): string {
  return process.env.GEMINI_TTS_MODEL?.trim() || GEMINI_MODEL_STACK.audio.tts;
}
