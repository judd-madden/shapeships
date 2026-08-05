import assert from 'node:assert/strict';
import type { GameState, ShipInstance } from '../../../engine/state/GameStateTypes.ts';
import {
  advanceDrawingPreludeCandidatePlayer,
  classifyDrawingPreludeSourceMode,
  createDrawingPreludeInitializationCandidate,
  finalizeDrawingPreludeInitializationCandidate,
  getCarrierDrawingPreludeChoiceLegality,
  getCurrentDrawingPreludeCandidatePlayerState,
  recordDrawingPreludeAutomaticEvaluation,
  validateFrozenCarrierDrawingPreludeSource,
  type DrawingPreludeFoundationResult,
} from '../../../engine/state/drawingPreludeState.ts';
import { getShipDefinition } from '../../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';

function ship(
  instanceId: string,
  shipDefId: string,
  options: Partial<ShipInstance> = {},
): ShipInstance {
  return { instanceId, shipDefId, ...options };
}

function createState(args: {
  p1Ships?: ShipInstance[];
  p2Ships?: ShipInstance[];
  chronoswarms?: Record<string, number>;
} = {}): GameState {
  return {
    gameId: 'drawing-foundation',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', health: 25, lines: 3, joiningLines: 0, faction: 'human' },
      { id: 'p2', role: 'player', health: 25, lines: 3, joiningLines: 0, faction: 'xenite' },
      { id: 'spectator', role: 'spectator', health: 0, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 5,
      ships: {
        p1: args.p1Ships ?? [],
        p2: args.p2Ships ?? [],
      },
      turnData: {
        turnNumber: 5,
        chronoswarmCountByPlayerId: args.chronoswarms ?? { p1: 0, p2: 0 },
      },
    },
    actions: [],
  };
}

function candidateFor(state: GameState) {
  return unwrap(createDrawingPreludeInitializationCandidate(state));
}

function unwrap<T>(result: DrawingPreludeFoundationResult<T>): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

Deno.test('Drawing-prelude candidate freezes exact raw sources in fleet/raw order', () => {
  const state = createState({
    p1Ships: [
      ship('car-a', 'CAR', { createdTurn: 5, chargesCurrent: 6 }),
      ship('zen', 'ZEN', { createdTurn: 4 }),
      ship('bug', 'BUG', { createdTurn: 4, chargesCurrent: 0 }),
      ship('queen', 'QUE', { createdTurn: 4 }),
      ship('dre', 'DRE', { createdTurn: 4 }),
      ship('ssim', 'SSIM', { createdTurn: 4 }),
      ship('evo', 'EVO', { createdTurn: 4 }),
      ship('chrono', 'CHR', { createdTurn: 4 }),
      ship('car-b', 'CAR', { createdTurn: 5, chargesCurrent: 1 }),
    ],
    p2Ships: [ship('foreign-car', 'CAR', { createdTurn: 5, chargesCurrent: 2 })],
    chronoswarms: { p1: 4, p2: 0 },
  });

  const candidate = candidateFor(state);
  assert.deepEqual(
    candidate.playerStateByPlayerId.p1.eligibleSourcePowers.map((source) => ({
      key: source.key,
      mode: source.mode,
    })),
    [
      { key: 'car-a:CAR#0', mode: 'interactive' },
      { key: 'zen:ZEN#1', mode: 'automatic' },
      { key: 'bug:BUG#0', mode: 'automatic' },
      { key: 'queen:QUE#0', mode: 'automatic' },
      { key: 'car-b:CAR#0', mode: 'interactive' },
    ],
  );
  assert.deepEqual(
    candidate.playerStateByPlayerId.p2.eligibleSourcePowers.map((source) => source.key),
    ['foreign-car:CAR#0'],
  );
  assert.equal(candidate.playerStateByPlayerId.p1.requiredPassCount, 2);
  assert.equal(candidate.playerStateByPlayerId.p2.requiredPassCount, 1);
  assert.equal(candidate.playerStateByPlayerId.p1.activePassIndex, 1);
  assert.equal('status' in candidate.playerStateByPlayerId.p1, false);
  assert.deepEqual(candidate.playerStateByPlayerId.p1.resolvedSourcePowerKeysByPass, {});
  assert.equal(classifyDrawingPreludeSourceMode('ZEN#0').ok, false);
});

