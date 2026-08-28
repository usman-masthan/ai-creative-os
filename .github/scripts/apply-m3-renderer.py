from pathlib import Path

p = Path('src/creativeTypes.ts')
t = p.read_text()
old = '''export interface CampaignMoneyOverlay {
  amount: number;
  currency: "LKR";
  display: string;
}
'''
new = '''export type CampaignPriceStyle = "BRAND_RED" | "BRAND_YELLOW";

export interface CampaignMoneyOverlay {
  amount: number;
  currency: "LKR";
  display: string;
  priceStyle?: CampaignPriceStyle;
}
'''
assert old in t
p.write_text(t.replace(old, new, 1))

p = Path('src/creativeValidator.ts')
t = p.read_text()
old = '''  if (currency !== "LKR") {
    throw new Error(`Invalid campaign creative output: ${path}.${key}.currency must be LKR.`);
  }

  return {
    amount,
    currency: "LKR",
    display: formatLkr(amount),
  };
'''
new = '''  if (currency !== "LKR") {
    throw new Error(`Invalid campaign creative output: ${path}.${key}.currency must be LKR.`);
  }
  const priceStyle = value.priceStyle;
  if (
    priceStyle !== undefined &&
    priceStyle !== "BRAND_RED" &&
    priceStyle !== "BRAND_YELLOW"
  ) {
    throw new Error(
      `Invalid campaign creative output: ${path}.${key}.priceStyle must be BRAND_RED or BRAND_YELLOW when supplied.`,
    );
  }

  return {
    amount,
    currency: "LKR",
    display: formatLkr(amount),
    ...(priceStyle ? { priceStyle } : {}),
  };
'''
assert old in t
p.write_text(t.replace(old, new, 1))

p = Path('src/posterTemplate.ts')
t = p.read_text()
old = 'import { ATTHAS_TOKENS, atthasCssVariables } from "./atthasTokens.js";\n'
new = old + 'import { buildM3PosterHtml, type M3CopyZones } from "./m3Renderer.js";\n'
assert old in t
t = t.replace(old, new, 1)
old = '''  brandId?: AtthasBrandId;
  layoutId?: AtthasLayoutId;
}
'''
new = '''  brandId?: AtthasBrandId;
  layoutId?: AtthasLayoutId;
  rendererMode?: "LEGACY" | "M3_V2";
  copyZones?: M3CopyZones;
}
'''
assert old in t
t = t.replace(old, new, 1)
old = '''  const brandId = input.brandId ?? "ATTHAS_BURGER";
  const layout = selectAtthasLayout({
'''
new = '''  const brandId = input.brandId ?? "ATTHAS_BURGER";
  if (input.rendererMode === "M3_V2") {
    return buildM3PosterHtml({
      creative,
      format,
      baseImageDataUri,
      brandId,
      ...(input.layoutId ? { layoutId: input.layoutId } : {}),
      ...(input.copyZones ? { copyZones: input.copyZones } : {}),
    });
  }
  const layout = selectAtthasLayout({
'''
assert old in t
p.write_text(t.replace(old, new, 1))

