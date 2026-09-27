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
    return '—';
  }

  switch (metric.state) {
    case 'concealed':
      return '?';
    case 'pending':
      return '…';
    case 'unavailable':
      return '—';
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
  if (isAvailableMetric(current) && current.source === 'final_actual') {
    return [{
      kind: 'final_turn',
      heading: 'FINAL TURN',
      showEstimateQualifier: false,
      totalText: String(current.total),
      rows: current.rows,
    }];
  }

  const sections: BoardStatHoverSectionVm[] = [];
  if (isAvailableMetric(current)) {
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
