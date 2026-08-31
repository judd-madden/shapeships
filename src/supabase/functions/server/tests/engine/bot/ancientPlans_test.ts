import assert from 'node:assert/strict';
import {
  ACTIVE_ANCIENT_BOT_STRATEGIES,
  ANCIENT_BOT_STRATEGIES_BY_FAMILY,
  chooseAncientOpeningStrategy,
  getAncientBotStrategyById,
} from '../../../engine/bot/ancientPlans.ts';

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
  ['anc_mer_aggro', 'Simple Aggro'],
] as const;

Deno.test('Ancient strategy registry exposes eleven stable identities in explicit families', () => {
  assert.deepEqual(
    ACTIVE_ANCIENT_BOT_STRATEGIES.map((entry) => entry.id),
    EXPECTED_STRATEGIES.map(([id]) => id),
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(ANCIENT_BOT_STRATEGIES_BY_FAMILY).map(([family, entries]) => [
        family,
        entries.length,
      ]),
    ),
    { CUB: 4, NEP: 5, SPI: 1, MER: 1 },
  );

  for (const [id, workingName] of EXPECTED_STRATEGIES) {
    const registered = getAncientBotStrategyById(id);
    assert.equal(registered?.id, id);
    assert.equal(registered?.workingName, workingName);
    assert.equal(registered?.speciesId, 'ANC');
    assert.equal('buildGoals' in (registered as unknown as Record<string, unknown>), false);
    assert.equal('solarPolicy' in (registered as unknown as Record<string, unknown>), false);
  }

  assert.equal(getAncientBotStrategyById('anc_unknown'), null);
});

Deno.test('Ancient chooser deterministically enters the CUB and NEP families', () => {
  for (const lines of [9, 10, 20]) {
    const decision = chooseAncientOpeningStrategy({
      gameId: 'family-thresholds',
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
      gameId: 'family-thresholds',
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
    gameId: 'representative-3',
    turnNumber: 3,
    availableOrdinaryLines: 6,
  });
  const sixSaved = chooseAncientOpeningStrategy({
    gameId: 'representative-0',
    turnNumber: 3,
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
      gameId: 'representative-0',
      turnNumber: 3,
      availableOrdinaryLines,
    })
  );
  const lowSaved = [3, 4, 5].map((availableOrdinaryLines) =>
    chooseAncientOpeningStrategy({
      gameId: 'representative-1',
      turnNumber: 3,
      availableOrdinaryLines,
    })
  );
  assert.deepEqual(lowSelected, Array(3).fill({
    kind: 'selected',
    family: 'MER',
    strategyId: 'anc_mer_aggro',
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
