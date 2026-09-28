import type {
  BoardStatBreakdownRowVm,
  ThisTurnMetricPairVm,
  ThisTurnPresentationVm,
} from '../../client/gameSession/types';
import {
  buildBoardStatHoverSections,
  formatBoardMetricBreakdownAmount,
  formatBoardStatMetric,
} from '../layout/boardStage/boardStatPresentation';

export const MOBILE_STATUS_STAT_ORDER = [
  'saved',
  'bonus',
  'damage',
  'healing',
] as const;

export const MOBILE_POPOVER_TAP_THRESHOLD_PX = 8;

export interface MobileHudMetricPairVm {
  currentText: string;
  lastText: string;
}

export type MobileMetricKind = 'damage' | 'healing';

export interface MobileMetricBreakdownSectionVm {
  key: string;
  title: string;
  totalText: string;
  tone: MobileMetricKind;
  rows: BoardStatBreakdownRowVm[];
}

export interface MobileMetricBreakdownGroupsVm {
  primary: MobileMetricBreakdownSectionVm[];
  last: MobileMetricBreakdownSectionVm[];
}

interface PointerPosition {
  clientX: number;
  clientY: number;
}

export function buildMobileHudMetricPair(
  pair: ThisTurnMetricPairVm | null | undefined,
): MobileHudMetricPairVm {
  return {
    currentText: formatBoardStatMetric(pair?.current, 'current'),
    lastText: formatBoardStatMetric(pair?.last, 'last'),
  };
}

export function buildMobileMetricBreakdownGroups(args: {
  presentation: ThisTurnPresentationVm | null | undefined;
  side: 'me' | 'opponent';
}): MobileMetricBreakdownGroupsVm {
  const { presentation, side } = args;
  if (!presentation) {
    return { primary: [], last: [] };
  }

  const metrics = presentation[side];
  const current = (['damage', 'healing'] as const).flatMap((metricKind) => {
    const section = buildCurrentMetricSection({
      pair: metrics[metricKind],
      metricKind,
      terminalWithoutResolution: presentation.phaseKey === 'game.finished',
    });
    return section ? [section] : [];
  });
  const last = (['damage', 'healing'] as const).flatMap((metricKind) => {
    const section = buildLastMetricSection(metrics[metricKind], metricKind);
    return section ? [section] : [];
  });

  if (side === 'opponent') {
    return presentation.mobile.opponentDetail === 'last'
      ? { primary: last, last: [] }
      : { primary: current, last: [] };
  }

  return { primary: current, last };
}

export function isMobilePopoverTapGesture(
  start: PointerPosition,
  end: PointerPosition,
  thresholdPx = MOBILE_POPOVER_TAP_THRESHOLD_PX,
): boolean {
  return Math.hypot(end.clientX - start.clientX, end.clientY - start.clientY) <= thresholdPx;
}

export function formatMobileBreakdownAmount(
  row: BoardStatBreakdownRowVm,
  signlessContribution: boolean,
): string {
  return signlessContribution ? formatBoardMetricBreakdownAmount(row) : row.amountText;
}

function buildCurrentMetricSection(args: {
  pair: ThisTurnMetricPairVm;
  metricKind: MobileMetricKind;
  terminalWithoutResolution: boolean;
}): MobileMetricBreakdownSectionVm | null {
  const { pair, metricKind, terminalWithoutResolution } = args;
  const source = buildBoardStatHoverSections(pair).find(
    (section) => section.kind !== 'last_turn',
  );

  if (source) {
    const turnLabel = source.kind === 'final_turn' ? 'Final turn' : 'This turn';
    return {
      key: `${metricKind}:${source.kind}`,
      title: `${turnLabel} ${metricKind}`,
      totalText: source.totalText,
      tone: metricKind,
      rows: source.rows,
    };
  }

  if (pair.current.state === 'concealed' || terminalWithoutResolution) {
    return null;
  }

  return {
    key: `${metricKind}:this_turn_fallback`,
    title: `This turn ${metricKind}`,
    totalText: '0',
    tone: metricKind,
    rows: [],
  };
}

function buildLastMetricSection(
  pair: ThisTurnMetricPairVm,
  metricKind: MobileMetricKind,
): MobileMetricBreakdownSectionVm | null {
  const source = buildBoardStatHoverSections(pair).find(
    (section) => section.kind === 'last_turn',
  );
  if (!source) {
    return null;
  }

  return {
    key: `${metricKind}:last_turn`,
    title: `Last turn ${metricKind}`,
    totalText: source.totalText,
    tone: metricKind,
    rows: source.rows,
  };
}
