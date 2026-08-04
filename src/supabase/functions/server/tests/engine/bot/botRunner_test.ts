import assert from 'node:assert/strict';
import { runBotsUntilSettled } from '../../../engine/bot/botRunner.ts';
import { replaceChargeDeclarationVisibilityState } from '../../../engine/state/chargeDeclarationVisibility.ts';

function createBotCubeState(mainValue: number, cubeValues: number[]) {
  const cubeShips = cubeValues.map((_, index) => ({
    instanceId: `transferred-cube-${String(index + 1).padStart(2, '0')}`,
    shipDefId: 'CUB',
    createdTurn: 1,
  }));
  return {
    gameId: 'bot-cube-test',
    status: 'active',
    turnNumber: 2,
    players: [
      { id: 'human', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: {
        kind: 'bot',
        speciesId: 'CEN',
        chosenPlanId: 'cen_greed_kno_des',
      },
    },
    gameData: {
      turnNumber: 2,
      currentPhase: 'build',
      currentSubPhase: 'dice_roll',
      diceRoll: mainValue,
      ships: {
        human: [],
        bot: [...cubeShips, {
          instanceId: 'owned-kno',
          shipDefId: 'KNO',
          createdTurn: 1,
        }],
      },
      phaseReadiness: [{
        playerId: 'human',
        isReady: true,
        currentStep: 'build.dice_roll',
      }],
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber: 2,
        currentMajorPhase: 'build',
        currentSubPhase: 'dice_roll',
        diceManipulationStage: 'cube',
        diceRolled: true,
        diceFinalized: false,
        baseDiceRoll: mainValue,
        effectiveDiceRoll: mainValue,
        diceRoll: mainValue,
        effectiveDiceRollByPlayerId: { human: mainValue, bot: mainValue },
        cubeDiceRollsByPlayerId: {
          bot: cubeShips.map((ship, index) => ({
            sourceInstanceId: ship.instanceId,
            value: cubeValues[index],
          })),
        },
        visibleCubeDiceValueByPlayerId: { bot: cubeValues[0] },
        chronoswarmRolls: [],
        chronoswarmCountByPlayerId: { human: 0, bot: 0 },
        chronoswarmSharedRollCount: 0,
      },
    },
  };
}

Deno.test('bot with transferred CUB stages one batch choice then readies and resolves', async () => {
  const result = await runBotsUntilSettled({
    state: createBotCubeState(2, [4, 6]),
    nowMs: 100,
  });

  assert.equal(
    result.events.some((event) => event.type === 'BOT_INTENT_REJECTED'),
    false,
  );
  assert.equal(result.botStepsApplied >= 2, true);
  assert.deepEqual(
    result.state.gameData.turnData.cubeDiceSelectionByPlayerId.bot,
    {
      choiceId: 'cube:transferred-cube-02',
      value: 6,
      sourceInstanceId: 'transferred-cube-02',
    },
  );
  assert.equal(result.state.gameData.turnData.diceManipulationStage, undefined);
  assert.equal(result.state.gameData.turnData.diceFinalized, true);
});

Deno.test('bot Cube selection keeps Main on ties and stable Cube order otherwise', async () => {
  const mainTie = await runBotsUntilSettled({
    state: createBotCubeState(6, [6, 6]),
    nowMs: 100,
  });
  assert.equal(
    mainTie.state.gameData.turnData.cubeDiceSelectionByPlayerId.bot.choiceId,
    'main',
  );

  const cubeTie = await runBotsUntilSettled({
    state: createBotCubeState(1, [5, 5]),
    nowMs: 100,
  });
  assert.equal(
    cubeTie.state.gameData.turnData.cubeDiceSelectionByPlayerId.bot.choiceId,
    'cube:transferred-cube-01',
  );
});

