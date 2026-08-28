import { geminiImageModelForRole, geminiTextModelForRole } from "../../providers/geminiModels.js";
import { estimateImageOutputCostUsd } from "../../providers/geminiUsage.js";
import { withTransientRetry, type RetryPolicy } from "../../reliability/retry.js";
import type {
  SubjectSegmentationProvider,
  SubjectSegmentationRequest,
  SubjectSegmentationResult,
} from "./types.js";

interface GeminiSegmentationProviderOptions {
  apiKey?: string;
  textModel?: string;
  imageModel?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  retryPolicy?: RetryPolicy;
}

interface SegmentationBox {
  box_2d?: number[];
  mask?: number[][];
  label?: string;
}

interface SegmentationInteractionResponse {
  output_text?: string;
  output_image?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  error?: {
    message?: string;
    status?: string;
  };
}

function clampNormalized(value: number): number {
  return Math.max(0, Math.min(1000, value));
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateBox(value: SegmentationBox): value is Required<Pick<SegmentationBox, "box_2d" | "mask">> & SegmentationBox {
  return (
    Array.isArray(value.box_2d) &&
    value.box_2d.length === 4 &&
    value.box_2d.every(finiteNumber) &&
    Array.isArray(value.mask) &&
    value.mask.length >= 3 &&
    value.mask.every((point) => Array.isArray(point) && point.length >= 2 && finiteNumber(point[0]) && finiteNumber(point[1]))
  );
}

function boxArea(box: number[]): number {
  const [ymin = 0, xmin = 0, ymax = 0, xmax = 0] = box;
  return Math.max(0, ymax - ymin) * Math.max(0, xmax - xmin);
}

function chooseMask(boxes: SegmentationBox[], subjectHint: string | undefined): SegmentationBox & { box_2d: number[]; mask: number[][] } {
  const valid = boxes.filter(validateBox);
  if (!valid.length) throw new Error("SEGMENTATION_EMPTY: Gemini returned no valid subject mask.");
  const hint = subjectHint?.trim().toLowerCase();
  const matching = hint
    ? valid.filter((item) => item.label?.toLowerCase().includes(hint) || hint.includes(item.label?.toLowerCase() ?? "__none__"))
    : [];
  const candidates = matching.length ? matching : valid;
  return [...candidates].sort((a, b) => boxArea(b.box_2d) - boxArea(a.box_2d))[0]!;
}

function absoluteMaskPoints(box: number[], mask: number[][], width: number, height: number): Array<{ x: number; y: number }> {
  const [yminRaw = 0, xminRaw = 0, ymaxRaw = 1000, xmaxRaw = 1000] = box;
  const ymin = clampNormalized(yminRaw);
  const xmin = clampNormalized(xminRaw);
  const ymax = clampNormalized(ymaxRaw);
  const xmax = clampNormalized(xmaxRaw);
  const boxWidth = Math.max(1, xmax - xmin);
  const boxHeight = Math.max(1, ymax - ymin);
  return mask.map((point) => {
    const localX = clampNormalized(point[0] ?? 0);
    const localY = clampNormalized(point[1] ?? 0);
    const normalizedX = xmin + (localX / 1000) * boxWidth;
    const normalizedY = ymin + (localY / 1000) * boxHeight;
    return {
      x: Math.round((normalizedX / 1000) * width * 100) / 100,
      y: Math.round((normalizedY / 1000) * height * 100) / 100,
    };
  });
}

function xmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function foregroundSvg(input: {
  imageBase64: string;
  mimeType: string;
  width: number;
  height: number;
  points: Array<{ x: number; y: number }>;
}): string {
  const polygon = input.points.map((point) => `${point.x},${point.y}`).join(" ");
  const source = `data:${input.mimeType};base64,${input.imageBase64}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height}" viewBox="0 0 ${input.width} ${input.height}">
<defs><clipPath id="subject-mask"><polygon points="${xmlAttribute(polygon)}" /></clipPath></defs>
<image href="${xmlAttribute(source)}" x="0" y="0" width="${input.width}" height="${input.height}" preserveAspectRatio="none" clip-path="url(#subject-mask)" />
</svg>`;
}

function aspectRatio(width: number, height: number): string {
  const ratio = width / height;
  const candidates = [
    { value: "1:1", ratio: 1 },
    { value: "4:5", ratio: 4 / 5 },
    { value: "9:16", ratio: 9 / 16 },
    { value: "16:9", ratio: 16 / 9 },
    { value: "3:4", ratio: 3 / 4 },
    { value: "4:3", ratio: 4 / 3 },
  ];
  return candidates.sort((a, b) => Math.abs(a.ratio - ratio) - Math.abs(b.ratio - ratio))[0]!.value;
}

async function transientError(response: Response, prefix: string): Promise<Error & { status: number }> {
  let detail = `HTTP ${response.status}`;
  try {
    const body = (await response.clone().json()) as SegmentationInteractionResponse;
    detail = body.error?.message ?? detail;
  } catch {
    // Preserve HTTP fallback.
  }
  const error = new Error(`${prefix}: ${detail}`) as Error & { status: number };
  error.status = response.status;
  return error;
}

export class GeminiSubjectSegmentationProvider implements SubjectSegmentationProvider {
  readonly providerName = "gemini-native-segmentation";
  readonly model: string;
  readonly textModel: string;
  readonly imageModel: string;
  lastCostUsd: number | undefined;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly retryPolicy: RetryPolicy;

  constructor(options: GeminiSegmentationProviderOptions = {}) {
    const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) throw new Error("GEMINI_API_KEY is required for Gemini subject segmentation.");
    this.apiKey = apiKey.trim();
    this.textModel = options.textModel?.trim() || geminiTextModelForRole("advanced");
    this.imageModel = options.imageModel?.trim() || geminiImageModelForRole("production");
    this.model = `${this.textModel}+${this.imageModel}`;
    this.baseUrl = options.baseUrl?.replace(/\/$/, "") ?? "https://generativelanguage.googleapis.com/v1beta";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.retryPolicy = options.retryPolicy ?? {};
  }

  private async detectMask(request: SubjectSegmentationRequest): Promise<SegmentationBox & { box_2d: number[]; mask: number[][] }> {
    const hint = request.subjectHint?.trim() || "the primary food/product subject";
    const prompt = [
      `Segment only ${hint} from the provided image.`,
      "Return the smallest accurate contour for the real visible subject, including its complete silhouette.",
      "Do not include promotional text, logos, plates, tables, packaging, hands or background props unless they are physically part of the named product.",
      "Output JSON only using the provided schema.",
    ].join(" ");
    const schema = {
      type: "object",
      properties: {
        boxes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              box_2d: { type: "array", items: { type: "number" } },
              mask: {
                type: "array",
                items: { type: "array", items: { type: "number" } },
              },
              label: { type: "string" },
            },
            required: ["box_2d", "mask", "label"],
          },
        },
      },
      required: ["boxes"],
    };
    const retry = await withTransientRetry(async () => {
      const response = await this.fetchImpl(`${this.baseUrl}/interactions`, {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.textModel,
          input: [
            { type: "text", text: prompt },
            { type: "image", data: request.imageBase64, mime_type: request.mimeType },
          ],
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema,
          },
          generation_config: { thinking_level: "minimal" },
        }),
      });
      if (response.status === 429 || response.status === 503) throw await transientError(response, "Gemini segmentation failed");
      return response;
    }, this.retryPolicy);
    const response = retry.value;
    let body: SegmentationInteractionResponse;
    try {
      body = (await response.json()) as SegmentationInteractionResponse;
    } catch {
      throw new Error(`Gemini segmentation returned non-JSON HTTP ${response.status}.`);
    }
    if (!response.ok) throw new Error(`Gemini segmentation failed: ${body.error?.message ?? `HTTP ${response.status}`}`);
    if (!body.output_text?.trim()) throw new Error("Gemini segmentation returned no mask JSON.");
    let parsed: { boxes?: SegmentationBox[] };
    try {
      parsed = JSON.parse(body.output_text) as { boxes?: SegmentationBox[] };
    } catch {
      throw new Error("Gemini segmentation returned invalid mask JSON.");
    }
    return chooseMask(parsed.boxes ?? [], request.subjectHint);
  }

  private async removeSubject(request: SubjectSegmentationRequest): Promise<{ dataBase64: string; mimeType: "image/png" }> {
    const width = request.width ?? 1080;
    const height = request.height ?? 1080;
    const hint = request.subjectHint?.trim() || "the primary food/product subject";
    const prompt = [
      `Remove only ${hint} from the provided image and reconstruct the occluded background plate.`,
      "Keep the camera, lighting, surfaces, shadows, background objects, composition and color grading as unchanged as possible.",
      "Do not add a replacement product, food, people, text, logos, labels, signs, prices or promotional elements.",
      "The result must be a clean background plate suitable for placing the original segmented subject back on top.",
    ].join(" ");
    const retry = await withTransientRetry(async () => {
      const response = await this.fetchImpl(`${this.baseUrl}/interactions`, {
        method: "POST",
        headers: {
          "x-goog-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.imageModel,
          input: [
            { type: "text", text: prompt },
            { type: "image", data: request.imageBase64, mime_type: request.mimeType },
          ],
          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: aspectRatio(width, height),
            image_size: "1K",
          },
        }),
      });
      if (response.status === 429 || response.status === 503) throw await transientError(response, "Gemini background repair failed");
      return response;
    }, this.retryPolicy);
    const response = retry.value;
    let body: SegmentationInteractionResponse;
    try {
      body = (await response.json()) as SegmentationInteractionResponse;
    } catch {
      throw new Error(`Gemini background repair returned non-JSON HTTP ${response.status}.`);
    }
    if (!response.ok) throw new Error(`Gemini background repair failed: ${body.error?.message ?? `HTTP ${response.status}`}`);
    if (!body.output_image?.data) throw new Error("Gemini background repair returned no image.");
    return { dataBase64: body.output_image.data, mimeType: "image/png" };
  }

  async segment(request: SubjectSegmentationRequest): Promise<SubjectSegmentationResult> {
    if (!request.imageBase64.trim() || !request.mimeType.startsWith("image/")) {
      throw new Error("SEGMENTATION_INPUT_INVALID: image bytes and image MIME type are required.");
    }
    const width = request.width ?? 1080;
    const height = request.height ?? 1080;
    if (!Number.isInteger(width) || width < 64 || !Number.isInteger(height) || height < 64) {
      throw new Error("SEGMENTATION_INPUT_INVALID: width and height must be integers of at least 64px.");
    }

    const mask = await this.detectMask(request);
    const points = absoluteMaskPoints(mask.box_2d, mask.mask, width, height);
    if (points.length < 3) throw new Error("SEGMENTATION_INVALID: subject contour requires at least three points.");
    const foreground = foregroundSvg({
      imageBase64: request.imageBase64,
      mimeType: request.mimeType,
      width,
      height,
      points,
    });
    const background = await this.removeSubject({ ...request, width, height });
    this.lastCostUsd = estimateImageOutputCostUsd(this.imageModel, "1K");

    return {
      foregroundBase64: Buffer.from(foreground, "utf8").toString("base64"),
      backgroundBase64: background.dataBase64,
      foregroundMimeType: "image/svg+xml",
      backgroundMimeType: background.mimeType,
      metadata: {
        maskLabel: mask.label?.trim() || request.subjectHint?.trim() || "primary-subject",
        maskPointCount: points.length,
        foregroundPixelsOriginal: true,
        backgroundRepairGenerated: true,
        textModel: this.textModel,
        imageModel: this.imageModel,
      },
    };
  }
}
