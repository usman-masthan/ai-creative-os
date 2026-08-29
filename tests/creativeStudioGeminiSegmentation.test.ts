import test from "node:test";
import assert from "node:assert/strict";

import { GeminiSubjectSegmentationProvider } from "../src/creativeStudio/segmentation/gemini.js";

test("Gemini segmentation preserves foreground source pixels and generates only the background plate", async () => {
  const sourceBytes = Buffer.alloc(1800, 9);
  const backgroundBytes = Buffer.alloc(1900, 4);
  const requests: Array<Record<string, unknown>> = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    requests.push(body);
    if (requests.length === 1) {
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          boxes: [
            {
              box_2d: [100, 150, 900, 850],
              mask: [[50, 60], [950, 70], [920, 940], [80, 930]],
              label: "Chicken Tikka Wrap",
            },
          ],
        }),
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({
      output_image: {
        data: backgroundBytes.toString("base64"),
        mime_type: "image/png",
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const provider = new GeminiSubjectSegmentationProvider({
    apiKey: "test-key",
    textModel: "gemini-test-segmentation",
    imageModel: "gemini-test-image",
    fetchImpl,
  });
  const result = await provider.segment({
    imageBase64: sourceBytes.toString("base64"),
    mimeType: "image/jpeg",
    width: 1080,
    height: 1350,
    subjectHint: "Chicken Tikka Wrap",
  });

  assert.equal(requests.length, 2);
  const maskRequest = requests[0] as {
    generation_config?: { thinking_level?: string };
    input?: Array<{ type?: string; data?: string }>;
  };
  assert.equal(maskRequest.generation_config?.thinking_level, "minimal");
  assert.equal(maskRequest.input?.find((item) => item.type === "image")?.data, sourceBytes.toString("base64"));

  assert.equal(result.foregroundMimeType, "image/svg+xml");
  const svg = Buffer.from(result.foregroundBase64, "base64").toString("utf8");
  assert.match(svg, /clipPath id="subject-mask"/);
  assert.match(svg, /data:image\/jpeg;base64,/);
  assert.ok(svg.includes(sourceBytes.toString("base64")));
  assert.equal(result.backgroundMimeType, "image/png");
  assert.equal(Buffer.from(result.backgroundBase64, "base64").length, backgroundBytes.length);
  assert.equal(result.metadata?.foregroundPixelsOriginal, true);
  assert.equal(result.metadata?.backgroundRepairGenerated, true);
});
