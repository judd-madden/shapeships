import assert from 'node:assert/strict';
import {
  planAncientChargeDeclaration,
} from '../../../engine/bot/ancientBotPlanner.ts';
import type {
  AncientBotStrategy,
} from '../../../engine/bot/ancientPlans.ts';
import { getAncientBotStrategyById } from '../../../engine/bot/ancientPlans.ts';
import { getAncientAuthoredPlanByStrategyId } from '../../../engine/bot/ancientAuthoredPlans.ts';
import { planBotBuildDecision } from '../../../engine/bot/buildPlanner.ts';
import {
  planDamageHealChargeActions,
} from '../../../engine/bot/botPowerPlanning.ts';
import {
  advanceAcceptedStagedSimulacrumProgress,
  runBotsUntilSettled,
} from '../../../engine/bot/botRunner.ts';
import { getHumanBotPlanById } from '../../../engine/bot/humanPlans.ts';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
import { materializeQueuedSimulacrumCopiesAtTurnStart } from '../../../engine/ancient/simulacrumSolarPower.ts';
import {
  replaceChargeDeclarationVisibilityState,
} from '../../../engine/state/chargeDeclarationVisibility.ts';

const BASE_STRATEGY: AncientBotStrategy = {
  id: 'anc_mer_aggro',
  workingName: 'Simple Aggro',
  speciesId: 'ANC',
  family: 'MER',
};

function createState(args: {
  gameId?: string;
  turnNumber?: number;
  energy?: { green: number; red: number; blue: number };
  effectiveDice?: number;
  botHealth?: number;
  botShips?: any[];
  opponentShips?: any[];
  sourceIds?: string[];
  opponentFaction?: string;
  chosenPlanId?: string | null;
} = {}): any {
  const turnNumber = args.turnNumber ?? 3;
  const botShips = structuredClone(args.botShips ?? []);
  const opponentShips = structuredClone(args.opponentShips ?? []);
  const state = {
    gameId: args.gameId ?? 'ancient-bot-planner-test',
    status: 'active',
    turnNumber,
    players: [
      {
        id: 'player',
        role: 'player',
        faction: args.opponentFaction ?? 'human',
        health: 25,
        lines: 0,
        joiningLines: 0,
      },
      {
        id: 'bot',
        role: 'player',
        faction: 'ancient',
        health: args.botHealth ?? 25,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      player: { kind: 'human' },
      bot: {
        kind: 'bot',
        speciesId: 'ANC',
        chosenPlanId: args.chosenPlanId ?? BASE_STRATEGY.id,
      },
    },
    gameData: {
      turnNumber,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [],
      ships: { player: opponentShips, bot: botShips },
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
            pool: structuredClone(args.energy ?? {
              green: 1,
              red: 0,
              blue: 0,
            }),
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
        effectiveDiceRollByPlayerId: {
          player: 2,
          bot: args.effectiveDice ?? 1,
        },
        chargePowerUsedByInstanceId: {},
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          player: [],
          bot: [...(args.sourceIds ?? [])],
        },
        chargeDeclarationFleetSnapshotByPlayerId: {
          player: structuredClone(opponentShips),
          bot: structuredClone(botShips),
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
  return state;
}

function requirePayload(
  result: ReturnType<typeof planAncientChargeDeclaration>,
) {
  if (result.kind === 'submit') {
    return result.payload;
  }
  assert.fail(`Expected declaration payload, received ${result.reason}`);
}

function nepFleet(count: number, prefix = 'nep') {
  return Array.from({ length: count }, (_, index) => ({
    instanceId: `${prefix}-${index}`,
    shipDefId: 'NEP',
  }));
}

Deno.test('Ancient baseline declaration uses stable identity and authoritative Autocast', () => {
  const state = createState();
  const before = structuredClone(state);
  const first = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  const second = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));

  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    contractVersion: 1,
    declarationId:
      'bot:ancient-bot-planner-test:3:bot:ancient-charge:v1',
    ordinaryChargeActions: [],
    solarCasts: [],
    autocastEnabled: true,
  });
  assert.deepEqual(state, before);
});

Deno.test('Ancient planner does not forge a declaration when no input exists', () => {
  const state = createState({ energy: { green: 0, red: 0, blue: 0 } });
  assert.deepEqual(
    planAncientChargeDeclaration({
      state,
      playerId: 'bot',
      strategy: BASE_STRATEGY,
    }),
    { kind: 'no_input', reason: 'no_atomic_declaration_input' },
  );
});