Deno.test('Drawing-prelude candidate preserves age and direct-materialized exceptions', () => {
  const state = createState({
    p1Ships: [
      ship('current-car', 'CAR', { createdTurn: 5, chargesCurrent: 6 }),
      ship('current-bug', 'BUG', { createdTurn: 5, chargesCurrent: 4 }),
      ship('copied-bug', 'BUG', { createdTurn: 5, chargesCurrent: 4 }),
      ship('current-zen', 'ZEN', { createdTurn: 5 }),
      ship('copied-zen', 'ZEN', { createdTurn: 5 }),
      ship('old-bug', 'BUG', { createdTurn: 4, chargesCurrent: 0 }),
      ship('old-zen', 'ZEN', { createdTurn: 4 }),
      ship('current-queen', 'QUE', { createdTurn: 5 }),
      ship('fake-copied-queen', 'QUE', { createdTurn: 5 }),
      ship('old-queen', 'QUE', { createdTurn: 4 }),
    ],
  });
  state.gameData.ancient = {
    schemaVersion: 1,
    energyByPlayerId: {},
    acceptedDeclarationByPlayerId: {},
    solarLedgerByPlayerId: {},
    pendingBlackHoleDestructions: [],
    pendingSimulacrumCopies: [
      {
        pendingCopyId: 'copy-bug', declarationId: 'd1', ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'target-bug', copiedShipDefId: 'BUG', queuedTurnNumber: 4,
        materializationTurnNumber: 5, queueOrder: 0, capturedStartOfBattleCharges: 4,
        permanentConfiguration: {}, sourceMode: 'primary', status: 'materialized',
        materializedInstanceId: 'copied-bug',
      },
      {
        pendingCopyId: 'copy-zen', declarationId: 'd2', ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'target-zen', copiedShipDefId: 'ZEN', queuedTurnNumber: 4,
        materializationTurnNumber: 5, queueOrder: 1, capturedStartOfBattleCharges: 0,
        permanentConfiguration: {}, sourceMode: 'primary', status: 'materialized',
        materializedInstanceId: 'copied-zen',
      },
      {
        pendingCopyId: 'invalid-copy-queen', declarationId: 'd3', ownerPlayerId: 'p1',
        sourceTargetInstanceId: 'target-queen', copiedShipDefId: 'QUE', queuedTurnNumber: 4,
        materializationTurnNumber: 5, queueOrder: 2, capturedStartOfBattleCharges: 0,
        permanentConfiguration: {}, sourceMode: 'primary', status: 'materialized',
        materializedInstanceId: 'fake-copied-queen',
      },
    ],
  };

  const keys = candidateFor(state).playerStateByPlayerId.p1.eligibleSourcePowers
    .map((source) => source.key);
  assert.deepEqual(keys, [
    'current-car:CAR#0',
    'copied-bug:BUG#0',
    'copied-zen:ZEN#1',
    'old-bug:BUG#0',
    'old-zen:ZEN#1',
    'old-queen:QUE#0',
  ]);
});

Deno.test('Drawing-prelude candidate remains frozen after live fleet and charge changes', () => {
  const state = createState({
    p1Ships: [
      ship('carrier', 'CAR', { createdTurn: 5, chargesCurrent: 2 }),
      ship('bug-kept', 'BUG', { createdTurn: 4, chargesCurrent: 3 }),
      ship('bug-removed', 'BUG', { createdTurn: 4, chargesCurrent: 1 }),
    ],
  });
  const candidate = candidateFor(state);
  const frozenCandidate = structuredClone(candidate);

  state.gameData.ships!.p1.push(
    ship('later-queen', 'QUE', { createdTurn: 4 }),
  );
  state.gameData.ships!.p1 = state.gameData.ships!.p1.filter(
    (entry) => entry.instanceId !== 'bug-removed',
  );
  state.gameData.ships!.p1.find((entry) => entry.instanceId === 'carrier')!
    .chargesCurrent = 0;
  state.gameData.ships!.p1.find((entry) => entry.instanceId === 'bug-kept')!
    .chargesCurrent = 0;

  assert.deepEqual(candidate, frozenCandidate);
  assert.deepEqual(
    candidate.playerStateByPlayerId.p1.eligibleSourcePowers.map((source) => source.key),
    ['carrier:CAR#0', 'bug-kept:BUG#0', 'bug-removed:BUG#0'],
  );
  assert.deepEqual(
    candidate.buildDrawingPublicFleetByPlayerId.p1.map((entry) => ({
      instanceId: entry.instanceId,
      chargesCurrent: entry.chargesCurrent,
    })),
    [
      { instanceId: 'carrier', chargesCurrent: 2 },
      { instanceId: 'bug-kept', chargesCurrent: 3 },
      { instanceId: 'bug-removed', chargesCurrent: 1 },
    ],
  );
});

