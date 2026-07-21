import assert from 'node:assert/strict';
import type { GameState } from '../../engine/state/GameStateTypes.ts';
import { EffectKind, EffectTiming, SurvivabilityRule } from './Effect.ts';
import { applyEffects } from './applyEffects.ts';

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