Deno.test('Ancient planner fails closed on malformed canonical Energy and accepted input', async () => {
  const malformed = createState();
  malformed.gameData.ancient.energyByPlayerId.bot.pool.red = 1.5;
  assert.deepEqual(
    planAncientChargeDeclaration({
      state: malformed,
      playerId: 'bot',
      strategy: BASE_STRATEGY,
    }),
    { kind: 'no_input', reason: 'invalid_energy_state' },
  );

  const state = createState();
  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  const accepted = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'planner-accepted',
  }, 100);
  assert.equal(accepted.ok, true);
  assert.deepEqual(
    planAncientChargeDeclaration({
      state: accepted.state,
      playerId: 'bot',
      strategy: BASE_STRATEGY,
    }),
    { kind: 'no_input', reason: 'accepted_declaration_exists' },
  );

  const retry = await applyIntent(accepted.state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'planner-retry',
  }, 101);
  assert.equal(retry.ok, true);
  assert.deepEqual(retry.state, accepted.state);
});

Deno.test('rich Ancient declarations remain deterministic and idempotent after acceptance', async () => {
  const siphonState = createState({
    gameId: 'ancient-rich-retry-siphon',
    energy: { green: 8, red: 10, blue: 0 },
    effectiveDice: 4,
    botShips: [{ instanceId: 'copied-int', shipDefId: 'INT', chargesCurrent: 1 }],
    sourceIds: ['copied-int'],
  });
  const firstPayload = requirePayload(planAncientChargeDeclaration({
    state: siphonState,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  const replayedPlan = requirePayload(planAncientChargeDeclaration({
    state: structuredClone(siphonState),
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  assert.deepEqual(replayedPlan, firstPayload);
  assert.equal(firstPayload.ordinaryChargeActions.length, 1);
  assert.equal(
    firstPayload.solarCasts.find((cast) => cast.solarPowerId === 'SSIP')
      ?.lockedAmount,
    7,
  );

  const accepted = await applyIntent(siphonState, 'bot', {
    gameId: siphonState.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload: firstPayload,
    nonce: 'rich-siphon-first',
  }, 100);
  assert.equal(accepted.ok, true);
  const acceptedSnapshot = structuredClone(accepted.state);
  const retried = await applyIntent(accepted.state, 'bot', {
    gameId: siphonState.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload: firstPayload,
    nonce: 'rich-siphon-retry',
  }, 101);
  assert.equal(retried.ok, true);
  assert.deepEqual(retried.state, acceptedSnapshot);

  const blackHoleStrategy = getAncientBotStrategyById('anc_big_standard_econ');
  assert.ok(blackHoleStrategy);
  const blackHoleState = createState({
    gameId: 'ancient-rich-retry-black-hole',
    energy: { green: 4, red: 4, blue: 4 },
    opponentShips: [
      { instanceId: 'target-fig', shipDefId: 'FIG' },
      { instanceId: 'target-def', shipDefId: 'DEF' },
    ],
  });
  const blackHolePayload = requirePayload(planAncientChargeDeclaration({
    state: blackHoleState,
    playerId: 'bot',
    strategy: blackHoleStrategy,
  }));
  assert.equal(blackHolePayload.solarCasts[0]?.solarPowerId, 'SBLA');
  const blackHoleAccepted = await applyIntent(blackHoleState, 'bot', {
    gameId: blackHoleState.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload: blackHolePayload,
    nonce: 'rich-black-hole-first',
  }, 102);
  assert.equal(blackHoleAccepted.ok, true);
  const blackHoleSnapshot = structuredClone(blackHoleAccepted.state);
  const blackHoleRetry = await applyIntent(blackHoleAccepted.state, 'bot', {
    gameId: blackHoleState.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload: blackHolePayload,
    nonce: 'rich-black-hole-retry',
  }, 103);
  assert.equal(blackHoleRetry.ok, true);
  assert.deepEqual(blackHoleRetry.state, blackHoleSnapshot);
});

Deno.test('accepted staged Simulacrum replay does not duplicate queues or progress', async () => {
  const strategy = getAncientBotStrategyById('anc_vortex_simulacrum');
  assert.ok(strategy);
  const state = createState({
    gameId: 'ancient-staged-retry',
    energy: { green: 0, red: 0, blue: 5 },
    botShips: nepFleet(3, 'retry-nep'),
    opponentShips: [
      { instanceId: 'retry-def', shipDefId: 'DEF' },
      { instanceId: 'retry-fig', shipDefId: 'FIG' },
    ],
    chosenPlanId: strategy.id,
  });
  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy,
  }));
  assert.deepEqual(payload.solarCasts.map((cast) => cast.solarPowerId), [
    'SSIM',
    'SSIM',
  ]);

  const accepted = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'staged-retry-first',
  }, 100);
  assert.equal(accepted.ok, true);
  advanceAcceptedStagedSimulacrumProgress({
    state: accepted.state,
    playerId: 'bot',
    strategy,
    declarationId: payload.declarationId,
  });
  const acceptedSnapshot = structuredClone(accepted.state);

  const retried = await applyIntent(accepted.state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'staged-retry-second',
  }, 101);
  assert.equal(retried.ok, true);
  advanceAcceptedStagedSimulacrumProgress({
    state: retried.state,
    playerId: 'bot',
    strategy,
    declarationId: payload.declarationId,
  });
  assert.deepEqual(retried.state, acceptedSnapshot);
  assert.equal(
    retried.state.gameData.ancient.pendingSimulacrumCopies.length,
    2,
  );
  assert.deepEqual(retried.state.controllersByPlayerId.bot.planProgress, {
    simulacrum: {
      strategyId: strategy.id,
      completedGoalCount: 2,
      openingComplete: true,
    },
  });
});

