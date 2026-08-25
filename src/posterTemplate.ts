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
  :root {
    --atthas-red-deep: #B50008;
    --atthas-red-appetite: #D01920;
    --atthas-red-ember: #820008;
    --atthas-gold-flame: #FFD21A;
    --atthas-gold-toasted: #F2B705;
    --atthas-white: #FFFFFF;
    --atthas-cream: #FFF8E8;
    --atthas-ink: #171717;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${format.width}px; height: ${format.height}px; overflow: hidden; }
  body { font-family: Inter, Arial, Helvetica, sans-serif; background: var(--atthas-ink); }
  .poster {
    position: relative;
    width: ${format.width}px;
    height: ${format.height}px;
    overflow: hidden;
    background-image:
      linear-gradient(180deg, rgba(23,23,23,.16) 0%, rgba(23,23,23,0) 42%, rgba(23,23,23,.78) 100%),
      url("${cssString(baseImageDataUri)}");
    background-size: cover;
    background-position: center;
    color: var(--atthas-white);
  }
  .poster::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 350px;
    background: linear-gradient(180deg, rgba(181,0,8,.94) 0%, rgba(181,0,8,.76) 58%, rgba(181,0,8,0) 100%);
    pointer-events: none;
  }
  .brand-rail {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 16px;
    background: var(--atthas-gold-flame);
  }
  .top {
    position: absolute;
    z-index: 2;
    left: 64px;
    right: 64px;
    top: 64px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 36px;
  }
  .copy { max-width: 690px; }
  .headline {
    font-family: Oswald, "Arial Narrow", Arial, sans-serif;
    font-size: 82px;
    line-height: .96;
    font-weight: 800;
    letter-spacing: -1.8px;
    text-wrap: balance;
    text-transform: none;
    text-shadow: 0 3px 14px rgba(23,23,23,.28);
  }
  .supporting {
    margin-top: 20px;
    font-size: 32px;
    line-height: 1.2;
    font-weight: 600;
    max-width: 620px;
    color: var(--atthas-cream);
    text-shadow: 0 2px 10px rgba(23,23,23,.28);
  }
  .price {
    flex: 0 0 auto;
    padding: 18px 26px;
    border-radius: 12px;
    background: var(--atthas-gold-flame);
    color: var(--atthas-ink);
    border: 3px solid rgba(255,255,255,.92);
    font-family: Oswald, "Arial Narrow", Arial, sans-serif;
    font-size: 46px;
    line-height: 1;
    font-weight: 700;
    letter-spacing: -.5px;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(23,23,23,.22);
  }
  .bottom {
    position: absolute;
    z-index: 2;
    left: 64px;
    right: 64px;
    bottom: 64px;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 64px;
    padding: 18px 28px;
    border-radius: 8px;
    background: var(--atthas-gold-flame);
    color: var(--atthas-ink);
    font-size: 30px;
    line-height: 1;
    font-weight: 800;
    letter-spacing: -.2px;
    box-shadow: 0 10px 28px rgba(23,23,23,.30);
  }
  .compliance-accent {
    position: absolute;
    z-index: 2;
    left: 64px;
    bottom: 64px;
    width: 96px;
    height: 8px;
    border-radius: 999px;
    background: var(--atthas-gold-flame);
  }
</style>
</head>
<body>
  <main class="poster" data-width="${format.width}" data-height="${format.height}" data-template-id="ATTHAS_BURGER_HERO_V1">
    <div class="brand-rail" aria-hidden="true"></div>
    <section class="top">
      <div class="copy">
        <div class="headline">${headline}</div>
        <div class="supporting">${supportingCopy}</div>
      </div>
      ${price ? `<div class="price">${price}</div>` : ""}
    </section>
    <div class="compliance-accent" aria-hidden="true"></div>
    <section class="bottom">
      <div class="cta">${cta}</div>
    </section>
  </main>
</body>
</html>`;
}
