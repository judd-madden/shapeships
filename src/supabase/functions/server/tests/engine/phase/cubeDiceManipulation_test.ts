import assert from 'node:assert/strict';
import { applyIntent, type IntentRequest } from '../../../engine/intent/IntentReducer.ts';
import { onEnterPhase } from '../../../engine/phase/onEnterPhase.ts';
import { advancePhaseCore } from '../../../engine/phase/advancePhase.ts';
import {
  getCubeDiceActionForPlayer,
  rollLockedCubeDiceByPlayerId,
} from '../../../engine/phase/cubeDiceManipulation.ts';

function ship(instanceId: string, shipDefId: string, createdTurn = 1) {
  return { instanceId, shipDefId, createdTurn };
}

function createDiceState(p1Ships: any[], p2Ships: any[] = []): any {
  return {
    gameId: 'cube-dice-test',
    status: 'active',
    turnNumber: 1,
    players: [
      { id: 'p1', role: 'player', faction: 'human', health: 25, lines: 0, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'centaur', health: 25, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 1,
      currentPhase: 'build',
      currentSubPhase: 'dice_roll',
      diceRoll: null,
      phaseReadiness: [],
      ships: { p1: p1Ships, p2: p2Ships },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {},
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber: 1,
        currentMajorPhase: 'build',
        currentSubPhase: 'dice_roll',
        diceRolled: false,
        diceFinalized: false,
      },
    },
  };
}

function actionIntent(sourceInstanceId: string, choiceId: string): IntentRequest {
  return {
    gameId: 'cube-dice-test',
    intentType: 'ACTION',
    turnNumber: 1,
    nonce: `cube-action-${choiceId}`,
    payload: {
      actionType: 'power',
      actionId: 'CUB#0',
      sourceInstanceId,
      choiceId,
    },
  };
}

function readyIntent(playerId: string): IntentRequest {
  return {
    gameId: 'cube-dice-test',
    intentType: 'DECLARE_READY',
    turnNumber: 1,
    nonce: `cube-ready-${playerId}`,
  };
}

Deno.test('Cube helper locks deterministic rolls in lexicographic controller order', () => {
  const state = createDiceState([
    ship('cube-z', 'CUB'),
    ship('cube-a', 'CUB'),
  ]);
  const values = [2, 5];
  const rolls = rollLockedCubeDiceByPlayerId(state, () => values.shift()!);

  assert.deepEqual(rolls, {
    p1: [
      { sourceInstanceId: 'cube-a', value: 2 },
      { sourceInstanceId: 'cube-z', value: 5 },
    ],
  });
});

Deno.test('direct Cube stage rolls once, projects Main first, and auto-readies the opponent', () => {
  const state = createDiceState([
    ship('cube-z', 'CUB'),
    ship('cube-a', 'CUB'),
  ]);
  const entered = onEnterPhase(
    state,
    'battle.end_of_turn_resolution',
    'build.dice_roll',
    100,
  );
  const turnData = entered.state.gameData.turnData;

  assert.equal(turnData.diceManipulationStage, 'cube');
  assert.equal(turnData.diceFinalized, false);
  assert.equal(turnData.cubeDiceRollsByPlayerId.p1.length, 2);
  assert.deepEqual(
    turnData.cubeDiceRollsByPlayerId.p1.map((roll: any) => roll.sourceInstanceId),
    ['cube-a', 'cube-z'],
  );
  assert.equal(
    turnData.visibleCubeDiceValueByPlayerId.p1,
    turnData.cubeDiceRollsByPlayerId.p1[0].value,
  );
  assert.equal(
    entered.state.gameData.phaseReadiness.some(
      (entry: any) => entry.playerId === 'p2' && entry.isReady,
    ),
    true,
  );

  const action = getCubeDiceActionForPlayer(entered.state, 'p1');
  assert.ok(action);
  assert.deepEqual(
    action.choices.map((choice) => choice.choiceId),
    ['main', 'cube:cube-a', 'cube:cube-z'],
  );

  const lockedBefore = structuredClone(turnData.cubeDiceRollsByPlayerId);
  const reentered = onEnterPhase(
    entered.state,
    'build.dice_roll',
    'build.dice_roll',
    200,
  );
  assert.deepEqual(
    reentered.state.gameData.turnData.cubeDiceRollsByPlayerId,
    lockedBefore,
  );
});