Deno.test('present malformed Solar policies are diagnostic configuration failures', () => {
  const state = createState();
  const scenarios = [
    [
      { blackHole: { minSelfHealth: -1, maxCastsPerDeclaration: 1 } },
      'invalid_black_hole_policy',
    ],
    [
      { blackHole: { minSelfHealth: 10, maxCastsPerDeclaration: 0 } },
      'invalid_black_hole_policy',
    ],
    [
      { vortex: { maxCastsPerDeclaration: 1.5 } },
      'invalid_vortex_policy',
    ],
    [
      { simulacrum: { mode: 'staged_cost_goals', costGoals: [] } },
      'invalid_simulacrum_policy',
    ],
    [
      {
        simulacrum: {
          mode: 'staged_cost_goals',
          costGoals: [2, 3],
          activationFleetGoal: { shipDefId: 'NEP', targetCount: 0 },
        },
      },
      'invalid_simulacrum_policy',
    ],
    [
      {
        simulacrum: {
          mode: 'highest_value_highest_charge',
          maxCastsPerDeclaration: 'until_blue_exhausted',
          excludeDepletedChargedTargets: true,
        },
      },
      'invalid_simulacrum_policy',
    ],
  ] as const;

  for (const [solarPolicy, reason] of scenarios) {
    const strategy = {
      ...BASE_STRATEGY,
      solarPolicy,
    } as unknown as AncientBotStrategy;
    assert.deepEqual(
      planAncientChargeDeclaration({ state, playerId: 'bot', strategy }),
      { kind: 'no_input', reason },
    );
  }
});

Deno.test('Siphon uses strict authoritative output comparison and deterministic spend ties', () => {
  const scenarios = [
    {
      energy: { green: 4, red: 4, blue: 0 },
      dice: 1,
      expectedSpend: 4,
    },
    {
      energy: { green: 4, red: 4, blue: 0 },
      dice: 4,
      expectedSpend: null,
    },
    {
      energy: { green: 4, red: 4, blue: 0 },
      dice: 5,
      expectedSpend: null,
    },
    {
      energy: { green: 8, red: 8, blue: 0 },
      dice: 1,
      expectedSpend: 8,
    },
    {
      energy: { green: 8, red: 10, blue: 0 },
      dice: 4,
      expectedSpend: 7,
    },
  ];

  for (const scenario of scenarios) {
    const payload = requirePayload(planAncientChargeDeclaration({
      state: createState({
        energy: scenario.energy,
        effectiveDice: scenario.dice,
      }),
      playerId: 'bot',
      strategy: BASE_STRATEGY,
    }));
    const siphon = payload.solarCasts.find((cast) =>
      cast.solarPowerId === 'SSIP'
    );
    assert.equal(siphon?.lockedAmount ?? null, scenario.expectedSpend);
    assert.equal(payload.autocastEnabled, true);
  }
});

Deno.test('Vortex requires valid opt-in and respects affordability and cap', () => {
  const state = createState({ energy: { green: 5, red: 5, blue: 5 } });
  const baseline = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  assert.equal(
    baseline.solarCasts.some((cast) => cast.solarPowerId === 'SVOR'),
    false,
  );

  const vortexStrategy = getAncientBotStrategyById(
    'anc_vortex_no_simulacrum',
  );
  assert.ok(vortexStrategy);
  const enabled = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: vortexStrategy,
  }));
  assert.deepEqual(
    enabled.solarCasts.filter((cast) => cast.solarPowerId === 'SVOR'),
    [{ solarPowerId: 'SVOR' }, { solarPowerId: 'SVOR' }],
  );
  assert.equal(
    enabled.solarCasts.some((cast) => 'lockedAmount' in cast),
    false,
  );
});

Deno.test('manual Solar casts keep Vortex, Black Hole, then Siphon order', () => {
  const payload = requirePayload(planAncientChargeDeclaration({
    state: createState({ energy: { green: 10, red: 10, blue: 10 } }),
    playerId: 'bot',
    strategy: {
      ...BASE_STRATEGY,
      solarPolicy: {
        vortex: { maxCastsPerDeclaration: 1 },
        blackHole: { minSelfHealth: 0, maxCastsPerDeclaration: 1 },
      },
    },
  }));
  assert.deepEqual(
    payload.solarCasts.map((cast) => cast.solarPowerId),
    ['SVOR', 'SBLA', 'SSIP'],
  );
  assert.equal(payload.solarCasts[2].lockedAmount, 4);
});

