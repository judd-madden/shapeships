import assert from 'node:assert/strict';
import { runAncientHarness } from './ancientFullGameHarness.ts';
import { replaceChargeDeclarationVisibilityState } from '../../../engine/state/chargeDeclarationVisibility.ts';
import { normalizeAncientGameState } from '../../../engine/state/ancientState.ts';
import { runBotsUntilSettled } from '../../../engine/bot/botRunner.ts';

const REPRESENTATIVE_STRATEGIES = [
  'anc_cube_red_green',
  'anc_big_standard_econ',
  'anc_mer_aggro',
  'anc_spiral_aggro',
  'anc_cube_quantum_solar_snowball',
  'anc_small_econ_siphon',
  'anc_sol_reach_black_hole',
  'anc_sol_blue_snowball',
  'anc_vortex_no_simulacrum',
  'anc_vortex_simulacrum',
  'anc_silly_simulacrum',
] as const;

function createChargeCheckpoint(strategyId: string): any {
  const turnNumber = 3;
  const state: any = {
    gameId: `ancient-full-game-${strategyId}`,
    status: 'active',
    turnNumber,
    currentPhase: 'battle',
    currentSubPhase: 'charge_declaration',
    players: [
      {
        id: 'player',
        name: 'Player',
        role: 'player',
        faction: 'human',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
      {
        id: 'bot',
        name: 'Ancient Bot',
        role: 'player',
        faction: 'ancient',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
      bot: { kind: 'bot', speciesId: 'ANC', chosenPlanId: strategyId },
    },
    gameData: {
      turnNumber,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [{
        playerId: 'player',
        currentStep: 'battle.charge_declaration',
        isReady: true,
      }],
      ships: { player: [], bot: [] },
      voidShipsByPlayerId: { player: [], bot: [] },
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
        breakdownEntries: [],
      },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {
          player: {
            battleTurnNumber: turnNumber,
            pool: { green: 0, red: 0, blue: 0 },
            sources: [],
          },
          bot: {
            battleTurnNumber: turnNumber,
            pool: { green: 1, red: 0, blue: 0 },
            sources: [],
          },
        },
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {
          player: { battleTurnNumber: null, entries: [] },
          bot: { battleTurnNumber: null, entries: [] },
        },
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        commitments: {},
        chargePowerUsedByInstanceId: {},
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          player: [],
          bot: [],
        },
        chargeDeclarationFleetSnapshotByPlayerId: {
          player: [],
          bot: [],
        },
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
  replaceChargeDeclarationVisibilityState(state);
  return normalizeAncientGameState(state).state;
}

function createSeamRichFirstStrikeCheckpoint(): any {
  return normalizeAncientGameState({
    gameId: 'ancient-seam-rich-cap-audit',
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
        faction: 'ancient',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
      bot: {
        kind: 'bot',
        speciesId: 'ANC',
        chosenPlanId: 'anc_spiral_aggro',
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
        player: [{ instanceId: 'target-def', shipDefId: 'DEF' }],
        bot: [
          { instanceId: 'spi-1', shipDefId: 'SPI', createdTurn: 1 },
          { instanceId: 'spi-2', shipDefId: 'SPI', createdTurn: 2 },
          { instanceId: 'spi-3', shipDefId: 'SPI', createdTurn: 3 },
          { instanceId: 'cube-1', shipDefId: 'CUB', createdTurn: 1 },
          {
            instanceId: 'copied-carrier',
            shipDefId: 'CAR',
            chargesCurrent: 1,
            createdTurn: 1,
          },
          {
            instanceId: 'copied-interceptor',
            shipDefId: 'INT',
            chargesCurrent: 1,
            createdTurn: 1,
          },
          {
            instanceId: 'solar-1',
            shipDefId: 'SOL',
            chargesCurrent: 0,
            createdTurn: 1,
          },
        ],
      },
      voidShipsByPlayerId: { player: [], bot: [] },
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
        breakdownEntries: [],
      },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {
          player: {
            battleTurnNumber: 3,
            pool: { green: 0, red: 0, blue: 0 },
            sources: [],
          },
          bot: {
            battleTurnNumber: 3,
            pool: { green: 1, red: 0, blue: 0 },
            sources: [],
          },
        },
        acceptedDeclarationByPlayerId: {},
        solarLedgerByPlayerId: {
          player: { battleTurnNumber: null, entries: [] },
          bot: { battleTurnNumber: null, entries: [] },
        },
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        commitments: {},
        chargePowerUsedByInstanceId: {},
        thirdSpiralFirstStrikeEligibilityByPlayerId: {
          bot: { sourceInstanceId: 'spi-3', turnNumber: 3 },
        },
      },
    },
    actions: [],
    events: [],
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
  }).state;
}

