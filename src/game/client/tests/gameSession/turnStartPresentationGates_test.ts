declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  applyTurnStartCataloguePresentationGate,
  classifyFirstTurnDiceSignature,
  createTurnStartEconomyPresentationState,
  createTurnStartStatPresentationState,
  deriveBuildDrawingReadyNote,
  getTurnStartStatOrientationKey,
  holdTurnStartDiceModifierPresentation,
  isCurrentTurnDicePresentationSettled,
  isNormalDrawingInteractionHeld,
  normalizeTurnStartDiceModifierPresentation,
  settleTurnStartEconomyPresentation,
  shouldHoldTurnStartFleetMaterialisation,
  shouldHoldSetupTurnDiceCatchUp,
  syncTurnStartStatPresentation,
  syncTurnStartEconomyPresentation,
} from '../../gameSession/clienteffects/turnStartPresentationGates';
import type {
  ThisTurnMetricVm,
  ThisTurnPresentationVm,
} from '../../gameSession/types';

function assertEquals(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual: ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`
    );
  }
}

function assertSame(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(message);
  }
}

function assertNotSame(actual: unknown, expected: unknown, message: string): void {
  if (actual === expected) {
    throw new Error(message);
  }
}

function statMetric(
  total: number,
  turnNumber: number,
  source: Extract<ThisTurnMetricVm, { total: number }>['source'] = 'estimated',
  label = 'Fighter',
  estimateMode?: Extract<ThisTurnMetricVm, { total: number }>['estimateMode'],
): ThisTurnMetricVm {
  return {
    state: total === 0 ? 'zero' : 'value',
    turnNumber,
    source,
    total,
    rows: total === 0
      ? []
      : [{ rowKind: 'ship', label, count: 1, amount: total, amountText: String(total) }],
    ...(estimateMode ? { estimateMode } : {}),
  };
}

function statPresentation(args: {
  turnNumber: number;
  total: number;
  leftPlayerId?: string;
  rightPlayerId?: string;
  opponentDetail?: 'this_turn' | 'last';
  opponentConcealed?: boolean;
  label?: string;
  estimateMode?: Extract<ThisTurnMetricVm, { total: number }>['estimateMode'];
}): ThisTurnPresentationVm {
  const current = statMetric(
    args.total,
    args.turnNumber,
    'estimated',
    args.label,
    args.estimateMode,
  );
  const last = statMetric(
    Math.max(0, args.total - 1),
    Math.max(0, args.turnNumber - 1),
    'last_actual',
    `${args.label ?? 'Fighter'} last`,
  );
  const pair = () => ({ current, last });

  return {
    turnNumber: args.turnNumber,
    phaseKey: 'build.drawing',
    liveLog: null,
    archiveHandoff: null,
    mobile: {
      pairKey: `game-1::${args.turnNumber}`,
      opponentDetail: args.opponentDetail ?? 'last',
    },
    me: {
      playerId: args.leftPlayerId ?? 'p1',
      damage: pair(),
      healing: pair(),
    },
    opponent: {
      playerId: args.rightPlayerId ?? 'p2',
      damage: args.opponentConcealed
        ? { current: { state: 'concealed', turnNumber: args.turnNumber }, last }
        : pair(),
      healing: pair(),
    },
  };
}

function chargeInclusivePresentation(args: {
  turnNumber: number;
  source: Extract<ThisTurnMetricVm, { total: number }>['source'];
  opponentDetail: 'this_turn' | 'last';
  totals: [number, number, number, number];
  lastTotals: [number, number, number, number];
  label: string;
}): ThisTurnPresentationVm {
  const pair = (
    total: number,
    lastTotal: number,
    metricLabel: string,
  ) => ({
    current: {
      ...statMetric(total, args.turnNumber, args.source, metricLabel),
      rows: [
        {
          rowKind: 'ship' as const,
          label: `${metricLabel} base`,
          count: 1,
          amount: Math.max(0, total - 2),
          amountText: String(Math.max(0, total - 2)),
        },
        {
          rowKind: 'ship' as const,
          label: `${args.label} charge`,
          count: 1,
          amount: Math.min(2, total),
          amountText: String(Math.min(2, total)),
        },
      ],
    },
    last: statMetric(
      lastTotal,
      Math.max(0, args.turnNumber - 1),
      'last_actual',
      `${metricLabel} prior`,
    ),
  });
  const [myDamage, myHealing, opponentDamage, opponentHealing] = args.totals;
  const [lastMyDamage, lastMyHealing, lastOpponentDamage, lastOpponentHealing] =
    args.lastTotals;

  return {
    turnNumber: args.turnNumber,
    phaseKey: args.source === 'held_actual'
      ? 'battle.end_of_turn_resolution'
      : 'build.drawing',
    liveLog: null,
    archiveHandoff: null,
    mobile: {
      pairKey: `game-1::${args.turnNumber}::${args.label}`,
      opponentDetail: args.opponentDetail,
    },
    me: {
      playerId: 'p1',
      damage: pair(myDamage, lastMyDamage, 'My damage'),
      healing: pair(myHealing, lastMyHealing, 'My healing'),
    },
    opponent: {
      playerId: 'p2',
      damage: pair(opponentDamage, lastOpponentDamage, 'Opponent damage'),
      healing: pair(opponentHealing, lastOpponentHealing, 'Opponent healing'),
    },
  };
}

function statPresentationSnapshot(presentation: ThisTurnPresentationVm | null) {
  const metric = (value: ThisTurnMetricVm) => value.state === 'zero' || value.state === 'value'
    ? {
        total: value.total,
        source: value.source,
        rows: value.rows.map((row) => row.label),
      }
    : { state: value.state };
  const pair = (value: { current: ThisTurnMetricVm; last: ThisTurnMetricVm }) => ({
    current: metric(value.current),
    last: metric(value.last),
  });

  return presentation == null
    ? null
    : {
        turnNumber: presentation.turnNumber,
        opponentDetail: presentation.mobile.opponentDetail,
        me: {
          damage: pair(presentation.me.damage),
          healing: pair(presentation.me.healing),
        },
        opponent: {
          damage: pair(presentation.opponent.damage),
          healing: pair(presentation.opponent.healing),
        },
      };
}

Deno.test('first established dice signature hydrates without presenting a roll', () => {
  assertEquals(
    classifyFirstTurnDiceSignature({ observedEligibleNoSignature: false }),
    'hydrate',
    'reload and mid-turn hydration should not replay a roll'
  );
});

Deno.test('first signature after an eligible no-signature state presents Turn 1 roll', () => {
  assertEquals(
    classifyFirstTurnDiceSignature({ observedEligibleNoSignature: true }),
    'present_roll',
    'setup-to-Turn-1 transition should use the normal roll presentation'
  );
});

Deno.test('Turn 1 economy stays on the pre-turn baseline until dice presentation settles', () => {
  const baseline = {
    myBonusLines: 0,
    opponentBonusLines: 0,
    myBonusLinesOnEven: 0,
    opponentBonusLinesOnEven: 0,
    myDisplayedSavedLines: 3,
    opponentDisplayedSavedLines: 3,
    myDisplayedSavedJoiningLines: 0,
    opponentDisplayedSavedJoiningLines: 0,
    mySavedJoiningLines: 0,
    opponentSavedJoiningLines: 0,
    myJoiningBonusLines: 0,
    opponentJoiningBonusLines: 0,
    myBonusBreakdownRows: [],
    opponentBonusBreakdownRows: [],
  };
  const turnOne = {
    ...baseline,
    myBonusLines: 2,
    opponentBonusLines: 1,
    myDisplayedSavedLines: 8,
    opponentDisplayedSavedLines: 7,
  };
  const initial = createTurnStartEconomyPresentationState({
    gameId: 'mission-game',
    turnNumber: 0,
    economy: baseline,
  });
  const pending = syncTurnStartEconomyPresentation(initial, {
    gameId: 'mission-game',
    turnNumber: 1,
    economy: turnOne,
  });

  assertEquals(
    pending.presented,
    baseline,
    'new-turn economy should remain hidden behind the existing dice settlement gate'
  );
  assertEquals(
    settleTurnStartEconomyPresentation(pending, 1).presented,
    turnOne,
    'Turn 1 economy should release when the existing dice presentation settles'
  );
});

Deno.test('turn-start modifier hold preserves existing dice and seeds new dice at one', () => {
  const held = holdTurnStartDiceModifierPresentation({
    presented: {
      chronoswarmRolls: [3],
      cubeDiceValueByPlayerId: { playerA: 4 },
    },
    authoritative: {
      chronoswarmRolls: [5, 6],
      cubeDiceValueByPlayerId: { playerA: 2, playerB: 6 },
    },
  });

  assertEquals(
    held,
    {
      chronoswarmRolls: [3, 1],
      cubeDiceValueByPlayerId: { playerA: 4, playerB: 1 },
    },
    'existing slots should retain their presented face and new slots should start at one'
  );
});

Deno.test('authoritative modifier targets normalize for release', () => {
  assertEquals(
    normalizeTurnStartDiceModifierPresentation({
      chronoswarmRolls: [5, 6, 9],
      cubeDiceValueByPlayerId: { playerA: 2, invalid: 0 },
    }),
    {
      chronoswarmRolls: [5, 6],
      cubeDiceValueByPlayerId: { playerA: 2 },
    },
    'release targets should contain only valid authoritative dice values'
  );
});

Deno.test('current-turn result UI remains gated until that turn settles', () => {
  assertEquals(
    isCurrentTurnDicePresentationSettled({ turnNumber: 3, settledTurnNumber: 2 }),
    false,
    'the prior turn settle must not expose current results'
  );
  assertEquals(
    isCurrentTurnDicePresentationSettled({ turnNumber: 3, settledTurnNumber: 3 }),
    true,
    'the current result may be exposed after settle'
  );
});

Deno.test('dice settlement holds and releases Autocast totals, rows, source, and qualifier atomically', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const prior = statPresentation({ turnNumber: 4, total: 6, label: 'Prior' });
  const autocast = statPresentation({
    turnNumber: 5,
    total: 13,
    label: 'Supernova',
    estimateMode: 'with_autocast',
  });
  let state = createTurnStartStatPresentationState({
    gameId: 'game-1', orientationKey, turnNumber: 4,
    presentation: prior, firstTurnRollPresentationActive: false,
  });

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: autocast, settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
  });
  assertEquals(state.presented, prior, 'the prior complete presentation must remain visible');
  assertEquals(state.latest, autocast, 'the complete Autocast presentation must remain pending');

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: structuredClone(autocast), settledTurnNumber: 5,
    firstTurnRollPresentationActive: false,
  });
  const released = state.presented?.me.damage.current;
  assertEquals(released?.state === 'value' || released?.state === 'zero'
    ? {
        total: released.total,
        source: released.source,
        estimateMode: released.estimateMode,
        rows: released.rows.map((row) => row.label),
      }
    : released, {
    total: 13,
    source: 'estimated',
    estimateMode: 'with_autocast',
    rows: ['Supernova'],
  }, 'settlement must release the total, rows, source, and qualifier together');
});

Deno.test('turn stats retain the complete prior presentation and release the newest estimate at settlement', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player',
    leftPlayerId: 'p1',
    rightPlayerId: 'p2',
  });
  const prior = statPresentation({
    turnNumber: 4,
    total: 6,
    opponentDetail: 'this_turn',
    label: 'Prior fighter',
  });
  let state = createTurnStartStatPresentationState({
    gameId: 'game-1',
    orientationKey,
    turnNumber: 4,
    presentation: prior,
    firstTurnRollPresentationActive: false,
  });
  const beforeDice = statPresentation({
    turnNumber: 5,
    total: 2,
    opponentDetail: 'last',
    label: 'Initial estimate',
  });
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: beforeDice, settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
  });
  assertEquals(state.presented, prior, 'the first new-turn render must retain every prior stat field');
  const pendingBeforeDice = state;
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: statPresentation({
      turnNumber: 5,
      total: 2,
      opponentDetail: 'last',
      label: 'Initial estimate',
    }),
    settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
  });
  assertSame(
    state,
    pendingBeforeDice,
    'an equivalent newly allocated pending presentation must reuse the existing state',
  );

  const duringRoll = statPresentation({
    turnNumber: 5,
    total: 9,
    opponentDetail: 'last',
    label: 'Newest estimate',
  });
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: duringRoll, settledTurnNumber: null,
    firstTurnRollPresentationActive: false,
  });
  assertNotSame(state, pendingBeforeDice, 'a changed estimate must create a new pending state');
  assertEquals(state.presented, prior, 'the roll must keep numbers, rows, sources, and mobile detail held');
  assertEquals(state.latest, duringRoll, 'the newest safe estimate must be retained for release');
  const updatedPending = state;
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: statPresentation({
      turnNumber: 5,
      total: 9,
      opponentDetail: 'last',
      label: 'Newest estimate',
    }),
    settledTurnNumber: null,
    firstTurnRollPresentationActive: false,
  });
  assertSame(state, updatedPending, 'an equivalent repeated estimate must stabilize by reference');

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: duringRoll, settledTurnNumber: 5,
    firstTurnRollPresentationActive: false,
  });
  assertNotSame(state, updatedPending, 'settlement must create the release state');
  assertEquals(state.presented, duringRoll, 'settlement must release the complete newest presentation together');
  assertEquals(state.pendingTurnNumber, null, 'settlement must clear the pending turn');
  const settled = state;
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: statPresentation({
      turnNumber: 5,
      total: 9,
      opponentDetail: 'last',
      label: 'Newest estimate',
    }),
    settledTurnNumber: 5,
    firstTurnRollPresentationActive: false,
  });
  assertSame(state, settled, 'an equivalent settled presentation must reuse the release state');
});

Deno.test('resolved actual stats publish before the next-turn dice hold and remain until settlement', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const estimate = chargeInclusivePresentation({
    turnNumber: 4,
    source: 'estimated',
    opponentDetail: 'this_turn',
    totals: [6, 2, 7, 1],
    lastTotals: [3, 1, 4, 2],
    label: 'estimate',
  });
  let state = createTurnStartStatPresentationState({
    gameId: 'game-1', orientationKey, turnNumber: 4,
    presentation: estimate, firstTurnRollPresentationActive: false,
  });
  const resolved = chargeInclusivePresentation({
    turnNumber: 4,
    source: 'held_actual',
    opponentDetail: 'this_turn',
    totals: [14, 5, 11, 6],
    lastTotals: [3, 1, 4, 2],
    label: 'resolved',
  });

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: resolved, settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: 4,
  });
  assertEquals(
    statPresentationSnapshot(state.presented),
    statPresentationSnapshot(resolved),
    'authoritative Turn 4 totals, charge rows, sources, Last values, and mobile mode must publish immediately',
  );
  assertEquals(
    state.authoritativeTurnNumber,
    4,
    'the resolved presentation must anchor the gate to its own turn',
  );

  const publishedResolved = state;
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: structuredClone(resolved), settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: 4,
  });
  assertSame(
    state,
    publishedResolved,
    'an equivalent newly allocated held-actual presentation must preserve state identity',
  );

  const nextTurn = chargeInclusivePresentation({
    turnNumber: 5,
    source: 'estimated',
    opponentDetail: 'last',
    totals: [2, 3, 4, 5],
    lastTotals: [14, 5, 11, 6],
    label: 'next',
  });
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: nextTurn, settledTurnNumber: 4,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: null,
  });
  assertEquals(
    statPresentationSnapshot(state.presented),
    statPresentationSnapshot(resolved),
    'early Turn 5 state and its Last fields must not replace resolved Turn 4 during the roll',
  );
  assertEquals(state.latest, nextTurn, 'raw Turn 5 must remain pending for release');

  const pending = state;
  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: structuredClone(nextTurn), settledTurnNumber: null,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: null,
  });
  assertSame(
    state,
    pending,
    'equivalent raw Turn 5 input must preserve pending state identity',
  );

  state = syncTurnStartStatPresentation(state, {
    gameId: 'game-1', orientationKey, turnNumber: 5,
    presentation: structuredClone(nextTurn), settledTurnNumber: 5,
    firstTurnRollPresentationActive: false,
    resolvedPresentationTurnNumber: null,
  });
  assertEquals(
    statPresentationSnapshot(state.presented),
    statPresentationSnapshot(nextTurn),
    'dice settlement must release Turn 5 totals, rows, sources, Last fields, and mobile mode together',
  );
});

Deno.test('turn stat holds are scoped to game and viewer orientation for both players and spectators', () => {
  const cases = [
    { role: 'player' as const, left: 'p1', right: 'p2' },
    { role: 'player' as const, left: 'p2', right: 'p1' },
    { role: 'spectator' as const, left: 'p1', right: 'p2' },
  ];

  for (const candidate of cases) {
    const orientationKey = getTurnStartStatOrientationKey({
      viewerRole: candidate.role,
      leftPlayerId: candidate.left,
      rightPlayerId: candidate.right,
    });
    const prior = statPresentation({
      turnNumber: 2,
      total: 3,
      leftPlayerId: candidate.left,
      rightPlayerId: candidate.right,
    });
    const next = statPresentation({
      turnNumber: 3,
      total: 7,
      leftPlayerId: candidate.left,
      rightPlayerId: candidate.right,
    });
    let state = createTurnStartStatPresentationState({
      gameId: 'game-1', orientationKey, turnNumber: 2,
      presentation: prior, firstTurnRollPresentationActive: false,
    });
    state = syncTurnStartStatPresentation(state, {
      gameId: 'game-1', orientationKey, turnNumber: 3,
      presentation: next, settledTurnNumber: 2,
      firstTurnRollPresentationActive: false,
    });
    assertEquals(state.presented, prior, `${candidate.role} ${candidate.left} orientation should hold`);
  }

  const p1Orientation = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const p2Orientation = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p2', rightPlayerId: 'p1',
  });
  const old = statPresentation({ turnNumber: 4, total: 4 });
  const reoriented = statPresentation({
    turnNumber: 4, total: 8, leftPlayerId: 'p2', rightPlayerId: 'p1',
  });
  const originalOrientationState = createTurnStartStatPresentationState({
    gameId: 'game-1', orientationKey: p1Orientation, turnNumber: 4,
    presentation: old, firstTurnRollPresentationActive: false,
  });
  const reset = syncTurnStartStatPresentation(
    originalOrientationState,
    {
      gameId: 'game-1', orientationKey: p2Orientation, turnNumber: 4,
      presentation: reoriented, settledTurnNumber: null,
      firstTurnRollPresentationActive: false,
    },
  );
  assertNotSame(reset, originalOrientationState, 'an orientation change must create a new state');
  assertEquals(reset.presented, reoriented, 'an orientation change must hydrate instead of reusing held stats');

  const newGame = statPresentation({ turnNumber: 4, total: 12 });
  const originalGameState = createTurnStartStatPresentationState({
    gameId: 'game-1', orientationKey: p1Orientation, turnNumber: 4,
    presentation: old, firstTurnRollPresentationActive: false,
  });
  const gameReset = syncTurnStartStatPresentation(
    originalGameState,
    {
      gameId: 'game-2', orientationKey: p1Orientation, turnNumber: 4,
      presentation: newGame, settledTurnNumber: null,
      firstTurnRollPresentationActive: false,
    },
  );
  assertNotSame(gameReset, originalGameState, 'a game change must create a new state');
  assertEquals(gameReset.presented, newGame, 'a game change must hydrate instead of reusing held stats');
});

Deno.test('null stat resets are idempotent while changed reset scope still creates state', () => {
  const empty = createTurnStartStatPresentationState({
    gameId: null,
    orientationKey: null,
    turnNumber: null,
    presentation: null,
    firstTurnRollPresentationActive: false,
  });
  const repeatedEmpty = syncTurnStartStatPresentation(empty, {
    gameId: null,
    orientationKey: null,
    turnNumber: null,
    presentation: null,
    settledTurnNumber: null,
    firstTurnRollPresentationActive: false,
  });
  assertSame(repeatedEmpty, empty, 'equivalent empty reset input must reuse the existing state');

  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const scopedReset = syncTurnStartStatPresentation(repeatedEmpty, {
    gameId: 'game-1',
    orientationKey,
    turnNumber: 1,
    presentation: null,
    settledTurnNumber: null,
    firstTurnRollPresentationActive: false,
  });
  assertNotSame(scopedReset, repeatedEmpty, 'changed game, orientation, and turn scope must create reset state');
  const repeatedScopedReset = syncTurnStartStatPresentation(scopedReset, {
    gameId: 'game-1',
    orientationKey,
    turnNumber: 1,
    presentation: null,
    settledTurnNumber: 1,
    firstTurnRollPresentationActive: false,
  });
  assertSame(
    repeatedScopedReset,
    scopedReset,
    'equivalent null reset state must remain stable when settlement has nothing pending',
  );

  const spectatorOrientation = getTurnStartStatOrientationKey({
    viewerRole: 'spectator', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const reorientedReset = syncTurnStartStatPresentation(repeatedScopedReset, {
    gameId: 'game-1',
    orientationKey: spectatorOrientation,
    turnNumber: 1,
    presentation: null,
    settledTurnNumber: 1,
    firstTurnRollPresentationActive: false,
  });
  assertNotSame(reorientedReset, repeatedScopedReset, 'changed reset orientation must create new state');
});

Deno.test('a locally presented first-turn roll uses neutral zero stats while settled hydration remains immediate', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const setupPresentation = statPresentation({
    turnNumber: 0, total: 4, label: 'Setup presentation',
  });
  const setupState = createTurnStartStatPresentationState({
    gameId: 'game-1', orientationKey, turnNumber: 0,
    presentation: setupPresentation, firstTurnRollPresentationActive: false,
  });
  const firstEstimate = statPresentation({ turnNumber: 1, total: 7, label: 'Early estimate' });
  let rolling = syncTurnStartStatPresentation(setupState, {
    gameId: 'game-1', orientationKey, turnNumber: 1,
    presentation: firstEstimate, settledTurnNumber: 0,
    firstTurnRollPresentationActive: true,
  });
  assertNotSame(rolling, setupState, 'Turn 1 roll status and turn number must create a neutral hold state');
  const neutralMetrics = [
    rolling.presented?.me.damage,
    rolling.presented?.me.healing,
    rolling.presented?.opponent.damage,
    rolling.presented?.opponent.healing,
  ];
  const neutralMetricValues = neutralMetrics.map((pair) => {
    const current = pair?.current;
    const last = pair?.last;
    return [
      current?.state,
      current?.state === 'zero' || current?.state === 'value' ? current.total : null,
      last?.state,
      last?.state === 'zero' || last?.state === 'value' ? last.total : null,
    ];
  });
  assertEquals(
    neutralMetricValues,
    Array.from({ length: 4 }, () => ['zero', 0, 'zero', 0]),
    'all first-turn Current and Last slots should begin at neutral zero',
  );
  assertEquals(
    neutralMetrics.flatMap((pair) => [
      pair?.current.state === 'zero' ? pair.current.rows : ['unexpected'],
      pair?.last.state === 'zero' ? pair.last.rows : ['unexpected'],
    ]),
    Array.from({ length: 8 }, () => []),
    'neutral first-turn stats must not invent breakdown rows',
  );

  const initialRolling = rolling;
  rolling = syncTurnStartStatPresentation(rolling, {
    gameId: 'game-1', orientationKey, turnNumber: 1,
    presentation: statPresentation({
      turnNumber: 1, total: 7, label: 'Early estimate',
    }),
    settledTurnNumber: 0,
    firstTurnRollPresentationActive: true,
  });
  assertSame(
    rolling,
    initialRolling,
    'an equivalent newly allocated Turn 1 estimate must reuse the neutral hold state',
  );

  const latestEstimate = statPresentation({ turnNumber: 1, total: 11, label: 'Latest estimate' });
  rolling = syncTurnStartStatPresentation(rolling, {
    gameId: 'game-1', orientationKey, turnNumber: 1,
    presentation: latestEstimate, settledTurnNumber: null,
    firstTurnRollPresentationActive: true,
  });
  assertNotSame(rolling, initialRolling, 'a genuinely newer Turn 1 estimate must be retained');
  assertEquals(rolling.presented?.me.damage.current.state, 'zero', 'the neutral baseline must survive the roll');
  assertEquals(rolling.latest, latestEstimate, 'the newest Turn 1 estimate must be pending for release');
  const updatedRolling = rolling;
  rolling = syncTurnStartStatPresentation(rolling, {
    gameId: 'game-1', orientationKey, turnNumber: 1,
    presentation: statPresentation({
      turnNumber: 1, total: 11, label: 'Latest estimate',
    }),
    settledTurnNumber: null,
    firstTurnRollPresentationActive: true,
  });
  assertSame(rolling, updatedRolling, 'the repeated newest Turn 1 estimate must stabilize by reference');

  rolling = syncTurnStartStatPresentation(rolling, {
    gameId: 'game-1', orientationKey, turnNumber: 1,
    presentation: statPresentation({
      turnNumber: 1, total: 11, label: 'Latest estimate',
    }),
    settledTurnNumber: 1,
    firstTurnRollPresentationActive: false,
  });
  assertNotSame(rolling, updatedRolling, 'Turn 1 settlement must create the release state');
  assertEquals(rolling.presented, latestEstimate, 'first-turn settlement must release the latest estimate');
  const settledTurnOne = rolling;
  rolling = syncTurnStartStatPresentation(rolling, {
    gameId: 'game-1', orientationKey, turnNumber: 1,
    presentation: statPresentation({
      turnNumber: 1, total: 11, label: 'Latest estimate',
    }),
    settledTurnNumber: 1,
    firstTurnRollPresentationActive: false,
  });
  assertSame(rolling, settledTurnOne, 'equivalent settled Turn 1 input must reuse the release state');

  const hydrated = statPresentation({ turnNumber: 6, total: 13 });
  const hydratedState = createTurnStartStatPresentationState({
    gameId: 'game-2', orientationKey, turnNumber: 6,
    presentation: hydrated, firstTurnRollPresentationActive: false,
  });
  assertEquals(hydratedState.presented, hydrated, 'a midgame load with no local roll must hydrate immediately');
});

Deno.test('released stat presentation preserves opponent concealment without prior-turn fallback', () => {
  const orientationKey = getTurnStartStatOrientationKey({
    viewerRole: 'player', leftPlayerId: 'p1', rightPlayerId: 'p2',
  });
  const visible = statPresentation({ turnNumber: 5, total: 4 });
  const concealed = statPresentation({ turnNumber: 5, total: 8, opponentConcealed: true });
  const state = syncTurnStartStatPresentation(
    createTurnStartStatPresentationState({
      gameId: 'game-1', orientationKey, turnNumber: 5,
      presentation: visible, firstTurnRollPresentationActive: false,
    }),
    {
      gameId: 'game-1', orientationKey, turnNumber: 5,
      presentation: concealed, settledTurnNumber: 5,
      firstTurnRollPresentationActive: false,
    },
  );
  assertEquals(
    state.presented?.opponent.damage.current,
    { state: 'concealed', turnNumber: 5 },
    'concealment must pass through after release rather than borrowing the prior value',
  );
});

Deno.test('turn-start fleet materialisation hold covers the authoritative turn transition continuously', () => {
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 3,
      previouslyObservedTurnNumber: 3,
      releaseTurnNumber: null,
      settledTurnNumber: null,
    }),
    false,
    'initial hydration should not manufacture a fleet hold'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 4,
      previouslyObservedTurnNumber: 3,
      releaseTurnNumber: null,
      settledTurnNumber: 3,
    }),
    true,
    'the first authoritative new-turn render should retain the previous fleet footprint'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 4,
      previouslyObservedTurnNumber: 4,
      releaseTurnNumber: 4,
      settledTurnNumber: null,
    }),
    true,
    'release bookkeeping catch-up should keep the fleet hold active until settlement'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 4,
      previouslyObservedTurnNumber: 4,
      releaseTurnNumber: 4,
      settledTurnNumber: 4,
    }),
    false,
    'the existing current-turn dice settlement should release the fleet once'
  );
});

Deno.test('turn-start fleet materialisation hold ignores game changes and stale turns', () => {
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: false,
      turnNumber: 4,
      previouslyObservedTurnNumber: 3,
      releaseTurnNumber: 4,
      settledTurnNumber: 3,
    }),
    false,
    'presentation bookkeeping from another game must not hide a hydrated fleet'
  );
  assertEquals(
    shouldHoldTurnStartFleetMaterialisation({
      isSameGame: true,
      turnNumber: 3,
      previouslyObservedTurnNumber: 4,
      releaseTurnNumber: 4,
      settledTurnNumber: 4,
    }),
    false,
    'backward or stale authoritative turns should not create a new hold'
  );
});

Deno.test('setup-entry phase catch-up stays on Dice until current-turn dice settle', () => {
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: true,
      currentTurnDicePresentationSettled: false,
    }),
    true,
    'the live setup-to-turn path should remain at Dice while its presentation is unsettled'
  );
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: true,
      currentTurnDicePresentationSettled: true,
    }),
    false,
    'the normal phase catch-up path should resume as soon as dice settle'
  );
});

Deno.test('dice settlement does not add a phase hold outside setup entry', () => {
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: false,
      currentTurnDicePresentationSettled: false,
    }),
    false,
    'later-turn Dice timing must remain independent of the setup-entry gate'
  );
  assertEquals(
    shouldHoldSetupTurnDiceCatchUp({
      setupTurnDiceCatchUpPending: false,
      currentTurnDicePresentationSettled: true,
    }),
    false,
    'hydrated settled turns must not manufacture a new phase hold'
  );
});

Deno.test('unsettled Drawing downgrades only an otherwise buildable catalogue', () => {
  const unsettledDrawing = {
    phaseKey: 'build.drawing',
    currentTurnDicePresentationSettled: false,
  };

  assertEquals(
    applyTurnStartCataloguePresentationGate({
      ...unsettledDrawing,
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      normalContext: 'buildable',
    }),
    'unavailable',
    'newly available Drawing build interaction should remain unavailable until dice settle'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      ...unsettledDrawing,
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      normalContext: 'reference_only',
    }),
    'reference_only',
    'existing reference-only policy should pass through unchanged'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      ...unsettledDrawing,
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      normalContext: 'unavailable',
    }),
    'unavailable',
    'existing unavailable policy should pass through unchanged'
  );
});

Deno.test('settlement and non-Drawing phases preserve the normal catalogue context', () => {
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: true,
      normalContext: 'buildable',
    }),
    'buildable',
    'settled Drawing should restore buildability immediately'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'battle.first_strike',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'unavailable',
    }),
    'unavailable',
    'dice settlement must not redefine non-Drawing catalogue policy'
  );
});

Deno.test('Play Computer catalogue stays unavailable from Mission intro through Turn 1 dice', () => {
  const progression = [
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: true,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'buildable',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: true,
      normalContext: 'buildable',
    }),
  ];

  assertEquals(
    progression,
    ['reference_only', 'unavailable', 'unavailable', 'buildable'],
    'Mission games should progress from species reference through intro/dice unavailable to settled buildable'
  );
});

Deno.test('multiplayer catalogue stays unavailable from matchup intro through Turn 1 dice', () => {
  const progression = [
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'setup.species_selection',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: true,
      currentTurnDicePresentationSettled: false,
      normalContext: 'reference_only',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: false,
      normalContext: 'buildable',
    }),
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled: true,
      normalContext: 'buildable',
    }),
  ];

  assertEquals(
    progression,
    ['reference_only', 'unavailable', 'unavailable', 'buildable'],
    'multiplayer should progress from species reference through matchup/dice unavailable to settled buildable'
  );
});

Deno.test('intro hold flags do not redefine unrelated phases', () => {
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'battle.first_strike',
      missionIntroHoldActive: true,
      matchupIntroHoldActive: true,
      currentTurnDicePresentationSettled: true,
      normalContext: 'reference_only',
    }),
    'reference_only',
    'stale or irrelevant intro flags must not affect non-setup catalogue policy'
  );
});

Deno.test('ordinary Drawing interaction is held without delaying prelude workflows', () => {
  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: false,
    }),
    true,
    'ordinary build and Ready interaction should be held before settlement'
  );
  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'build.drawing',
      drawingStageKind: 'prelude',
      currentTurnDicePresentationSettled: false,
    }),
    false,
    'Drawing preludes should remain outside the ordinary interaction hold'
  );
  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'battle.first_strike',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: false,
    }),
    false,
    'unrelated phases should remain outside the Drawing hold'
  );
});

Deno.test('Drawing Ready economy copy releases exactly at dice settlement', () => {
  const economy = {
    projectedSavedOrdinary: 5,
    projectedSavedJoining: 0,
    projectedSavedCombined: 5,
    projectedSavedWasCapped: false,
  };

  assertEquals(
    deriveBuildDrawingReadyNote({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: false,
      economy,
    }),
    null,
    'unsettled Drawing must not expose projected save-lines copy'
  );
  assertEquals(
    deriveBuildDrawingReadyNote({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled: true,
      economy,
    }),
    'Save 5 lines',
    'settlement should restore the ordinary Drawing Ready note without another delay'
  );
});

Deno.test('hydrated current turns already considered settled do not acquire a new gate', () => {
  const currentTurnDicePresentationSettled = isCurrentTurnDicePresentationSettled({
    turnNumber: 4,
    settledTurnNumber: 4,
  });

  assertEquals(
    isNormalDrawingInteractionHeld({
      phaseKey: 'build.drawing',
      drawingStageKind: 'normal',
      currentTurnDicePresentationSettled,
    }),
    false,
    'an already-settled hydrated turn should expose ordinary Drawing immediately'
  );
  assertEquals(
    applyTurnStartCataloguePresentationGate({
      phaseKey: 'build.drawing',
      missionIntroHoldActive: false,
      matchupIntroHoldActive: false,
      currentTurnDicePresentationSettled,
      normalContext: 'buildable',
    }),
    'buildable',
    'settled hydration and ordinary later turns should retain their normal catalogue context'
  );
});
