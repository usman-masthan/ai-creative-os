export interface GuideRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SmartGuide =
  | {
      kind: "alignment";
      axis: "x" | "y";
      position: number;
      start: number;
      end: number;
      movingAnchor: "start" | "center" | "end";
      targetId: string;
    }
  | {
      kind: "spacing";
      axis: "horizontal" | "vertical";
      gap: number;
      segments: Array<{ start: number; end: number; cross: number }>;
      neighborIds: [string, string];
    };

export interface SmartMoveSnapResult {
  deltaX: number;
  deltaY: number;
  guides: SmartGuide[];
}

interface AxisCandidate {
  adjustment: number;
  position: number;
  movingAnchor: "start" | "center" | "end";
  targetId: string;
  start: number;
  end: number;
}

function anchors(start: number, size: number): Array<{ value: number; anchor: "start" | "center" | "end" }> {
  return [
    { value: start, anchor: "start" },
    { value: start + size / 2, anchor: "center" },
    { value: start + size, anchor: "end" },
  ];
}

function nearestAlignment(
  moving: GuideRect,
  others: GuideRect[],
  axis: "x" | "y",
  tolerance: number,
): AxisCandidate | undefined {
  const movingStart = axis === "x" ? moving.x : moving.y;
  const movingSize = axis === "x" ? moving.width : moving.height;
  const movingCrossStart = axis === "x" ? moving.y : moving.x;
  const movingCrossEnd = movingCrossStart + (axis === "x" ? moving.height : moving.width);
  let best: AxisCandidate | undefined;
  for (const other of others) {
    const otherStart = axis === "x" ? other.x : other.y;
    const otherSize = axis === "x" ? other.width : other.height;
    const otherCrossStart = axis === "x" ? other.y : other.x;
    const otherCrossEnd = otherCrossStart + (axis === "x" ? other.height : other.width);
    for (const movingAnchor of anchors(movingStart, movingSize)) {
      for (const targetAnchor of anchors(otherStart, otherSize)) {
        const adjustment = targetAnchor.value - movingAnchor.value;
        if (Math.abs(adjustment) > tolerance) continue;
        if (!best || Math.abs(adjustment) < Math.abs(best.adjustment)) {
          best = {
            adjustment,
            position: targetAnchor.value,
            movingAnchor: movingAnchor.anchor,
            targetId: other.id,
            start: Math.min(movingCrossStart, otherCrossStart),
            end: Math.max(movingCrossEnd, otherCrossEnd),
          };
        }
      }
    }
  }
  return best;
}

function horizontalSpacing(moving: GuideRect, others: GuideRect[], tolerance: number): { adjustment: number; guide: SmartGuide } | undefined {
  const leftCandidates = others.filter((other) => other.x + other.width <= moving.x + tolerance);
  const rightCandidates = others.filter((other) => other.x >= moving.x + moving.width - tolerance);
  if (!leftCandidates.length || !rightCandidates.length) return undefined;
  const left = leftCandidates.reduce((best, item) => item.x + item.width > best.x + best.width ? item : best);
  const right = rightCandidates.reduce((best, item) => item.x < best.x ? item : best);
  const available = right.x - (left.x + left.width) - moving.width;
  if (available < 0) return undefined;
  const gap = available / 2;
  const targetX = left.x + left.width + gap;
  const adjustment = targetX - moving.x;
  if (Math.abs(adjustment) > tolerance) return undefined;
  const cross = moving.y + moving.height / 2;
  return {
    adjustment,
    guide: {
      kind: "spacing",
      axis: "horizontal",
      gap,
      segments: [
        { start: left.x + left.width, end: targetX, cross },
        { start: targetX + moving.width, end: right.x, cross },
      ],
      neighborIds: [left.id, right.id],
    },
  };
}

function verticalSpacing(moving: GuideRect, others: GuideRect[], tolerance: number): { adjustment: number; guide: SmartGuide } | undefined {
  const topCandidates = others.filter((other) => other.y + other.height <= moving.y + tolerance);
  const bottomCandidates = others.filter((other) => other.y >= moving.y + moving.height - tolerance);
  if (!topCandidates.length || !bottomCandidates.length) return undefined;
  const top = topCandidates.reduce((best, item) => item.y + item.height > best.y + best.height ? item : best);
  const bottom = bottomCandidates.reduce((best, item) => item.y < best.y ? item : best);
  const available = bottom.y - (top.y + top.height) - moving.height;
  if (available < 0) return undefined;
  const gap = available / 2;
  const targetY = top.y + top.height + gap;
  const adjustment = targetY - moving.y;
  if (Math.abs(adjustment) > tolerance) return undefined;
  const cross = moving.x + moving.width / 2;
  return {
    adjustment,
    guide: {
      kind: "spacing",
      axis: "vertical",
      gap,
      segments: [
        { start: top.y + top.height, end: targetY, cross },
        { start: targetY + moving.height, end: bottom.y, cross },
      ],
      neighborIds: [top.id, bottom.id],
    },
  };
}

export function computeSmartMoveSnap(input: {
  moving: GuideRect;
  others: GuideRect[];
  deltaX: number;
  deltaY: number;
  tolerance: number;
}): SmartMoveSnapResult {
  if (!Number.isFinite(input.deltaX) || !Number.isFinite(input.deltaY) || !Number.isFinite(input.tolerance) || input.tolerance < 0) {
    throw new Error("Smart-guide movement values must be finite and tolerance must be non-negative.");
  }
  const moved: GuideRect = {
    ...input.moving,
    x: input.moving.x + input.deltaX,
    y: input.moving.y + input.deltaY,
  };
  let deltaX = input.deltaX;
  let deltaY = input.deltaY;
  const guides: SmartGuide[] = [];

  const spacingX = horizontalSpacing(moved, input.others, input.tolerance);
  const alignX = nearestAlignment(moved, input.others, "x", input.tolerance);
  const xAdjustment = spacingX && (!alignX || Math.abs(spacingX.adjustment) <= Math.abs(alignX.adjustment))
    ? spacingX.adjustment
    : alignX?.adjustment;
  if (xAdjustment !== undefined) {
    deltaX += xAdjustment;
    if (spacingX && xAdjustment === spacingX.adjustment) guides.push(spacingX.guide);
    else if (alignX) guides.push({ kind: "alignment", axis: "x", position: alignX.position, start: alignX.start, end: alignX.end, movingAnchor: alignX.movingAnchor, targetId: alignX.targetId });
  }

  const movedAfterX = { ...moved, x: input.moving.x + deltaX };
  const spacingY = verticalSpacing(movedAfterX, input.others, input.tolerance);
  const alignY = nearestAlignment(movedAfterX, input.others, "y", input.tolerance);
  const yAdjustment = spacingY && (!alignY || Math.abs(spacingY.adjustment) <= Math.abs(alignY.adjustment))
    ? spacingY.adjustment
    : alignY?.adjustment;
  if (yAdjustment !== undefined) {
    deltaY += yAdjustment;
    if (spacingY && yAdjustment === spacingY.adjustment) guides.push(spacingY.guide);
    else if (alignY) guides.push({ kind: "alignment", axis: "y", position: alignY.position, start: alignY.start, end: alignY.end, movingAnchor: alignY.movingAnchor, targetId: alignY.targetId });
  }

  return { deltaX, deltaY, guides };
}