Deno.test('Black Hole policy gates health and selects snapshot targets deterministically', async () => {
  const targets = [
    { instanceId: 'enemy-nep', shipDefId: 'NEP' },
    { instanceId: 'enemy-gua', shipDefId: 'GUA' },
    { instanceId: 'enemy-orb-z', shipDefId: 'ORB', chargesCurrent: 0 },
    { instanceId: 'enemy-car', shipDefId: 'CAR', chargesCurrent: 2 },
    { instanceId: 'enemy-orb-a', shipDefId: 'ORB', chargesCurrent: 0 },
    { instanceId: 'enemy-int', shipDefId: 'INT', chargesCurrent: 3 },
  ];
  const policyStrategy: AncientBotStrategy = {
    ...BASE_STRATEGY,
    solarPolicy: {
      blackHole: { minSelfHealth: 20, maxCastsPerDeclaration: 1 },
    },
  };

  const below = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 4, red: 4, blue: 4 },
      botHealth: 19,
      opponentFaction: 'ancient',
      opponentShips: targets,
    }),
    playerId: 'bot',
    strategy: policyStrategy,
  }));
  assert.equal(below.solarCasts.some((cast) => cast.solarPowerId === 'SBLA'), false);

  const unaffordable = requirePayload(planAncientChargeDeclaration({
    state: createState({ energy: { green: 4, red: 4, blue: 3 } }),
    playerId: 'bot',
    strategy: policyStrategy,
  }));
  assert.equal(
    unaffordable.solarCasts.some((cast) => cast.solarPowerId === 'SBLA'),
    false,
  );

  const state = createState({
    energy: { green: 4, red: 4, blue: 4 },
    botHealth: 20,
    opponentFaction: 'ancient',
    opponentShips: targets,
  });
  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: policyStrategy,
  }));
  assert.deepEqual(payload.solarCasts, [{
    solarPowerId: 'SBLA',
    targetInstanceIds: ['enemy-car', 'enemy-orb-a'],
  }]);
  assert.equal(
    payload.solarCasts[0].targetInstanceIds?.includes('enemy-nep'),
    false,
  );
  assert.equal(
    payload.solarCasts[0].targetInstanceIds?.includes('enemy-gua'),
    false,
  );

  const accepted = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'black-hole-accepted',
  }, 100);
  assert.equal(accepted.ok, true);
});

Deno.test('repeated Black Holes reserve targets and allow later zero-target casts', () => {
  const payload = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 12, red: 12, blue: 12 },
      opponentShips: [
        { instanceId: 'enemy-orb', shipDefId: 'ORB' },
        { instanceId: 'enemy-int', shipDefId: 'INT' },
        { instanceId: 'enemy-def', shipDefId: 'DEF' },
      ],
    }),
    playerId: 'bot',
    strategy: {
      ...BASE_STRATEGY,
      solarPolicy: {
        blackHole: { minSelfHealth: 0, maxCastsPerDeclaration: 3 },
      },
    },
  }));
  assert.deepEqual(
    payload.solarCasts.filter((cast) => cast.solarPowerId === 'SBLA'),
    [
      {
        solarPowerId: 'SBLA',
        targetInstanceIds: ['enemy-orb', 'enemy-int'],
      },
      { solarPowerId: 'SBLA', targetInstanceIds: ['enemy-def'] },
      { solarPowerId: 'SBLA', targetInstanceIds: [] },
    ],
  );
});

Deno.test('production Black Hole policies are explicitly uncapped and health-inclusive', () => {
  for (const [strategyId, threshold] of [
    ['anc_big_standard_econ', 12],
    ['anc_sol_reach_black_hole', 10],
  ] as const) {
    const strategy = getAncientBotStrategyById(strategyId);
    assert.ok(strategy);
    const eligible = requirePayload(planAncientChargeDeclaration({
      state: createState({
        energy: { green: 12, red: 12, blue: 12 },
        botHealth: threshold,
      }),
      playerId: 'bot',
      strategy,
    }));
    assert.equal(
      eligible.solarCasts.filter((cast) => cast.solarPowerId === 'SBLA').length,
      3,
    );

    const below = requirePayload(planAncientChargeDeclaration({
      state: createState({
        energy: { green: 12, red: 12, blue: 12 },
        botHealth: threshold - 1,
      }),
      playerId: 'bot',
      strategy,
    }));
    assert.equal(
      below.solarCasts.some((cast) => cast.solarPowerId === 'SBLA'),
      false,
    );
  }

  assert.deepEqual(
    planAncientChargeDeclaration({
      state: createState(),
      playerId: 'bot',
      strategy: {
        ...BASE_STRATEGY,
        solarPolicy: {
          blackHole: {
            minSelfHealth: 10,
            maxCastsPerDeclaration: 'forever',
          },
        },
      } as unknown as AncientBotStrategy,
    }),
    { kind: 'no_input', reason: 'invalid_black_hole_policy' },
  );
});

