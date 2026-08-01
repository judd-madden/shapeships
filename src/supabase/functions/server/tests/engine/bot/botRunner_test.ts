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
        chargeDeclarationEligibleByPlayerId: { human: false, bot: true },
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
        anyChargesSpentInDeclaration: false,
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
