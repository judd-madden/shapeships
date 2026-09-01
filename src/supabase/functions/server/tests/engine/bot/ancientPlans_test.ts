import assert from 'node:assert/strict';
import {
  ACTIVE_ANCIENT_BOT_STRATEGIES,
  ANCIENT_BOT_STRATEGIES_BY_FAMILY,
  chooseAncientOpeningStrategy,
  getAncientBotStrategyById,
} from '../../../engine/bot/ancientPlans.ts';
import {
  ACTIVE_ANCIENT_AUTHORED_PLANS,
  getAncientAuthoredPlanByStrategyId,
} from '../../../engine/bot/ancientAuthoredPlans.ts';

const EXPECTED_STRATEGIES = [
  ['anc_cube_red_green', 'Simple Cube Red/Green'],
  ['anc_big_standard_econ', 'Big Standard Econ'],
  ['anc_cube_quantum_solar_snowball', 'Cube Quantum Solar Snowball'],
  ['anc_vortex_no_simulacrum', 'Vortex — No Simulacrum'],
  ['anc_small_econ_siphon', 'Small Econ Siphon'],
  ['anc_sol_reach_black_hole', 'Sol Reach Black Hole'],
  ['anc_sol_blue_snowball', 'Sol Blue Snowball'],
  ['anc_vortex_simulacrum', 'Vortex + Simulacrum'],
  ['anc_silly_simulacrum', 'Silly Simulacrum'],
  ['anc_spiral_aggro', 'Spiral Into Aggro'],
  ['anc_spiral_nep_aggro', 'Spiral NEP Aggro'],
  ['anc_mer_aggro', 'Simple Aggro'],
  ['anc_mer_aggro_plu', 'Simple Aggro + PLU'],
] as const;

Deno.test('Ancient strategy registry exposes thirteen stable identities in explicit families', () => {
  assert.deepEqual(
    ACTIVE_ANCIENT_BOT_STRATEGIES.map((entry) => entry.id),
    EXPECTED_STRATEGIES.map(([id]) => id),
  );
  assert.equal(
    new Set(ACTIVE_ANCIENT_BOT_STRATEGIES.map((entry) => entry.id)).size,
    EXPECTED_STRATEGIES.length,
  );
  assert.deepEqual(
    ACTIVE_ANCIENT_AUTHORED_PLANS.map((entry) => entry.id),
    EXPECTED_STRATEGIES.map(([id]) => id),
  );
  assert.equal(
    new Set(ACTIVE_ANCIENT_AUTHORED_PLANS.map((entry) => entry.id)).size,
    EXPECTED_STRATEGIES.length,
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(ANCIENT_BOT_STRATEGIES_BY_FAMILY).map(([family, entries]) => [
        family,
        entries.length,
      ]),
    ),
    { CUB: 4, NEP: 5, SPI: 2, MER: 2 },
  );

  for (const [id, workingName] of EXPECTED_STRATEGIES) {
    const registered = getAncientBotStrategyById(id);
    const authored = getAncientAuthoredPlanByStrategyId(id);
    assert.equal(registered?.id, id);
    assert.equal(registered?.workingName, workingName);
    assert.equal(registered?.speciesId, 'ANC');
    assert.equal(authored?.id, id);
    assert.equal(authored?.name, workingName);
    assert.equal(authored?.speciesId, 'ANC');
    assert.equal('buildGoals' in (registered as unknown as Record<string, unknown>), false);
    if (
      id !== 'anc_big_standard_econ' &&
      id !== 'anc_sol_reach_black_hole' &&
      id !== 'anc_vortex_no_simulacrum' &&
      id !== 'anc_vortex_simulacrum' &&
      id !== 'anc_silly_simulacrum'
    ) {
      assert.equal(
        'solarPolicy' in (registered as unknown as Record<string, unknown>),
        false,
      );
    }
  }

  for (const entries of Object.values(ANCIENT_BOT_STRATEGIES_BY_FAMILY)) {
    for (const entry of entries) {
      assert.equal(ACTIVE_ANCIENT_BOT_STRATEGIES.includes(entry), true);
    }
  }

  assert.deepEqual(
    getAncientBotStrategyById('anc_big_standard_econ')?.solarPolicy,
    {
      blackHole: {
        minSelfHealth: 12,
        maxCastsPerDeclaration: 'uncapped',
      },
    },
  );
  assert.deepEqual(
    getAncientBotStrategyById('anc_sol_reach_black_hole')?.solarPolicy,
    {
      blackHole: {
        minSelfHealth: 10,
        maxCastsPerDeclaration: 'uncapped',
      },
    },
  );
  assert.deepEqual(
    getAncientBotStrategyById('anc_vortex_no_simulacrum')?.solarPolicy,
    { vortex: { maxCastsPerDeclaration: 2 } },
  );
  assert.deepEqual(
    getAncientBotStrategyById('anc_vortex_simulacrum')?.solarPolicy,
    {
      simulacrum: {
        mode: 'staged_cost_goals',
        costGoals: [2, 3],
        activationFleetGoal: { shipDefId: 'NEP', targetCount: 3 },
      },
      vortex: { maxCastsPerDeclaration: 'uncapped' },
    },
  );
  assert.deepEqual(
    getAncientBotStrategyById('anc_silly_simulacrum')?.solarPolicy,
    {
      simulacrum: {
        mode: 'highest_value_highest_charge',
        maxCastsPerDeclaration: 'while_legal_affordable',
        excludeDepletedChargedTargets: true,
        activationFleetGoal: { shipDefId: 'NEP', targetCount: 6 },
      },
    },
  );

  assert.equal(getAncientBotStrategyById('anc_unknown'), null);
});