Deno.test('bot EQU planning retains declaration-entry targets after hidden canonical removal', async () => {
  const state: any = {
    gameId: 'bot-equality-snapshot-test',
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'human', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: {
        kind: 'bot',
        speciesId: 'CEN',
        chosenPlanId: 'cen_vigor_power_destruction',
      },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [{
        playerId: 'human',
        isReady: true,
        currentStep: 'battle.charge_declaration',
      }],
      ships: {
        human: [{ instanceId: 'human-def', shipDefId: 'DEF' }],
        bot: [
          { instanceId: 'bot-equ', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-def', shipDefId: 'DEF' },
        ],
      },
      voidShipsByPlayerId: { human: [], bot: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          human: [],
          bot: ['bot-equ'],
        },
        solarGridDeclarationSourceIdsByPlayerId: { human: [], bot: [] },
        chargeDeclarationFleetSnapshotByPlayerId: {
          human: [{ instanceId: 'human-def', shipDefId: 'DEF' }],
          bot: [
            { instanceId: 'bot-equ', shipDefId: 'EQU', chargesCurrent: 1 },
            { instanceId: 'bot-def', shipDefId: 'DEF' },
          ],
        },
        chargePowerUsedByInstanceId: {},
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };
  replaceChargeDeclarationVisibilityState(state);
  state.gameData.ships.human = [];
  state.gameData.voidShipsByPlayerId.human = [
    { instanceId: 'human-def', shipDefId: 'DEF' },
  ];

  const result = await runBotsUntilSettled({ state, nowMs: 1000 });
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'POWER_USED' &&
      event.playerId === 'bot' &&
      event.actionId === 'EQU#0'
    ),
    true,
  );
  assert.equal(
    result.state.gameData.voidShipsByPlayerId.bot.some(
      (ship: any) => ship.instanceId === 'bot-def',
    ),
    true,
  );
});

