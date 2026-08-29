import {
  clampRectToArtboard,
  safeAreaRect,
  type ArtboardSize,
  type LayerGeometryProfile,
  type Rect,
} from "./geometry.js";

export type DesignCopyZone = "upperLeft" | "upperRight" | "lowerLeft" | "lowerRight";

export interface LayerGeometryPlan {
  safeArea: Rect;
  background: Rect;
  subject: Rect;
  headline: Rect;
  supporting: Rect;
  cta: Rect;
  price: Rect;
  logo: Rect;
}

function copyAnchor(safe: Rect, zone: DesignCopyZone, width: number, height: number): Rect {
  const right = safe.x + safe.width - width;
  const bottom = safe.y + safe.height - height;
  return {
    x: zone.endsWith("Right") ? right : safe.x,
    y: zone.startsWith("lower") ? bottom : safe.y,
    width,
    height,
  };
}

function subjectRect(profile: LayerGeometryProfile, artboard: ArtboardSize): Rect {
  if (profile === "VERTICAL_STORY") {
    return {
      x: Math.round(artboard.width * 0.08),
      y: Math.round(artboard.height * 0.30),
      width: Math.round(artboard.width * 0.84),
      height: Math.round(artboard.height * 0.52),
    };
  }
  if (profile === "EDITORIAL_OFFCENTER") {
    return {
      x: Math.round(artboard.width * 0.42),
      y: Math.round(artboard.height * 0.26),
      width: Math.round(artboard.width * 0.52),
      height: Math.round(artboard.height * 0.60),
    };
  }
  return {
    x: Math.round(artboard.width * 0.30),
    y: Math.round(artboard.height * 0.30),
    width: Math.round(artboard.width * 0.66),
    height: Math.round(artboard.height * 0.58),
  };
}

export function resolveLayerGeometry(input: {
  artboard: ArtboardSize;
  geometryProfile: LayerGeometryProfile;
  copyZone?: DesignCopyZone;
  hasPrice: boolean;
}): LayerGeometryPlan {
  const { artboard } = input;
  const safe = safeAreaRect(artboard);
  const vertical = artboard.height / artboard.width > 1.5;
  const copyZone = input.copyZone ?? "upperLeft";
  const copyWidth = Math.round(safe.width * (vertical ? 0.78 : 0.54));
  const headlineHeight = Math.round(safe.height * (vertical ? 0.17 : 0.20));
  const headline = copyAnchor(safe, copyZone, copyWidth, headlineHeight);
  const direction = copyZone.startsWith("lower") ? -1 : 1;
  const supportHeight = Math.round(safe.height * 0.095);
  const supportY = direction > 0
    ? headline.y + headline.height + Math.round(artboard.height * 0.015)
    : headline.y - supportHeight - Math.round(artboard.height * 0.015);
  const supporting = clampRectToArtboard({ x: headline.x, y: supportY, width: copyWidth, height: supportHeight }, artboard);
  const ctaHeight = Math.round(artboard.height * 0.055);
  const ctaWidth = Math.round(copyWidth * 0.46);
  const ctaY = direction > 0
    ? supporting.y + supporting.height + Math.round(artboard.height * 0.02)
    : supporting.y - ctaHeight - Math.round(artboard.height * 0.02);
  const cta = clampRectToArtboard({
    x: copyZone.endsWith("Right") ? headline.x + headline.width - ctaWidth : headline.x,
    y: ctaY,
    width: ctaWidth,
    height: ctaHeight,
  }, artboard);
  const priceWidth = Math.round(copyWidth * 0.42);
  const priceHeight = Math.round(artboard.height * 0.065);
  const price = clampRectToArtboard({
    x: copyZone.endsWith("Right") ? headline.x + headline.width - priceWidth : headline.x,
    y: direction > 0
      ? cta.y + cta.height + Math.round(artboard.height * 0.012)
      : cta.y - priceHeight - Math.round(artboard.height * 0.012),
    width: priceWidth,
    height: input.hasPrice ? priceHeight : 0,
  }, artboard);
  const logoWidth = Math.round(artboard.width * 0.15);
  const logoHeight = Math.round(logoWidth * 0.48);
  const logo = clampRectToArtboard({
    x: safe.x + safe.width - logoWidth,
    y: safe.y + safe.height - logoHeight,
    width: logoWidth,
    height: logoHeight,
  }, artboard);
  return {
    safeArea: safe,
    background: { x: 0, y: 0, width: artboard.width, height: artboard.height },
    subject: clampRectToArtboard(subjectRect(input.geometryProfile, artboard), artboard),
    headline,
    supporting,
    cta,
    price,
    logo,
  };
}
