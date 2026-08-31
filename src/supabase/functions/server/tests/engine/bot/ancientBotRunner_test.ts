import assert from 'node:assert/strict';
import { runBotsUntilSettled } from '../../../engine/bot/botRunner.ts';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
import { getCubeDiceActionForPlayer } from '../../../engine/phase/cubeDiceManipulation.ts';
import { normalizeAncientGameState } from '../../../engine/state/ancientState.ts';

function createBaseState(args: {
  gameId: string;
  turnNumber: number;
  phase: 'species_selection' | 'dice_roll' | 'drawing';
  lines?: number;
  chosenPlanId?: string | null;
  cubeValues?: number[];
}) {
  const botShips = (args.cubeValues ?? []).map((value, index) => ({
    instanceId: `bot-cube-${index + 1}`,
    shipDefId: 'CUB',
    createdTurn: 1,
    testRoll: value,
  }));
  const majorPhase = args.phase === 'species_selection' ? 'setup' : 'build';
  const subPhase = args.phase;
  const state = {
    gameId: args.gameId,
    status: 'active',
    turnNumber: args.turnNumber,
    players: [
      {
        id: 'human',
        name: 'Human',
        role: 'player',
        faction: args.phase === 'species_selection' ? null : 'human',
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: 'bot',
        name: 'Ancient Bot',
        role: 'player',
        faction: args.phase === 'species_selection' ? null : 'ancient',
        health: 25,
        lines: args.lines ?? 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      human: { kind: 'human' },
      bot: {
        kind: 'bot',
        speciesId: 'ANC',
        chosenPlanId: args.chosenPlanId ?? null,
      },
    },
    gameData: {
      turnNumber: args.turnNumber,
      currentPhase: majorPhase,
      currentSubPhase: subPhase,
      diceRoll: 4,
      phaseReadiness: [],
      ships: { human: [], bot: botShips },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: args.turnNumber,
        currentMajorPhase: majorPhase,
        currentSubPhase: subPhase,
        commitments: {},
        ...(args.phase === 'dice_roll'
          ? {
            diceManipulationStage: 'cube',
            diceRolled: true,
            diceFinalized: false,
            baseDiceRoll: 4,
            effectiveDiceRoll: 4,
            diceRoll: 4,
            effectiveDiceRollByPlayerId: { human: 4, bot: 4 },
            cubeDiceRollsByPlayerId: {
              bot: botShips.map((ship, index) => ({
                sourceInstanceId: ship.instanceId,
                value: args.cubeValues?.[index],
              })),
            },
            visibleCubeDiceValueByPlayerId: {
              bot: args.cubeValues?.[0],
            },
            chronoswarmRolls: [],
            chronoswarmCountByPlayerId: { human: 0, bot: 0 },
            chronoswarmSharedRollCount: 0,
          }
          : {}),
        ...(args.phase === 'drawing'
          ? {
            effectiveDiceRollByPlayerId: { human: 4, bot: 4 },
            chronoswarmRolls: [],
            chronoswarmCountByPlayerId: { human: 0, bot: 0 },
            drawingPreludeByPlayerId: {
              human: {
                turnNumber: args.turnNumber,
                requiredPassCount: 1,
                activePassIndex: 1,
                status: 'complete',
                eligibleSourcePowers: [],
                resolvedSourcePowerKeysByPass: {},
              },
              bot: {
                turnNumber: args.turnNumber,
                requiredPassCount: 1,
                activePassIndex: 1,
                status: 'complete',
                eligibleSourcePowers: [],
                resolvedSourcePowerKeysByPass: {},
              },
            },
            buildDrawingPublicFleetByPlayerId: { human: [], bot: botShips },
          }
          : {}),
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
  return normalizeAncientGameState(state).state;
}

Deno.test('internal Ancient controller submits its own species while public bot selection stays gated', async () => {
  const internal = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'ancient-internal-species',
      turnNumber: 0,
      phase: 'species_selection',
    }),
    nowMs: 100,
  });
  assert.equal(internal.botStepsApplied, 1);
  assert.equal(
    internal.state.players.find((player: { id?: string }) => player.id === 'bot')?.faction,
    'ancient',
  );
  assert.equal(
    internal.events.some((event: { type?: string }) =>
      event.type === 'BOT_INTENT_REJECTED'
    ),
    false,
  );

  const publicAttempt = await applyIntent(
    createBaseState({
      gameId: 'ancient-public-gate',
      turnNumber: 0,
      phase: 'species_selection',
    }),
    'human',
    {
      gameId: 'ancient-public-gate',
      intentType: 'SPECIES_SUBMIT',
      turnNumber: 0,
      payload: { species: 'human', botSpecies: 'ancient' },
      nonce: 'public-ancient-attempt',
    },
    100,
  );
  assert.equal(publicAttempt.ok, false);
  assert.equal(publicAttempt.rejected?.code, 'INVALID_SPECIES');
});