Deno.test('multi-EQU bot reserves its accepted pair and settles without repeat-target rejection', async () => {
  const state: any = {
    gameId: 'bot-multi-equ-reservation-test',
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'human', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'CEN', chosenPlanId: 'cen_vigor_power_destruction' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [{
        playerId: 'human',
        isReady: true,
        currentStep: 'battle.charge_declaration',
      }],
      ships: {
        human: [{ instanceId: 'human-def', shipDefId: 'DEF' }],
        bot: [
          { instanceId: 'bot-equ-a', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-b', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-c', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-def', shipDefId: 'DEF' },
        ],
      },
      voidShipsByPlayerId: { human: [], bot: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          human: [],
          bot: ['bot-equ-a', 'bot-equ-b', 'bot-equ-c'],
        },
        solarGridDeclarationSourceIdsByPlayerId: { human: [], bot: [] },
        chargeDeclarationFleetSnapshotByPlayerId: {},
        chargePowerUsedByInstanceId: {},
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = structuredClone(
    state.gameData.ships,
  );
  replaceChargeDeclarationVisibilityState(state);

  const result = await runBotsUntilSettled({ state, nowMs: 1000 });
  const equalityUses = result.events.filter(
    (event: any) => event.type === 'POWER_USED' && event.actionId === 'EQU#0',
  );
  assert.equal(equalityUses.length, 1);
  assert.equal(
    result.events.some((event: any) => event.type === 'BOT_INTENT_REJECTED'),
    false,
  );
  assert.equal(equalityUses[0].sourceInstanceId, 'bot-equ-a');
  assert.deepEqual(equalityUses[0].targetInstanceIds, ['bot-def', 'human-def']);
  assert.equal(
    result.state.gameData.ships.bot.find((ship: any) => ship.instanceId === 'bot-equ-b')
      .chargesCurrent,
    1,
  );
});

Deno.test('multi-EQU bot spends disjoint sources on every available shared-cost pair', async () => {
  const state: any = {
    gameId: 'bot-multi-equ-disjoint-test',
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'human', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'CEN', chosenPlanId: 'cen_vigor_power_destruction' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [{
        playerId: 'human',
        isReady: true,
        currentStep: 'battle.charge_declaration',
      }],
      ships: {
        human: [
          { instanceId: 'human-def', shipDefId: 'DEF' },
          { instanceId: 'human-int', shipDefId: 'INT' },
        ],
        bot: [
          { instanceId: 'bot-equ-a', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-b', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-c', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-def', shipDefId: 'DEF' },
          { instanceId: 'bot-int', shipDefId: 'INT' },
        ],
      },
      voidShipsByPlayerId: { human: [], bot: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          human: [],
          bot: ['bot-equ-a', 'bot-equ-b', 'bot-equ-c'],
        },
        solarGridDeclarationSourceIdsByPlayerId: { human: [], bot: [] },
        chargeDeclarationFleetSnapshotByPlayerId: {},
        chargePowerUsedByInstanceId: {},
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };
  state.gameData.turnData.chargeDeclarationFleetSnapshotByPlayerId = structuredClone(
    state.gameData.ships,
  );
  replaceChargeDeclarationVisibilityState(state);

  const result = await runBotsUntilSettled({ state, nowMs: 1000 });
  const equalityUses = result.events.filter(
    (event: any) => event.type === 'POWER_USED' && event.actionId === 'EQU#0',
  );
  assert.equal(
    result.events.some((event: any) => event.type === 'BOT_INTENT_REJECTED'),
    false,
  );
  assert.equal(
    result.events.some((event: any) => event.type === 'BOT_RUNNER_LIMIT_REACHED'),
    false,
  );
  assert.equal(result.botStepsApplied >= 2, true);
  assert.notEqual(result.state.gameData.currentSubPhase, 'charge_declaration');
  assert.deepEqual(
    equalityUses.map((event: any) => ({
      sourceInstanceId: event.sourceInstanceId,
      targetInstanceIds: event.targetInstanceIds,
    })),
    [
      {
        sourceInstanceId: 'bot-equ-a',
        targetInstanceIds: ['bot-def', 'human-def'],
      },
      {
        sourceInstanceId: 'bot-equ-b',
        targetInstanceIds: ['bot-int', 'human-int'],
      },
    ],
  );
});

Deno.test('multi-GUA bot seeds staged reservations across sequential loop passes', async () => {
  const state: any = {
    gameId: 'bot-multi-gua-reservation-test',
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'opponent', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      opponent: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'HUM', chosenPlanId: 'hum_guardian_tactical_control' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'first_strike',
      phaseReadiness: [{
        playerId: 'opponent',
        isReady: true,
        currentStep: 'battle.first_strike',
      }],
      ships: {
        opponent: [{ instanceId: 'only-target', shipDefId: 'DEF' }],
        bot: [
          { instanceId: 'gua-a', shipDefId: 'GUA', chargesCurrent: 2 },
          { instanceId: 'gua-b', shipDefId: 'GUA', chargesCurrent: 2 },
          { instanceId: 'gua-c', shipDefId: 'GUA', chargesCurrent: 2 },
        ],
      },
      voidShipsByPlayerId: { opponent: [], bot: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        chargePowerUsedByInstanceId: {},
      },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
    },
  };

  const result = await runBotsUntilSettled({ state, nowMs: 1000 });
  assert.equal(
    result.events.filter(
      (event: any) => event.type === 'POWER_USED' && event.actionId === 'GUA#0',
    ).length,
    1,
  );
  assert.equal(
    result.events.some((event: any) => event.type === 'BOT_INTENT_REJECTED'),
    false,
  );
  assert.equal(
    result.state.gameData.ships.bot.find((ship: any) => ship.instanceId === 'gua-b')
      .chargesCurrent,
    2,
  );
  assert.equal(
    result.state.gameData.ships.bot.find((ship: any) => ship.instanceId === 'gua-c')
      .chargesCurrent,
    2,
  );
});

Deno.test('authored Human INT-only plans preserve sequential final Declaration actions', async () => {
  const ships = {
    opponent: [],
    bot: [
      { instanceId: 'bot-int-a', shipDefId: 'INT', chargesCurrent: 1 },
      { instanceId: 'bot-int-b', shipDefId: 'INT', chargesCurrent: 1 },
    ],
  };
  const state: any = {
    gameId: 'bot-human-int-sequential-test',
    status: 'active',
    turnNumber: 3,
    players: [
      { id: 'opponent', role: 'player', faction: 'xenite', health: 5, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'human', health: 20, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      opponent: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'HUM', chosenPlanId: 'hum_orbital_carrier_tactical' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [{
        playerId: 'opponent',
        isReady: true,
        currentStep: 'battle.charge_declaration',
      }],
      ships,
      voidShipsByPlayerId: { opponent: [], bot: [] },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          opponent: [],
          bot: ['bot-int-a', 'bot-int-b'],
        },
        solarGridDeclarationSourceIdsByPlayerId: { opponent: [], bot: [] },
        chargeDeclarationFleetSnapshotByPlayerId: structuredClone(ships),
        chargePowerUsedByInstanceId: {},
      },
    },
  };
  replaceChargeDeclarationVisibilityState(state);

  const result = await runBotsUntilSettled({ state, nowMs: 100 });
  const interceptorUses = result.events.filter(
    (event: any) => event.type === 'POWER_USED' && event.actionId === 'INT#0',
  );

  assert.equal(result.botStepsApplied, 3);
  assert.deepEqual(
    interceptorUses.map((event: any) => event.sourceInstanceId),
    ['bot-int-a', 'bot-int-b'],
  );
  assert.equal(result.state.status, 'finished');
  assert.equal(
    result.events.some((event: any) => event.type === 'BOT_RUNNER_LIMIT_REACHED'),
    false,
  );
});
