import assert from 'node:assert/strict';
import {
  buildFirstStrikeTargetIntentForCurrentPhase,
} from '../../../engine/bot/botRunner.ts';
import type { AuthoredBotPlan } from '../../../engine/bot/botTypes.ts';
import { applyIntent, type IntentRequest } from '../../../engine/intent/IntentReducer.ts';
import { fleetHasAvailablePowers } from '../../../engine/phase/fleetHasAvailablePowers.ts';
import { normalizeAncientGameState } from '../../../engine/state/ancientState.ts';

const SPIRAL_PLAN: AuthoredBotPlan = {
  id: 'synthetic-ancient-spiral',
  speciesId: 'ANC',
  buildGoals: [],
  loopGoals: [],
  targetPolicy: { SPI: { mode: 'highest_cost_basic' } },
};

function spiral(instanceId: string, createdTurn = 3) {
  return { instanceId, shipDefId: 'SPI', createdTurn };
}

function createState(args: {
  markerSourceId?: string;
  markerTurnNumber?: number;
  targets?: any[];
  fired?: boolean;
  pending?: boolean;
} = {}): any {
  const markerSourceId = args.markerSourceId;
  return normalizeAncientGameState({
    gameId: 'ancient-first-strike-capability-test',
    status: 'active',
    turnNumber: 3,
    players: [
      {
        id: 'bot',
        role: 'player',
        faction: 'ancient',
        health: 40,
        lines: 0,
        joiningLines: 0,
      },
      {
        id: 'human',
        role: 'player',
        faction: 'human',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      bot: {
        kind: 'bot',
        speciesId: 'ANC',
        chosenPlanId: 'anc_spiral_aggro',
      },
      human: { kind: 'human' },
    },
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'first_strike',
      phaseReadiness: [{
        playerId: 'human',
        isReady: true,
        currentStep: 'battle.first_strike',
      }],
      ships: {
        bot: [spiral('spi-1', 1), spiral('spi-2', 2), spiral('spi-3')],
        human: args.targets ?? [{ instanceId: 'target-def', shipDefId: 'DEF' }],
      },
      powerMemory: {
        onceOnlyFired: args.fired && markerSourceId
          ? { [`${markerSourceId}::SPI#0`]: true }
          : {},
        frigateTriggerByInstanceId: {},
      },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'first_strike',
        commitments: {},
        chargePowerUsedByInstanceId: {},
        ...(markerSourceId
          ? {
            thirdSpiralFirstStrikeEligibilityByPlayerId: {
              bot: {
                sourceInstanceId: markerSourceId,
                turnNumber: args.markerTurnNumber ?? 3,
              },
            },
          }
          : {}),
        ...(args.pending && markerSourceId
          ? {
            pendingFirstStrikeSelectionsByPlayerId: {
              bot: {
                [markerSourceId]: {
                  sourceInstanceId: markerSourceId,
                  targetInstanceIds: ['target-def'],
                },
              },
            },
          }
          : {}),
      },
    },
  }).state;
}

function decide(state: any): IntentRequest | null {
  return buildFirstStrikeTargetIntentForCurrentPhase({
    state,
    playerId: 'bot',
    phaseKey: 'battle.first_strike',
    loopStep: 0,
    plan: SPIRAL_PLAN,
  });
}

function actionPayload(intent: IntentRequest | null): any {
  return intent?.payload ?? null;
}

Deno.test('Spiral targeting requires the exact authoritative current-turn source marker', () => {
  assert.equal(decide(createState()), null);
  assert.equal(
    decide(createState({ markerSourceId: 'not-controlled' })),
    null,
  );
  assert.equal(
    decide(createState({ markerSourceId: 'spi-3', markerTurnNumber: 2 })),
    null,
  );

  const intent = decide(createState({ markerSourceId: 'spi-3' }));
  assert.equal(actionPayload(intent)?.sourceInstanceId, 'spi-3');
  assert.equal(actionPayload(intent)?.actionId, 'SPI#0');
});

Deno.test('Spiral targeting does not repeat pending or consumed actions', () => {
  assert.equal(
    decide(createState({ markerSourceId: 'spi-3', pending: true })),
    null,
  );
  assert.equal(
    decide(createState({ markerSourceId: 'spi-3', fired: true })),
    null,
  );
});

Deno.test('Spiral targeting uses canonical cost, live charges, then stable instance ID', () => {
  const highestCost = decide(createState({
    markerSourceId: 'spi-3',
    targets: [
      { instanceId: 'qua-many-charges', shipDefId: 'QUA', chargesCurrent: 9 },
      { instanceId: 'sol-high-cost', shipDefId: 'SOL', chargesCurrent: 0 },
    ],
  }));
  assert.equal(actionPayload(highestCost)?.targetInstanceId, 'sol-high-cost');

  const mostCharges = decide(createState({
    markerSourceId: 'spi-3',
    targets: [
      { instanceId: 'sol-low', shipDefId: 'SOL', chargesCurrent: 1 },
      { instanceId: 'sol-high', shipDefId: 'SOL', chargesCurrent: 3 },
    ],
  }));
  assert.equal(actionPayload(mostCharges)?.targetInstanceId, 'sol-high');

  const stableId = decide(createState({
    markerSourceId: 'spi-3',
    targets: [
      { instanceId: 'sol-b', shipDefId: 'SOL', chargesCurrent: 2 },
      { instanceId: 'sol-a', shipDefId: 'SOL', chargesCurrent: 2 },
    ],
  }));
  assert.equal(actionPayload(stableId)?.targetInstanceId, 'sol-a');
});

Deno.test('Spiral targeting excludes protected Cores and non-Basic ships', () => {
  const intent = decide(createState({
    markerSourceId: 'spi-3',
    targets: [
      { instanceId: 'protected-plu', shipDefId: 'PLU' },
      { instanceId: 'upgraded-bat', shipDefId: 'BAT' },
      { instanceId: 'legal-def', shipDefId: 'DEF' },
    ],
  }));

  assert.equal(actionPayload(intent)?.targetInstanceId, 'legal-def');
});

Deno.test('no-target Spiral capability emits no action and authoritative readiness settles First Strike', async () => {
  const state = createState({
    markerSourceId: 'spi-3',
    targets: [
      { instanceId: 'protected-plu', shipDefId: 'PLU' },
      { instanceId: 'upgraded-bat', shipDefId: 'BAT' },
    ],
  });
  assert.equal(decide(state), null);
  assert.equal(
    fleetHasAvailablePowers(state, 'battle.first_strike', 'bot'),
    false,
  );

  const settled = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'DECLARE_READY',
    turnNumber: 3,
    nonce: 'settle-no-target-first-strike',
  }, 1000);
  assert.equal(settled.ok, true);
  assert.notEqual(settled.state.gameData.currentSubPhase, 'first_strike');
});