Deno.test('unresolved Ancient passes Dice Roll and reuses plan-independent Cube handling', async () => {
  const noCube = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'ancient-unresolved-dice',
      turnNumber: 1,
      phase: 'dice_roll',
    }),
    nowMs: 100,
  });
  assert.equal(noCube.botStepsApplied, 1);
  assert.equal(
    noCube.events.some((event: { reason?: string }) =>
      event.reason === 'missing_chosen_plan_id'
    ),
    false,
  );
  assert.equal(
    noCube.state.gameData.phaseReadiness.some((entry: {
      playerId?: string;
      isReady?: boolean;
    }) =>
      entry.playerId === 'bot' && entry.isReady === true
    ),
    true,
  );

  const cubeState = createBaseState({
    gameId: 'ancient-unresolved-cube',
    turnNumber: 1,
    phase: 'dice_roll',
    cubeValues: [3, 6],
  });
  assert.equal(getCubeDiceActionForPlayer(cubeState, 'bot')?.choices.length, 3);
  const withCube = await runBotsUntilSettled({
    state: cubeState,
    nowMs: 100,
  });
  assert.equal(
    withCube.state.gameData.turnData.pendingCubeDiceChoiceByPlayerId.bot,
    'cube:bot-cube-2',
  );
  assert.equal(withCube.botStepsApplied, 2);

  const higherMain = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'ancient-cube-main-higher',
      turnNumber: 1,
      phase: 'dice_roll',
      cubeValues: [3, 2],
    }),
    nowMs: 101,
  });
  assert.equal(
    higherMain.state.gameData.turnData.pendingCubeDiceChoiceByPlayerId.bot,
    'main',
  );

  const tiedCube = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'ancient-cube-tie',
      turnNumber: 1,
      phase: 'dice_roll',
      cubeValues: [4, 4],
    }),
    nowMs: 102,
  });
  assert.equal(
    tiedCube.state.gameData.turnData.pendingCubeDiceChoiceByPlayerId.bot,
    'cube:bot-cube-1',
  );
});

Deno.test('Ancient Drawing selection continues into an accepted build in the same invocation', async () => {
  const state = createBaseState({
    gameId: 'ancient-cub-resolution',
    turnNumber: 1,
    phase: 'drawing',
    lines: 9,
  });
  const selected = await runBotsUntilSettled({ state, nowMs: 100 });
  const chosenPlanId = selected.state.controllersByPlayerId.bot.chosenPlanId;

  assert.equal(selected.botStepsApplied, 1);
  assert.equal(typeof chosenPlanId, 'string');
  assert.equal(chosenPlanId.startsWith('anc_'), true);
  assert.equal(
    selected.events.some((event: { type?: string }) =>
      event.type === 'BOT_STRATEGY_RESOLVED'
    ),
    true,
  );
  assert.equal(
    selected.events.some((event: { type?: string }) =>
      event.type === 'BUILD_SUBMITTED'
    ),
    true,
  );

  selected.state.players.find((player: { id?: string; lines?: number }) =>
    player.id === 'bot'
  ).lines = 7;
  const repeated = await runBotsUntilSettled({ state: selected.state, nowMs: 101 });
  assert.equal(repeated.state.controllersByPlayerId.bot.chosenPlanId, chosenPlanId);
  assert.equal(repeated.botStepsApplied, 0);
});

Deno.test('runner persists a committed trio proposal before one authoritative build step', async () => {
  const result = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'committed-cube-trio',
      turnNumber: 2,
      phase: 'drawing',
      lines: 9,
      chosenPlanId: 'anc_cube_red_green',
      cubeValues: [4],
    }),
    nowMs: 100,
  });
  assert.equal(result.botStepsApplied, 1);
  assert.deepEqual(
    result.state.controllersByPlayerId.bot.planProgress,
    {
      committedBuildGroup: {
        planId: 'anc_cube_red_green',
        groupKey: 'core_trio',
        branchId: 'mer',
        shipDefId: 'MER',
        startingCount: 0,
        targetCount: 3,
      },
    },
  );
  assert.deepEqual(
    result.state.gameData.turnData.commitments.BUILD_2.bot.revealPayload.builds,
    [{ shipDefId: 'MER', count: 2 }],
  );
});

