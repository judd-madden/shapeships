import assert from 'node:assert/strict';
import { completeAncientBuildSubmitPayload } from '../../../engine/bot/ancientBuildPayload.ts';
import { planBotBuildSubmit } from '../../../engine/bot/buildPlanner.ts';
import type { AuthoredBotPlan } from '../../../engine/bot/botTypes.ts';
import { applyIntent, type IntentRequest } from '../../../engine/intent/IntentReducer.ts';
import type { BuildSubmitPayload } from '../../../engine/intent/IntentTypes.ts';
import { normalizeAncientGameState } from '../../../engine/state/ancientState.ts';

function plan(
  mode?: 'fixed_6' | 'match_effective_dice',
): AuthoredBotPlan {
  return {
    id: `synthetic-ancient-${mode ?? 'missing'}`,
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    ...(mode
      ? { quantumMysticPolicy: { QUA: { mode } } }
      : {}),
  };
}

function createBuildState(args: {
  lines?: number;
  baseDice?: number;
  effectiveDice?: unknown;
} = {}): any {
  const baseDice = args.baseDice ?? 2;
  const effectiveDice = Object.prototype.hasOwnProperty.call(args, 'effectiveDice')
    ? args.effectiveDice
    : baseDice;

  return normalizeAncientGameState({
    gameId: 'ancient-build-payload-test',
    status: 'active',
    players: [
      {
        id: 'bot',
        role: 'player',
        faction: 'ancient',
        health: 25,
        lines: args.lines ?? 30,
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
    gameData: {
      turnNumber: 1,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: { bot: [], human: [] },
      turnData: {
        commitments: {},
        baseDiceRoll: baseDice,
        effectiveDiceRoll: baseDice,
        effectiveDiceRollByPlayerId: { bot: effectiveDice, human: baseDice },
        drawingPreludeByPlayerId: {
          bot: {
            turnNumber: 1,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: 'complete',
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
          },
          human: {
            turnNumber: 1,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: 'complete',
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
          },
        },
        buildDrawingPublicFleetByPlayerId: { bot: [], human: [] },
      },
    },
  }).state;
}

function buildIntent(
  playerId: string,
  payload: BuildSubmitPayload,
): IntentRequest {
  return {
    gameId: 'ancient-build-payload-test',
    intentType: 'BUILD_SUBMIT',
    turnNumber: 1,
    payload,
    nonce: `${playerId}-build`,
  };
}

Deno.test('QUA payload completion emits fixed selections for every final payload attempt', () => {
  const payload: BuildSubmitPayload = {
    builds: [
      { shipDefId: 'QUA', count: 1 },
      { shipDefId: 'MER', count: 1 },
      { shipDefId: 'QUA', count: 2 },
    ],
  };
  const result = completeAncientBuildSubmitPayload({
    state: createBuildState(),
    playerId: 'bot',
    plan: plan('fixed_6'),
    payload,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.payload.quantumMysticSelections, [6, 6, 6]);
  assert.deepEqual(result.payload.builds, payload.builds);
});

Deno.test('QUA match policy reads direct and Cube-modified authoritative effective dice', () => {
  const directResult = completeAncientBuildSubmitPayload({
    state: createBuildState({ baseDice: 4 }),
    playerId: 'bot',
    plan: plan('match_effective_dice'),
    payload: { builds: [{ shipDefId: 'QUA', count: 1 }] },
  });
  assert.deepEqual(directResult, {
    ok: true,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 1 }],
      quantumMysticSelections: [4],
    },
  });

  const cubeResult = completeAncientBuildSubmitPayload({
    state: createBuildState({ baseDice: 2, effectiveDice: 5 }),
    playerId: 'bot',
    plan: plan('match_effective_dice'),
    payload: { builds: [{ shipDefId: 'QUA', count: 2 }] },
  });

  assert.deepEqual(cubeResult, {
    ok: true,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 2 }],
      quantumMysticSelections: [5, 5],
    },
  });
});

