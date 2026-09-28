declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import type {
  BoardStatBreakdownRowVm,
  ThisTurnMetricPairVm,
  ThisTurnMetricVm,
  ThisTurnPlayerMetricsVm,
  ThisTurnPresentationVm,
} from '../../../client/gameSession/types';
import {
  buildMobileHudMetricPair,
  buildMobileMetricBreakdownGroups,
  formatMobileBreakdownAmount,
  isMobilePopoverTapGesture,
  MOBILE_STATUS_STAT_ORDER,
} from '../../mobile/mobileStatPresentation';

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`values differ\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

const shipRow: BoardStatBreakdownRowVm = {
  rowKind: 'ship',
  label: 'Fighter',
  count: 2,
  amount: 4,
  amountText: '+4',
};

function availableMetric(
  total: number,
  source: Extract<ThisTurnMetricVm, { total: number }>['source'],
  turnNumber = 4,
  rows: BoardStatBreakdownRowVm[] = [shipRow],
): ThisTurnMetricVm {
  return {
    state: total === 0 ? 'zero' : 'value',
    turnNumber,
    source,
    total,
    rows,
  };
}

function pair(
  current: ThisTurnMetricVm,
  last: ThisTurnMetricVm = availableMetric(3, 'last_actual', 3),
): ThisTurnMetricPairVm {
  return { current, last };
}

function playerMetrics(
  damage: ThisTurnMetricPairVm,
  healing: ThisTurnMetricPairVm = pair(
    availableMetric(2, 'estimated'),
    availableMetric(1, 'last_actual', 3),
  ),
): ThisTurnPlayerMetricsVm {
  return { playerId: 'p1', damage, healing };
}

function presentation(overrides: Partial<ThisTurnPresentationVm> = {}): ThisTurnPresentationVm {
  const metrics = playerMetrics(pair(availableMetric(8, 'estimated')));
  return {
    turnNumber: 4,
    phaseKey: 'build.drawing',
    liveLog: null,
    me: metrics,
    opponent: { ...metrics, playerId: 'p2' },
    archiveHandoff: null,
    mobile: { pairKey: 'game-1::4', opponentDetail: 'last' },
    ...overrides,
  };
}

Deno.test('mobile HUD fixes stat order and uses desktop value-state formatting', () => {
  assertEquals(MOBILE_STATUS_STAT_ORDER, ['saved', 'bonus', 'damage', 'healing']);
  assertEquals(buildMobileHudMetricPair(pair(availableMetric(8, 'estimated'))), {
    currentText: '8',
    lastText: '3',
  });
  assertEquals(buildMobileHudMetricPair(pair({ state: 'concealed', turnNumber: 4 })), {
    currentText: '?',
    lastText: '3',
  });
  assertEquals(buildMobileHudMetricPair(pair({ state: 'pending', turnNumber: 4 })), {
    currentText: '0',
    lastText: '3',
  });
  assertEquals(buildMobileHudMetricPair(pair({ state: 'unavailable', turnNumber: 4 })), {
    currentText: '0',
    lastText: '3',
  });
  assertEquals(buildMobileHudMetricPair(pair(availableMetric(6, 'privacy_frozen', 4, []))), {
    currentText: '6',
    lastText: '3',
  });
  assertEquals(buildMobileHudMetricPair(null), { currentText: '0', lastText: '0' });
});

Deno.test('own popover pairs estimated current with genuine Last and preserves calculated zero rows', () => {
  const vm = presentation({
    me: playerMetrics(
      pair(availableMetric(0, 'estimated', 4, [shipRow])),
      pair(
        availableMetric(5, 'privacy_frozen'),
        availableMetric(1, 'last_actual', 3),
      ),
    ),
  });
  const groups = buildMobileMetricBreakdownGroups({ presentation: vm, side: 'me' });
  assertEquals(groups.primary.map((section) => [section.title, section.totalText, section.rows.length]), [
    ['This turn damage', '~0', 1],
    ['This turn healing', '~5', 1],
  ]);
  assertEquals(groups.last.map((section) => [section.title, section.totalText]), [
    ['Last turn damage', '3'],
    ['Last turn healing', '1'],
  ]);
});

Deno.test('active unavailable metrics use neutral zero fallbacks without rows', () => {
  const unavailable = pair({ state: 'unavailable', turnNumber: 4 });
  const vm = presentation({ me: playerMetrics(unavailable, unavailable) });
  const groups = buildMobileMetricBreakdownGroups({ presentation: vm, side: 'me' });
  assertEquals(groups.primary.map((section) => [section.totalText, section.rows.length]), [
    ['0', 0],
    ['0', 0],
  ]);
});

Deno.test('opponent detail swaps from genuine Last before Reveal to current only after Reveal', () => {
  const before = presentation();
  assertEquals(
    buildMobileMetricBreakdownGroups({ presentation: before, side: 'opponent' }),
    {
      primary: [
        { key: 'damage:last_turn', title: 'Last turn damage', totalText: '3', tone: 'damage', rows: [shipRow] },
        { key: 'healing:last_turn', title: 'Last turn healing', totalText: '1', tone: 'healing', rows: [shipRow] },
      ],
      last: [],
    },
  );

  const after = presentation({
    phaseKey: 'build.reveal',
    mobile: { pairKey: 'game-1::4', opponentDetail: 'this_turn' },
  });
  const groups = buildMobileMetricBreakdownGroups({ presentation: after, side: 'opponent' });
  assertEquals(groups.primary.map((section) => [section.title, section.totalText]), [
    ['This turn damage', '~8'],
    ['This turn healing', '~2'],
  ]);
  assertEquals(groups.last, []);
});

Deno.test('spectator concealment exposes no current detail before Reveal', () => {
  const concealedMetrics = playerMetrics(
    pair({ state: 'concealed', turnNumber: 4 }),
    pair({ state: 'concealed', turnNumber: 4 }),
  );
  const vm = presentation({ me: concealedMetrics, opponent: concealedMetrics });
  const own = buildMobileMetricBreakdownGroups({ presentation: vm, side: 'me' });
  const opponent = buildMobileMetricBreakdownGroups({ presentation: vm, side: 'opponent' });
  assertEquals(own.primary, []);
  assertEquals(own.last.map((section) => section.title), [
    'Last turn damage',
    'Last turn healing',
  ]);
  assertEquals(opponent.primary.map((section) => section.title), [
    'Last turn damage',
    'Last turn healing',
  ]);
});

Deno.test('held and final actuals are plain, with Final retaining only a genuine preceding Last', () => {
  const heldMetrics = playerMetrics(pair(availableMetric(9, 'held_actual')));
  const held = presentation({ me: heldMetrics });
  assertEquals(
    buildMobileMetricBreakdownGroups({ presentation: held, side: 'me' }).primary[0]?.totalText,
    '9',
  );

  const finalMetrics = playerMetrics(pair(availableMetric(11, 'final_actual')));
  const final = presentation({ phaseKey: 'game.finished', me: finalMetrics });
  const finalGroups = buildMobileMetricBreakdownGroups({ presentation: final, side: 'me' });
  assertEquals(finalGroups.primary[0]?.title, 'Final turn damage');
  assertEquals(finalGroups.primary[0]?.totalText, '11');
  assertEquals(finalGroups.last[0]?.title, 'Last turn damage');

  const turnOnePair = pair(
    availableMetric(11, 'final_actual', 1),
    availableMetric(0, 'last_actual', 0, []),
  );
  const turnOneMetrics = playerMetrics(turnOnePair, turnOnePair);
  const turnOne = presentation({ turnNumber: 1, phaseKey: 'game.finished', me: turnOneMetrics });
  assertEquals(
    buildMobileMetricBreakdownGroups({ presentation: turnOne, side: 'me' }).last,
    [],
  );
});

Deno.test('unresolved terminal completion never fabricates Final Turn sections', () => {
  const unavailable = pair(
    { state: 'unavailable', turnNumber: 4 },
    availableMetric(3, 'last_actual', 3),
  );
  const vm = presentation({
    phaseKey: 'game.finished',
    me: playerMetrics(unavailable, unavailable),
  });
  const groups = buildMobileMetricBreakdownGroups({ presentation: vm, side: 'me' });
  assertEquals(groups.primary, []);
  assertEquals(groups.last.map((section) => section.title), [
    'Last turn damage',
    'Last turn healing',
  ]);
});

Deno.test('mobile row formatting removes contribution signs but preserves adjustments and Bonus text', () => {
  assertEquals(formatMobileBreakdownAmount(shipRow, true), '4');
  assertEquals(formatMobileBreakdownAmount({
    rowKind: 'solar_power',
    solarPowerId: 'SBLA',
    label: 'Black Hole',
    count: 1,
    amount: -2,
    amountText: '-2',
  }, true), '2');
  assertEquals(formatMobileBreakdownAmount({
    rowKind: 'adjustment',
    label: 'Damage cap',
    amount: -2,
    amountText: '-2',
  }, true), '-2');
  assertEquals(formatMobileBreakdownAmount(shipRow, false), '+4');
});

Deno.test('popover tap threshold distinguishes taps from card scrolling', () => {
  const start = { clientX: 100, clientY: 200 };
  assertEquals(isMobilePopoverTapGesture(start, { clientX: 104, clientY: 206 }), true);
  assertEquals(isMobilePopoverTapGesture(start, { clientX: 100, clientY: 208 }), true);
  assertEquals(isMobilePopoverTapGesture(start, { clientX: 100, clientY: 209 }), false);
  assertEquals(isMobilePopoverTapGesture(start, { clientX: 100, clientY: 240 }), false);
});