Deno.test('copied damage-heal choices are reusable, atomic, and policy independent', async () => {
  const state = createState({
    energy: { green: 0, red: 0, blue: 0 },
    botShips: [{ instanceId: 'copied-int', shipDefId: 'INT', chargesCurrent: 2 }],
    sourceIds: ['copied-int'],
  });
  assert.deepEqual(
    planDamageHealChargeActions({ state, playerId: 'bot' }),
    [{
      actionType: 'power',
      actionId: 'INT#0',
      sourceInstanceId: 'copied-int',
      choiceId: 'damage',
    }],
  );
  assert.deepEqual(
    planDamageHealChargeActions({
      state,
      playerId: 'bot',
      chargePolicy: { INT: { healSelfAtOrBelow: 30 } },
    })[0]?.choiceId,
    'heal',
  );
  const humanPlan = getHumanBotPlanById('hum_orbital_carrier_tactical');
  assert.ok(humanPlan);
  assert.deepEqual(
    planDamageHealChargeActions({
      state,
      playerId: 'bot',
      chargePolicy: humanPlan.chargePolicy,
    }),
    [{
      actionType: 'power',
      actionId: 'INT#0',
      sourceInstanceId: 'copied-int',
      choiceId: 'damage',
    }],
  );

  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  assert.equal(payload.ordinaryChargeActions.length, 1);
  const applied = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'copied-int-atomic',
  }, 100);
  assert.equal(applied.ok, true);
  assert.equal(
    applied.events.some((event: any) => event.type === 'POWER_USED'),
    true,
  );

  const runner = await runBotsUntilSettled({ state, nowMs: 101 });
  assert.equal(runner.botStepsApplied, 1);
  assert.equal(
    runner.events.some((event: any) => event.type === 'POWER_USED'),
    true,
  );
  assert.equal(
    runner.events.some((event: any) =>
      event.type === 'CHARGE_DECLARATION_ACCEPTED'
    ),
    true,
  );
});

Deno.test('unsupported snapped ordinary source is omitted without blocking acceptance', async () => {
  const state = createState({
    energy: { green: 0, red: 0, blue: 0 },
    botShips: [
      { instanceId: 'equ-source', shipDefId: 'EQU', chargesCurrent: 1 },
      { instanceId: 'own-def', shipDefId: 'DEF' },
    ],
    opponentShips: [{ instanceId: 'enemy-def', shipDefId: 'DEF' }],
    sourceIds: ['equ-source'],
  });
  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  assert.deepEqual(payload.ordinaryChargeActions, []);
  const applied = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'unsupported-source-omitted',
  }, 100);
  assert.equal(applied.ok, true);
});

Deno.test('supported copied source is included beside an omitted unsupported source', async () => {
  const state = createState({
    energy: { green: 0, red: 0, blue: 0 },
    botShips: [
      { instanceId: 'supported-int', shipDefId: 'INT', chargesCurrent: 1 },
      { instanceId: 'unsupported-equ', shipDefId: 'EQU', chargesCurrent: 1 },
      { instanceId: 'own-def', shipDefId: 'DEF' },
    ],
    opponentShips: [{ instanceId: 'enemy-def', shipDefId: 'DEF' }],
    sourceIds: ['supported-int', 'unsupported-equ'],
  });
  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  assert.deepEqual(payload.ordinaryChargeActions, [{
    actionType: 'power',
    actionId: 'INT#0',
    sourceInstanceId: 'supported-int',
    choiceId: 'damage',
  }]);

  const result = await runBotsUntilSettled({ state, nowMs: 100 });
  assert.equal(result.botStepsApplied, 1);
  assert.equal(
    result.events.some((event: any) => event.type === 'CHARGE_DECLARATION_ACCEPTED'),
    true,
  );
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'BOT_INTENT_REJECTED' ||
      event.type === 'POWERS_BATCH_SUBMITTED'
    ),
    false,
  );
});