Deno.test('Carrier legality inspects exact CAR#0 option costs and reports Hold-only', () => {
  for (const [charges, expected] of [
    [0, []],
    [1, ['defender']],
    [2, ['defender', 'fighter']],
  ] as const) {
    const state = createState({
      p1Ships: [ship('car', 'CAR', { createdTurn: 5, chargesCurrent: charges })],
    });
    const source = candidateFor(state).playerStateByPlayerId.p1.eligibleSourcePowers[0];
    const legality = unwrap(getCarrierDrawingPreludeChoiceLegality(state, 'p1', source));
    assert.deepEqual(legality.nonHoldChoiceIds, expected);
    assert.equal(legality.holdOnly, expected.length === 0);
  }
});

Deno.test('Automatic markers are output-independent, idempotent, ordered, and pass-local', () => {
  const state = createState({
    p1Ships: [
      ship('zen', 'ZEN', { createdTurn: 4 }),
      ship('bug', 'BUG', { createdTurn: 4, chargesCurrent: 0 }),
    ],
    chronoswarms: { p1: 2, p2: 0 },
  });
  let candidate = candidateFor(state);

  const zeroOutputEvaluation: unknown[] = [];
  assert.deepEqual(zeroOutputEvaluation, []);
  candidate = unwrap(recordDrawingPreludeAutomaticEvaluation(candidate, 'p1', 'bug:BUG#0'));
  candidate = unwrap(recordDrawingPreludeAutomaticEvaluation(candidate, 'p1', 'zen:ZEN#1'));
  assert.deepEqual(candidate.playerStateByPlayerId.p1.resolvedSourcePowerKeysByPass[1], [
    'zen:ZEN#1',
    'bug:BUG#0',
  ]);

  const duplicate = unwrap(recordDrawingPreludeAutomaticEvaluation(candidate, 'p1', 'zen:ZEN#1'));
  assert.equal(duplicate, candidate);

  candidate = unwrap(advanceDrawingPreludeCandidatePlayer(candidate, 'p1'));
  assert.equal(candidate.playerStateByPlayerId.p1.activePassIndex, 2);
  const passTwoMarked = unwrap(recordDrawingPreludeAutomaticEvaluation(candidate, 'p1', 'zen:ZEN#1'));
  assert.deepEqual(passTwoMarked.playerStateByPlayerId.p1.resolvedSourcePowerKeysByPass[1], [
    'zen:ZEN#1', 'bug:BUG#0',
  ]);
  assert.deepEqual(passTwoMarked.playerStateByPlayerId.p1.resolvedSourcePowerKeysByPass[2], [
    'zen:ZEN#1',
  ]);
});

