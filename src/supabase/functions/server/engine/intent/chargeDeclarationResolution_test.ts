import assert from 'node:assert/strict';
import {
  fingerprintChargeDeclaration,
  normalizeChargeDeclarationPayload,
  resolveChargeDeclarationSubmission,
} from './chargeDeclarationResolution.ts';

function payload(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1,
    declarationId: 'declaration-1',
    ordinaryChargeActions: [],
    solarGridChoices: [],
    solarCasts: [],
    autocastEnabled: false,
    ...overrides,
  };
}

function createState(): any {
  return {
    gameId: 'charge-declaration-resolution-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 20, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 20, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [],
      ships: {
        p1: [
          { instanceId: 'int-1', shipDefId: 'INT', chargesCurrent: 2 },
          { instanceId: 'int-2', shipDefId: 'INT', chargesCurrent: 2 },
          { instanceId: 'sol-a', shipDefId: 'SOL', chargesCurrent: 4 },
          { instanceId: 'sol-b', shipDefId: 'SOL', chargesCurrent: 1 },
        ],
        p2: [],
      },
      voidShipsByPlayerId: { p1: [], p2: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleByPlayerId: { p1: true, p2: false },
        chargeDeclarationEligibleSourceIdsByPlayerId: { p1: ['int-1', 'int-2'], p2: [] },
        solarGridDeclarationSourceIdsByPlayerId: { p1: ['sol-a', 'sol-b'], p2: [] },
        chargeDeclarationFleetSnapshotByPlayerId: {
          p1: [
            { instanceId: 'int-1', shipDefId: 'INT', chargesCurrent: 2 },
            { instanceId: 'int-2', shipDefId: 'INT', chargesCurrent: 2 },
            { instanceId: 'sol-a', shipDefId: 'SOL', chargesCurrent: 4 },
            { instanceId: 'sol-b', shipDefId: 'SOL', chargesCurrent: 1 },
          ],
          p2: [],
        },
        chargePowerUsedByInstanceId: {},
        anyChargesSpentInDeclaration: false,
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {
          p1: {
            battleTurnNumber: 3,
            pool: { green: 1, red: 0, blue: 0 },
            sources: [{
              sourceId: 'initial-core',
              sourceInstanceId: 'core-1',
              sourceShipDefId: 'PLU',
              battleTurnNumber: 3,
              order: 0,
              amounts: { green: 1, red: 0, blue: 0 },
            }],
          },
          p2: { battleTurnNumber: 3, pool: { green: 0, red: 0, blue: 0 }, sources: [] },
        },
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {
          p1: { battleTurnNumber: null, entries: [] },
          p2: { battleTurnNumber: null, entries: [] },
        },
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };
}

Deno.test('charge declaration payload normalization is versioned, explicit, and deterministically fingerprinted', () => {
  const first = normalizeChargeDeclarationPayload(payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      { sourceInstanceId: 'sol-a', choiceId: 'use' },
    ],
  }));
  const second = normalizeChargeDeclarationPayload(payload({
    declarationId: 'different-id',
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'use' },
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
    ],
  }));
  assert.equal(fingerprintChargeDeclaration(first), fingerprintChargeDeclaration(second));
  for (const invalid of [
    payload({ contractVersion: 2 }),
    payload({ declarationId: '' }),
    payload({ solarCasts: [{ solarPowerId: 'SLIF' }] }),
    payload({ autocastEnabled: true }),
  ]) {
    assert.throws(() => normalizeChargeDeclarationPayload(invalid));
  }
});

