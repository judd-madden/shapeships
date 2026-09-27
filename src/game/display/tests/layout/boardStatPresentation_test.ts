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
  calculateBoardStatHoverLayout,
  formatBoardStatMetric,
  formatBoardMetricBreakdownAmount,
  selectBoardStatHoverAnchor,
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
  assertEquals(formatBoardStatMetric({ state: 'pending', turnNumber: 4 }, 'current'), '0');
  assertEquals(formatBoardStatMetric({ state: 'unavailable', turnNumber: 4 }, 'current'), '0');
  assertEquals(formatBoardStatMetric(valueMetric(0, 'last_actual', 0, []), 'last'), '0');
  assertEquals(formatBoardStatMetric(null, 'current'), '0');
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
  assertEquals(
    buildBoardStatHoverSections(
      pair(valueMetric(2, 'turn_start_baseline', 4, rows)),
    )[0],
    {
      kind: 'this_turn_estimate',
      heading: 'THIS TURN',
      showEstimateQualifier: true,
      totalText: '~2',
      rows,
    },
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

Deno.test('resolved final turn keeps a genuine preceding Last section', () => {
  const sections = buildBoardStatHoverSections(pair(valueMetric(11, 'final_actual')));
  assertEquals(sections.map((section) => [section.kind, section.totalText]), [
    ['final_turn', '11'],
    ['last_turn', '3'],
  ]);
});

Deno.test('resolved turn one shows Final Turn without an invented Last section', () => {
  const sections = buildBoardStatHoverSections(pair(
    valueMetric(11, 'final_actual', 1),
    valueMetric(0, 'last_actual', 0, []),
  ));
  assertEquals(sections.map((section) => section.kind), ['final_turn']);
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

Deno.test('metric contribution rows are signless while adjustments retain meaning', () => {
  assertEquals(formatBoardMetricBreakdownAmount(rows[0]), '4');
  assertEquals(formatBoardMetricBreakdownAmount({
    rowKind: 'ship', label: 'Fighter', amount: -4, amountText: '-4',
  }), '4');
  assertEquals(formatBoardMetricBreakdownAmount({
    rowKind: 'solar_power', solarPowerId: 'SBLA', label: 'Black Hole', count: 1,
    amount: -2, amountText: '-2',
  }), '2');
  assertEquals(formatBoardMetricBreakdownAmount({
    rowKind: 'adjustment', label: 'Damage cap', amount: -2, amountText: '-2',
  }), '-2');
});

Deno.test('numeric content is selected ahead of the fixed-width trigger', () => {
  const numericContent = { id: 'numbers' };
  const fixedWidthTrigger = { id: 'button' };
  assertEquals(
    selectBoardStatHoverAnchor(numericContent, fixedWidthTrigger),
    numericContent,
  );
  assertEquals(
    selectBoardStatHoverAnchor(null, fixedWidthTrigger),
    fixedWidthTrigger,
  );
});

Deno.test('hover layout hugs numeric edges on both sides and flips when needed', () => {
  const anchorRect = { left: 500, right: 540, top: 300, height: 60 };
  assertEquals(calculateBoardStatHoverLayout({
    anchorRect, cardWidth: 240, cardHeight: 100,
    viewportWidth: 1200, viewportHeight: 800, preferredPlacement: 'left',
  }), { left: 246, top: 280, placement: 'left', tailOffset: 50 });
  assertEquals(calculateBoardStatHoverLayout({
    anchorRect, cardWidth: 240, cardHeight: 100,
    viewportWidth: 1200, viewportHeight: 800, preferredPlacement: 'right',
  }), { left: 554, top: 280, placement: 'right', tailOffset: 50 });
  assertEquals(calculateBoardStatHoverLayout({
    anchorRect: { left: 100, right: 140, top: 300, height: 60 },
    cardWidth: 240, cardHeight: 100,
    viewportWidth: 1200, viewportHeight: 800, preferredPlacement: 'left',
  }).placement, 'right');
});

Deno.test('hover layout clamps vertically and keeps its tail within the card', () => {
  assertEquals(calculateBoardStatHoverLayout({
    anchorRect: { left: 500, right: 540, top: 180, height: 20 },
    cardWidth: 240, cardHeight: 80,
    viewportWidth: 1200, viewportHeight: 200, preferredPlacement: 'left',
  }), { left: 246, top: 108, placement: 'left', tailOffset: 62 });
});
