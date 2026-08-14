import assert from 'node:assert/strict';
import type { GameState } from '../../../engine/state/GameStateTypes.ts';
import {
  advanceDrawingPreludeForPlayer,
  createDrawingPreludeEffectId,
  resolveDrawingPreludePowerAction,
  resolveDrawingPreludePowerActionsBatch,
} from '../../../engine/intent/drawingPreludeResolution.ts';
import { createPrivateDrawingPreludeCueKey } from '../../../engine/state/drawingPreludeProjection.ts';

function createState(sources: Array<{ instanceId: string; shipDefId: string; chargesCurrent?: number }>): GameState {
  const eligibleSourcePowers = sources.map((source) => {
    const rawPowerIndex = source.shipDefId === 'ZEN' ? 1 : 0;
    return {
      key: `${source.instanceId}:${source.shipDefId}#${rawPowerIndex}`,
      sourceInstanceId: source.instanceId,
      shipDefId: source.shipDefId,
      rawPowerIndex,
      mode: source.shipDefId === 'CAR' ? 'interactive' as const : 'automatic' as const,
    };
  });
  return {
    gameId: 'prelude-resolution',
    status: 'active',
    players: [
      { id: 'p1', name: 'One', role: 'player', faction: 'human', health: 25, lines: 10, joiningLines: 0 },
      { id: 'p2', name: 'Two', role: 'player', faction: 'human', health: 25, lines: 10, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: {
        p1: sources.map((source) => ({ ...source, createdTurn: 1 })),
        p2: [],
      },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        effectiveDiceRollByPlayerId: { p1: 4 },
        drawingPreludeByPlayerId: {
          p1: {
            turnNumber: 3,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: 'awaiting_actions',
            eligibleSourcePowers,
            resolvedSourcePowerKeysByPass: {},
          },
        },
        buildDrawingPublicFleetByPlayerId: { p1: [], p2: [] },
      },
    },
    actions: [],
    events: [],
    battleLogScratch: { currentTurnCapture: null, lastFinalizedTurnNumber: null, archiveCheckpoint: null },
  } as GameState;
}

function power(sourceInstanceId: string, choiceId: string, passIndex: 1 | 2 = 1) {
  return { actionType: 'power', actionId: 'CAR#0', sourceInstanceId, choiceId, passIndex };
}

function requireTwoPasses(state: GameState, chronoswarmRoll: unknown = 2): GameState {
  const next = structuredClone(state);
  next.gameData.turnData!.drawingPreludeByPlayerId!.p1.requiredPassCount = 2;
  (next.gameData.turnData as any).chronoswarmRolls = [chronoswarmRoll];
  return next;
}

Deno.test('Drawing-prelude effect identity is deterministic and pass-aware', () => {
  const common = {
    turnNumber: 3,
    playerId: 'p1',
    frozenSourceKey: 'car-1:CAR#0',
    choiceOrAutomatic: 'defender',
    effectOrdinal: 0,
  };
  const pass1 = createDrawingPreludeEffectId({ ...common, activePassIndex: 1 });
  const pass2 = createDrawingPreludeEffectId({ ...common, activePassIndex: 2 });
  assert.notEqual(pass1, pass2);
  assert.equal(pass1, createDrawingPreludeEffectId({ ...common, activePassIndex: 1 }));
});

Deno.test('automatic BUG applies charge and creation, verifies accounting, capture, marker, cue, and privacy', () => {
  const state = createState([{ instanceId: 'bug-1', shipDefId: 'BUG', chargesCurrent: 1 }]);
  const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.gameData.ships?.p1?.find((ship) => ship.instanceId === 'bug-1')?.chargesCurrent, 0);
  assert.equal(result.state.gameData.ships?.p1?.filter((ship) => ship.shipDefId === 'XEN').length, 1);
  assert.equal(result.state.gameData.turnData?.shipsMadeThisTurnByPlayerId?.p1, 1);
  assert.deepEqual(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.resolvedSourcePowerKeysByPass[1], ['bug-1:BUG#0']);
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
  assert.equal(result.events.every((event) => event.drawingPreludeVisibility?.playerId === 'p1'), true);
  assert.equal(result.events.filter((event) => event.type === 'EFFECT_APPLIED').length, 2);
  assert.deepEqual(
    result.events.find((event) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED'
    )?.producedBuildOccurrence,
    { stage: 'drawing_prelude', passIndex: 1 },
  );
  assert.equal(
    result.events.find((event) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED'
    )?.sourceShipInstanceId,
    'bug-1',
  );
  assert.equal(result.state.gameData.turnData?.shipActivationCueBatches?.[0].sources[0].sourceInstanceId, 'bug-1');
  const repeated = advanceDrawingPreludeForPlayer({ state: result.state, playerId: 'p1', nowMs: 11 });
  assert.equal(repeated.ok, true);
  if (repeated.ok) assert.equal(repeated.changed, false);
});

