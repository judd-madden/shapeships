import type {
  BoardStatBreakdownRowVm,
  ThisTurnMetricPairVm,
  ThisTurnPresentationVm,
} from '../../client/gameSession/types';
import {
  buildCurrentBoardCombatBreakdown,
  getAffectedHealthMetrics,
  type BoardCombatBreakdownVm,
  type BoardCombatColumnVm,
  formatBoardMetricBreakdownAmount,
  formatBoardStatMetric,
} from '../layout/boardStage/boardStatPresentation';
import { findResolvedBoardCombatMetric } from '../layout/boardStage/healthBreakdownPresentation';

export const MOBILE_STATUS_STAT_ORDER = [
  'damage',
  'healing',
  'saved',
  'bonus',
] as const;

export const MOBILE_POPOVER_TAP_THRESHOLD_PX = 8;

export type MobilePopoverPeriod = 'current' | 'last';

export interface MobilePopoverPeriodSelection {
  gameId: string;
  turnNumber: number;
  period: MobilePopoverPeriod;
}

export function getMobilePopoverPeriodOnOpen(
  selection: MobilePopoverPeriodSelection,
  gameId: string,
  turnNumber: number,
): MobilePopoverPeriodSelection {
  return selection.gameId === gameId && selection.turnNumber === turnNumber
    ? selection
    : { gameId, turnNumber, period: 'current' };
}

export function getMobilePopoverTailLeft(
  boardCenterX: number,
  cardLeft: number,
  cardWidth: number,
): number {
  return Math.min(Math.max(boardCenterX - cardLeft - 6, 18), Math.max(18, cardWidth - 30));
}

export interface MobileHudMetricPairVm {
  currentText: string;
  lastText: string;
}

export type MobileMetricKind = 'damage' | 'healing';

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

export function buildMobileHealthPoolMetrics(
  presentation: ThisTurnPresentationVm | null | undefined,
  side: 'me' | 'opponent',
): Record<MobileMetricKind, MobileHudMetricPairVm> {
  const damageSide = side === 'me' ? 'opponent' : 'me';
  // Damage remains damage dealt in the VM; only its display row changes.
  return {
    damage: buildMobileHudMetricPair(presentation?.[damageSide].damage),
    healing: buildMobileHudMetricPair(presentation?.[side].healing),
  };
}

export function buildMobileCombatBreakdowns(args: {
  presentation: ThisTurnPresentationVm | null;
  side: 'my' | 'opponent';
  damageLabel: string;
  healingLabel: string;
}): { current: BoardCombatBreakdownVm; last: BoardCombatBreakdownVm } {
  const current = buildCurrentBoardCombatBreakdown(args);
  const metrics = getAffectedHealthMetrics(args.presentation, args.side);
  const turnNumber = (args.presentation?.turnNumber ?? 1) - 1;
  const column = (tone: MobileMetricKind, label: string): BoardCombatColumnVm => {
    const last = metrics[tone]?.last;
    const totalText = formatBoardStatMetric(last, 'last');
    // Only the genuine preceding slot is eligible; never borrow held/final current rows.
    const metric = turnNumber > 0 && last &&
      (last.state === 'value' || last.state === 'zero') && last.source === 'last_actual'
      ? findResolvedBoardCombatMetric({
          candidates: [last], turnNumber, totalText, heading: 'LAST TURN',
        })
      : undefined;
    return {
      label,
      tone,
      totalText: metric ? totalText : last?.state === 'concealed' ? '?' : '0',
      section: metric ? {
        kind: 'last_turn', heading: 'LAST TURN', showEstimateQualifier: false,
        totalText, rows: metric.rows,
      } : null,
      ...(!metric ? {
        unavailableText: last?.state === 'concealed'
          ? 'Concealed' as const : 'Breakdown unavailable' as const,
      } : {}),
    };
  };
  return {
    current,
    last: {
      heading: 'LAST TURN',
      damage: column('damage', args.damageLabel),
      healing: column('healing', args.healingLabel),
    },
  };
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