p = Path('src/commands/producePoster.ts')
t = p.read_text()
anchor = 'import type { ImageDraftProvider, ImageDraftResult } from "../imageProviders/types.js";\n'
addition = 'import { buildM3RendererPlan, type M3CopyZones, type M3RendererPlan } from "../m3Renderer.js";\n'
assert anchor in t
t = t.replace(anchor, anchor + addition, 1)
old = '''  finalArtQa?: PosterFinalArtQaConfig;
  chromePath?: string;
  fetchFn?: typeof fetch;
}
'''
new = '''  finalArtQa?: PosterFinalArtQaConfig;
  rendererMode?: "LEGACY" | "M3_V2";
  copyZones?: M3CopyZones;
  chromePath?: string;
  fetchFn?: typeof fetch;
}
'''
assert old in t
t = t.replace(old, new, 1)
old = '''  visualQa?: VisualQaResult;
  finalArtQa?: FinalArtQaResult;
  qa: PosterQaResult;
}
'''
new = '''  visualQa?: VisualQaResult;
  finalArtQa?: FinalArtQaResult;
  rendererPlan?: M3RendererPlan;
  qa: PosterQaResult;
}
'''
assert old in t
t = t.replace(old, new, 1)
old = '''  const baseImageDataUri = await imageToDataUri(baseImagePath);
  const html = buildPosterHtml({
    creative: request.campaign.creative,
    format: request.campaign.production.format,
    baseImageDataUri,
    brandId,
    layoutId: layout.id,
  });
'''
new = '''  const baseImageDataUri = await imageToDataUri(baseImagePath);
  const rendererMode = request.rendererMode ?? "LEGACY";
  const rendererPlan =
    rendererMode === "M3_V2"
      ? buildM3RendererPlan({
          creative: request.campaign.creative,
          format: request.campaign.production.format,
          brandId,
          layoutId: layout.id,
          ...(request.copyZones ? { copyZones: request.copyZones } : {}),
        })
      : undefined;
  const html = buildPosterHtml({
    creative: request.campaign.creative,
    format: request.campaign.production.format,
    baseImageDataUri,
    brandId,
    layoutId: layout.id,
    rendererMode,
    ...(request.copyZones ? { copyZones: request.copyZones } : {}),
  });
'''
assert old in t
t = t.replace(old, new, 1)
old = '''    overlay: request.campaign.creative.overlaySpec,
    imageGeneration: imageGenerationSummary ?? { provider: "local", model: "existing-image" },
'''
new = '''    overlay: request.campaign.creative.overlaySpec,
    renderer: rendererPlan ?? { mode: "LEGACY" },
    imageGeneration: imageGenerationSummary ?? { provider: "local", model: "existing-image" },
'''
assert old in t
t = t.replace(old, new, 1)
old = '''    ...(finalArtQa ? { finalArtQa } : {}),
    qa,
  };
}
'''
new = '''    ...(finalArtQa ? { finalArtQa } : {}),
    ...(rendererPlan ? { rendererPlan } : {}),
    qa,
  };
}
'''
assert old in t
p.write_text(t.replace(old, new, 1))

p = Path('src/commands/producePlannedCampaign.ts')
t = p.read_text()
old = '''      baseImagePath: current.path,
      ...(request.chromePath ? { chromePath: request.chromePath } : {}),
'''
new = '''      baseImagePath: current.path,
      ...(featureFlags.useNewRenderer ? { rendererMode: "M3_V2" as const } : {}),
      ...(request.chromePath ? { chromePath: request.chromePath } : {}),
'''
assert old in t
t = t.replace(old, new, 1)
old = '''    baseImagePath: current.path,
    ...(request.chromePath ? { chromePath: request.chromePath } : {}),
'''
new = '''    baseImagePath: current.path,
    ...(featureFlags.useNewRenderer ? { rendererMode: "M3_V2" as const } : {}),
    ...(featureFlags.useNewRenderer && lastQa?.compositionEvidence
      ? { copyZones: lastQa.compositionEvidence.copyZones }
      : {}),
    ...(request.chromePath ? { chromePath: request.chromePath } : {}),
'''
assert old in t
p.write_text(t.replace(old, new, 1))

p = Path('tests/productionOrchestrator.test.ts')
t = p.read_text()
if 'new renderer receives measured Visual QA copy zones' not in t:
    t += '''

test("new renderer receives measured Visual QA copy zones instead of relying on brief quiet zones", async () => {
  await withTempDir(async (dir) => {
    const prompts: string[] = [];
    const request = baseRequest(dir, prompts);
    request.featureFlags = { useNewRenderer: true };
    const pass = qaResult("PASS");
    pass.compositionEvidence = {
      heroPlacement: "MATCH",
      heroScale: "MATCH",
      cropQuality: "GOOD",
      copyZones: {
        upperLeft: "POOR",
        upperRight: "GOOD",
        lowerLeft: "ACCEPTABLE",
        lowerRight: "POOR",
      },
      notes: ["upper-right is the measured cleanest copy zone"],
    };
    request.providers.visualQa = qaProvider([pass]);
    let captured: ProducePosterRequest | undefined;
    request.posterProducer = async (posterRequest) => {
      captured = posterRequest;
      return posterProducer(posterRequest);
    };

    const result = await producePlannedCampaign(request);
    assert.equal(result.status, "FINAL_RENDERED");
    assert.equal(captured?.rendererMode, "M3_V2");
    assert.deepEqual(captured?.copyZones, pass.compositionEvidence.copyZones);
  });
});
'''
p.write_text(t)