Deno.test('status-only completion reports changed when an awaiting prelude has no sources', () => {
  const state = createState([]);
  const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.changed, true);
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
});

Deno.test('automatic zero-output BUG and ZEN mark exactly once without capture or cue', () => {
  const state = createState([
    { instanceId: 'bug-0', shipDefId: 'BUG', chargesCurrent: 0 },
    { instanceId: 'zen-1', shipDefId: 'ZEN' },
  ]);
  state.gameData.turnData!.effectiveDiceRollByPlayerId = { p1: 1 };
  const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.events, []);
  assert.equal(result.state.gameData.turnData?.shipActivationCueBatches, undefined);
  assert.deepEqual(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.resolvedSourcePowerKeysByPass[1], ['bug-0:BUG#0', 'zen-1:ZEN#1']);
});

Deno.test('automatic QUE and recurring ZEN retain source accounting and roll outcomes', () => {
  for (const [roll, expectedZenDefs] of [[2, ['XEN']], [3, ['ANT']], [4, ['XEN', 'XEN']]] as const) {
    const state = createState([
      { instanceId: 'queen-1', shipDefId: 'QUE' },
      { instanceId: 'zen-1', shipDefId: 'ZEN' },
    ]);
    state.gameData.turnData!.effectiveDiceRollByPlayerId = { p1: roll };
    const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
    assert.equal(result.ok, true);
    if (!result.ok) continue;
    const created = result.events
      .filter((event) => event.type === 'EFFECT_APPLIED' && event.kind === 'CreateShip')
      .map((event) => event.details.shipDefId);
    assert.deepEqual(created, ['XEN', ...expectedZenDefs]);
    assert.equal(result.state.gameData.turnData?.shipsMadeThisTurnByPlayerId?.p1, 1 + expectedZenDefs.length);
    assert.equal(result.state.gameData.turnData?.queenCreatedXenitesThisTurnByPlayerId?.p1, 1);
    assert.deepEqual(
      result.state.gameData.turnData?.shipActivationCueBatches?.[0].sources.map((source) => source.sourceInstanceId),
      ['queen-1', 'zen-1'],
    );
  }
});

