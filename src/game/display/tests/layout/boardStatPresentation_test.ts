declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BoardCombatBreakdown } from '../../layout/boardStage/BoardStatBreakdownHoverCard';
import type {
  BoardViewModel,
  BoardStatBreakdownRowVm,
  GameSessionViewerViewModel,
  GameStatsViewModel,
  ThisTurnMetricPairVm,
  ThisTurnMetricVm,
  ThisTurnPresentationVm,
} from '../../../client/gameSession/types';
import {
  buildBoardStatHoverSections,
  buildCurrentBoardCombatBreakdown,
  calculateBoardStatHoverLayout,
  formatBoardStatMetric,
  formatBoardMetricBreakdownAmount,
  getBoardCombatHeadingPresentation,
} from '../../layout/boardStage/boardStatPresentation';
import {
  buildHealthBreakdownPresentation,
  buildResolvedBoardCombatBreakdown,
  getHealthContributionLabels,
  formatHealthChange,
} from '../../layout/boardStage/healthBreakdownPresentation';
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
  estimateMode?: Extract<ThisTurnMetricVm, { total: number }>['estimateMode'],
): ThisTurnMetricVm {
  return {
    state: total === 0 ? 'zero' : 'value',
    turnNumber,
    source,
    total,
    rows: metricRows,
    ...(estimateMode ? { estimateMode } : {}),
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

Deno.test('public Charge uncertainty appends a marker without changing numeric totals', () => {
  const uncertain = {
    ...valueMetric(13, 'privacy_frozen'),
    chargeDeclarationUncertain: true,
  } as ThisTurnMetricVm;
  const uncertainZero = {
    ...valueMetric(0, 'privacy_frozen', 4, []),
    chargeDeclarationUncertain: true,
  } as ThisTurnMetricVm;
  assertEquals(formatBoardStatMetric(uncertain, 'current'), '13?');
  assertEquals(formatBoardStatMetric(uncertainZero, 'current'), '0?');
  assertEquals(formatBoardStatMetric(uncertain, 'last'), '13');
  assertEquals(buildBoardStatHoverSections(pair(uncertain))[0]?.totalText, '~13?');
  assertEquals(
    uncertain.state === 'value' || uncertain.state === 'zero' ? uncertain.total : null,
    13,
  );
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

Deno.test('Autocast estimates qualify only the estimated breakdown and keep resting values plain', () => {
  const metric = valueMetric(8, 'estimated', 4, rows, 'with_autocast');
  assertEquals(formatBoardStatMetric(metric, 'current'), '8');
  assertEquals(buildBoardStatHoverSections(pair(metric)), [
    {
      kind: 'this_turn_estimate',
      heading: 'THIS TURN',
      showEstimateQualifier: true,
      estimateQualifierText: 'AUTOCAST ESTIMATE',
      totalText: '~8',
      rows,
    },
    {
      kind: 'last_turn',
      heading: 'LAST TURN',
      showEstimateQualifier: false,
      totalText: '3',
      rows,
    },
  ]);
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

type BoardModeVm = Extract<BoardViewModel, { mode: 'board' }>;

function healthBoard(overrides: Partial<BoardModeVm> = {}): BoardModeVm {
  return {
    mode: 'board',
    turnNumber: 5,
    myHealth: 22,
    opponentHealth: 25,
    myLastTurnHeal: 5,
    myLastTurnDamage: 7,
    myLastTurnNet: -3,
    opponentLastTurnHeal: 2,
    opponentLastTurnDamage: 8,
    opponentLastTurnNet: 1,
    ...overrides,
  } as BoardModeVm;
}

function healthPresentation(
  source: Extract<ThisTurnMetricVm, { total: number }>['source'],
  turnNumber = 4,
  phaseKey = 'build.drawing',
): ThisTurnPresentationVm {
  return {
    turnNumber,
    phaseKey,
    liveLog: null,
    archiveHandoff: null,
    mobile: { pairKey: `game-1::${turnNumber}`, opponentDetail: 'this_turn' },
    me: {
      playerId: 'p1',
      healing: pair(valueMetric(5, source, turnNumber), valueMetric(0, 'last_actual', 0, [])),
      damage: pair(valueMetric(7, source, turnNumber), valueMetric(0, 'last_actual', 0, [])),
    },
    opponent: {
      playerId: 'p2',
      healing: pair(valueMetric(2, source, turnNumber), valueMetric(0, 'last_actual', 0, [])),
      damage: pair(valueMetric(8, source, turnNumber), valueMetric(0, 'last_actual', 0, [])),
    },
  };
}

const playerViewer: GameSessionViewerViewModel = {
  viewerMode: 'p1_player',
  isSpectator: false,
  isPlayerViewer: true,
  p1Name: 'Juddly',
  p2Name: 'Opponent',
};

function history(turnNumber: number, board = healthBoard()): GameStatsViewModel {
  return {
    turnCount: 1,
    turns: [{
      turnNumber,
      viewer: {
        playerId: 'p1', label: 'You', healthEnd: board.myHealth,
        healthDelta: board.myLastTurnNet, healingReceived: board.myLastTurnHeal,
        damageTaken: board.opponentLastTurnDamage, damageDealt: board.myLastTurnDamage,
        fleetValueEnd: 10,
      },
      opponent: {
        playerId: 'p2', label: 'Opponent', healthEnd: board.opponentHealth,
        healthDelta: board.opponentLastTurnNet, healingReceived: board.opponentLastTurnHeal,
        damageTaken: board.myLastTurnDamage, damageDealt: board.opponentLastTurnDamage,
        fleetValueEnd: 10,
      },
      row2Net: 0,
      row3Net: 0,
    }],
    summary: {
      viewer: { label: 'You', finalHealth: board.myHealth, totalHealing: 5, totalDamage: 7, finalFleetValue: 10 },
      opponent: { label: 'Opponent', finalHealth: board.opponentHealth, totalHealing: 2, totalDamage: 8, finalFleetValue: 10 },
    },
    labels: {
      viewerHealth: 'Your Health', opponentHealth: 'Opponent Health',
      viewerHealing: 'Your Healing', opponentDamage: 'Opponent Damage',
      viewerDamage: 'Your Damage', opponentHealing: 'Opponent Healing',
      viewerFleetValue: 'Your Fleet Value', opponentFleetValue: 'Opponent Fleet Value',
    },
    scaleHints: { pressureMax: 40, fleetValueMax: 10, healthFloor: -10 },
  };
}

Deno.test('health breakdown maps each owner healing before incoming damage and preserves authoritative net', () => {
  const board = healthBoard({ myLastTurnNet: 0, myLastTurnHeal: 8 });
  const current = healthPresentation('held_actual');
  current.me.healing.current = valueMetric(8, 'held_actual', 4);
  const result = buildHealthBreakdownPresentation({
    boardVm: board,
    thisTurn: current,
    gameStats: null,
    viewer: playerViewer,
  });

  assertEquals(result.my, {
    heading: 'LAST TURN', turnNumber: 4,
    healingLabel: 'Your Healing', healingText: '8',
    damageLabel: 'Opponent Damage', damageText: '8',
    changeText: '±0', changeTone: 'neutral',
  });
  assertEquals(result.opponent?.healingLabel, 'Opponent Healing');
  assertEquals(result.opponent?.damageLabel, 'Your Damage');
  assertEquals(formatHealthChange(-3), '−3');
  assertEquals(formatHealthChange(2), '+2');
});

Deno.test('held Damage and Healing stats do not delay raw Phase 18H health data', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const priorStats = healthPresentation('estimated', 4);
  const rawResolution = healthPresentation('held_actual', 5);
  const heldState = syncTurnStartStatPresentation(
    createTurnStartStatPresentationState({
      gameId: 'game-1', orientationKey, turnNumber: 4,
      presentation: priorStats, firstTurnRollPresentationActive: false,
    }),
    {
      gameId: 'game-1', orientationKey, turnNumber: 5,
      presentation: rawResolution, settledTurnNumber: 4,
      firstTurnRollPresentationActive: false,
    },
  );
  const health = buildHealthBreakdownPresentation({
    boardVm: healthBoard({ turnNumber: 5 }),
    thisTurn: rawResolution,
    gameStats: null,
    viewer: playerViewer,
  });

  assertEquals(heldState.presented?.turnNumber, 4);
  assertEquals({ eligible: health.hoverEligible, turn: health.my?.turnNumber }, {
    eligible: true,
    turn: 5,
  });
});

Deno.test('desktop stat numbers and hover rows show resolved actuals through next-turn dice settlement', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const prior = healthPresentation('estimated', 4);
  const resolved = healthPresentation('held_actual', 4);
  resolved.me.damage.current = valueMetric(14, 'held_actual', 4, [{
    rowKind: 'ship', label: 'Centaur charge', count: 1, amount: 14, amountText: '+14',
  }]);
  const next = healthPresentation('estimated', 5);
  next.me.damage.current = valueMetric(12, 'estimated', 5, [{
    rowKind: 'ship', label: 'Destroyer', count: 2, amount: 12, amountText: '+12',
  }]);
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
  assertEquals(formatBoardStatMetric(state.presented?.me.damage.current, 'current'), '14');
  assertEquals(
    buildBoardStatHoverSections(state.presented?.me.damage).map((section) => [
      section.totalText,
      section.rows.map((row) => row.label),
    ]),
    [['14', ['Centaur charge']]],
  );

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: next, settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: null,
  });
  assertEquals(formatBoardStatMetric(state.presented?.me.damage.current, 'current'), '14');
  assertEquals(
    buildBoardStatHoverSections(state.presented?.me.damage)[0]?.rows.map((row) => row.label),
    ['Centaur charge'],
  );

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: next, settledTurnNumber: 5,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: null,
  });
  assertEquals(formatBoardStatMetric(state.presented?.me.damage.current, 'current'), '12');
  assertEquals(
    buildBoardStatHoverSections(state.presented?.me.damage)[0]?.rows.map((row) => row.label),
    ['Destroyer'],
  );
});

