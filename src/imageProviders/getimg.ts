import type {
  ImageDraftProvider,
  ImageDraftRequest,
  ImageDraftResult,
} from "./types.js";

interface GetimgOptions {
  apiKey: string;
  model?: string;
  resolution?: string;
  endpoint?: string;
  fetchFn?: typeof fetch;
}

interface GetimgResponse {
  id?: string;
  status?: string;
  model?: string;
  data?: Array<{ url?: string }>;
  usage?: {
    total_cost?: number;
  };
  error?: {
    message?: string;
  };
  message?: string;
}

const DEFAULT_ENDPOINT = "https://api.getimg.ai/v2/images/generations";
const DEFAULT_MODEL = "gemini-3-1-flash-lite-image";

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as GetimgResponse;
    return payload.error?.message ?? payload.message ?? JSON.stringify(payload);
  } catch {
    try {
      return await response.text();
    } catch {
      return `HTTP ${response.status}`;
    }
  }
}

export class GetimgImageProvider implements ImageDraftProvider {
  readonly providerName = "getimg";
  readonly model: string;
  private readonly apiKey: string;
  private readonly resolution: string;
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: GetimgOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("GETIMG_API_KEY is required for the getimg image provider.");
    }

    this.apiKey = options.apiKey;
    this.model = options.model?.trim() || DEFAULT_MODEL;
    this.resolution = options.resolution?.trim() || "1K";
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async generate(request: ImageDraftRequest): Promise<ImageDraftResult> {
    const prompt = request.prompt.trim();
    if (!prompt) {
      throw new Error("Image draft prompt cannot be empty.");
    }
    if (prompt.length > 4096) {
      throw new Error("Image draft prompt exceeds getimg.ai's 4096-character limit.");
    }

    const response = await this.fetchFn(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        aspect_ratio: request.aspectRatio,
        resolution: request.resolution ?? this.resolution,
        output_format: request.outputFormat ?? "jpeg",
      }),
    });

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(`getimg.ai image generation failed: ${detail}`);
    }

    const payload = (await response.json()) as GetimgResponse;
    const imageUrl = payload.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error("getimg.ai image generation succeeded but returned no image URL.");
    }

    return {
      provider: this.providerName,
      model: payload.model ?? this.model,
      ...(payload.id ? { requestId: payload.id } : {}),
      imageUrl,
      ...(typeof payload.usage?.total_cost === "number"
        ? { costUsd: payload.usage.total_cost }
        : {}),
    };
  }
}