Deno.test('Carrier resolution uses pass-aware IDs, marks all events, and emits no batch acknowledgement for ACTION', () => {
  const state = createState([{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 }]);
  const result = resolveDrawingPreludePowerAction({ state, playerId: 'p1', action: power('car-1', 'defender'), nowMs: 20 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const effectEvents = result.events.filter((event) => event.type === 'EFFECT_APPLIED');
  assert.equal(effectEvents.length, 2);
  assert.equal(effectEvents.every((event) => event.effectId.startsWith('drawing-prelude:3:p1:pass:1:car-1:CAR#0:defender:')), true);
  assert.equal(result.events.some((event) => event.type === 'POWERS_BATCH_SUBMITTED'), false);
  assert.equal(result.events.every((event) => event.drawingPreludeVisibility?.playerId === 'p1'), true);
  assert.deepEqual(
    result.events.find((event) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED'
    )?.producedBuildOccurrence,
    { stage: 'drawing_prelude', passIndex: 1 },
  );
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
  assert.equal(result.state.gameData.ships?.p1?.find((ship) => ship.instanceId === 'car-1')?.chargesCurrent, 1);
  assert.equal(result.state.gameData.turnData?.shipsThatBuildPassUsageByInstanceId, undefined);
  assert.equal(result.state.gameData.turnData?.chargePowerUsedByInstanceId, undefined);
  assert.deepEqual((result.state.gameData as any).phaseReadiness, []);
});

Deno.test('partial Carrier batches merge cues in acceptance order and one batch emits one acknowledgement', () => {
  const state = createState([
    { instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 },
    { instanceId: 'car-2', shipDefId: 'CAR', chargesCurrent: 2 },
  ]);
  const first = resolveDrawingPreludePowerActionsBatch({ state, playerId: 'p1', actions: [power('car-2', 'fighter')], nowMs: 20 });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'awaiting_actions');
  assert.equal(first.events.filter((event) => event.type === 'POWERS_BATCH_SUBMITTED').length, 1);
  assert.equal(first.events.every((event) => event.drawingPreludeVisibility?.playerId === 'p1'), true);
  const second = resolveDrawingPreludePowerAction({ state: first.state, playerId: 'p1', action: power('car-1', 'defender'), nowMs: 21 });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  const cue = second.state.gameData.turnData?.shipActivationCueBatches?.find((batch) => batch.key === createPrivateDrawingPreludeCueKey({ turnNumber: 3, playerId: 'p1', passIndex: 1 }));
  assert.deepEqual(cue?.sources.map((source) => source.sourceInstanceId), ['car-2', 'car-1']);
  assert.equal(second.events.some((event) => event.type === 'POWERS_BATCH_SUBMITTED'), false);
});

Deno.test('accepted Hold emits only one private POWER_USED and no cue', () => {
  const state = createState([{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 }]);
  const result = resolveDrawingPreludePowerAction({ state, playerId: 'p1', action: power('car-1', 'hold'), nowMs: 20 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.events.map((event) => event.type), ['POWER_USED']);
  assert.equal(result.events[0].drawingPreludeVisibility?.playerId, 'p1');
  assert.equal(result.state.gameData.turnData?.shipActivationCueBatches, undefined);
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
});

Deno.test('live advancement forces zero-charge Carrier Hold without events, cues, or legacy marker mutation', () => {
  const state = createState([{ instanceId: 'car-0', shipDefId: 'CAR', chargesCurrent: 0 }]);
  const readinessBefore = structuredClone((state.gameData as any).phaseReadiness);
  const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 20 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.changed, true);
  assert.deepEqual(result.events, []);
  assert.equal(result.state.gameData.turnData?.shipActivationCueBatches, undefined);
  assert.deepEqual(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.resolvedSourcePowerKeysByPass[1], ['car-0:CAR#0']);
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
  assert.equal(result.state.gameData.turnData?.shipsThatBuildPassUsageByInstanceId, undefined);
  assert.equal(result.state.gameData.turnData?.chargePowerUsedByInstanceId, undefined);
  assert.deepEqual((result.state.gameData as any).phaseReadiness, readinessBefore);
});

Deno.test('strict cue merge preserves automatic occurrence order before later Carrier acceptance', () => {
  const state = createState([
    { instanceId: 'bug-1', shipDefId: 'BUG', chargesCurrent: 1 },
    { instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 1 },
  ]);
  const advanced = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  const carrier = resolveDrawingPreludePowerAction({ state: advanced.state, playerId: 'p1', action: power('car-1', 'defender'), nowMs: 11 });
  assert.equal(carrier.ok, true);
  if (!carrier.ok) return;
  const cue = carrier.state.gameData.turnData?.shipActivationCueBatches?.[0];
  assert.deepEqual(cue?.sources.map((source) => source.sourceInstanceId), ['bug-1', 'car-1']);
});

Deno.test('empty, duplicate, stale, and conflicting-cue Carrier requests reject without mutation', () => {
  const state = createState([{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 }]);
  const empty = resolveDrawingPreludePowerActionsBatch({ state, playerId: 'p1', actions: [], nowMs: 1 });
  assert.equal(empty.ok, false);
  assert.equal(empty.ok ? '' : empty.error.kind, 'player');
  assert.strictEqual(empty.state, state);

  const duplicate = resolveDrawingPreludePowerActionsBatch({ state, playerId: 'p1', actions: [power('car-1', 'defender'), power('car-1', 'hold')], nowMs: 1 });
  assert.equal(duplicate.ok, false);
  assert.deepEqual(state.gameData.ships?.p1?.map((ship) => ship.shipDefId), ['CAR']);

  const conflict = structuredClone(state);
  conflict.gameData.turnData!.shipActivationCueBatches = [{
    key: createPrivateDrawingPreludeCueKey({ turnNumber: 3, playerId: 'p1', passIndex: 1 }),
    turnNumber: 2,
    phaseKey: 'build.drawing',
    seq: 9,
    sources: [{ playerId: 'p1', sourceInstanceId: 'old' }],
  }];
  const rejected = resolveDrawingPreludePowerAction({ state: conflict, playerId: 'p1', action: power('car-1', 'defender'), nowMs: 1 });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.ok ? '' : rejected.error.kind, 'invariant');
  assert.strictEqual(rejected.state, conflict);
  assert.equal(conflict.gameData.ships?.p1?.length, 1);
});

