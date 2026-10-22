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
  buildMobileHealthPoolMetrics,
  buildMobileHudMetricPair,
  buildMobileCombatBreakdowns,
  getMobilePopoverPeriodOnOpen,
  getMobilePopoverTailLeft,
  formatMobileBreakdownAmount,
  isMobilePopoverTapGesture,
  MOBILE_STATUS_STAT_ORDER,
} from '../../mobile/mobileStatPresentation';
import { getBoardCombatHeadingPresentation } from '../../layout/boardStage/boardStatPresentation';
import { findResolvedBoardCombatMetric } from '../../layout/boardStage/healthBreakdownPresentation';
import {
  createTurnStartStatPresentationState,
  getTurnStartStatOrientationKey,
  syncTurnStartStatPresentation,
} from '../../../client/gameSession/clienteffects/turnStartPresentationGates';

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
  estimateMode?: Extract<ThisTurnMetricVm, { total: number }>['estimateMode'],
): ThisTurnMetricVm {
  return {
    state: total === 0 ? 'zero' : 'value',
    turnNumber,
    source,
    total,
    rows,
    ...(estimateMode ? { estimateMode } : {}),
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

Deno.test('mobile HUD and popovers show resolved actuals through next-turn dice settlement', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const prior = presentation();
  const resolvedMetrics = playerMetrics(
    pair(availableMetric(14, 'held_actual', 4, [{
      rowKind: 'ship', label: 'Centaur charge', count: 1, amount: 14, amountText: '+14',
    }]), availableMetric(3, 'last_actual', 3)),
    pair(availableMetric(6, 'held_actual', 4), availableMetric(1, 'last_actual', 3)),
  );
  const resolved = presentation({
    me: resolvedMetrics,
    opponent: { ...resolvedMetrics, playerId: 'p2' },
    mobile: { pairKey: 'game-1::4::held', opponentDetail: 'this_turn' },
  });
  const nextMetrics = playerMetrics(
    pair(availableMetric(12, 'estimated', 5), availableMetric(9, 'last_actual', 4)),
    pair(availableMetric(7, 'estimated', 5), availableMetric(4, 'last_actual', 4)),
  );
  const next = presentation({
    turnNumber: 5,
    me: nextMetrics,
    opponent: { ...nextMetrics, playerId: 'p2' },
    mobile: { pairKey: 'game-1::5', opponentDetail: 'this_turn' },
  });
  let state = createTurnStartStatPresentationState({
    gameId: 'game-1', orientationKey, turnNumber: 4,
    presentation: prior, firstTurnRollPresentationActive: false,
  });
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: resolved, settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: 4,
  });

  assertEquals(buildMobileHudMetricPair(state.presented?.me.damage), {
    currentText: '14', lastText: '3',
  });
  assertEquals(buildMobileHealthPoolMetrics(state.presented, 'opponent'), {
    damage: { currentText: '14', lastText: '3' },
    healing: { currentText: '6', lastText: '1' },
  });
  assertEquals(
    combat(state.presented, 'opponent').current.damage.totalText,
    '14',
  );

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: next, settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: null,
  });
  assertEquals(buildMobileHudMetricPair(state.presented?.me.damage), {
    currentText: '14', lastText: '3',
  });
  assertEquals(buildMobileHealthPoolMetrics(state.presented, 'opponent').damage, {
    currentText: '14', lastText: '3',
  });
  assertEquals(
    combat(state.presented, 'opponent').current.damage.section?.rows.map((row) => row.label),
    ['Centaur charge'],
  );

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: next, settledTurnNumber: 5,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: null,
  });
  assertEquals(buildMobileHudMetricPair(state.presented?.me.damage), {
    currentText: '12', lastText: '9',
  });
  assertEquals(buildMobileHealthPoolMetrics(state.presented, 'opponent'), {
    damage: { currentText: '12', lastText: '9' },
    healing: { currentText: '7', lastText: '4' },
  });
  assertEquals(
    [
      combat(state.presented, 'opponent').current.damage.totalText,
      combat(state.presented, 'opponent').current.healing.totalText,
    ],
    ['~12', '~7'],
  );
});

