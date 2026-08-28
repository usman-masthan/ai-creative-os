export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArtboardSize {
  width: number;
  height: number;
}

export function safeAreaRect(artboard: ArtboardSize, ratio = 0.06): Rect {
  if (ratio < 0 || ratio >= 0.5) throw new Error("Safe-area ratio must be from 0 inclusive to 0.5 exclusive.");
  const x = Math.round(artboard.width * ratio);
  const y = Math.round(artboard.height * ratio);
  return {
    x,
    y,
    width: artboard.width - x * 2,
    height: artboard.height - y * 2,
  };
}

export function clampRectToArtboard(rect: Rect, artboard: ArtboardSize): Rect {
  const x = Math.max(0, Math.min(Math.round(rect.x), artboard.width));
  const y = Math.max(0, Math.min(Math.round(rect.y), artboard.height));
  const width = Math.max(0, Math.min(Math.round(rect.width), artboard.width - x));
  const height = Math.max(0, Math.min(Math.round(rect.height), artboard.height - y));
  return { x, y, width, height };
}

export function rectWithin(inner: Rect, outer: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}