Deno.test('high blue Energy never creates a Simulacrum path', () => {
  const payload = requirePayload(planAncientChargeDeclaration({
    state: createState({ energy: { green: 0, red: 0, blue: 20 } }),
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  assert.equal(payload.solarCasts.some((cast) => cast.solarPowerId === 'SSIM'), false);
  assert.deepEqual(payload.solarCasts, []);
});

Deno.test('Vortex Simulacrum activates its staged opening only at authoritative NEP x3', () => {
  const strategy = getAncientBotStrategyById('anc_vortex_simulacrum');
  assert.ok(strategy);
  const beforeOpening = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 0, red: 0, blue: 10 },
      botShips: nepFleet(2, 'vortex-before'),
      opponentShips: [{ instanceId: 'before-def', shipDefId: 'DEF' }],
    }),
    playerId: 'bot',
    strategy,
  }));
  assert.equal(
    beforeOpening.solarCasts.some((cast) => cast.solarPowerId === 'SSIM'),
    false,
  );

  const openingComplete = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 0, red: 0, blue: 10 },
      botShips: nepFleet(3, 'vortex-ready'),
      opponentShips: [{ instanceId: 'ready-def', shipDefId: 'DEF' }],
    }),
    playerId: 'bot',
    strategy,
  }));
  assert.deepEqual(
    openingComplete.solarCasts.filter((cast) =>
      cast.solarPowerId === 'SSIM'
    ),
    [{ solarPowerId: 'SSIM', targetInstanceId: 'ready-def' }],
  );
});

Deno.test('Silly Simulacrum activates aggressive casting only at authoritative NEP x6', () => {
  const strategy = getAncientBotStrategyById('anc_silly_simulacrum');
  assert.ok(strategy);
  const beforeOpening = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 0, red: 0, blue: 10 },
      botShips: nepFleet(5, 'silly-before'),
      opponentShips: [{
        instanceId: 'before-carrier',
        shipDefId: 'CAR',
        chargesCurrent: 4,
      }],
    }),
    playerId: 'bot',
    strategy,
  }));
  assert.equal(
    beforeOpening.solarCasts.some((cast) => cast.solarPowerId === 'SSIM'),
    false,
  );

  const openingComplete = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 0, red: 0, blue: 10 },
      botShips: nepFleet(6, 'silly-ready'),
      opponentShips: [{
        instanceId: 'ready-carrier',
        shipDefId: 'CAR',
        chargesCurrent: 4,
      }],
    }),
    playerId: 'bot',
    strategy,
  }));
  assert.deepEqual(openingComplete.solarCasts, [{
    solarPowerId: 'SSIM',
    targetInstanceId: 'ready-carrier',
  }]);
});

Deno.test('Vortex Simulacrum completes ordered 2-cost and 3-cost primary goals before uncapped Vortex', async () => {
  const strategy = getAncientBotStrategyById('anc_vortex_simulacrum');
  assert.ok(strategy);
  const state = createState({
    energy: { green: 9, red: 9, blue: 9 },
    botShips: nepFleet(3, 'vortex-main'),
    opponentShips: [
      { instanceId: 'fig-z', shipDefId: 'FIG' },
      { instanceId: 'def-z', shipDefId: 'DEF' },
      { instanceId: 'def-a', shipDefId: 'DEF' },
    ],
    chosenPlanId: strategy.id,
  });
  const before = structuredClone(state);
  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy,
  }));
  assert.deepEqual(payload.solarCasts.slice(0, 2), [
    { solarPowerId: 'SSIM', targetInstanceId: 'def-a' },
    { solarPowerId: 'SSIM', targetInstanceId: 'fig-z' },
  ]);
  assert.deepEqual(
    payload.solarCasts.filter((cast) => cast.solarPowerId === 'SVOR'),
    [{ solarPowerId: 'SVOR' }, { solarPowerId: 'SVOR' }],
  );
  assert.deepEqual(state, before);

  const accepted = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'staged-simulacrum-accepted',
  }, 100);
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.deepEqual(
      accepted.state.gameData.ancient.pendingSimulacrumCopies.map(
        (copy: any) => copy.copiedShipDefId,
      ),
      ['DEF', 'FIG'],
    );
  }

  const runner = await runBotsUntilSettled({
    state: createState({
      energy: { green: 0, red: 0, blue: 5 },
      botShips: Array.from({ length: 3 }, (_, index) => ({
        instanceId: `runner-nep-${index}`,
        shipDefId: 'NEP',
      })),
      opponentShips: [
        { instanceId: 'runner-def', shipDefId: 'DEF' },
        { instanceId: 'runner-fig', shipDefId: 'FIG' },
      ],
      chosenPlanId: strategy.id,
    }),
    nowMs: 101,
  });
  assert.equal(runner.botStepsApplied, 1);
  assert.deepEqual(
    runner.state.controllersByPlayerId.bot.planProgress?.simulacrum,
    {
      strategyId: strategy.id,
      completedGoalCount: 2,
      openingComplete: true,
    },
  );

  let copyIndex = 0;
  const materialized = materializeQueuedSimulacrumCopiesAtTurnStart(
    runner.state,
    4,
    102,
    () => `runner-copy-${copyIndex++}`,
  );
  const materializedState: any = materialized.state;
  assert.deepEqual(
    materializedState.gameData.ships.bot
      .filter((ship: any) => ship.instanceId.startsWith('runner-copy-'))
      .map((ship: any) => ship.shipDefId),
    ['DEF', 'FIG'],
  );
  materializedState.players.find((player: any) => player.id === 'bot').lines =
    20;
  const authoredPlan = getAncientAuthoredPlanByStrategyId(strategy.id);
  assert.ok(authoredPlan);
  const continuation = planBotBuildDecision(
    materializedState,
    'bot',
    authoredPlan,
    materializedState.controllersByPlayerId.bot.planProgress,
  );
  assert.equal(continuation.ok, true);
  if (continuation.ok) {
    assert.deepEqual(continuation.payload.builds, [
      { shipDefId: 'PLU', count: 2 },
      { shipDefId: 'MER', count: 2 },
      { shipDefId: 'QUA', count: 1 },
    ]);
  }
});

