export const GEMINI_MODEL_STACK = {
  text: {
    default: "gemini-3.5-flash-lite",
    creative: "gemini-3.6-flash",
    latest: "gemini-3.7-flash",
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

export function geminiTextModelForRole(role: GeminiTextRole): string {
  return GEMINI_MODEL_STACK.text[role];
}
