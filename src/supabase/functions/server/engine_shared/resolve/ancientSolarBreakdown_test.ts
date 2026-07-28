import assert from 'node:assert/strict';
import type {
  GameState,
  PendingTurnBreakdownEntry,
} from '../../engine/state/GameStateTypes.ts';
import { resolvePhase } from './resolvePhase.ts';

function createState(args: {
  entries: PendingTurnBreakdownEntry[];
  damageByPlayerId?: Record<string, number>;
  healByPlayerId?: Record<string, number>;
  p1Health?: number;
  p2Health?: number;
}): GameState {
  return {
    gameId: 'ancient-solar-breakdown-test',
    status: 'active',
    players: [
      {
        id: 'p1',
        role: 'player',
        faction: 'ancient',
        health: args.p1Health ?? 20,
        lines: 0,
        joiningLines: 0,
      },
      {
        id: 'p2',
        role: 'player',
        faction: 'human',
        health: args.p2Health ?? 30,
        lines: 0,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 3,
      ships: { p1: [], p2: [] },
      turnData: { turnNumber: 3 },
      pendingTurn: {
        damageByPlayerId: args.damageByPlayerId ?? {},
        healByPlayerId: args.healByPlayerId ?? {},
        breakdownEntries: args.entries,
      },
    },
  };
}

function solarEntry(args: {
  effectId: string;
  kind: 'Damage' | 'Heal';
  powerId: string;
  amount: number;
  ownerPlayerId?: string;
  targetPlayerId?: string;
  finalAmount?: number;
}): PendingTurnBreakdownEntry {
  return {
    effectId: args.effectId,
    kind: args.kind,
    ownerPlayerId: args.ownerPlayerId ?? 'p1',
    targetPlayerId:
      args.targetPlayerId ?? (args.kind === 'Heal' ? 'p1' : 'p2'),
    sourceLabel: `ancient-solar:${args.powerId}`,
    baseAmount: args.amount,
    finalAmount: args.finalAmount ?? args.amount,
  };
}

Deno.test('Solar breakdown uses canonical typed rows and groups manual, Autocast, and Cube casts', () => {
  const entries = [
    solarEntry({
      effectId: 'ancient-solar:3:p1:declaration:manual:0:damage',
      kind: 'Damage',
      powerId: 'SSUP',
      amount: 6,
    }),
    solarEntry({
      effectId: 'ancient-solar:3:p1:autocast:0:damage',
      kind: 'Damage',
      powerId: 'SSUP',
      amount: 6,
    }),
    solarEntry({
      effectId: 'ancient-solar:3:p1:declaration:cube:0:damage',
      kind: 'Damage',
      powerId: 'SSUP',
      amount: 6,
    }),
  ];

  const result = resolvePhase(createState({
    entries,
    damageByPlayerId: { p2: 18 },
  }), 'battle.end_of_turn_resolution');

  assert.deepEqual(
    result.state.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1,
    [{
      rowKind: 'solar_power',
      solarPowerId: 'SSUP',
      label: 'Supernova',
      count: 3,
      amount: 18,
      amountText: '18',
    }],
  );
  assert.equal(
    result.state.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1?.[0]
      .count,
    3,
  );
  assert.equal(result.state.players[0].health, 20);
  assert.equal(result.state.players[1].health, 12);
  assert.deepEqual(result.state.gameData.lastTurnDamageByPlayerId, {
    p1: 0,
    p2: 18,
  });
});

Deno.test('Siphon counts each accepted cast once in both damage and healing families', () => {
  for (const castCount of [1, 2]) {
    const entries: PendingTurnBreakdownEntry[] = [];
    for (let castIndex = 0; castIndex < castCount; castIndex += 1) {
      const castIdentity =
        `ancient-solar:3:p1:declaration:manual:${castIndex}`;
      entries.push(
        solarEntry({
          effectId: `${castIdentity}:heal`,
          kind: 'Heal',
          powerId: 'SSIP',
          amount: 4,
        }),
        solarEntry({
          effectId: `${castIdentity}:damage`,
          kind: 'Damage',
          powerId: 'SSIP',
          amount: 4,
        }),
      );
    }

    const total = castCount * 4;
    const result = resolvePhase(createState({
      entries,
      damageByPlayerId: { p2: total },
      healByPlayerId: { p1: total },
      p1Health: 10,
    }), 'battle.end_of_turn_resolution');

    assert.deepEqual(
      result.state.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1,
      [{
        rowKind: 'solar_power',
        solarPowerId: 'SSIP',
        label: 'Siphon',
        count: castCount,
        amount: total,
        amountText: String(total),
      }],
    );
    assert.deepEqual(
      result.state.gameData.lastTurnHealingReceivedBreakdownByPlayerId?.p1,
      [{
        rowKind: 'solar_power',
        solarPowerId: 'SSIP',
        label: 'Siphon',
        count: castCount,
        amount: total,
        amountText: String(total),
      }],
    );
    assert.equal(result.state.players[0].health, 10 + total);
    assert.equal(result.state.players[1].health, 30 - total);
  }
});

Deno.test('Solar breakdown safely handles mismatched and empty effect IDs while preserving generic and ship adjustments', () => {
  const entries: PendingTurnBreakdownEntry[] = [
    solarEntry({
      effectId: 'shared-cast:damage',
      kind: 'Damage',
      powerId: 'SSUP',
      amount: 2,
    }),
    solarEntry({
      effectId: 'shared-cast:heal',
      kind: 'Damage',
      powerId: 'SSUP',
      amount: 3,
    }),
    solarEntry({
      effectId: '',
      kind: 'Damage',
      powerId: 'SSUP',
      amount: 1,
    }),
    solarEntry({
      effectId: '',
      kind: 'Damage',
      powerId: 'SSUP',
      amount: 2,
    }),
    solarEntry({
      effectId: 'unknown:damage',
      kind: 'Damage',
      powerId: 'NOPE',
      amount: 4,
    }),
    solarEntry({
      effectId: 'extra-source-suffix:damage',
      kind: 'Damage',
      powerId: 'SSUP:extra',
      amount: 1,
    }),
    {
      effectId: 'solar-grid:heal',
      kind: 'Damage',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      sourceShipDefId: 'SOL',
      sourceInstanceId: 'solar-grid',
      baseAmount: 5,
      finalAmount: 10,
    },
    solarEntry({
      effectId: 'zero:damage',
      kind: 'Damage',
      powerId: 'SVOR',
      amount: 0,
    }),
  ];

  const result = resolvePhase(createState({
    entries,
    damageByPlayerId: { p2: 23 },
  }), 'battle.end_of_turn_resolution');
  const rows =
    result.state.gameData.lastTurnDamageDealtBreakdownByPlayerId?.p1 ?? [];

  assert.deepEqual(rows, [
    {
      rowKind: 'solar_power',
      solarPowerId: 'SSUP',
      label: 'Supernova',
      count: 4,
      amount: 8,
      amountText: '8',
    },
    {
      rowKind: 'adjustment',
      label: 'Science Vessel',
      amount: 5,
      amountText: '5',
    },
    {
      rowKind: 'ship',
      label: 'Solar Grid',
      count: 1,
      amount: 5,
      amountText: '5',
    },
    {
      rowKind: 'adjustment',
      label: 'ancient-solar:NOPE',
      amount: 4,
      amountText: '4',
    },
    {
      rowKind: 'adjustment',
      label: 'ancient-solar:SSUP:extra',
      amount: 1,
      amountText: '1',
    },
  ]);
  assert.equal('count' in rows[3], false);
  assert.equal(
    rows.some((row) => row.label === 'Vortex'),
    false,
  );
  assert.equal(result.state.players[0].health, 20);
  assert.equal(result.state.players[1].health, 7);
  assert.deepEqual(result.state.gameData.lastTurnDamageByPlayerId, {
    p1: 0,
    p2: 23,
  });
});