Deno.test('spectator health labels retain left and right player orientation', () => {
  const result = buildHealthBreakdownPresentation({
    boardVm: healthBoard(),
    thisTurn: healthPresentation('held_actual'),
    gameStats: null,
    viewer: { ...playerViewer, viewerMode: 'spectator', isSpectator: true, isPlayerViewer: false, p1Name: 'Alpha', p2Name: 'Beta' },
  });
  assertEquals([
    result.my?.healingLabel,
    result.my?.damageLabel,
    result.opponent?.healingLabel,
    result.opponent?.damageLabel,
  ], ['Alpha Healing', 'Beta Damage', 'Beta Healing', 'Alpha Damage']);
});

Deno.test('delta visibility remains independent when health breakdown metadata is unavailable', () => {
  const unavailable = healthPresentation('estimated', 5);
  const result = buildHealthBreakdownPresentation({
    boardVm: healthBoard({ turnNumber: 5 }),
    thisTurn: unavailable,
    gameStats: null,
    viewer: playerViewer,
  });
  assertEquals({ hover: result.hoverEligible, delta: result.deltaVisible }, { hover: false, delta: true });

  const opening = buildHealthBreakdownPresentation({
    boardVm: healthBoard({ turnNumber: 1 }),
    thisTurn: healthPresentation('estimated', 1),
    gameStats: null,
    viewer: playerViewer,
  });
  assertEquals({ hover: opening.hoverEligible, delta: opening.deltaVisible }, { hover: false, delta: false });
});

