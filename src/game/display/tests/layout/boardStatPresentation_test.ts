declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import type {
  BoardStatBreakdownRowVm,
  ThisTurnMetricPairVm,
  ThisTurnMetricVm,
} from '../../../client/gameSession/types';
import {
  buildBoardStatHoverSections,
  formatBoardStatMetric,
} from '../../layout/boardStage/boardStatPresentation';

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`values differ\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

const rows: BoardStatBreakdownRowVm[] = [{
  rowKind: 'ship',
  label: 'Fighter',
  count: 2,
  amount: 4,
  amountText: '+4',
}];

function valueMetric(
  total: number,
  source: Extract<ThisTurnMetricVm, { total: number }>['source'],
  turnNumber = 4,
  metricRows: BoardStatBreakdownRowVm[] = rows,
): ThisTurnMetricVm {
  return {
    state: total === 0 ? 'zero' : 'value',
    turnNumber,
    source,
    total,
    rows: metricRows,
  };
}

function pair(
  current: ThisTurnMetricVm,
  last: ThisTurnMetricVm = valueMetric(3, 'last_actual', 3),
): ThisTurnMetricPairVm {
  return { current, last };
}

Deno.test('resting board metric formatting never adds estimate decoration', () => {
  assertEquals(formatBoardStatMetric(valueMetric(8, 'estimated'), 'current'), '8');
  assertEquals(formatBoardStatMetric(valueMetric(-1234, 'privacy_frozen'), 'current'), '-1234');
  assertEquals(formatBoardStatMetric({ state: 'concealed', turnNumber: 4 }, 'current'), '?');
  assertEquals(formatBoardStatMetric({ state: 'pending', turnNumber: 4 }, 'current'), '…');
  assertEquals(formatBoardStatMetric({ state: 'unavailable', turnNumber: 4 }, 'current'), '—');
  assertEquals(formatBoardStatMetric(valueMetric(0, 'last_actual', 0, []), 'last'), '—');
});

Deno.test('estimated and privacy-frozen metrics use estimate hover totals', () => {
  assertEquals(
    buildBoardStatHoverSections(pair(valueMetric(8, 'estimated'))).map((section) => ({
      kind: section.kind,
      totalText: section.totalText,
      estimate: section.showEstimateQualifier,
    })),
    [
      { kind: 'this_turn_estimate', totalText: '~8', estimate: true },
      { kind: 'last_turn', totalText: '3', estimate: false },
    ],
  );
  assertEquals(
    buildBoardStatHoverSections(pair(valueMetric(5, 'privacy_frozen')))[0]?.totalText,
    '~5',
  );
});

Deno.test('valid zero remains an available hover section without rows', () => {
  const sections = buildBoardStatHoverSections(pair(
    valueMetric(0, 'estimated', 4, []),
    valueMetric(0, 'last_actual', 3, []),
  ));
  assertEquals(sections.map((section) => [section.totalText, section.rows.length]), [
    ['~0', 0],
    ['0', 0],
  ]);
});

Deno.test('concealed opponent before Reveal exposes only genuine Last', () => {
  const sections = buildBoardStatHoverSections(pair(
    { state: 'concealed', turnNumber: 4 },
    valueMetric(6, 'last_actual', 3),
  ));
  assertEquals(sections.map((section) => section.kind), ['last_turn']);
});

Deno.test('resolution hold keeps actual current and preceding Last', () => {
  const sections = buildBoardStatHoverSections(pair(valueMetric(9, 'held_actual')));
  assertEquals(sections.map((section) => [section.kind, section.totalText]), [
    ['this_turn', '9'],
    ['last_turn', '3'],
  ]);
});

Deno.test('rollover presents the new estimate with resolved prior turn in Last', () => {
  const sections = buildBoardStatHoverSections(pair(
    valueMetric(2, 'estimated', 5),
    valueMetric(9, 'last_actual', 4),
  ));
  assertEquals(sections.map((section) => [section.kind, section.totalText]), [
    ['this_turn_estimate', '~2'],
    ['last_turn', '9'],
  ]);
});

Deno.test('resolved final turn replaces current and Last with Final Turn', () => {
  const sections = buildBoardStatHoverSections(pair(valueMetric(11, 'final_actual')));
  assertEquals(sections.map((section) => [section.kind, section.totalText]), [
    ['final_turn', '11'],
  ]);
});

Deno.test('unresolved terminal completion never fabricates a Final Turn', () => {
  const sections = buildBoardStatHoverSections(pair(
    { state: 'unavailable', turnNumber: 4 },
    valueMetric(3, 'last_actual', 3),
  ));
  assertEquals(sections.map((section) => section.kind), ['last_turn']);
  assertEquals(
    buildBoardStatHoverSections(pair(
      { state: 'unavailable', turnNumber: 1 },
      valueMetric(0, 'last_actual', 0, []),
    )),
    [],
  );
});