Deno.test('QUA payload completion fails closed for missing policy, invalid dice, or malformed counts', () => {
  assert.deepEqual(
    completeAncientBuildSubmitPayload({
      state: createBuildState(),
      playerId: 'bot',
      plan: plan(),
      payload: { builds: [{ shipDefId: 'QUA', count: 1 }] },
    }),
    { ok: false, reason: 'missing_quantum_mystic_policy' },
  );
  assert.deepEqual(
    completeAncientBuildSubmitPayload({
      state: createBuildState({ effectiveDice: 7 }),
      playerId: 'bot',
      plan: plan('match_effective_dice'),
      payload: { builds: [{ shipDefId: 'QUA', count: 1 }] },
    }),
    { ok: false, reason: 'invalid_effective_dice' },
  );
  assert.deepEqual(
    completeAncientBuildSubmitPayload({
      state: createBuildState(),
      playerId: 'bot',
      plan: plan('fixed_6'),
      payload: {
        builds: [{ shipDefId: 'QUA', count: -1 }],
      },
    }),
    { ok: false, reason: 'invalid_quantum_mystic_build_count' },
  );
});

Deno.test('QUA payload completion omits unnecessary selections when final payload requests none', () => {
  const result = completeAncientBuildSubmitPayload({
    state: createBuildState(),
    playerId: 'bot',
    plan: plan(),
    payload: {
      builds: [{ shipDefId: 'MER', count: 1 }],
      quantumMysticSelections: [6],
    },
  });

  assert.deepEqual(result, {
    ok: true,
    payload: { builds: [{ shipDefId: 'MER', count: 1 }] },
  });
});

Deno.test('synthetic Ancient plan flows through planner, QUA completion, and authoritative reducer', async () => {
  const state = createBuildState({ lines: 15 });
  const syntheticPlan: AuthoredBotPlan = {
    ...plan('match_effective_dice'),
    orderedBuildPlan: {
      buildOrder: [],
      endLoop: ['QUA'],
    },
  };
  const plannedPayload = planBotBuildSubmit(state, 'bot', syntheticPlan);
  assert.deepEqual(plannedPayload.builds, [{ shipDefId: 'QUA', count: 3 }]);

  const completion = completeAncientBuildSubmitPayload({
    state,
    playerId: 'bot',
    plan: syntheticPlan,
    payload: plannedPayload,
  });
  assert.equal(completion.ok, true);
  if (!completion.ok) return;
  assert.deepEqual(completion.payload.quantumMysticSelections, [2, 2, 2]);

  const botSubmitted = await applyIntent(
    state,
    'bot',
    buildIntent('bot', completion.payload),
    900,
  );
  assert.equal(botSubmitted.ok, true);
  const resolved = await applyIntent(
    botSubmitted.state,
    'human',
    buildIntent('human', { builds: [] }),
    901,
  );
  assert.equal(resolved.ok, true);
  assert.deepEqual(
    resolved.state.gameData.ships.bot.map((entry: any) =>
      entry.permanentConfiguration?.selectedNumber
    ),
    [2, 2, 2],
  );
});

Deno.test('completed QUA payload is accepted and preserves attempt-order selections through resolution', async () => {
  const state = createBuildState({ lines: 5 });
  const completion = completeAncientBuildSubmitPayload({
    state,
    playerId: 'bot',
    plan: plan('fixed_6'),
    payload: { builds: [{ shipDefId: 'QUA', count: 2 }] },
  });
  assert.equal(completion.ok, true);
  if (!completion.ok) return;
  assert.equal(completion.payload.quantumMysticSelections?.length, 2);

  const botSubmitted = await applyIntent(
    state,
    'bot',
    buildIntent('bot', completion.payload),
    1000,
  );
  assert.equal(botSubmitted.ok, true);
  const resolved = await applyIntent(
    botSubmitted.state,
    'human',
    buildIntent('human', { builds: [] }),
    1001,
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.gameData.ships.bot.length, 1);
  assert.equal(
    resolved.state.gameData.ships.bot[0].permanentConfiguration?.selectedNumber,
    6,
  );
  assert.equal(
    resolved.events.some((event: any) =>
      event.type === 'BUILD_ATTEMPT_SKIPPED' &&
      event.reason === 'insufficient_ordinary_lines'
    ),
    true,
  );
});
