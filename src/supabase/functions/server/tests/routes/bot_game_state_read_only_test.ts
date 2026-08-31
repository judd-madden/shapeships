import assert from 'node:assert/strict';
import { Hono } from 'npm:hono';
import { runBotsUntilSettled } from '../../engine/bot/botRunner.ts';
import { registerGameRoutes } from '../../routes/game_routes.ts';
import type {
  ConditionalWriteResult,
  IntentPersistence,
} from '../../routes/intent_persistence.ts';

type GameRoutePersistence = Pick<
  IntentPersistence,
  'load' | 'conditionalUpdate' | 'insertIfMissing'
>;

class TrackingGamePersistence implements GameRoutePersistence {
  readonly store = new Map<string, any>();
  conditionalAttempts = 0;

  async load(key: string) {
    if (!this.store.has(key)) return { status: 'missing' as const };
    return {
      status: 'found' as const,
      value: structuredClone(this.store.get(key)),
    };
  }

  async conditionalUpdate(
    _args: Parameters<IntentPersistence['conditionalUpdate']>[0],
  ): Promise<ConditionalWriteResult> {
    this.conditionalAttempts += 1;
    return { status: 'conflict' };
  }

  async insertIfMissing(
    key: string,
    value: any,
  ): Promise<ConditionalWriteResult> {
    if (this.store.has(key)) return { status: 'conflict' };
    this.store.set(key, structuredClone(value));
    return { status: 'updated' };
  }
}

function createActionableBotDrawingState(
  species: 'centaur' | 'ancient' = 'centaur',
): any {
  const isAncient = species === 'ancient';
  return {
    gameId: `bot-get-read-only-${species}-test`,
    status: 'active',
    stateRevision: isAncient ? 11 : 7,
    turnNumber: 4,
    currentPhase: 'build',
    currentSubPhase: 'drawing',
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
        name: 'Computer',
        role: 'player',
        faction: species,
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
      bot: {
        kind: 'bot',
        speciesId: isAncient ? 'ANC' : 'CEN',
        chosenPlanId: isAncient ? 'anc_cube_red_green' : 'cen_greed_dom',
        ...(isAncient
          ? {
            planProgress: {
              committedBuildGroup: {
                planId: 'anc_cube_red_green',
                groupKey: 'core_trio',
                branchId: 'mer',
                shipDefId: 'MER',
                startingCount: 0,
                targetCount: 3,
              },
            },
          }
          : {}),
      },
    },
    gameData: {
      turnNumber: 4,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: { player: [], bot: [] },
      voidShipsByPlayerId: { player: [], bot: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: isAncient
          ? {
            bot: {
              battleTurnNumber: 3,
              pool: { green: 2, red: 3, blue: 4 },
              sources: [],
            },
          }
          : {},
        acceptedDeclarationByPlayerId: isAncient
          ? {
            bot: {
              contractVersion: 1,
              declarationId: 'read-only-sentinel',
              ordinaryChargeActions: [],
              solarCasts: [],
              autocastEnabled: true,
            },
          }
          : {},
        solarLedgerByPlayerId: {},
        pendingSimulacrumCopies: [],
        pendingBlackHoleDestructions: [],
      },
      turnData: {
        turnNumber: 4,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        commitments: {},
        effectiveDiceRoll: 2,
        effectiveDiceRollByPlayerId: { player: 2, bot: 2 },
        chronoswarmRolls: [],
        chronoswarmCountByPlayerId: { player: 0, bot: 0 },
        drawingPreludeByPlayerId: {
          player: {
            turnNumber: 4,
            requiredPassCount: 1,
            activePassIndex: 1,
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
            status: 'complete',
          },
          bot: {
            turnNumber: 4,
            requiredPassCount: 1,
            activePassIndex: 1,
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
            status: 'complete',
          },
        },
        buildDrawingPublicFleetByPlayerId: { player: [], bot: [] },
        buildDrawingPublicSavedResourcesByPlayerId: {
          player: { savedLines: 0, savedJoiningLines: 0 },
          bot: { savedLines: 0, savedJoiningLines: 0 },
        },
      },
    },
    actions: [],
    events: isAncient
      ? [{ type: 'BOT_DEBUG_SENTINEL', playerId: 'bot' }]
      : [],
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
  };
}

Deno.test('full and head game-state GET polling never executes an actionable bot', async () => {
  for (const species of ['centaur', 'ancient'] as const) {
    const state = createActionableBotDrawingState(species);
    const botProbe = await runBotsUntilSettled({
      state: structuredClone(state),
      nowMs: 100,
    });
    assert.equal(botProbe.botStepsApplied, 1);
    assert.equal(
      botProbe.events.some((event: any) =>
        event.type === 'BUILD_SUBMITTED' && event.playerId === 'bot'
      ),
      true,
    );

    const persistence = new TrackingGamePersistence();
    const gameKey = `game_${state.gameId}`;
    persistence.store.set(gameKey, structuredClone(state));
    const storedBeforePolling = structuredClone(persistence.store.get(gameKey));
    const kvWrites: Array<{ key: string; value: any }> = [];
    const app = new Hono();
    registerGameRoutes(
      app,
      async (key) => structuredClone(persistence.store.get(key)),
      async (key, value) => {
        kvWrites.push({ key, value: structuredClone(value) });
      },
      async () => ({ sessionId: 'player' }),
      () => 'unused',
      persistence,
    );

    const headUrl = `/make-server-825e19ab/game-state-head/${state.gameId}`;
    const fullUrl = `/make-server-825e19ab/game-state/${state.gameId}`;
    const responses = [
      await app.request(headUrl),
      await app.request(fullUrl),
      await app.request(headUrl),
      await app.request(fullUrl),
    ];

    for (const response of responses) {
      assert.equal(response.status, 200);
    }
    const finalFullBody = await responses[3].json();
    assert.equal(finalFullBody.stateRevision, state.stateRevision);
    assert.equal(finalFullBody.gameData.currentPhase, 'build');
    assert.equal(finalFullBody.gameData.currentSubPhase, 'drawing');
    assert.equal(
      finalFullBody.gameData.phaseReadiness.some((entry: any) => entry.playerId === 'bot'),
      false,
    );
    assert.equal(finalFullBody.gameData.turnData.commitments.BUILD_4, undefined);
    if (species === 'ancient') {
      assert.equal(
        finalFullBody.controllersByPlayerId.bot.chosenPlanId,
        'anc_cube_red_green',
      );
      assert.equal('planProgress' in finalFullBody.controllersByPlayerId.bot, false);
    }
    assert.equal(persistence.conditionalAttempts, 0);
    assert.deepEqual(kvWrites, []);
    assert.deepEqual(persistence.store.get(gameKey), storedBeforePolling);
  }
});