Deno.test('final KNO pass enters Cube and clears stale KNO stage state', async () => {
  const state = createDiceState([
    ship('kno-a', 'KNO'),
    ship('cube-a', 'CUB'),
  ]);
  const entered = onEnterPhase(
    state,
    'battle.end_of_turn_resolution',
    'build.dice_roll',
    100,
  );
  assert.equal(entered.state.gameData.turnData.diceManipulationStage, 'kno');
  assert.equal(entered.state.gameData.turnData.cubeDiceRollsByPlayerId, undefined);

  const held = await applyIntent(entered.state, 'p1', {
    gameId: 'cube-dice-test',
    intentType: 'ACTION',
    turnNumber: 1,
    nonce: 'kno-hold',
    payload: {
      actionType: 'power',
      actionId: 'KNO#0',
      sourceInstanceId: 'kno-a',
      choiceId: 'hold',
    },
  }, 150);
  assert.equal(held.ok, true);

  const readied = await applyIntent(held.state, 'p1', readyIntent('p1'), 200);
  assert.equal(readied.ok, true);
  assert.equal(readied.state.gameData.turnData.diceManipulationStage, 'cube');
  assert.equal(readied.state.gameData.turnData.knoRerollPassIndex, undefined);
  assert.deepEqual(
    readied.state.gameData.turnData.pendingKnoRerollChoiceByPassByPlayerId,
    {},
  );
  assert.equal(readied.state.gameData.turnData.diceFinalized, false);
  assert.equal(readied.state.gameData.turnData.cubeDiceRollsByPlayerId.p1.length, 1);
});

Deno.test('multiple KNO passes complete before Cube rolls are created', async () => {
  const entered = onEnterPhase(
    createDiceState([
      ship('kno-a', 'KNO'),
      ship('kno-b', 'KNO'),
      ship('cube-a', 'CUB'),
    ]),
    'battle.end_of_turn_resolution',
    'build.dice_roll',
    100,
  );

  const firstChoice = await applyIntent(entered.state, 'p1', {
    gameId: 'cube-dice-test',
    intentType: 'ACTION',
    turnNumber: 1,
    nonce: 'kno-pass-1',
    payload: {
      actionType: 'power',
      actionId: 'KNO#0',
      sourceInstanceId: 'kno-a',
      choiceId: 'reroll',
    },
  }, 110);
  const secondPass = await applyIntent(
    firstChoice.state,
    'p1',
    readyIntent('p1'),
    120,
  );
  assert.equal(secondPass.state.gameData.turnData.diceManipulationStage, 'kno');
  assert.equal(secondPass.state.gameData.turnData.knoRerollPassIndex, 2);
  assert.equal(secondPass.state.gameData.turnData.cubeDiceRollsByPlayerId, undefined);

  const secondChoice = await applyIntent(secondPass.state, 'p1', {
    gameId: 'cube-dice-test',
    intentType: 'ACTION',
    turnNumber: 1,
    nonce: 'kno-pass-2',
    payload: {
      actionType: 'power',
      actionId: 'KNO#0',
      sourceInstanceId: 'kno-b',
      choiceId: 'hold',
    },
  }, 130);
  const cubeStage = await applyIntent(
    secondChoice.state,
    'p1',
    readyIntent('p1'),
    140,
  );
  assert.equal(cubeStage.state.gameData.turnData.diceManipulationStage, 'cube');
  assert.equal(cubeStage.state.gameData.turnData.knoRerollPassIndex, undefined);
  assert.equal(cubeStage.state.gameData.turnData.cubeDiceRollsByPlayerId.p1.length, 1);
  const action = getCubeDiceActionForPlayer(cubeStage.state, 'p1');
  assert.equal(
    action?.choices[0].projectedAmount,
    cubeStage.state.gameData.turnData.baseDiceRoll,
  );
});