Deno.test('known Ancient chooser seeds reach every registered family member deterministically', () => {
  const cases = [
    ['fixture-1', 9, 'anc_cube_red_green'],
    ['fixture-0', 9, 'anc_big_standard_econ'],
    ['fixture-3', 9, 'anc_cube_quantum_solar_snowball'],
    ['fixture-2', 9, 'anc_vortex_no_simulacrum'],
    ['fixture-17', 8, 'anc_small_econ_siphon'],
    ['fixture-0', 8, 'anc_sol_reach_black_hole'],
    ['fixture-5', 8, 'anc_sol_blue_snowball'],
    ['fixture-27', 8, 'anc_vortex_simulacrum'],
    ['fixture-10', 8, 'anc_silly_simulacrum'],
    ['variant-3', 6, 'anc_spiral_aggro'],
    ['variant-2', 6, 'anc_spiral_nep_aggro'],
    ['variant-5', 5, 'anc_mer_aggro'],
    ['variant-0', 5, 'anc_mer_aggro_plu'],
  ] as const;

  for (const [gameId, availableOrdinaryLines, strategyId] of cases) {
    const input = { gameId, turnNumber: 1, availableOrdinaryLines };
    const first = chooseAncientOpeningStrategy(input);
    assert.deepEqual(first, chooseAncientOpeningStrategy(input));
    assert.equal(first.kind, 'selected');
    if (first.kind === 'selected') {
      assert.equal(first.strategyId, strategyId);
    }
  }

  assert.deepEqual(
    chooseAncientOpeningStrategy({
      gameId: 'variant-0',
      turnNumber: 1,
      availableOrdinaryLines: 6,
    }),
    { kind: 'save', thresholdClass: 'six' },
  );
  assert.deepEqual(
    chooseAncientOpeningStrategy({
      gameId: 'variant-1',
      turnNumber: 1,
      availableOrdinaryLines: 5,
    }),
    { kind: 'save', thresholdClass: 'low' },
  );
});

Deno.test('Ancient chooser deterministically enters the CUB and NEP families', () => {
  for (const lines of [9, 10, 20]) {
    const decision = chooseAncientOpeningStrategy({
      gameId: 'fixture-1',
      turnNumber: 1,
      availableOrdinaryLines: lines,
    });
    assert.equal(decision.kind, 'selected');
    if (decision.kind === 'selected') {
      assert.equal(decision.family, 'CUB');
      assert.equal(getAncientBotStrategyById(decision.strategyId)?.family, 'CUB');
    }
  }

  for (const lines of [7, 8]) {
    const decision = chooseAncientOpeningStrategy({
      gameId: 'fixture-1',
      turnNumber: 1,
      availableOrdinaryLines: lines,
    });
    assert.equal(decision.kind, 'selected');
    if (decision.kind === 'selected') {
      assert.equal(decision.family, 'NEP');
      assert.equal(getAncientBotStrategyById(decision.strategyId)?.family, 'NEP');
    }
  }
});

Deno.test('Ancient six-line and low-line percentage branches cover both deterministic outcomes', () => {
  const sixSelected = chooseAncientOpeningStrategy({
    gameId: 'variant-3',
    turnNumber: 1,
    availableOrdinaryLines: 6,
  });
  const sixSaved = chooseAncientOpeningStrategy({
    gameId: 'variant-0',
    turnNumber: 1,
    availableOrdinaryLines: 6,
  });
  assert.deepEqual(sixSelected, {
    kind: 'selected',
    family: 'SPI',
    strategyId: 'anc_spiral_aggro',
  });
  assert.deepEqual(sixSaved, { kind: 'save', thresholdClass: 'six' });

  const lowSelected = [3, 4, 5].map((availableOrdinaryLines) =>
    chooseAncientOpeningStrategy({
      gameId: 'variant-0',
      turnNumber: 1,
      availableOrdinaryLines,
    })
  );
  const lowSaved = [3, 4, 5].map((availableOrdinaryLines) =>
    chooseAncientOpeningStrategy({
      gameId: 'variant-1',
      turnNumber: 1,
      availableOrdinaryLines,
    })
  );
  assert.deepEqual(lowSelected, Array(3).fill({
    kind: 'selected',
    family: 'MER',
    strategyId: 'anc_mer_aggro_plu',
  }));
  assert.deepEqual(
    lowSaved,
    Array(3).fill({ kind: 'save', thresholdClass: 'low' }),
  );
});

Deno.test('Ancient chooser repeats identical results and fails closed on malformed inputs', () => {
  const input = {
    gameId: 'repeatable-chooser',
    turnNumber: 7,
    availableOrdinaryLines: 8,
  };
  assert.deepEqual(
    chooseAncientOpeningStrategy(input),
    chooseAncientOpeningStrategy(input),
  );

  assert.deepEqual(chooseAncientOpeningStrategy({
    ...input,
    gameId: '',
  }), { kind: 'invalid', reason: 'invalid_game_id' });
  assert.deepEqual(chooseAncientOpeningStrategy({
    ...input,
    turnNumber: -1,
  }), { kind: 'invalid', reason: 'invalid_turn_number' });
  assert.deepEqual(chooseAncientOpeningStrategy({
    ...input,
    availableOrdinaryLines: 1.5,
  }), { kind: 'invalid', reason: 'invalid_available_ordinary_lines' });
});