Deno.test('ordinary charge list rejects duplicate source entries before transactional application', () => {
  assert.throws(() => normalizeChargeDeclarationPayload(payload({
    ordinaryChargeActions: [
      { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'hold' },
      { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage' },
    ],
  })), /Duplicate ordinary charge source/);
});

Deno.test('mixed ordinary charge and independent SOL Use/Hold choices commit deterministically', () => {
  const state = createState();
  const result = resolveChargeDeclarationSubmission({
    state,
    playerId: 'p1',
    payload: payload({
      ordinaryChargeActions: [{
        actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage',
      }],
      solarGridChoices: [
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
        { sourceInstanceId: 'sol-a', choiceId: 'use' },
      ],
    }),
    nowMs: 1000,
  });
  assert.equal(result.status, 'applied');
  assert.equal(result.state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'int-1').chargesCurrent, 1);
  assert.equal(result.state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-a').chargesCurrent, 3);
  assert.equal(result.state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-b').chargesCurrent, 1);
  assert.deepEqual(result.state.gameData.ancient.energyByPlayerId.p1.pool, { green: 2, red: 1, blue: 1 });
  assert.deepEqual(
    result.state.gameData.ancient.energyByPlayerId.p1.sources.map((source: any) => source.sourceId),
    ['initial-core', 'ancient-solar-grid-energy:3:p1:sol-a'],
  );
  assert.equal(result.state.gameData.turnData.anyChargesSpentInDeclaration, true);
  assert.deepEqual(result.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.context, {
    contextVersion: 1,
    battleTurnNumber: 3,
    initialEnergy: { green: 1, red: 0, blue: 0 },
    energySourceIds: ['initial-core'],
  });
  assert.equal(state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'int-1').chargesCurrent, 2);
  assert.equal(state.gameData.ancient.acceptedDeclarationByPlayerId.p1, undefined);
});

Deno.test('invalid later ordinary action and invalid SOL coverage leave the entire input state unchanged', () => {
  for (const invalidPayload of [
    payload({
      ordinaryChargeActions: [
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage' },
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-2', choiceId: 'forged' },
      ],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
    payload({
      ordinaryChargeActions: [
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'int-1', choiceId: 'damage' },
      ],
      solarGridChoices: [{ sourceInstanceId: 'sol-a', choiceId: 'use' }],
    }),
    payload({
      ordinaryChargeActions: [
        { actionType: 'power', actionId: 'INT#0', sourceInstanceId: 'forged', choiceId: 'damage' },
      ],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
  ]) {
    const state = createState();
    const before = structuredClone(state);
    assert.throws(() => resolveChargeDeclarationSubmission({
      state, playerId: 'p1', payload: invalidPayload, nowMs: 1000,
    }));
    assert.deepEqual(state, before);
  }
});

Deno.test('snapshotted SOL moved to VOID can use its charge and identical accepted retry is eventless', () => {
  const state = createState();
  const moved = state.gameData.ships.p1.find((ship: any) => ship.instanceId === 'sol-b');
  state.gameData.ships.p1 = state.gameData.ships.p1.filter((ship: any) => ship.instanceId !== 'sol-b');
  state.gameData.voidShipsByPlayerId.p1.push(moved);
  const declaration = payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'hold' },
      { sourceInstanceId: 'sol-b', choiceId: 'use' },
    ],
  });
  const applied = resolveChargeDeclarationSubmission({ state, playerId: 'p1', payload: declaration, nowMs: 1000 });
  assert.equal(applied.state.gameData.voidShipsByPlayerId.p1[0].chargesCurrent, 0);
  applied.state.gameData.currentSubPhase = 'charge_response';
  const retry = resolveChargeDeclarationSubmission({
    state: applied.state, playerId: 'p1', payload: declaration, nowMs: 1001,
  });
  assert.equal(retry.status, 'idempotent');
  assert.deepEqual(retry.events, []);
  assert.equal(retry.state.gameData.voidShipsByPlayerId.p1[0].chargesCurrent, 0);
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: applied.state,
    playerId: 'p1',
    payload: payload({ declarationId: 'new-id', solarGridChoices: declaration.solarGridChoices }),
    nowMs: 1002,
  }), /different charge declaration/);
});

Deno.test('non-Ancient and forged or depleted SOL submissions are rejected', () => {
  const nonAncient = createState();
  nonAncient.players[0].faction = 'human';
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: nonAncient,
    playerId: 'p1',
    payload: payload({
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
    nowMs: 1000,
  }), /Only Ancient players/);

  const depleted = createState();
  depleted.gameData.turnData.solarGridDeclarationSourceIdsByPlayerId.p1 = ['sol-b'];
  depleted.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId.p1 = [
    { instanceId: 'sol-b', shipDefId: 'SOL', chargesCurrent: 0 },
  ];
  assert.throws(() => resolveChargeDeclarationSubmission({
    state: depleted,
    playerId: 'p1',
    payload: payload({ solarGridChoices: [{ sourceInstanceId: 'sol-b', choiceId: 'use' }] }),
    nowMs: 1000,
  }), /Invalid snapshotted Solar Grid/);
});

Deno.test('a previous Battle accepted record does not block a new declaration', () => {
  const firstState = createState();
  const firstPayload = payload({
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'hold' },
      { sourceInstanceId: 'sol-b', choiceId: 'hold' },
    ],
  });
  const first = resolveChargeDeclarationSubmission({
    state: firstState, playerId: 'p1', payload: firstPayload, nowMs: 1000,
  });
  const nextBattle = first.state;
  nextBattle.gameData.turnNumber = 4;
  nextBattle.gameData.turnData.turnNumber = 4;
  nextBattle.gameData.currentSubPhase = 'charge_declaration';
  nextBattle.gameData.turnData.currentSubPhase = 'charge_declaration';
  nextBattle.gameData.ancient.energyByPlayerId.p1.battleTurnNumber = 4;
  const second = resolveChargeDeclarationSubmission({
    state: nextBattle,
    playerId: 'p1',
    payload: payload({
      declarationId: 'battle-4-declaration',
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-b', choiceId: 'hold' },
      ],
    }),
    nowMs: 2000,
  });
  assert.equal(second.status, 'applied');
  assert.equal(second.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.declarationId, 'battle-4-declaration');
  assert.equal(second.state.gameData.ancient.acceptedDeclarationByPlayerId.p1.context.battleTurnNumber, 4);
});