Deno.test('Cube readiness resolution retains selection and isolates shared and CHR dice', async () => {
  const state = createDiceState([
    ship('cube-a', 'CUB'),
    ship('chr-a', 'CHR'),
  ]);
  Object.assign(state.gameData.turnData, {
    diceManipulationStage: 'cube',
    diceRolled: true,
    baseDiceRoll: 2,
    effectiveDiceRoll: 2,
    diceRoll: 2,
    effectiveDiceRollByPlayerId: { p1: 2, p2: 2 },
    cubeDiceRollsByPlayerId: {
      p1: [{ sourceInstanceId: 'cube-a', value: 5 }],
    },
    visibleCubeDiceValueByPlayerId: { p1: 5 },
    chronoswarmRolls: [3],
    chronoswarmCountByPlayerId: { p1: 1, p2: 0 },
    chronoswarmSharedRollCount: 1,
  });
  state.gameData.diceRoll = 2;
  state.gameData.phaseReadiness = [{
    playerId: 'p2',
    isReady: true,
    currentStep: 'build.dice_roll',
  }];

  const staged = await applyIntent(
    state,
    'p1',
    actionIntent('cube-a', 'cube:cube-a'),
    100,
  );
  assert.equal(staged.ok, true);

  const resolved = await applyIntent(
    staged.state,
    'p1',
    readyIntent('p1'),
    200,
  );
  assert.equal(resolved.ok, true);
  const turnData = resolved.state.gameData.turnData;
  assert.equal(turnData.diceManipulationStage, undefined);
  assert.equal(turnData.diceFinalized, true);
  assert.deepEqual(turnData.cubeDiceSelectionByPlayerId.p1, {
    choiceId: 'cube:cube-a',
    value: 5,
    sourceInstanceId: 'cube-a',
  });
  assert.equal(turnData.baseDiceRoll, 2);
  assert.equal(turnData.effectiveDiceRoll, 2);
  assert.equal(turnData.diceRoll, 2);
  assert.equal(resolved.state.gameData.diceRoll, 2);
  assert.equal(turnData.effectiveDiceRollByPlayerId.p1, 5);
  assert.equal(turnData.effectiveDiceRollByPlayerId.p2, 2);
  assert.deepEqual(turnData.chronoswarmRolls, [3]);
  assert.equal(resolved.state.players[0].lines, 8);
  assert.equal(resolved.state.players[1].lines, 2);
});

