import assert from 'node:assert/strict';
import type { GameState } from '../../../engine/state/GameStateTypes.ts';
import { EffectKind, EffectTiming, SurvivabilityRule } from '../../../engine_shared/effects/Effect.ts';
import { applyEffects } from '../../../engine_shared/effects/applyEffects.ts';
import {
  deriveMaterializedSimulacrumLedgerEntryIdsByPlayerId,
  materializeQueuedSimulacrumCopiesAtTurnStart,
} from '../../../engine/ancient/simulacrumSolarPower.ts';

function ship(instanceId: string, shipDefId: string) {
  return { instanceId, shipDefId };
}

function createState(args: {
  p1Health?: number;
  p2Health?: number;
  p1Ships?: any[];
  p2Ships?: any[];
} = {}): GameState {
  return {
    gameId: 'apply-spiral-effects-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: args.p1Health ?? 25, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: args.p2Health ?? 25, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      ships: { p1: args.p1Ships ?? [], p2: args.p2Ships ?? [] },
      turnData: { turnNumber: 3 },
    },
  } as GameState;
}

function destroyEffect(targetPlayerId: string, shipInstanceId: string): any {
  return {
    id: `destroy-${shipInstanceId}`,
    ownerPlayerId: targetPlayerId === 'p1' ? 'p2' : 'p1',
    source: { type: 'system', reason: 'test' },
    timing: 'battle.first_strike',
    activationTag: EffectTiming.OnceOnly,
    survivability: SurvivabilityRule.ResolvesIfDestroyed,
    target: { playerId: targetPlayerId, shipInstanceId },
    kind: EffectKind.Destroy,
    restriction: 'any',
    count: 1,
  };
}

function transferEffect(shipInstanceIds: string[]): any {
  return {
    id: 'transfer-test',
    ownerPlayerId: 'p2',
    source: { type: 'system', reason: 'test' },
    timing: 'battle.first_strike',
    activationTag: EffectTiming.OnceOnly,
    survivability: SurvivabilityRule.ResolvesIfDestroyed,
    target: { playerId: 'p1', shipInstanceIds },
    kind: EffectKind.TransferShip,
    restriction: 'basic_only',
    count: shipInstanceIds.length,
  };
}

Deno.test('destroying a Spiral clamps immediately only when health exceeds the new maximum', () => {
  const high = createState({
    p1Health: 50,
    p1Ships: [ship('spi-1', 'SPI'), ship('spi-2', 'SPI'), ship('spi-3', 'SPI')],
  });
  const highResult = applyEffects(high, [destroyEffect('p1', 'spi-3')]);
  assert.equal(highResult.state.players[0].health, 45);
  assert.deepEqual(highResult.state.gameData.pendingTurn, {
    damageByPlayerId: {},
    healByPlayerId: {},
    breakdownEntries: [],
  });

  const below = createState({
    p1Health: 42,
    p1Ships: [ship('spi-1', 'SPI'), ship('spi-2', 'SPI'), ship('spi-3', 'SPI')],
  });
  assert.equal(
    applyEffects(below, [destroyEffect('p1', 'spi-3')]).state.players[0].health,
    42,
  );

  const nonSpiral = createState({ p1Health: 50, p1Ships: [ship('fig-1', 'FIG')] });
  assert.equal(
    applyEffects(nonSpiral, [destroyEffect('p1', 'fig-1')]).state.players[0].health,
    50,
  );
});

Deno.test('transferring a Spiral clamps the source and raises destination capacity without healing', () => {
  const state = createState({
    p1Health: 48,
    p2Health: 21,
    p1Ships: [ship('spi-1', 'SPI'), ship('spi-2', 'SPI'), ship('spi-3', 'SPI')],
    p2Ships: [ship('fig-2', 'FIG')],
  });
  const result = applyEffects(state, [transferEffect(['spi-3'])]);

  assert.equal(result.state.players[0].health, 45);
  assert.equal(result.state.players[1].health, 21);
  assert.deepEqual(result.state.gameData.ships?.p1?.map((candidate) => candidate.instanceId), ['spi-1', 'spi-2']);
  assert.deepEqual(result.state.gameData.ships?.p2?.map((candidate) => candidate.instanceId), ['fig-2', 'spi-3']);
  assert.deepEqual(result.state.gameData.pendingTurn, {
    damageByPlayerId: {},
    healByPlayerId: {},
    breakdownEntries: [],
  });
});