Deno.test('health breakdown follows held, rollover, concealed, zero, and live final lifecycle states', () => {
  const rolled = healthPresentation('estimated', 5);
  rolled.me.healing.last = valueMetric(5, 'last_actual', 4);
  rolled.me.damage.last = valueMetric(7, 'last_actual', 4);
  rolled.opponent.healing.last = valueMetric(2, 'last_actual', 4);
  rolled.opponent.damage.last = valueMetric(8, 'last_actual', 4);
  rolled.opponent.damage.current = { state: 'concealed', turnNumber: 5 };
  const last = buildHealthBreakdownPresentation({
    boardVm: healthBoard(),
    thisTurn: rolled,
    gameStats: null,
    viewer: playerViewer,
  });
  assertEquals({ heading: last.my?.heading, turn: last.my?.turnNumber }, {
    heading: 'LAST TURN', turn: 4,
  });

  const zeroBoard = healthBoard({
    turnNumber: 2,
    myLastTurnHeal: 0,
    myLastTurnDamage: 0,
    myLastTurnNet: 0,
    opponentLastTurnHeal: 0,
    opponentLastTurnDamage: 0,
    opponentLastTurnNet: 0,
  });
  const zeroTurn = healthPresentation('estimated', 2);
  zeroTurn.me.healing.last = valueMetric(0, 'last_actual', 1, []);
  zeroTurn.me.damage.last = valueMetric(0, 'last_actual', 1, []);
  zeroTurn.opponent.healing.last = valueMetric(0, 'last_actual', 1, []);
  zeroTurn.opponent.damage.last = valueMetric(0, 'last_actual', 1, []);
  const zero = buildHealthBreakdownPresentation({
    boardVm: zeroBoard,
    thisTurn: zeroTurn,
    gameStats: null,
    viewer: playerViewer,
  });
  assertEquals({ hover: zero.hoverEligible, change: zero.my?.changeText }, {
    hover: true, change: '±0',
  });

  const liveFinal = buildHealthBreakdownPresentation({
    boardVm: healthBoard({ turnNumber: 4 }),
    thisTurn: healthPresentation('final_actual', 4, 'game.finished'),
    gameStats: null,
    viewer: playerViewer,
  });
  assertEquals({ heading: liveFinal.my?.heading, final: liveFinal.confirmedFinal }, {
    heading: 'FINAL TURN', final: true,
  });
});