Deno.test('Cube Ready requires a staged choice and two controllers resolve independently', async () => {
  const entered = onEnterPhase(
    createDiceState(
      [ship('cube-p1', 'CUB')],
      [ship('cube-p2', 'CUB')],
    ),
    'battle.end_of_turn_resolution',
    'build.dice_roll',
    100,
  );
  const turnData = entered.state.gameData.turnData;
  turnData.baseDiceRoll = 2;
  turnData.effectiveDiceRoll = 2;
  turnData.diceRoll = 2;
  entered.state.gameData.diceRoll = 2;
  turnData.effectiveDiceRollByPlayerId = { p1: 2, p2: 2 };
  turnData.cubeDiceRollsByPlayerId = {
    p1: [{ sourceInstanceId: 'cube-p1', value: 5 }],
    p2: [{ sourceInstanceId: 'cube-p2', value: 4 }],
  };
  turnData.visibleCubeDiceValueByPlayerId = { p1: 5, p2: 4 };

  const readinessBefore = structuredClone(entered.state.gameData.phaseReadiness);
  const premature = await applyIntent(
    entered.state,
    'p1',
    readyIntent('p1'),
    110,
  );
  assert.equal(premature.ok, false);
  assert.deepEqual(entered.state.gameData.phaseReadiness, readinessBefore);

  const p1Choice = await applyIntent(
    entered.state,
    'p1',
    actionIntent('cube-p1', 'cube:cube-p1'),
    120,
  );
  const p1Ready = await applyIntent(
    p1Choice.state,
    'p1',
    readyIntent('p1'),
    130,
  );
  assert.equal(p1Ready.state.gameData.turnData.diceManipulationStage, 'cube');
  assert.equal(
    p1Ready.events.some((event: any) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_CUBE_ROLLS'
    ),
    false,
  );

  const p2Choice = await applyIntent(
    p1Ready.state,
    'p2',
    actionIntent('cube-p2', 'main'),
    140,
  );
  const resolved = await applyIntent(
    p2Choice.state,
    'p2',
    readyIntent('p2'),
    150,
  );
  assert.equal(resolved.state.gameData.turnData.effectiveDiceRollByPlayerId.p1, 5);
  assert.equal(resolved.state.gameData.turnData.effectiveDiceRollByPlayerId.p2, 2);
  assert.equal(resolved.state.gameData.turnData.visibleCubeDiceValueByPlayerId.p1, 5);
  assert.equal(resolved.state.gameData.turnData.visibleCubeDiceValueByPlayerId.p2, 4);
  assert.deepEqual(
    resolved.events.filter((event: any) =>
      event.type === 'BATTLE_LOG_CAPTURE_BUILD_CUBE_ROLLS'
    ),
    [
      {
        type: 'BATTLE_LOG_CAPTURE_BUILD_CUBE_ROLLS',
        turnNumber: 1,
        playerId: 'p1',
        cubeRollValues: [5],
      },
      {
        type: 'BATTLE_LOG_CAPTURE_BUILD_CUBE_ROLLS',
        turnNumber: 1,
        playerId: 'p2',
        cubeRollValues: [4],
      },
    ],
  );
});

Deno.test('LEV suppresses Cube rolls and public Cube values', () => {
  const entered = onEnterPhase(
    createDiceState([ship('cube-a', 'CUB'), ship('lev-a', 'LEV')]),
    'battle.end_of_turn_resolution',
    'build.dice_roll',
    100,
  );

  assert.equal(entered.state.gameData.turnData.diceManipulationStage, undefined);
  assert.equal(entered.state.gameData.turnData.cubeDiceRollsByPlayerId, undefined);
  assert.equal(
    entered.state.gameData.turnData.visibleCubeDiceValueByPlayerId?.p1,
    undefined,
  );
  assert.equal(entered.state.gameData.turnData.effectiveDiceRollByPlayerId.p1, 6);
});

Deno.test('new turn clears every Cube Dice Manipulation field', () => {
  const state = createDiceState([ship('cube-a', 'CUB')]);
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'end_of_turn_resolution';
  Object.assign(state.gameData.turnData, {
    currentMajorPhase: 'battle',
    currentSubPhase: 'end_of_turn_resolution',
    diceManipulationStage: 'cube',
    cubeDiceRollsByPlayerId: {
      p1: [{ sourceInstanceId: 'cube-a', value: 5 }],
    },
    pendingCubeDiceChoiceByPlayerId: { p1: 'cube:cube-a' },
    cubeDiceSelectionByPlayerId: {
      p1: {
        choiceId: 'cube:cube-a',
        value: 5,
        sourceInstanceId: 'cube-a',
      },
    },
    visibleCubeDiceValueByPlayerId: { p1: 5 },
  });

  const advanced = advancePhaseCore(state, 100);
  assert.equal(advanced.ok, true);
  if (!advanced.ok) return;
  const turnData = advanced.state.gameData?.turnData;
  assert.equal(turnData?.diceManipulationStage, undefined);
  assert.equal(turnData?.cubeDiceRollsByPlayerId, undefined);
  assert.equal(turnData?.pendingCubeDiceChoiceByPlayerId, undefined);
  assert.equal(turnData?.cubeDiceSelectionByPlayerId, undefined);
  assert.equal(turnData?.visibleCubeDiceValueByPlayerId, undefined);
});
