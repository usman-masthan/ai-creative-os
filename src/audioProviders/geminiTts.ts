import { geminiTtsModel } from "../providers/geminiModels.js";
import {
  usageFromInteraction,
  type GeminiUsageTelemetry,
} from "../providers/geminiUsage.js";
import type {
  AudioGenerationProvider,
  AudioGenerationRequest,
  AudioGenerationResult,
} from "./types.js";

interface GeminiTtsProviderOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  defaultVoice?: string;
  fetchImpl?: typeof fetch;
}

interface GeminiAudioInteractionResponse {
  id?: string;
  usage?: {
    total_tokens?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
    service_tier?: string;
  };
  steps?: Array<{
    content?: Array<{
      type?: string;
      data?: string;
      mime_type?: string;
      mimeType?: string;
    }>;
  }>;
  output_audio?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  error?: {
    message?: string;
  };
}

function extractAudio(body: GeminiAudioInteractionResponse): { dataBase64: string; mimeType: string } | undefined {
  for (const step of body.steps ?? []) {
    for (const content of step.content ?? []) {
      if (content.type !== "audio" || !content.data) continue;
      return {
        dataBase64: content.data,
        mimeType: content.mime_type ?? content.mimeType ?? "audio/L16;rate=24000",
      };
    }
  }

  if (body.output_audio?.data) {
    return {
      dataBase64: body.output_audio.data,
      mimeType: body.output_audio.mime_type ?? body.output_audio.mimeType ?? "audio/L16;rate=24000",
    };
  }

  return undefined;
}

export class GeminiTtsProvider implements AudioGenerationProvider {
  readonly providerName = "gemini";
  readonly model: string;
  lastUsage: GeminiUsageTelemetry | undefined;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultVoice: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GeminiTtsProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      throw new Error("GEMINI_API_KEY is required to use GeminiTtsProvider.");
    }

    this.apiKey = apiKey.trim();
    this.model = options.model?.trim() || geminiTtsModel();
    this.baseUrl =
      options.baseUrl?.replace(/\/$/, "") ??
      "https://generativelanguage.googleapis.com/v1beta";
    this.defaultVoice = options.defaultVoice?.trim() || process.env.GEMINI_TTS_VOICE?.trim() || "Kore";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResult> {
    const text = request.text.trim();
    if (!text) {
      throw new Error("Gemini TTS text cannot be empty.");
    }

    const voice = request.voice?.trim() || this.defaultVoice;
    const response = await this.fetchImpl(`${this.baseUrl}/interactions`, {
      method: "POST",
      headers: {
        "x-goog-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        response_format: {
          type: "audio",
        },
        generation_config: {
          speech_config: [{ voice }],
        },
      }),
    });

    let body: GeminiAudioInteractionResponse;
    try {
      body = (await response.json()) as GeminiAudioInteractionResponse;
    } catch {
      throw new Error(`Gemini TTS API returned a non-JSON response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      const detail = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Gemini TTS generation failed: ${detail}`);
    }

    const audio = extractAudio(body);
    if (!audio) {
      throw new Error("Gemini TTS generation succeeded but returned no audio data.");
    }

    this.lastUsage = usageFromInteraction(this.model, body.usage);

    return {
      provider: this.providerName,
      model: this.model,
      ...(body.id ? { requestId: body.id } : {}),
      dataBase64: audio.dataBase64,
      mimeType: audio.mimeType,
      sampleRateHz: 24_000,
      channels: 1,
      bitsPerSample: 16,
      ...(this.lastUsage ? { usage: this.lastUsage } : {}),
    };
  }
}