Deno.test('finished reload confirms Final Turn only when latest history matches board totals', () => {
  const board = healthBoard({ turnNumber: 1 });
  const unavailable = healthPresentation('estimated', 1, 'game.finished');
  unavailable.me.damage.current = { state: 'unavailable', turnNumber: 1 };
  unavailable.me.healing.current = { state: 'unavailable', turnNumber: 1 };
  unavailable.opponent.damage.current = { state: 'unavailable', turnNumber: 1 };
  unavailable.opponent.healing.current = { state: 'unavailable', turnNumber: 1 };
  const confirmed = buildHealthBreakdownPresentation({
    boardVm: board,
    thisTurn: unavailable,
    gameStats: history(1, board),
    viewer: playerViewer,
  });
  assertEquals({ heading: confirmed.my?.heading, delta: confirmed.deltaVisible }, {
    heading: 'FINAL TURN', delta: true,
  });

  const mismatchedHistory = history(1, board);
  mismatchedHistory.turns[0].viewer.healthDelta = 99;
  const suppressed = buildHealthBreakdownPresentation({
    boardVm: board,
    thisTurn: unavailable,
    gameStats: mismatchedHistory,
    viewer: playerViewer,
  });
  assertEquals({ hover: suppressed.hoverEligible, final: suppressed.confirmedFinal }, {
    hover: false, final: false,
  });
});

Deno.test('finished unresolved terminal retains only a matching earlier Last Turn', () => {
  const board = healthBoard({ turnNumber: 5 });
  const unavailable = healthPresentation('estimated', 5, 'game.finished');
  const result = buildHealthBreakdownPresentation({
    boardVm: board,
    thisTurn: unavailable,
    gameStats: history(4, board),
    viewer: playerViewer,
  });
  assertEquals({ heading: result.my?.heading, turn: result.my?.turnNumber }, {
    heading: 'LAST TURN', turn: 4,
  });
});

Deno.test('combined current columns group damage and healing by affected health with spectator owners', () => {
  const presentation = healthPresentation('estimated');
  const viewer = { ...playerViewer, isSpectator: true, p1Name: 'Alpha', p2Name: 'Beta' };
  const labels = getHealthContributionLabels(viewer, null);
  const left = buildCurrentBoardCombatBreakdown({
    presentation, side: 'my', damageLabel: labels.opponentDamage, healingLabel: labels.viewerHealing,
  });
  const right = buildCurrentBoardCombatBreakdown({
    presentation, side: 'opponent', damageLabel: labels.viewerDamage, healingLabel: labels.opponentHealing,
  });
  assertEquals([left.damage.label, left.damage.totalText, left.healing.label, left.healing.totalText],
    ['Beta Damage', '~8', 'Alpha Healing', '~5']);
  assertEquals([right.damage.label, right.damage.totalText, right.healing.label, right.healing.totalText],
    ['Alpha Damage', '~7', 'Beta Healing', '~2']);
});

Deno.test('combined current inspection preserves the visible column when the other is concealed', () => {
  const presentation = healthPresentation('estimated');
  presentation.opponent.damage.current = { state: 'concealed', turnNumber: 4 };
  presentation.me.healing.current = {
    ...valueMetric(0, 'privacy_frozen', 4, [], 'with_autocast'), chargeDeclarationUncertain: true,
  } as ThisTurnMetricVm;
  const card = buildCurrentBoardCombatBreakdown({
    presentation, side: 'my', damageLabel: 'Opponent Damage', healingLabel: 'Your Healing',
  });
  assertEquals([card.damage.totalText, card.damage.section, card.damage.unavailableText], ['?', null, 'Concealed']);
  assertEquals([card.healing.totalText, card.healing.section?.estimateQualifierText, card.healing.section?.rows],
    ['~0?', 'AUTOCAST ESTIMATE', []]);
});