Deno.test('Vortex Simulacrum does not skip an unavailable current staged goal and completed progress disables SSIM', () => {
  const strategy = getAncientBotStrategyById('anc_vortex_simulacrum');
  assert.ok(strategy);
  const blocked = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 0, red: 0, blue: 3 },
      botShips: nepFleet(3, 'vortex-blocked'),
      opponentShips: [{ instanceId: 'fig-only', shipDefId: 'FIG' }],
    }),
    playerId: 'bot',
    strategy,
  }));
  assert.equal(
    blocked.solarCasts.some((cast) => cast.solarPowerId === 'SSIM'),
    false,
  );

  const complete = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 2, red: 2, blue: 2 },
      botShips: nepFleet(3, 'vortex-complete'),
      opponentShips: [{ instanceId: 'def', shipDefId: 'DEF' }],
    }),
    playerId: 'bot',
    strategy,
    planProgress: {
      simulacrum: {
        strategyId: strategy.id,
        completedGoalCount: 2,
        openingComplete: true,
      },
    },
  }));
  assert.deepEqual(complete.solarCasts, [{ solarPowerId: 'SVOR' }]);
});

Deno.test('Silly Simulacrum ranks snapshot value and charges, excludes depleted charged targets, and stops with blue remaining', async () => {
  const strategy = getAncientBotStrategyById('anc_silly_simulacrum');
  assert.ok(strategy);
  const state = createState({
    energy: { green: 0, red: 0, blue: 10 },
    botShips: nepFleet(6, 'silly-main'),
    opponentShips: [
      { instanceId: 'orb', shipDefId: 'ORB' },
      { instanceId: 'carrier', shipDefId: 'CAR', chargesCurrent: 4 },
      { instanceId: 'depleted-int', shipDefId: 'INT', chargesCurrent: 0 },
      { instanceId: 'commander', shipDefId: 'COM' },
    ],
    chosenPlanId: strategy.id,
  });
  const payload = requirePayload(planAncientChargeDeclaration({
    state,
    playerId: 'bot',
    strategy,
  }));
  assert.deepEqual(payload.solarCasts, [
    { solarPowerId: 'SSIM', targetInstanceId: 'carrier' },
    { solarPowerId: 'SSIM', targetInstanceId: 'commander' },
  ]);
  const accepted = await applyIntent(state, 'bot', {
    gameId: state.gameId,
    intentType: 'CHARGE_DECLARATION_SUBMIT',
    turnNumber: 3,
    payload,
    nonce: 'silly-simulacrum-accepted',
  }, 100);
  assert.equal(accepted.ok, true);

  const multiTurnRunner = await runBotsUntilSettled({
    state: createState({
      energy: { green: 0, red: 0, blue: 6 },
      botShips: Array.from({ length: 6 }, (_, index) => ({
        instanceId: `silly-nep-${index}`,
        shipDefId: 'NEP',
      })),
      opponentShips: [{
        instanceId: 'copied-carrier',
        shipDefId: 'CAR',
        chargesCurrent: 4,
      }],
      chosenPlanId: strategy.id,
    }),
    nowMs: 101,
  });
  assert.equal(multiTurnRunner.botStepsApplied, 1);
  const materializedCarrier = materializeQueuedSimulacrumCopiesAtTurnStart(
    multiTurnRunner.state,
    4,
    102,
    () => 'silly-copied-carrier',
  );
  const materializedCarrierState: any = materializedCarrier.state;
  assert.equal(
    materializedCarrierState.gameData.ships.bot.some((ship: any) =>
      ship.instanceId === 'silly-copied-carrier' && ship.shipDefId === 'CAR'
    ),
    true,
  );
  materializedCarrierState.players.find((player: any) =>
    player.id === 'bot'
  ).lines = 18;
  const sillyPlan = getAncientAuthoredPlanByStrategyId(strategy.id);
  assert.ok(sillyPlan);
  const growth = planBotBuildDecision(
    materializedCarrierState,
    'bot',
    sillyPlan,
  );
  assert.equal(growth.ok, true);
  if (growth.ok) {
    assert.deepEqual(growth.payload.builds, [{ shipDefId: 'SPI', count: 3 }]);
  }

  const noDesirableTarget = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 0, red: 0, blue: 4 },
      botShips: nepFleet(6, 'silly-no-target'),
      opponentShips: [{
        instanceId: 'depleted-only',
        shipDefId: 'INT',
        chargesCurrent: 0,
      }],
    }),
    playerId: 'bot',
    strategy,
  }));
  assert.deepEqual(noDesirableTarget.solarCasts, []);
  assert.equal(noDesirableTarget.autocastEnabled, true);
});