Deno.test('all production Ancient strategies progress canonically across multiple turns', async (test) => {
  let maximumObserved = 0;

  for (const strategyId of REPRESENTATIVE_STRATEGIES) {
    await test.step(strategyId, async () => {
      const result = await runAncientHarness({
        state: createChargeCheckpoint(strategyId),
        strategyId,
        deterministicD6Bytes: [5, 5, 5],
        maxIterations: 60,
        stopWhen: (state) =>
          state?.gameData?.turnNumber >= 6 &&
          state?.gameData?.currentPhase === 'build' &&
          state?.gameData?.currentSubPhase === 'drawing',
      });

      maximumObserved = Math.max(maximumObserved, result.maxBotStepsObserved);
      assert.equal(result.state.gameData.turnNumber >= 6, true);
      assert.equal(
        result.events.some((event: any) => event.type === 'BUILD_SUBMITTED'),
        true,
      );
      assert.equal(
        result.events.some((event: any) => event.type === 'BOT_RUNNER_LIMIT_REACHED'),
        false,
      );
      assert.equal(result.maxBotStepsObserved <= 8, true);
      assert.equal(
        result.phaseTrace.some((phase) => phase === 'battle.charge_declaration'),
        true,
      );
      assert.equal(
        result.events.some((event: any) =>
          event.type === 'BUILD_SUBMITTED' && event.playerId === 'bot'
        ),
        true,
      );
    });
  }

  assert.equal(maximumObserved > 0, true);
  assert.equal(maximumObserved <= 7, true);
});

Deno.test('seam-rich Ancient runner chain remains canonically below the safety cap', async () => {
  const result = await runAncientHarness({
    state: createSeamRichFirstStrikeCheckpoint(),
    strategyId: 'anc_spiral_aggro',
    deterministicD6Bytes: [5, 4],
    maxIterations: 20,
    stopWhen: (state) =>
      state?.gameData?.turnNumber >= 4 &&
      state?.gameData?.currentPhase === 'build' &&
      state?.gameData?.currentSubPhase === 'drawing',
  });

  assert.deepEqual(result.botStepsByInvocation, [7]);
  assert.equal(result.maxBotStepsObserved <= 8, true);
  assert.equal(
    result.events.some((event: any) => event.type === 'BOT_RUNNER_LIMIT_REACHED'),
    false,
  );
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'POWER_USED' && event.actionId === 'SPI#0'
    ),
    true,
  );
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'CHARGE_DECLARATION_ACCEPTED'
    ),
    true,
  );
  assert.equal(
    result.events.some((event: any) => event.type === 'BUILD_SUBMITTED'),
    true,
  );
  const immediateReplay = await runBotsUntilSettled({
    state: structuredClone(result.state),
    nowMs: 20_000,
  });
  assert.equal(immediateReplay.botStepsApplied, 0);
  assert.equal(
    immediateReplay.events.some((event: any) =>
      event.type === 'BOT_RUNNER_LIMIT_REACHED' ||
      event.type === 'BOT_INTENT_REJECTED'
    ),
    false,
  );
});