Deno.test('combined current inspection never substitutes last-turn rows for unavailable current data', () => {
  const presentation = healthPresentation('estimated');
  presentation.me.healing.current = { state: 'unavailable', turnNumber: 4 };
  presentation.opponent.damage.current = { state: 'pending', turnNumber: 4 };
  presentation.me.healing.last = valueMetric(9, 'last_actual', 3);
  presentation.opponent.damage.last = valueMetric(12, 'last_actual', 3);
  const card = buildCurrentBoardCombatBreakdown({
    presentation, side: 'my', damageLabel: 'Opponent Damage', healingLabel: 'Your Healing',
  });
  assertEquals([card.damage.section, card.healing.section], [null, null]);
});

Deno.test('resolved combined inspection selects held actuals instead of the preceding last slot', () => {
  const presentation = healthPresentation('held_actual', 4);
  presentation.opponent.damage.last = valueMetric(8, 'last_actual', 3, [{ ...rows[0], label: 'Wrong prior turn' }]);
  const health = buildHealthBreakdownPresentation({
    boardVm: healthBoard(), thisTurn: presentation, gameStats: null, viewer: playerViewer,
  });
  const card = buildResolvedBoardCombatBreakdown({ card: health.my, thisTurn: presentation, side: 'my' });
  assertEquals([card?.heading, card?.damage.totalText, card?.damage.section?.rows[0].label], ['LAST TURN', '8', 'Fighter']);
  assertEquals(card?.healing.totalText, '5');
});

Deno.test('resolved combined inspection uses last actuals after rollover, not equal-valued estimates', () => {
  const presentation = healthPresentation('estimated', 5);
  for (const side of [presentation.me, presentation.opponent]) {
    for (const kind of ['damage', 'healing'] as const) {
      const current = side[kind].current as Extract<ThisTurnMetricVm, { total: number }>;
      side[kind].last = valueMetric(current.total, 'last_actual', 4, [{ ...rows[0], label: 'Resolved ship' }]);
    }
  }
  const health = buildHealthBreakdownPresentation({
    boardVm: healthBoard(), thisTurn: presentation, gameStats: null, viewer: playerViewer,
  });
  const card = buildResolvedBoardCombatBreakdown({ card: health.opponent, thisTurn: presentation, side: 'opponent' });
  assertEquals([card?.damage.section?.rows[0].label, card?.healing.section?.rows[0].label], ['Resolved ship', 'Resolved ship']);
});

Deno.test('resolved combined inspection retains confirmed final semantics and rejects mismatched details', () => {
  const board = healthBoard({ turnNumber: 4 });
  const presentation = healthPresentation('final_actual', 4, 'game.finished');
  const health = buildHealthBreakdownPresentation({ boardVm: board, thisTurn: presentation, gameStats: null, viewer: playerViewer });
  const final = buildResolvedBoardCombatBreakdown({ card: health.my, thisTurn: presentation, side: 'my' });
  assertEquals([final?.heading, final?.damage.section?.kind, final?.healing.section?.kind], ['FINAL TURN', 'final_turn', 'final_turn']);
  presentation.opponent.damage.current = valueMetric(99, 'final_actual', 4);
  presentation.me.healing.current = valueMetric(5, 'estimated', 4);
  const unavailable = buildResolvedBoardCombatBreakdown({ card: health.my, thisTurn: presentation, side: 'my' });
  assertEquals([unavailable?.damage.totalText, unavailable?.damage.section, unavailable?.healing.section], ['8', null, null]);
});

Deno.test('matching historical health allows aggregate totals without inventing contribution rows', () => {
  const board = healthBoard({ turnNumber: 1 });
  const presentation = healthPresentation('estimated', 1, 'game.finished');
  const health = buildHealthBreakdownPresentation({
    boardVm: board, thisTurn: presentation, gameStats: history(1, board), viewer: playerViewer,
  });
  const card = buildResolvedBoardCombatBreakdown({ card: health.my, thisTurn: presentation, side: 'my' });
  assertEquals([card?.heading, card?.damage.totalText, card?.damage.section, card?.healing.section], ['FINAL TURN', '8', null, null]);
  assertEquals(card?.damage.unavailableText, 'Breakdown unavailable');
  assertEquals(buildResolvedBoardCombatBreakdown({ card: null, thisTurn: presentation, side: 'my' }), null);
});

Deno.test('compact combined cards flip outward placement and clamp within a short desktop viewport', () => {
  const result = calculateBoardStatHoverLayout({
    anchorRect: { left: 180, right: 240, top: 90, height: 60 },
    cardWidth: 240, cardHeight: 176, viewportWidth: 600, viewportHeight: 200, preferredPlacement: 'left',
  });
  assertEquals(result, { left: 254, top: 12, placement: 'right', tailOffset: 108 });
});

