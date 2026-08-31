import assert from 'node:assert/strict';
import {
  MAX_BOT_STEPS_PER_REQUEST,
  runBotsUntilSettled,
} from '../../../engine/bot/botRunner.ts';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
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
      { id: 'player', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
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
        player: [],
        bot: [...cubeShips, {
          instanceId: 'owned-kno',
          shipDefId: 'KNO',
          createdTurn: 1,
        }],
      },
      phaseReadiness: [{
        playerId: 'player',
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
        effectiveDiceRollByPlayerId: { player: mainValue, bot: mainValue },
        cubeDiceRollsByPlayerId: {
          bot: cubeShips.map((ship, index) => ({
            sourceInstanceId: ship.instanceId,
            value: cubeValues[index],
          })),
        },
        visibleCubeDiceValueByPlayerId: { bot: cubeValues[0] },
        chronoswarmRolls: [],
        chronoswarmCountByPlayerId: { player: 0, bot: 0 },
        chronoswarmSharedRollCount: 0,
      },
    },
  };
}

function createExactCapCentaurBotState(): any {
  return {
    gameId: 'bot-exact-cap-settled-test',
    status: 'active',
    turnNumber: 3,
    players: [
      {
        id: 'player',
        role: 'player',
        faction: 'human',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
      {
        id: 'bot',
        role: 'player',
        faction: 'centaur',
        health: 10,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
      bot: {
        kind: 'bot',
        speciesId: 'CEN',
        chosenPlanId: 'cen_greed_dom',
      },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'first_strike',
      phaseReadiness: [{
        playerId: 'player',
        isReady: true,
        currentStep: 'battle.first_strike',
      }],
      ships: {
        player: [
          { instanceId: 'player-orb', shipDefId: 'ORB', createdTurn: 1 },
          { instanceId: 'player-int', shipDefId: 'INT', chargesCurrent: 1, createdTurn: 1 },
          { instanceId: 'player-def', shipDefId: 'DEF', createdTurn: 1 },
        ],
        bot: [
          { instanceId: 'bot-dom', shipDefId: 'DOM', createdTurn: 3 },
          { instanceId: 'bot-equ', shipDefId: 'EQU', chargesCurrent: 1, createdTurn: 1 },
          { instanceId: 'bot-fam', shipDefId: 'FAM', chargesCurrent: 1, createdTurn: 1 },
          { instanceId: 'bot-kno', shipDefId: 'KNO', createdTurn: 1 },
          { instanceId: 'bot-fea', shipDefId: 'FEA', createdTurn: 1 },
        ],
      },
      voidShipsByPlayerId: { player: [], bot: [] },
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
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        commitments: {},
        chargePowerUsedByInstanceId: {},
        chronoswarmRolls: [],
        chronoswarmCountByPlayerId: { player: 0, bot: 0 },
        chronoswarmSharedRollCount: 0,
      },
    },
    actions: [],
    events: [],
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
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

Deno.test('bot Cube selection keeps a higher Main over lower Cubes', async () => {
  const result = await runBotsUntilSettled({
    state: createBotCubeState(6, [5, 4]),
    nowMs: 100,
  });
  assert.equal(
    result.state.gameData.turnData.cubeDiceSelectionByPlayerId.bot.choiceId,
    'main',
  );
});

Deno.test('bot Cube selection prefers Cube over Main ties and keeps stable Cube order', async () => {
  const mainTie = await runBotsUntilSettled({
    state: createBotCubeState(6, [6, 6]),
    nowMs: 100,
  });
  assert.equal(
    mainTie.state.gameData.turnData.cubeDiceSelectionByPlayerId.bot.choiceId,
    'cube:transferred-cube-01',
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
      { id: 'player', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
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
        playerId: 'player',
        isReady: true,
        currentStep: 'battle.charge_declaration',
      }],
      ships: {
        player: [{ instanceId: 'player-def', shipDefId: 'DEF' }],
        bot: [
          { instanceId: 'bot-equ', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-def', shipDefId: 'DEF' },
        ],
      },
      voidShipsByPlayerId: { player: [], bot: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          player: [],
          bot: ['bot-equ'],
        },
        chargeDeclarationFleetSnapshotByPlayerId: {
          player: [{ instanceId: 'player-def', shipDefId: 'DEF' }],
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
  state.gameData.ships.player = [];
  state.gameData.voidShipsByPlayerId.player = [
    { instanceId: 'player-def', shipDefId: 'DEF' },
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
      { id: 'player', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'CEN', chosenPlanId: 'cen_vigor_power_destruction' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [{
        playerId: 'player',
        isReady: true,
        currentStep: 'battle.charge_declaration',
      }],
      ships: {
        player: [{ instanceId: 'player-def', shipDefId: 'DEF' }],
        bot: [
          { instanceId: 'bot-equ-a', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-b', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-c', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-def', shipDefId: 'DEF' },
        ],
      },
      voidShipsByPlayerId: { player: [], bot: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          player: [],
          bot: ['bot-equ-a', 'bot-equ-b', 'bot-equ-c'],
        },
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
  assert.deepEqual(equalityUses[0].targetInstanceIds, ['bot-def', 'player-def']);
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
      { id: 'player', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'bot', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'CEN', chosenPlanId: 'cen_vigor_power_destruction' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [{
        playerId: 'player',
        isReady: true,
        currentStep: 'battle.charge_declaration',
      }],
      ships: {
        player: [
          { instanceId: 'player-def', shipDefId: 'DEF' },
          { instanceId: 'player-int', shipDefId: 'INT' },
        ],
        bot: [
          { instanceId: 'bot-equ-a', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-b', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-equ-c', shipDefId: 'EQU', chargesCurrent: 1 },
          { instanceId: 'bot-def', shipDefId: 'DEF' },
          { instanceId: 'bot-int', shipDefId: 'INT' },
        ],
      },
      voidShipsByPlayerId: { player: [], bot: [] },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          player: [],
          bot: ['bot-equ-a', 'bot-equ-b', 'bot-equ-c'],
        },
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
        targetInstanceIds: ['bot-def', 'player-def'],
      },
      {
        sourceInstanceId: 'bot-equ-b',
        targetInstanceIds: ['bot-int', 'player-int'],
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

Deno.test('current supported bot ceiling reaches eight accepted intents already settled', async () => {
  const firstRun = await runBotsUntilSettled({
    state: createExactCapCentaurBotState(),
    nowMs: 100,
  });

  assert.equal(firstRun.botStepsApplied, MAX_BOT_STEPS_PER_REQUEST);
  assert.equal(
    firstRun.events.some((event: any) => event.type === 'BOT_RUNNER_LIMIT_REACHED'),
    true,
  );
  assert.equal(
    firstRun.events.some((event: any) => event.type === 'BOT_INTENT_REJECTED'),
    false,
  );
  // DOM and KNO choices are staged by one accepted intent and resolved by the
  // following ready intent, so their resolution events are interleaved with
  // PLAYER_READY rather than mapping one-to-one to runner steps.
  assert.deepEqual(
    firstRun.events
      .filter((event: any) =>
        event.type === 'POWER_USED' ||
        event.type === 'PLAYER_READY' ||
        event.type === 'BUILD_SUBMITTED'
      )
      .map((event: any) =>
        event.type === 'POWER_USED'
          ? `${event.type}:${event.actionId}`
          : event.type
      ),
    [
      'PLAYER_READY',
      'POWER_USED:DOM#0',
      'POWER_USED:EQU#0',
      'POWER_USED:INT#0',
      'POWER_USED:FAM#0',
      'PLAYER_READY',
      'PLAYER_READY',
      'BUILD_SUBMITTED',
      'PLAYER_READY',
    ],
  );

  const settledState = firstRun.state;
  assert.equal(settledState.gameData.currentPhase, 'build');
  assert.equal(settledState.gameData.currentSubPhase, 'drawing');
  assert.equal(
    settledState.gameData.phaseReadiness.some((entry: any) =>
      entry.playerId === 'bot' &&
      entry.currentStep === 'build.drawing' &&
      entry.isReady === true
    ),
    true,
  );
  assert.equal(
    settledState.gameData.turnData.commitments.BUILD_4.bot.revealPayload != null,
    true,
  );
  assert.equal(
    settledState.gameData.turnData.drawingPreludeByPlayerId.bot.status,
    'complete',
  );
  assert.equal(
    settledState.gameData.turnData.commitments.BUILD_4.player,
    undefined,
  );

  // Reaching the numerical cap does not imply unresolved bot work. This exact
  // current-rule ceiling is fully settled after its eighth accepted bot intent.
  const secondRun = await runBotsUntilSettled({ state: settledState, nowMs: 101 });
  assert.equal(secondRun.botStepsApplied, 0);
  assert.deepEqual(secondRun.state, settledState);
  assert.equal(
    secondRun.events.some((event: any) =>
      event.type === 'POWER_USED' ||
      event.type === 'PLAYER_READY' ||
      event.type === 'BUILD_SUBMITTED' ||
      event.type === 'BOT_RUNNER_LIMIT_REACHED'
    ),
    false,
  );

  const playerBuild = await applyIntent(
    structuredClone(settledState),
    'player',
    {
      gameId: settledState.gameId,
      intentType: 'BUILD_SUBMIT',
      turnNumber: 4,
      payload: { builds: [] },
      nonce: 'player-after-exact-bot-cap',
    },
    102,
  );
  assert.equal(playerBuild.ok, true);
});