Deno.test('Silly Simulacrum trials canonical max quantity with Chronoswarm multiplicity and falls through', () => {
  const strategy = getAncientBotStrategyById('anc_silly_simulacrum');
  assert.ok(strategy);
  const payload = requirePayload(planAncientChargeDeclaration({
    state: createState({
      energy: { green: 0, red: 0, blue: 10 },
      botShips: [
        ...nepFleet(6, 'silly-chrono'),
        { instanceId: 'chronoswarm', shipDefId: 'CHR' },
        ...Array.from({ length: 5 }, (_, index) => ({
          instanceId: `owned-orb-${index}`,
          shipDefId: 'ORB',
        })),
      ],
      opponentShips: [
        { instanceId: 'maxed-orb', shipDefId: 'ORB' },
        { instanceId: 'fallback-com', shipDefId: 'COM' },
      ],
    }),
    playerId: 'bot',
    strategy,
  }));
  assert.deepEqual(payload.solarCasts, [{
    solarPowerId: 'SSIM',
    targetInstanceId: 'fallback-com',
  }]);
});

Deno.test('runner submits one atomic Ancient declaration as one bot step', async () => {
  const state = createState();
  const result = await runBotsUntilSettled({ state, nowMs: 100 });
  assert.equal(result.botStepsApplied, 1);
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'CHARGE_DECLARATION_ACCEPTED'
    ),
    true,
  );
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'BOT_INTENT_REJECTED' || event.type === 'POWER_USED'
    ),
    false,
  );
  assert.equal(
    result.state.gameData.ancient.acceptedDeclarationByPlayerId.bot
      ?.declarationId,
    'bot:ancient-bot-planner-test:3:bot:ancient-charge:v1',
  );
});

Deno.test('selected production Ancient plan settles First Strike without a Spiral action', async () => {
  const state = createState();
  state.gameData.currentSubPhase = 'first_strike';
  state.gameData.turnData.currentSubPhase = 'first_strike';
  const result = await runBotsUntilSettled({ state, nowMs: 100 });
  assert.equal(result.botStepsApplied, 1);
  assert.equal(result.events.some((event: any) => event.type === 'BOT_RUNNER_SKIPPED'), false);
});

Deno.test('representative lightweight strategies repeat atomic Battle progression', async () => {
  const productionStrategyIds = [
    'anc_mer_aggro',
    'anc_spiral_aggro',
    'anc_cube_red_green',
    'anc_small_econ_siphon',
    'anc_big_standard_econ',
    'anc_vortex_no_simulacrum',
    'anc_cube_quantum_solar_snowball',
  ];
  const strategies: AncientBotStrategy[] = productionStrategyIds.map((id) => {
    const strategy = getAncientBotStrategyById(id);
    assert.ok(strategy);
    return strategy;
  });

  for (const strategy of strategies) {
    for (const turnNumber of [3, 4]) {
      const state = createState({
        gameId: `repeat-${strategy.id}`,
        turnNumber,
        energy: strategy.solarPolicy
          ? { green: 4, red: 4, blue: 4 }
          : { green: 4, red: 4, blue: 0 },
      });
      const payload = requirePayload(planAncientChargeDeclaration({
        state,
        playerId: 'bot',
        strategy,
      }));
      assert.equal(
        payload.solarCasts.some((cast) => cast.solarPowerId === 'SSIM'),
        false,
      );
      const accepted = await applyIntent(state, 'bot', {
        gameId: state.gameId,
        intentType: 'CHARGE_DECLARATION_SUBMIT',
        turnNumber,
        payload,
        nonce: `repeat-${strategy.id}-${turnNumber}`,
      }, 100 + turnNumber);
      assert.equal(accepted.ok, true);
      assert.equal(
        accepted.state.gameData.ancient.acceptedDeclarationByPlayerId.bot
          ?.context?.battleTurnNumber,
        turnNumber,
      );
    }
  }
});