Deno.test('combined period headings qualify estimates while actual, last and final headings remain plain', () => {
  for (const source of ['estimated', 'turn_start_baseline', 'privacy_frozen', 'held_actual', 'final_actual'] as const) {
    const card = buildCurrentBoardCombatBreakdown({
      presentation: healthPresentation(source), side: 'my',
      damageLabel: 'Opponent Damage', healingLabel: 'Your Healing',
    });
    assertEquals(getBoardCombatHeadingPresentation(card), {
      heading: source === 'final_actual' ? 'FINAL TURN' : 'THIS TURN',
      qualifier: source === 'held_actual' || source === 'final_actual' ? null : 'ESTIMATE',
    });
  }
  const presentation = healthPresentation('held_actual');
  const health = buildHealthBreakdownPresentation({
    boardVm: healthBoard(), thisTurn: presentation, gameStats: null, viewer: playerViewer,
  });
  const card = buildResolvedBoardCombatBreakdown({ card: health.my, thisTurn: presentation, side: 'my' });
  assertEquals(card && getBoardCombatHeadingPresentation(card), { heading: 'LAST TURN', qualifier: null });
});

Deno.test('stacked combat rendering keeps one owner total per section and scopes Autocast to its contribution', () => {
  const presentation = healthPresentation('estimated');
  presentation.opponent.damage.current = {
    ...valueMetric(13, 'estimated', 4, [{ ...rows[0], label: 'Damage source', amount: 13 }], 'with_autocast'),
    chargeDeclarationUncertain: true,
  } as ThisTurnMetricVm;
  presentation.me.healing.current = valueMetric(5, 'estimated', 4, [{ ...rows[0], label: 'Healing source', amount: 5 }]);
  const card = buildCurrentBoardCombatBreakdown({
    presentation, side: 'my', damageLabel: 'Opponent Damage', healingLabel: 'Your Healing',
  });
  const markup = renderToStaticMarkup(createElement(BoardCombatBreakdown, { card }));
  const sections = markup.match(/<section\b[\s\S]*?<\/section>/g) ?? [];
  assertEquals(sections.length, 2);
  const [damage = '', healing = ''] = sections;
  assertEquals(markup.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1].replace(/<[^>]*>/g, ''), 'THIS TURN (ESTIMATE)');
  assertEquals(damage.includes('Opponent Damage') && damage.includes('Damage source'), true);
  assertEquals(healing.includes('Your Healing') && healing.includes('Healing source'), true);
  assertEquals(damage.includes('(AUTOCAST ESTIMATE)'), true);
  assertEquals(healing.includes('AUTOCAST'), false);
  assertEquals(markup.split('~13?').length - 1, 1);
  assertEquals(markup.split('~5').length - 1, 1);
  assertEquals(markup.includes('>TOTAL<'), false);
});

Deno.test('stacked rendering preserves concealed contributions, available zeroes and final unavailable details', () => {
  const presentation = healthPresentation('estimated');
  presentation.opponent.damage.current = { state: 'concealed', turnNumber: 4 };
  presentation.me.healing.current = valueMetric(0, 'estimated', 4, []);
  const current = buildCurrentBoardCombatBreakdown({
    presentation, side: 'my', damageLabel: 'Opponent Damage', healingLabel: 'Your Healing',
  });
  const markup = renderToStaticMarkup(createElement(BoardCombatBreakdown, { card: current }));
  assertEquals(markup.includes('Concealed') && markup.includes('Your Healing') && markup.includes('~0'), true);
  assertEquals(markup.includes('Fighter'), false);

  const board = healthBoard({ turnNumber: 1 });
  const finalPresentation = healthPresentation('estimated', 1, 'game.finished');
  const health = buildHealthBreakdownPresentation({
    boardVm: board, thisTurn: finalPresentation, gameStats: history(1, board), viewer: playerViewer,
  });
  const final = buildResolvedBoardCombatBreakdown({ card: health.my, thisTurn: finalPresentation, side: 'my' });
  const finalMarkup = final ? renderToStaticMarkup(createElement(BoardCombatBreakdown, { card: final })) : '';
  assertEquals(finalMarkup.includes('FINAL TURN'), true);
  assertEquals(finalMarkup.split('Breakdown unavailable').length - 1, 2);
  assertEquals(finalMarkup.includes('ESTIMATE') || finalMarkup.includes('~'), false);
});