Deno.test('Ancient save submits an empty build and later Drawing reassesses accumulated lines', async () => {
  const saved = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'representative-1',
      turnNumber: 3,
      phase: 'drawing',
      lines: 5,
    }),
    nowMs: 100,
  });
  assert.equal(saved.botStepsApplied, 1);
  assert.equal(saved.state.controllersByPlayerId.bot.chosenPlanId, null);
  assert.deepEqual(
    saved.state.gameData.turnData.commitments.BUILD_3.bot.revealPayload,
    { builds: [] },
  );
  assert.equal(
    saved.state.players.find((player: { id?: string }) => player.id === 'bot').lines,
    5,
  );

  const resolvedSave = await applyIntent(
    saved.state,
    'human',
    {
      gameId: 'representative-1',
      intentType: 'BUILD_SUBMIT',
      turnNumber: 3,
      payload: { builds: [] },
      nonce: 'human-empty-build-after-ancient-save',
    },
    101,
  );
  assert.equal(resolvedSave.ok, true);
  assert.equal(
    resolvedSave.state.players.find((player: { id?: string }) =>
      player.id === 'bot'
    ).lines,
    5,
  );
  assert.equal(resolvedSave.state.controllersByPlayerId.bot.chosenPlanId, null);

  const reassessed = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'representative-1',
      turnNumber: 4,
      phase: 'drawing',
      lines: 8,
    }),
    nowMs: 102,
  });
  assert.equal(reassessed.botStepsApplied, 0);
  assert.equal(
    reassessed.state.controllersByPlayerId.bot.chosenPlanId.startsWith('anc_'),
    true,
  );
});

Deno.test('both Phase 17E chooser strategies persist and stop with the explicit deferral diagnostic', async () => {
  for (const [gameId, expectedStrategyId] of [
    ['deferred-21', 'anc_vortex_simulacrum'],
    ['deferred-42', 'anc_silly_simulacrum'],
  ] as const) {
    const result = await runBotsUntilSettled({
      state: createBaseState({
        gameId,
        turnNumber: 1,
        phase: 'drawing',
        lines: 8,
      }),
      nowMs: 100,
    });
    assert.equal(result.botStepsApplied, 0);
    assert.equal(
      result.state.controllersByPlayerId.bot.chosenPlanId,
      expectedStrategyId,
    );
    assert.equal(
      result.events.some((event: { type?: string; reason?: string }) =>
        event.type === 'BOT_RUNNER_SKIPPED' &&
        event.reason === 'ancient_strategy_deferred_phase_17e'
      ),
      true,
    );
  }
});

Deno.test('all four chooser families continue directly into legal production builds', async () => {
  for (const scenario of [
    {
      gameId: 'ancient-cub-resolution',
      lines: 9,
      strategyId: 'anc_vortex_no_simulacrum',
      firstShipDefId: 'CUB',
    },
    {
      gameId: 'prod-nep-0',
      lines: 8,
      strategyId: 'anc_small_econ_siphon',
      firstShipDefId: 'NEP',
    },
    {
      gameId: 'representative-3',
      lines: 6,
      strategyId: 'anc_spiral_aggro',
      firstShipDefId: 'SPI',
    },
    {
      gameId: 'representative-0',
      lines: 5,
      strategyId: 'anc_mer_aggro',
      firstShipDefId: 'MER',
    },
  ] as const) {
    const result = await runBotsUntilSettled({
      state: createBaseState({
        gameId: scenario.gameId,
        turnNumber: 1,
        phase: 'drawing',
        lines: scenario.lines,
      }),
      nowMs: 100,
    });
    assert.equal(result.botStepsApplied, 1);
    assert.equal(
      result.state.controllersByPlayerId.bot.chosenPlanId,
      scenario.strategyId,
    );
    assert.equal(
      result.state.gameData.turnData.commitments.BUILD_1.bot.revealPayload
        .builds[0].shipDefId,
      scenario.firstShipDefId,
    );
  }
});

Deno.test('Ancient malformed chooser state and unknown stored strategy fail closed', async () => {
  const malformed = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'ancient-invalid-lines',
      turnNumber: 2,
      phase: 'drawing',
      lines: 1.5,
    }),
    nowMs: 100,
  });
  assert.equal(malformed.botStepsApplied, 0);
  assert.equal(malformed.state.controllersByPlayerId.bot.chosenPlanId, null);
  assert.equal(
    malformed.events.some((event: { reason?: string }) =>
      event.reason ===
        'invalid_ancient_opening_chooser_input:invalid_available_ordinary_lines'
    ),
    true,
  );

  const unknown = await runBotsUntilSettled({
    state: createBaseState({
      gameId: 'ancient-unknown-strategy',
      turnNumber: 2,
      phase: 'drawing',
      lines: 9,
      chosenPlanId: 'anc_not_registered',
    }),
    nowMs: 100,
  });
  assert.equal(unknown.botStepsApplied, 0);
  assert.equal(
    unknown.events.some((event: { reason?: string }) =>
      event.reason === 'missing_matching_ancient_strategy'
    ),
    true,
  );
});