Deno.test('defensive transfer guard moves no selected ships and emits no transfer event', () => {
  const state = createState({
    p1Health: 40,
    p2Health: 50,
    p1Ships: [ship('incoming-spi', 'SPI'), ship('incoming-fig', 'FIG')],
    p2Ships: [ship('owned-spi-1', 'SPI'), ship('owned-spi-2', 'SPI'), ship('owned-spi-3', 'SPI')],
  });
  const beforeShips = structuredClone(state.gameData.ships);
  const beforePlayers = structuredClone(state.players);
  const result = applyEffects(state, [transferEffect(['incoming-spi', 'incoming-fig'])]);

  assert.deepEqual(result.state.gameData.ships, beforeShips);
  assert.deepEqual(result.state.players, beforePlayers);
  assert.deepEqual(result.events, []);
});

function initializeCubeTriggerState(state: GameState): GameState {
  state.gameData.ancient = {
    schemaVersion: 1,
    energyByPlayerId: {},
    acceptedDeclarationByPlayerId: {},
    solarLedgerByPlayerId: {
      p1: { battleTurnNumber: 3, entries: [] },
      p2: { battleTurnNumber: 3, entries: [] },
    },
    pendingSimulacrumCopies: [],
    pendingBlackHoleDestructions: [],
  };
  state.gameData.turnData!.simulacrumRevealFleetSnapshotByPlayerId =
    structuredClone(state.gameData.ships ?? {});
  return state;
}

Deno.test('destroyed Cube queues the stable lowest-cost Basic candidate without mutating the input', () => {
  const state = initializeCubeTriggerState(createState({
    p1Ships: [ship('cube-transferred', 'CUB')],
    p2Ships: [
      ship('target-higher', 'HEL'),
      ship('target-z', 'OXI'),
      ship('target-a', 'AST'),
    ],
  }));
  state.players[0].faction = 'human';
  const inputBefore = structuredClone(state);

  const result = applyEffects(state, [destroyEffect('p1', 'cube-transferred')]);

  assert.deepEqual(state, inputBefore, 'applyEffects preserves its supplied state');
  assert.deepEqual(result.state.gameData.ships?.p1, []);
  assert.equal(
    result.state.gameData.ancient?.pendingSimulacrumCopies[0]
      ?.sourceTargetInstanceId,
    'target-a',
  );
  assert.equal(
    result.state.gameData.ancient?.pendingSimulacrumCopies[0]?.copiedShipDefId,
    'AST',
  );
  assert.deepEqual(
    result.state.gameData.ancient?.solarLedgerByPlayerId.p1.entries[0]
      ?.paidEnergy,
    { green: 0, red: 0, blue: 0 },
  );
  assert.equal(
    result.state.gameData.ancient?.solarLedgerByPlayerId.p1.entries[0]
      ?.sourceMode,
    'cube_destruction',
  );

  const nextTurnState = structuredClone(result.state);
  nextTurnState.gameData.turnNumber = 4;
  nextTurnState.gameData.turnData!.turnNumber = 4;
  const materialized = materializeQueuedSimulacrumCopiesAtTurnStart(
    nextTurnState,
    4,
    100,
    () => 'cube-triggered-copy',
  );
  assert.equal(
    materialized.state.gameData.ships?.p1?.some((candidate) =>
      candidate.instanceId === 'cube-triggered-copy' &&
      candidate.shipDefId === 'AST'
    ),
    true,
  );
  assert.deepEqual(
    deriveMaterializedSimulacrumLedgerEntryIdsByPlayerId(materialized.state),
    { p1: [
      result.state.gameData.ancient!.solarLedgerByPlayerId.p1.entries[0]
        .entryId,
    ], p2: [] },
  );
  const retried = materializeQueuedSimulacrumCopiesAtTurnStart(
    materialized.state,
    4,
    101,
    () => 'unexpected-duplicate',
  );
  assert.equal(
    retried.state.gameData.ships?.p1?.filter((candidate) =>
      candidate.shipDefId === 'AST'
    ).length,
    1,
  );
});