Deno.test('frozen live-definition mismatch and unresolved automatic input are invariant failures', () => {
  const mismatch = createState([{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 }]);
  mismatch.gameData.ships!.p1[0].shipDefId = 'DEF';
  const invalid = resolveDrawingPreludePowerAction({ state: mismatch, playerId: 'p1', action: power('car-1', 'defender'), nowMs: 1 });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.ok ? '' : invalid.error.kind, 'invariant');

  const automatic = createState([
    { instanceId: 'bug-1', shipDefId: 'BUG', chargesCurrent: 1 },
    { instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 },
  ]);
  const blocked = resolveDrawingPreludePowerAction({ state: automatic, playerId: 'p1', action: power('car-1', 'defender'), nowMs: 1 });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok ? '' : blocked.error.kind, 'invariant');
});

Deno.test('two-pass advancement completes empty passes, reports transitions, and then no-ops', () => {
  const state = requireTwoPasses(createState([]), 6);
  const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.changed, true);
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.activePassIndex, 2);
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');

  const repeated = advanceDrawingPreludeForPlayer({ state: result.state, playerId: 'p1', nowMs: 11 });
  assert.equal(repeated.ok, true);
  if (!repeated.ok) return;
  assert.equal(repeated.changed, false);
  assert.strictEqual(repeated.state, result.state);
  assert.deepEqual(repeated.events, []);
});

Deno.test('BUG, QUE, and recurring ZEN repeat from frozen sources with pass-specific rolls and cues', () => {
  const state = requireTwoPasses(createState([
    { instanceId: 'bug-1', shipDefId: 'BUG', chargesCurrent: 1 },
    { instanceId: 'queen-1', shipDefId: 'QUE' },
    { instanceId: 'zen-1', shipDefId: 'ZEN' },
  ]), 3);
  state.gameData.turnData!.effectiveDiceRollByPlayerId = { p1: 2 };

  const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const playerState = result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1;
  const expectedKeys = ['bug-1:BUG#0', 'queen-1:QUE#0', 'zen-1:ZEN#1'];
  assert.deepEqual(playerState?.resolvedSourcePowerKeysByPass[1], expectedKeys);
  assert.deepEqual(playerState?.resolvedSourcePowerKeysByPass[2], expectedKeys);
  assert.equal(playerState?.status, 'complete');
  assert.equal(result.state.gameData.ships?.p1?.find((ship) => ship.instanceId === 'bug-1')?.chargesCurrent, 0);
  assert.equal(result.state.gameData.turnData?.shipsMadeThisTurnByPlayerId?.p1, 5);
  assert.equal(result.state.gameData.turnData?.queenCreatedXenitesThisTurnByPlayerId?.p1, 2);

  const createdDefs = result.events
    .filter((event) => event.type === 'EFFECT_APPLIED' && event.kind === 'CreateShip')
    .map((event) => event.details.shipDefId);
  assert.deepEqual(createdDefs, ['XEN', 'XEN', 'XEN', 'XEN', 'ANT']);
  const effectIds = result.events
    .filter((event) => event.type === 'EFFECT_APPLIED')
    .map((event) => event.effectId as string);
  assert.equal(effectIds.some((id) => id.includes(':pass:1:')), true);
  assert.equal(effectIds.some((id) => id.includes(':pass:2:')), true);

  const pass1Cue = result.state.gameData.turnData?.shipActivationCueBatches?.find((batch) =>
    batch.key === createPrivateDrawingPreludeCueKey({ turnNumber: 3, playerId: 'p1', passIndex: 1 })
  );
  const pass2Cue = result.state.gameData.turnData?.shipActivationCueBatches?.find((batch) =>
    batch.key === createPrivateDrawingPreludeCueKey({ turnNumber: 3, playerId: 'p1', passIndex: 2 })
  );
  assert.deepEqual(pass1Cue?.sources.map((source) => source.sourceInstanceId), ['bug-1', 'queen-1', 'zen-1']);
  assert.deepEqual(pass2Cue?.sources.map((source) => source.sourceInstanceId), ['queen-1', 'zen-1']);
});

Deno.test('malformed pass-2 Chronoswarm rolls reject the whole cross-pass transaction atomically', () => {
  for (const roll of [undefined, '2', 2.5, 0, 7, Number.NaN]) {
    const state = requireTwoPasses(
      createState([{ instanceId: 'bug-1', shipDefId: 'BUG', chargesCurrent: 1 }]),
      roll,
    );
    if (typeof roll === 'undefined') state.gameData.turnData!.chronoswarmRolls = [];
    const before = structuredClone(state);
    const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
    assert.equal(result.ok, false, String(roll));
    if (result.ok) continue;
    assert.equal(result.error.code, 'INVALID_CHRONOSWARM_ROLL');
    assert.strictEqual(result.state, state);
    assert.deepEqual(result.state, before);
    assert.deepEqual(result.events, []);
  }
});