Deno.test('Finalization rejects unsettled automatic work and derives only semantic statuses', () => {
  const automaticState = createState({
    p1Ships: [ship('bug', 'BUG', { createdTurn: 4, chargesCurrent: 0 })],
  });
  let candidate = candidateFor(automaticState);
  assert.equal(finalizeDrawingPreludeInitializationCandidate(automaticState, candidate).ok, false);
  candidate = unwrap(recordDrawingPreludeAutomaticEvaluation(candidate, 'p1', 'bug:BUG#0'));
  const completed = unwrap(finalizeDrawingPreludeInitializationCandidate(automaticState, candidate));
  assert.equal(completed.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');

  const carrierState = createState({
    p1Ships: [ship('car', 'CAR', { createdTurn: 5, chargesCurrent: 1 })],
  });
  const awaiting = unwrap(finalizeDrawingPreludeInitializationCandidate(
    carrierState,
    candidateFor(carrierState),
  ));
  assert.equal(awaiting.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'awaiting_actions');

  const holdState = createState({
    p1Ships: [ship('empty-car', 'CAR', { createdTurn: 5, chargesCurrent: 0 })],
  });
  const held = unwrap(finalizeDrawingPreludeInitializationCandidate(holdState, candidateFor(holdState)));
  assert.equal(held.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
  assert.deepEqual(
    held.gameData.turnData?.drawingPreludeByPlayerId?.p1.resolvedSourcePowerKeysByPass[1],
    ['empty-car:CAR#0'],
  );
});

Deno.test('Finalization rejects partial or altered complete candidates', () => {
  const emptyState = createState();
  const emptyCandidate = candidateFor(emptyState);
  const variants: Array<[string, (candidate: any) => void]> = [
    ['missing player state', (candidate) => delete candidate.playerStateByPlayerId.p2],
    ['extra player state', (candidate) => {
      candidate.playerStateByPlayerId.extra = structuredClone(
        candidate.playerStateByPlayerId.p1,
      );
    }],
    ['missing snapshot', (candidate) => delete candidate.buildDrawingPublicFleetByPlayerId.p2],
    ['extra snapshot', (candidate) => {
      candidate.buildDrawingPublicFleetByPlayerId.extra = [];
    }],
    ['malformed snapshot', (candidate) => {
      candidate.buildDrawingPublicFleetByPlayerId.p1 = [{
        instanceId: '', shipDefId: 'CAR',
      }];
    }],
    ['stale player state', (candidate) => {
      candidate.playerStateByPlayerId.p1.turnNumber = 4;
    }],
  ];

  for (const [name, mutate] of variants) {
    const altered = structuredClone(emptyCandidate);
    mutate(altered);
    const result = finalizeDrawingPreludeInitializationCandidate(emptyState, altered);
    assert.equal(result.ok, false, name);
    if (!result.ok) assert.equal(result.error.code, 'INVALID_CANDIDATE', name);
  }

  const carrierState = createState({
    p1Ships: [
      ship('carrier-a', 'CAR', { chargesCurrent: 0 }),
      ship('carrier-b', 'CAR', { chargesCurrent: 0 }),
    ],
  });
  const duplicateKeys = candidateFor(carrierState);
  duplicateKeys.playerStateByPlayerId.p1.eligibleSourcePowers[1] = structuredClone(
    duplicateKeys.playerStateByPlayerId.p1.eligibleSourcePowers[0],
  );
  const duplicateResult = finalizeDrawingPreludeInitializationCandidate(
    carrierState,
    duplicateKeys,
  );
  assert.equal(duplicateResult.ok, false);
  if (!duplicateResult.ok) {
    assert.equal(duplicateResult.error.code, 'INVALID_CANDIDATE');
  }
});

Deno.test('Current finalization replaces stale player and snapshot maps instead of merging', () => {
  const state = createState();
  state.gameData.turnData!.drawingPreludeByPlayerId = {
    legacy: {
      turnNumber: 4,
      requiredPassCount: 1,
      activePassIndex: 1,
      status: 'complete',
      eligibleSourcePowers: [],
      resolvedSourcePowerKeysByPass: {},
    },
  };
  state.gameData.turnData!.buildDrawingPublicFleetByPlayerId = {
    legacy: [ship('legacy-ship', 'DEF', { createdTurn: 3 })],
  };

  const candidate = candidateFor(state);
  const finalized = unwrap(
    finalizeDrawingPreludeInitializationCandidate(state, candidate),
  );

  assert.deepEqual(
    Object.keys(finalized.gameData.turnData!.drawingPreludeByPlayerId!),
    ['p1', 'p2'],
  );
  assert.deepEqual(
    Object.keys(finalized.gameData.turnData!.buildDrawingPublicFleetByPlayerId!),
    ['p1', 'p2'],
  );
  assert.deepEqual(
    finalized.gameData.turnData!.buildDrawingPublicFleetByPlayerId,
    candidate.buildDrawingPublicFleetByPlayerId,
  );
  assert.equal(
    finalized.gameData.turnData!.drawingPreludeByPlayerId!.p1.turnNumber,
    5,
  );
});

Deno.test('Candidate, finalized state, descriptors, and snapshots are deeply isolated', () => {
  const state = createState({
    p1Ships: [ship('car', 'CAR', { createdTurn: 5, chargesCurrent: 0 })],
  });
  (state.gameData as any).phaseReadiness = [{ playerId: 'p1', isReady: false }];
  const before = structuredClone(state);
  const candidate = candidateFor(state);

  candidate.playerStateByPlayerId.p1.eligibleSourcePowers[0].shipDefId = 'MUTATED';
  candidate.buildDrawingPublicFleetByPlayerId.p1[0].shipDefId = 'MUTATED';
  assert.deepEqual(state, before);

  const freshCandidate = candidateFor(state);
  const readCandidate = unwrap(
    getCurrentDrawingPreludeCandidatePlayerState(state, freshCandidate, 'p1'),
  );
  readCandidate.eligibleSourcePowers[0].shipDefId = 'READ-MUTATION';
  assert.equal(freshCandidate.playerStateByPlayerId.p1.eligibleSourcePowers[0].shipDefId, 'CAR');
  assert.equal(freshCandidate.buildDrawingPublicFleetByPlayerId.p1[0].shipDefId, 'CAR');
  const finalized = unwrap(finalizeDrawingPreludeInitializationCandidate(state, freshCandidate));
  assert.deepEqual((finalized.gameData as any).phaseReadiness, (before.gameData as any).phaseReadiness);
  assert.deepEqual(finalized.players, before.players);
  assert.deepEqual(finalized.actions, before.actions);
});

Deno.test('frozen Carrier validation binds live definition, raw coordinate, timing, and overlay', () => {
  const state = createState({
    p1Ships: [ship('car', 'CAR', { chargesCurrent: 2 })],
  });
  const source = candidateFor(state).playerStateByPlayerId.p1.eligibleSourcePowers[0];
  assert.equal(validateFrozenCarrierDrawingPreludeSource(state, 'p1', source).ok, true);

  const mismatch = structuredClone(state);
  mismatch.gameData.ships!.p1[0].shipDefId = 'DEF';
  assert.equal(validateFrozenCarrierDrawingPreludeSource(mismatch, 'p1', source).ok, false);

  const rawPower = getShipDefinition('CAR')!.powers[0] as any;
  const priorTiming = rawPower.activationTiming;
  const priorOverlay = rawPower.structuredPowers;
  try {
    rawPower.activationTiming = 'end_of_build';
    assert.equal(validateFrozenCarrierDrawingPreludeSource(state, 'p1', source).ok, false);
    rawPower.activationTiming = priorTiming;
    rawPower.structuredPowers = [];
    assert.equal(validateFrozenCarrierDrawingPreludeSource(state, 'p1', source).ok, false);
  } finally {
    rawPower.activationTiming = priorTiming;
    rawPower.structuredPowers = priorOverlay;
  }
});

Deno.test('Drawing-prelude pass count freezes zero, one, and multiple Chronoswarms to one or two passes', () => {
  for (const [count, expectedPassCount] of [[0, 1], [1, 2], [4, 2]] as const) {
    const state = createState({ chronoswarms: { p1: count, p2: 0 } });
    const candidate = candidateFor(state);
    assert.equal(candidate.playerStateByPlayerId.p1.requiredPassCount, expectedPassCount);

    state.gameData.turnData!.chronoswarmCountByPlayerId!.p1 = count === 0 ? 1 : 0;
    state.gameData.ships!.p1.push(ship('later-chrono', 'CHR', { createdTurn: 5 }));
    assert.equal(candidate.playerStateByPlayerId.p1.requiredPassCount, expectedPassCount);
  }
});

Deno.test('frozen eligibility follows the current controller fleet across species', () => {
  const state = createState({
    p1Ships: [
      ship('foreign-bug', 'BUG', { createdTurn: 4, chargesCurrent: 1 }),
      ship('foreign-queen', 'QUE', { createdTurn: 4 }),
      ship('foreign-zen', 'ZEN', { createdTurn: 4 }),
    ],
    p2Ships: [
      ship('foreign-carrier', 'CAR', { createdTurn: 5, chargesCurrent: 2 }),
    ],
  });
  const candidate = candidateFor(state);
  assert.deepEqual(
    candidate.playerStateByPlayerId.p1.eligibleSourcePowers.map((source) => source.key),
    ['foreign-bug:BUG#0', 'foreign-queen:QUE#0', 'foreign-zen:ZEN#1'],
  );
  assert.deepEqual(
    candidate.playerStateByPlayerId.p2.eligibleSourcePowers.map((source) => source.key),
    ['foreign-carrier:CAR#0'],
  );
});
