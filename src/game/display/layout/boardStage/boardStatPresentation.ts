import type {
  BoardStatBreakdownRowVm,
  ThisTurnMetricPairVm,
  ThisTurnMetricVm,
} from '../../../client/gameSession/types';

export type BoardStatMetricTone = 'damage' | 'healing';

export interface BoardStatHoverSectionVm {
  kind: 'this_turn_estimate' | 'this_turn' | 'last_turn' | 'final_turn';
  heading: 'THIS TURN' | 'LAST TURN' | 'FINAL TURN';
  showEstimateQualifier: boolean;
  totalText: string;
  rows: BoardStatBreakdownRowVm[];
}

export interface BoardStatHoverRect {
  left: number;
  right: number;
  top: number;
  height: number;
}

export interface BoardStatHoverLayout {
  left: number;
  top: number;
  placement: 'left' | 'right';
  tailOffset: number;
}

const VIEWPORT_PADDING_PX = 12;
const SIDE_OFFSET_PX = 14;
const MIN_TAIL_INSET_PX = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isAvailableMetric(
  metric: ThisTurnMetricVm | null | undefined,
): metric is Extract<ThisTurnMetricVm, { state: 'zero' | 'value' }> {
  return metric?.state === 'zero' || metric?.state === 'value';
}

function isAvailableLastMetric(
  metric: ThisTurnMetricVm | null | undefined,
): metric is Extract<ThisTurnMetricVm, { state: 'zero' | 'value' }> {
  return isAvailableMetric(metric) && metric.turnNumber > 0;
}

export function formatBoardStatMetric(
  metric: ThisTurnMetricVm | null | undefined,
  slot: 'current' | 'last',
): string {
  if (!metric || (slot === 'last' && metric.turnNumber <= 0)) {
    return '0';
  }

  switch (metric.state) {
    case 'concealed':
      return slot === 'current' ? '?' : '0';
    case 'pending':
    case 'unavailable':
      return '0';
    case 'zero':
    case 'value':
      return String(metric.total);
  }
}

export function buildBoardStatHoverSections(
  pair: ThisTurnMetricPairVm | null | undefined,
): BoardStatHoverSectionVm[] {
  if (!pair) {
    return [];
  }

  const current = pair.current;
  const sections: BoardStatHoverSectionVm[] = [];
  if (isAvailableMetric(current) && current.source === 'final_actual') {
    sections.push({
      kind: 'final_turn',
      heading: 'FINAL TURN',
      showEstimateQualifier: false,
      totalText: String(current.total),
      rows: current.rows,
    });
  } else if (isAvailableMetric(current)) {
    const isEstimate =
      current.source === 'estimated' || current.source === 'privacy_frozen';
    sections.push({
      kind: isEstimate ? 'this_turn_estimate' : 'this_turn',
      heading: 'THIS TURN',
      showEstimateQualifier: isEstimate,
      totalText: `${isEstimate ? '~' : ''}${current.total}`,
      rows: current.rows,
    });
  }

  if (isAvailableLastMetric(pair.last)) {
    sections.push({
      kind: 'last_turn',
      heading: 'LAST TURN',
      showEstimateQualifier: false,
      totalText: String(pair.last.total),
      rows: pair.last.rows,
    });
  }

  return sections;
}

export function formatBoardMetricBreakdownAmount(
  row: BoardStatBreakdownRowVm,
): string {
  return row.rowKind === 'adjustment'
    ? row.amountText
    : String(Math.abs(row.amount));
}

export function selectBoardStatHoverAnchor<T>(
  numericContent: T | null,
  fixedWidthTrigger: T,
): T {
  return numericContent ?? fixedWidthTrigger;
}

export function calculateBoardStatHoverLayout(args: {
  anchorRect: BoardStatHoverRect;
  cardWidth: number;
  cardHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  preferredPlacement: 'left' | 'right';
}): BoardStatHoverLayout {
  const {
    anchorRect,
    cardWidth,
    cardHeight,
    viewportWidth,
    viewportHeight,
    preferredPlacement,
  } = args;
  const leftSpace = anchorRect.left - SIDE_OFFSET_PX - VIEWPORT_PADDING_PX;
  const rightSpace = viewportWidth - VIEWPORT_PADDING_PX - anchorRect.right - SIDE_OFFSET_PX;
  const preferredFits = preferredPlacement === 'left'
    ? leftSpace >= cardWidth
    : rightSpace >= cardWidth;
  const oppositeFits = preferredPlacement === 'left'
    ? rightSpace >= cardWidth
    : leftSpace >= cardWidth;
  const placement = preferredFits
    ? preferredPlacement
    : oppositeFits
      ? preferredPlacement === 'left' ? 'right' : 'left'
      : leftSpace >= rightSpace ? 'left' : 'right';
  const desiredLeft = placement === 'left'
    ? anchorRect.left - SIDE_OFFSET_PX - cardWidth
    : anchorRect.right + SIDE_OFFSET_PX;
  const maxLeft = Math.max(
    VIEWPORT_PADDING_PX,
    viewportWidth - VIEWPORT_PADDING_PX - cardWidth,
  );
  const left = clamp(desiredLeft, VIEWPORT_PADDING_PX, maxLeft);
  const anchorCenterY = anchorRect.top + (anchorRect.height / 2);
  const desiredTop = anchorCenterY - (cardHeight / 2);
  const maxTop = Math.max(
    VIEWPORT_PADDING_PX,
    viewportHeight - VIEWPORT_PADDING_PX - cardHeight,
  );
  const top = clamp(desiredTop, VIEWPORT_PADDING_PX, maxTop);
  const tailMax = Math.max(MIN_TAIL_INSET_PX, cardHeight - MIN_TAIL_INSET_PX);
  const tailOffset = clamp(
    anchorCenterY - top,
    MIN_TAIL_INSET_PX,
    tailMax,
  );

  return { left, top, placement, tailOffset };
}