Deno.test('the same Carrier acts once per pass and stale pass tokens reject without mutation', () => {
  const state = requireTwoPasses(
    createState([{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 }]),
    6,
  );
  const pass1 = resolveDrawingPreludePowerAction({
    state,
    playerId: 'p1',
    action: power('car-1', 'defender', 1),
    nowMs: 20,
  });
  assert.equal(pass1.ok, true);
  if (!pass1.ok) return;
  assert.equal(pass1.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.activePassIndex, 2);
  assert.equal(pass1.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'awaiting_actions');
  assert.equal(pass1.state.gameData.ships?.p1?.find((ship) => ship.instanceId === 'car-1')?.chargesCurrent, 1);

  const stale = resolveDrawingPreludePowerAction({
    state: pass1.state,
    playerId: 'p1',
    action: power('car-1', 'defender', 1),
    nowMs: 21,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, 'STALE_PRELUDE_PASS');
  assert.strictEqual(stale.state, pass1.state);

  const pass2 = resolveDrawingPreludePowerAction({
    state: pass1.state,
    playerId: 'p1',
    action: power('car-1', 'defender', 2),
    nowMs: 22,
  });
  assert.equal(pass2.ok, true);
  if (!pass2.ok) return;
  assert.equal(pass2.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
  assert.deepEqual(pass2.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.resolvedSourcePowerKeysByPass, {
    1: ['car-1:CAR#0'],
    2: ['car-1:CAR#0'],
  });
  assert.equal(
    pass2.events.filter((event) => event.type === 'EFFECT_APPLIED')
      .every((event) => event.effectId.includes(':pass:2:')),
    true,
  );
});

Deno.test('pass-1 Carrier spending controls pass-2 choices and may force pass-2 Hold in one transaction', () => {
  const state = requireTwoPasses(
    createState([{ instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 }]),
    4,
  );
  const result = resolveDrawingPreludePowerAction({
    state,
    playerId: 'p1',
    action: power('car-1', 'fighter', 1),
    nowMs: 20,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const playerState = result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1;
  assert.equal(playerState?.activePassIndex, 2);
  assert.equal(playerState?.status, 'complete');
  assert.deepEqual(playerState?.resolvedSourcePowerKeysByPass[1], ['car-1:CAR#0']);
  assert.deepEqual(playerState?.resolvedSourcePowerKeysByPass[2], ['car-1:CAR#0']);
  assert.equal(result.events.filter((event) => event.type === 'POWER_USED').length, 1);
  assert.equal(result.state.gameData.turnData?.shipsThatBuildPassUsageByInstanceId, undefined);
  assert.equal(result.state.gameData.turnData?.chargePowerUsedByInstanceId, undefined);
});

Deno.test('last pass-1 Carrier action resolves pass-2 automatics before exposing pass-2 Carrier input', () => {
  const state = requireTwoPasses(createState([
    { instanceId: 'queen-1', shipDefId: 'QUE' },
    { instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 2 },
  ]), 5);
  const prepared = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.equal(prepared.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.activePassIndex, 1);

  const crossed = resolveDrawingPreludePowerAction({
    state: prepared.state,
    playerId: 'p1',
    action: power('car-1', 'defender', 1),
    nowMs: 11,
  });
  assert.equal(crossed.ok, true);
  if (!crossed.ok) return;
  const playerState = crossed.state.gameData.turnData?.drawingPreludeByPlayerId?.p1;
  assert.equal(playerState?.activePassIndex, 2);
  assert.equal(playerState?.status, 'awaiting_actions');
  assert.equal(crossed.state.gameData.turnData?.queenCreatedXenitesThisTurnByPlayerId?.p1, 2);
  assert.deepEqual(playerState?.resolvedSourcePowerKeysByPass[2], ['queen-1:QUE#0']);
  assert.equal(playerState?.resolvedSourcePowerKeysByPass[2]?.includes('car-1:CAR#0'), false);
});

Deno.test('a batch that reaches malformed pass 2 rolls back all pass-1 actions and acknowledgements', () => {
  const state = requireTwoPasses(createState([
    { instanceId: 'car-1', shipDefId: 'CAR', chargesCurrent: 1 },
    { instanceId: 'car-2', shipDefId: 'CAR', chargesCurrent: 1 },
  ]), undefined);
  state.gameData.turnData!.chronoswarmRolls = [];
  const before = structuredClone(state);
  const result = resolveDrawingPreludePowerActionsBatch({
    state,
    playerId: 'p1',
    actions: [power('car-1', 'defender', 1), power('car-2', 'defender', 1)],
    nowMs: 20,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_CHRONOSWARM_ROLL');
  assert.strictEqual(result.state, state);
  assert.deepEqual(result.state, before);
  assert.deepEqual(result.events, []);
});

Deno.test('ships added after freezing do not join pass 2', () => {
  const state = requireTwoPasses(createState([]), 2);
  state.gameData.turnData!.drawingPreludeByPlayerId!.p1.activePassIndex = 2;
  state.gameData.ships!.p1.push({
    instanceId: 'later-bug',
    shipDefId: 'BUG',
    chargesCurrent: 1,
    createdTurn: 3,
  });
  const result = advanceDrawingPreludeForPlayer({ state, playerId: 'p1', nowMs: 10 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'complete');
  assert.equal(result.state.gameData.ships?.p1?.filter((ship) => ship.shipDefId === 'XEN').length, 0);
  assert.equal(result.state.gameData.ships?.p1?.find((ship) => ship.instanceId === 'later-bug')?.chargesCurrent, 1);
});

Deno.test('current-turn copied and controlled foreign sources execute through both passes without species gating', () => {
  const state = requireTwoPasses(createState([
    { instanceId: 'ssim-copied-bug', shipDefId: 'BUG', chargesCurrent: 2 },
    { instanceId: 'ssim-copied-zen', shipDefId: 'ZEN', chargesCurrent: 0 },
    { instanceId: 'controlled-car', shipDefId: 'CAR', chargesCurrent: 2 },
    { instanceId: 'controlled-queen', shipDefId: 'QUE', chargesCurrent: 0 },
  ]), 4);
  state.players[0].faction = 'centaur';
  state.gameData.ships!.p1.find((ship) => ship.instanceId === 'ssim-copied-bug')!.createdTurn = 3;
  state.gameData.ships!.p1.find((ship) => ship.instanceId === 'ssim-copied-zen')!.createdTurn = 3;
  state.gameData.ships!.p1.find((ship) => ship.instanceId === 'controlled-car')!.createdTurn = 1;
  state.gameData.ships!.p1.find((ship) => ship.instanceId === 'controlled-queen')!.createdTurn = 1;

  const pass1Automatic = advanceDrawingPreludeForPlayer({
    state,
    playerId: 'p1',
    nowMs: 1,
  });
  assert.equal(pass1Automatic.ok, true);
  if (!pass1Automatic.ok) return;
  const pass1 = resolveDrawingPreludePowerAction({
    state: pass1Automatic.state,
    playerId: 'p1',
    action: power('controlled-car', 'hold', 1),
    nowMs: 2,
  });
  assert.equal(pass1.ok, true);
  if (!pass1.ok) return;
  assert.equal(
    pass1.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.activePassIndex,
    2,
  );
  const pass2 = resolveDrawingPreludePowerAction({
    state: pass1.state,
    playerId: 'p1',
    action: power('controlled-car', 'hold', 2),
    nowMs: 3,
  });
  assert.equal(pass2.ok, true);
  if (!pass2.ok) return;

  const exactKeys = [
    'ssim-copied-bug:BUG#0',
    'ssim-copied-zen:ZEN#1',
    'controlled-car:CAR#0',
    'controlled-queen:QUE#0',
  ];
  assert.deepEqual(
    pass2.state.gameData.turnData?.drawingPreludeByPlayerId?.p1
      .resolvedSourcePowerKeysByPass,
    { 1: exactKeys, 2: exactKeys },
  );
  const captures = [...pass1Automatic.events, ...pass1.events, ...pass2.events]
    .filter((event) => event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED');
  for (const sourceShipDefId of ['BUG', 'ZEN', 'QUE']) {
    for (const passIndex of [1, 2]) {
      assert.equal(
        captures.some((event) =>
          event.sourceShipDefId === sourceShipDefId &&
          event.producedBuildOccurrence?.stage === 'drawing_prelude' &&
          event.producedBuildOccurrence.passIndex === passIndex
        ),
        true,
        `${sourceShipDefId} must produce a capture in pass ${passIndex}`,
      );
    }
  }
  assert.equal(
    pass2.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status,
    'complete',
  );
});
