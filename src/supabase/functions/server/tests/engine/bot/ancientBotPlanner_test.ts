import assert from 'node:assert/strict';
import {
  planAncientChargeDeclaration,
} from '../../../engine/bot/ancientBotPlanner.ts';
import type {
  AncientBotStrategy,
} from '../../../engine/bot/ancientPlans.ts';
import { getAncientBotStrategyById } from '../../../engine/bot/ancientPlans.ts';
import {
  planDamageHealChargeActions,
} from '../../../engine/bot/botPowerPlanning.ts';
import { runBotsUntilSettled } from '../../../engine/bot/botRunner.ts';
import { getHumanBotPlanById } from '../../../engine/bot/humanPlans.ts';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
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
        id: 'human',
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
      human: { kind: 'human' },
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
      ships: { human: opponentShips, bot: botShips },
      voidShipsByPlayerId: { human: [], bot: [] },
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
        breakdownEntries: [],
      },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      ancient: {
        schemaVersion: 1,
        energyByPlayerId: {
          human: {
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
          human: { battleTurnNumber: null, entries: [] },
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
          human: 2,
          bot: args.effectiveDice ?? 1,
        },
        chargePowerUsedByInstanceId: {},
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          human: [],
          bot: [...(args.sourceIds ?? [])],
        },
        chargeDeclarationFleetSnapshotByPlayerId: {
          human: structuredClone(opponentShips),
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

Deno.test('high blue Energy never creates a Simulacrum path', () => {
  const payload = requirePayload(planAncientChargeDeclaration({
    state: createState({ energy: { green: 0, red: 0, blue: 20 } }),
    playerId: 'bot',
    strategy: BASE_STRATEGY,
  }));
  assert.equal(payload.solarCasts.some((cast) => cast.solarPowerId === 'SSIM'), false);
  assert.deepEqual(payload.solarCasts, []);
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
  assert.equal(
    result.events.some((event: any) =>
      event.type === 'BOT_RUNNER_SKIPPED' &&
      event.reason === 'ancient_strategy_deferred_phase_17e'
    ),
    false,
  );
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