Deno.test('mobile HUD fixes stat order and uses desktop value-state formatting', () => {
  assertEquals(MOBILE_STATUS_STAT_ORDER, ['damage', 'healing', 'saved', 'bonus']);
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

Deno.test('mobile health pools pair incoming damage with own healing in both periods', () => {
  const me = playerMetrics(
    pair(availableMetric(11, 'estimated'), availableMetric(7, 'last_actual', 3)),
    pair(availableMetric(5, 'estimated'), availableMetric(2, 'last_actual', 3)),
  );
  const opponent = {
    ...playerMetrics(
      pair(availableMetric(19, 'privacy_frozen'), availableMetric(13, 'last_actual', 3)),
      pair(availableMetric(3, 'privacy_frozen'), availableMetric(1, 'last_actual', 3)),
    ),
    playerId: 'p2',
  };
  const vm = presentation({ me, opponent });
  const original = JSON.stringify(vm);

  assertEquals(buildMobileHealthPoolMetrics(vm, 'opponent'), {
    damage: { currentText: '11', lastText: '7' },
    healing: { currentText: '3', lastText: '1' },
  });
  assertEquals(buildMobileHealthPoolMetrics(vm, 'me'), {
    damage: { currentText: '19', lastText: '13' },
    healing: { currentText: '5', lastText: '2' },
  });
  // Already-oriented inputs also cover the other player/spectator seat order.
  const reversed = presentation({ me: opponent, opponent: me });
  assertEquals(
    buildMobileHealthPoolMetrics(reversed, 'me'),
    buildMobileHealthPoolMetrics(vm, 'opponent'),
  );
  assertEquals(
    buildMobileHealthPoolMetrics(reversed, 'opponent'),
    buildMobileHealthPoolMetrics(vm, 'me'),
  );
  assertEquals(JSON.stringify(vm), original);
});

Deno.test('mobile health-pool mapping retains concealment on the contributing side', () => {
  const concealed = pair({ state: 'concealed', turnNumber: 4 });
  const vm = presentation({
    me: playerMetrics(pair(availableMetric(8, 'estimated'))),
    opponent: { ...playerMetrics(concealed, concealed), playerId: 'p2' },
  });
  assertEquals(buildMobileHealthPoolMetrics(vm, 'me'), {
    damage: { currentText: '?', lastText: '3' },
    healing: { currentText: '2', lastText: '1' },
  });
  assertEquals(buildMobileHealthPoolMetrics(vm, 'opponent'), {
    damage: { currentText: '8', lastText: '3' },
    healing: { currentText: '?', lastText: '3' },
  });
  assertEquals(buildMobileHealthPoolMetrics(
    presentation({ me: playerMetrics(concealed, concealed), opponent: playerMetrics(concealed, concealed) }),
    'opponent',
  ), {
    damage: { currentText: '?', lastText: '3' },
    healing: { currentText: '?', lastText: '3' },
  });
});

Deno.test('mobile health-pool mapping preserves zero, unavailable and absent inputs', () => {
  const vm = presentation({
    me: playerMetrics(pair(availableMetric(0, 'estimated', 4, []))),
    opponent: playerMetrics(
      pair({ state: 'unavailable', turnNumber: 4 }),
      pair({ state: 'pending', turnNumber: 4 }),
    ),
  });
  assertEquals(buildMobileHealthPoolMetrics(vm, 'opponent'), {
    damage: { currentText: '0', lastText: '3' },
    healing: { currentText: '0', lastText: '3' },
  });
  assertEquals(buildMobileHealthPoolMetrics(vm, 'me').damage, {
    currentText: '0', lastText: '3',
  });
  for (const missing of [null, undefined]) {
    assertEquals(buildMobileHealthPoolMetrics(missing, 'me'), {
      damage: { currentText: '0', lastText: '0' },
      healing: { currentText: '0', lastText: '0' },
    });
  }
});

Deno.test('mobile health-pool mapping retains final values and genuine previous totals', () => {
  const vm = presentation({
    phaseKey: 'game.finished',
    me: playerMetrics(
      pair(availableMetric(21, 'final_actual'), availableMetric(8, 'last_actual', 3)),
      pair(availableMetric(4, 'final_actual'), availableMetric(2, 'last_actual', 3)),
    ),
    opponent: playerMetrics(
      pair(availableMetric(17, 'final_actual'), availableMetric(9, 'last_actual', 3)),
      pair(availableMetric(6, 'final_actual'), availableMetric(1, 'last_actual', 3)),
    ),
  });
  assertEquals(buildMobileHealthPoolMetrics(vm, 'opponent'), {
    damage: { currentText: '21', lastText: '8' },
    healing: { currentText: '6', lastText: '1' },
  });
  assertEquals(buildMobileHealthPoolMetrics(vm, 'me'), {
    damage: { currentText: '17', lastText: '9' },
    healing: { currentText: '4', lastText: '2' },
  });
});

Deno.test('mobile HUD and breakdown retain public Charge uncertainty markers', () => {
  const uncertain = {
    ...availableMetric(13, 'privacy_frozen'),
    chargeDeclarationUncertain: true,
  } as ThisTurnMetricVm;
  const vm = presentation();
  vm.opponent.damage.current = uncertain;
  vm.mobile.opponentDetail = 'this_turn';
  assertEquals(buildMobileHudMetricPair(vm.opponent.damage).currentText, '13?');
  assertEquals(buildMobileHealthPoolMetrics(vm, 'me').damage.currentText, '13?');
  assertEquals(
    combat(vm, 'my').current.damage.totalText,
    '~13?',
  );
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


function combat(vm: ThisTurnPresentationVm | null, side: 'my' | 'opponent' = 'my') {
  return buildMobileCombatBreakdowns({
    presentation: vm, side, damageLabel: side === 'my' ? 'Opponent Damage' : 'Your Damage',
    healingLabel: side === 'my' ? 'Your Healing' : 'Opponent Healing',
  });
}

Deno.test('shared period survives reopening and resets on another turn or game', () => {
  const selected = { gameId: 'one', turnNumber: 4, period: 'last' as const };
  assertEquals(getMobilePopoverPeriodOnOpen(selected, 'one', 4), selected);
  assertEquals(getMobilePopoverPeriodOnOpen(selected, 'one', 5), {
    gameId: 'one', turnNumber: 5, period: 'current',
  });
  assertEquals(getMobilePopoverPeriodOnOpen(selected, 'two', 4), {
    gameId: 'two', turnNumber: 4, period: 'current',
  });
  // Input identity is retained on reopen; no period change is scheduled while open.
  assertEquals(getMobilePopoverPeriodOnOpen(selected, 'one', 4) === selected, true);
});

Deno.test('both cards use current contributions instead of automatic opponent history', () => {
  const vm = presentation({
    me: playerMetrics(pair(availableMetric(11, 'estimated'))),
    opponent: playerMetrics(pair(availableMetric(19, 'privacy_frozen')),
      pair(availableMetric(5, 'privacy_frozen'))),
  });
  assertEquals(vm.mobile.opponentDetail, 'last');
  const top = combat(vm, 'opponent');
  const bottom = combat(vm);
  assertEquals([top.current.damage.totalText, top.current.healing.totalText], ['~11', '~5']);
  assertEquals([bottom.current.damage.totalText, bottom.current.healing.totalText], ['~19', '~2']);
  assertEquals([top.last.damage.totalText, bottom.last.damage.totalText], ['3', '3']);
});

Deno.test('estimate headings preserve Autocast inputs, zeroes and uncertainty without special wording', () => {
  for (const source of ['estimated', 'turn_start_baseline', 'privacy_frozen', 'held_actual', 'final_actual'] as const) {
    const vm = presentation();
    vm.opponent.damage.current = {
      ...availableMetric(13, source, 4, [shipRow], 'with_autocast'),
      chargeDeclarationUncertain: true,
    } as ThisTurnMetricVm;
    vm.me.healing.current = availableMetric(0, source, 4, []);
    const card = combat(vm).current;
    assertEquals(getBoardCombatHeadingPresentation(card), {
      heading: source === 'final_actual' ? 'FINAL TURN' : 'THIS TURN',
      qualifier: source === 'held_actual' || source === 'final_actual' ? null : 'ESTIMATE',
    });
    assertEquals(card.damage.totalText, source === 'final_actual' ? '13' :
      source === 'held_actual' ? '13?' : '~13?');
    assertEquals(card.damage.section?.rows, [shipRow]);
    assertEquals(card.healing.totalText, source === 'held_actual' || source === 'final_actual' ? '0' : '~0');
  }
});

Deno.test('concealed and unavailable columns never block the other contribution', () => {
  const vm = presentation();
  vm.opponent.damage.current = { state: 'concealed', turnNumber: 4 };
  const card = combat(vm).current;
  assertEquals([card.damage.totalText, card.damage.section, card.damage.unavailableText], ['?', null, 'Concealed']);
  assertEquals([card.healing.totalText, card.healing.section?.rows], ['~2', [shipRow]]);
  vm.opponent.damage.current = { state: 'pending', turnNumber: 4 };
  assertEquals(combat(vm).current.damage.section, null);
  assertEquals(combat(null).current.damage.unavailableText, 'Breakdown unavailable');
});

Deno.test('Last uses only the exact preceding last_actual slot through held and final periods', () => {
  for (const source of ['held_actual', 'final_actual'] as const) {
    const vm = presentation();
    vm.opponent.damage.current = availableMetric(9, source, 4, [{ ...shipRow, label: 'Current' }]);
    vm.opponent.damage.last = availableMetric(9, 'last_actual', 3, [{ ...shipRow, label: 'Previous' }]);
    assertEquals(combat(vm).last.damage.section?.rows[0]?.label, 'Previous');
    vm.opponent.damage.last = availableMetric(9, 'last_actual', 2);
    assertEquals(combat(vm).last.damage.section, null);
    vm.opponent.damage.last = availableMetric(9, 'estimated', 3);
    assertEquals(combat(vm).last.damage.section, null);
  }
  const turnOne = presentation({ turnNumber: 1 });
  turnOne.opponent.damage.last = availableMetric(0, 'last_actual', 0, []);
  assertEquals(combat(turnOne).last.damage.section, null);
  assertEquals(combat(turnOne).last.healing.section, null);
});

Deno.test('resolved matcher retains desktop source, turn and total validation', () => {
  const last = availableMetric(8, 'last_actual', 3);
  const held = availableMetric(8, 'held_actual', 3);
  const final = availableMetric(8, 'final_actual', 3);
  const find = (candidates: ThisTurnMetricVm[], heading: 'LAST TURN' | 'FINAL TURN' = 'LAST TURN') =>
    findResolvedBoardCombatMetric({ candidates, turnNumber: 3, totalText: '8', heading });
  assertEquals(find([last]), last);
  assertEquals(find([held]), held);
  assertEquals(find([final]), undefined);
  assertEquals(find([final], 'FINAL TURN'), final);
  assertEquals(find([availableMetric(8, 'last_actual', 2)]), undefined);
  assertEquals(find([availableMetric(9, 'last_actual', 3)]), undefined);
  assertEquals(find([availableMetric(8, 'estimated', 3)]), undefined);
});

Deno.test('board tails use actual horizontal geometry, including offset boards', () => {
  for (const width of [320, 360, 414, 600]) {
    assertEquals(getMobilePopoverTailLeft(width / 2, 16, width - 32) + 16 + 6, width / 2);
  }
  assertEquals(getMobilePopoverTailLeft(40 + 300 / 2, 16, 568) + 16 + 6, 190);
});
