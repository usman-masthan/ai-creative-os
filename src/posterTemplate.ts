import type {
  CampaignCreativeOutput,
  CampaignProductionFormat,
} from "./creativeTypes.js";

export interface PosterTemplateInput {
  creative: CampaignCreativeOutput;
  format: CampaignProductionFormat;
  baseImageDataUri: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function buildPosterHtml(input: PosterTemplateInput): string {
  const { creative, format, baseImageDataUri } = input;
  const overlay = creative.overlaySpec;
  const headline = escapeHtml(overlay.headline);
  const supportingCopy = escapeHtml(overlay.supportingCopy);
  const price = escapeHtml(overlay.price?.display ?? "");
  const cta = escapeHtml(overlay.cta);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${format.width}, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${format.width}px; height: ${format.height}px; overflow: hidden; }
  body { font-family: Arial, Helvetica, sans-serif; background: #111; }
  .poster {
    position: relative;
    width: ${format.width}px;
    height: ${format.height}px;
    background-image: linear-gradient(180deg, rgba(0,0,0,.12) 0%, rgba(0,0,0,.02) 44%, rgba(0,0,0,.62) 100%), url("${cssString(baseImageDataUri)}");
    background-size: cover;
    background-position: center;
    color: #fff;
  }
  .top {
    position: absolute;
    left: 72px;
    right: 72px;
    top: 72px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 40px;
  }
  .copy { max-width: 700px; }
  .headline {
    font-size: 82px;
    line-height: .96;
    font-weight: 800;
    letter-spacing: -2.5px;
    text-wrap: balance;
    text-shadow: 0 3px 18px rgba(0,0,0,.45);
  }
  .supporting {
    margin-top: 24px;
    font-size: 34px;
    line-height: 1.16;
    font-weight: 500;
    max-width: 620px;
    text-shadow: 0 2px 12px rgba(0,0,0,.55);
  }
  .price {
    flex: 0 0 auto;
    padding: 20px 28px;
    border-radius: 18px;
    background: rgba(0,0,0,.78);
    border: 2px solid rgba(255,255,255,.8);
    font-size: 46px;
    font-weight: 800;
    letter-spacing: -1px;
    white-space: nowrap;
  }
  .bottom {
    position: absolute;
    left: 72px;
    right: 72px;
    bottom: 70px;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
  }
  .cta {
    display: inline-block;
    padding: 20px 28px;
    border-radius: 14px;
    background: #fff;
    color: #111;
    font-size: 30px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -.4px;
  }
</style>
</head>
<body>
  <main class="poster" data-width="${format.width}" data-height="${format.height}">
    <section class="top">
      <div class="copy">
        <div class="headline">${headline}</div>
        <div class="supporting">${supportingCopy}</div>
      </div>
      ${price ? `<div class="price">${price}</div>` : ""}
    </section>
    <section class="bottom">
      <div class="cta">${cta}</div>
    </section>
  </main>
</body>
</html>`;
}