Deno.test('failed Cube candidates leave no partial reservation or ledger entry', () => {
  const state = initializeCubeTriggerState(createState({
    p1Ships: [ship('cube-1', 'CUB')],
    p2Ships: [ship('already-reserved', 'OXI')],
  }));
  state.gameData.ancient!.pendingSimulacrumCopies.push({
    pendingCopyId: 'existing-copy',
    declarationId: 'existing-declaration',
    ownerPlayerId: 'p1',
    sourceTargetInstanceId: 'already-reserved',
    copiedShipDefId: 'OXI',
    queuedTurnNumber: 3,
    materializationTurnNumber: 4,
    queueOrder: 0,
    capturedStartOfBattleCharges: 0,
    permanentConfiguration: {},
    sourceMode: 'primary',
    status: 'queued',
  });
  const inputBefore = structuredClone(state);
  const ancientBefore = structuredClone(state.gameData.ancient);

  const result = applyEffects(state, [destroyEffect('p1', 'cube-1')]);

  assert.deepEqual(state, inputBefore, 'failed attempts preserve the input');
  assert.deepEqual(result.state.gameData.ancient, ancientBefore);
  assert.deepEqual(result.state.gameData.ships?.p1, []);
});

Deno.test('Cube trigger skips a target already reserved by manual Simulacrum', () => {
  const state = initializeCubeTriggerState(createState({
    p1Ships: [ship('cube-1', 'CUB')],
    p2Ships: [ship('target-a', 'OXI'), ship('target-b', 'AST')],
  }));
  state.gameData.ancient!.pendingSimulacrumCopies.push({
    pendingCopyId: 'manual-copy',
    declarationId: 'manual-declaration',
    ownerPlayerId: 'p1',
    sourceTargetInstanceId: 'target-a',
    copiedShipDefId: 'OXI',
    queuedTurnNumber: 3,
    materializationTurnNumber: 4,
    queueOrder: 0,
    capturedStartOfBattleCharges: 0,
    permanentConfiguration: {},
    sourceMode: 'primary',
    status: 'queued',
  });

  const result = applyEffects(state, [destroyEffect('p1', 'cube-1')]);

  assert.deepEqual(
    result.state.gameData.ancient?.pendingSimulacrumCopies.map((record) =>
      record.sourceTargetInstanceId
    ),
    ['target-a', 'target-b'],
  );
});

Deno.test('transferring a Cube does not invoke its destruction trigger', () => {
  const state = initializeCubeTriggerState(createState({
    p1Ships: [ship('cube-1', 'CUB')],
    p2Ships: [ship('target-1', 'OXI')],
  }));

  const result = applyEffects(state, [transferEffect(['cube-1'])]);

  assert.deepEqual(result.state.gameData.ancient?.pendingSimulacrumCopies, []);
  assert.deepEqual(
    result.state.gameData.ancient?.solarLedgerByPlayerId.p1.entries,
    [],
  );
});

Deno.test('multiple Cube destructions reserve distinct targets in effect order', () => {
  const state = initializeCubeTriggerState(createState({
    p1Ships: [ship('cube-1', 'CUB'), ship('cube-2', 'CUB')],
    p2Ships: [ship('target-a', 'OXI'), ship('target-b', 'AST')],
  }));

  const result = applyEffects(state, [
    destroyEffect('p1', 'cube-2'),
    destroyEffect('p1', 'cube-1'),
    destroyEffect('p2', 'target-a'),
  ]);

  assert.deepEqual(
    result.state.gameData.ancient?.pendingSimulacrumCopies.map((record) =>
      record.sourceTargetInstanceId
    ),
    ['target-a', 'target-b'],
  );
  assert.deepEqual(
    result.state.gameData.ancient?.solarLedgerByPlayerId.p1.entries.map(
      (entry) => entry.order,
    ),
    [0, 1],
  );
});

Deno.test('Cube trigger copies Reveal-time charges and permanent configuration', () => {
  const configuredTarget = {
    ...ship('quantum-target', 'QUA'),
    permanentConfiguration: { selectedNumber: 5 },
  };
  const chargedTarget = {
    ...ship('interceptor-target', 'INT'),
    chargesCurrent: 1,
  };
  const state = initializeCubeTriggerState(createState({
    p1Ships: [ship('cube-1', 'CUB'), ship('cube-2', 'CUB')],
    p2Ships: [configuredTarget, chargedTarget],
  }));
  state.gameData.ships!.p2[1] = {
    ...state.gameData.ships!.p2[1],
    chargesCurrent: 0,
  };

  const result = applyEffects(state, [
    destroyEffect('p1', 'cube-1'),
    destroyEffect('p1', 'cube-2'),
  ]);
  const pending = result.state.gameData.ancient?.pendingSimulacrumCopies ?? [];

  assert.equal(pending[0]?.capturedStartOfBattleCharges, 1);
  assert.deepEqual(pending[1]?.permanentConfiguration, { selectedNumber: 5 });
});
