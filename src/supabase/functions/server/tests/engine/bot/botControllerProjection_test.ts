import assert from 'node:assert/strict';
import {
  projectPublicSeatControllers,
} from '../../../engine/bot/botControllerProjection.ts';

Deno.test('public controller projection hides unresolved bot identity without mutation', () => {
  const controllers = {
    player: { kind: 'human' },
    bot: {
      kind: 'bot',
      speciesId: 'ANC',
      chosenPlanId: 'anc_vortex_simulacrum',
      planProgress: {
        committedBuildGroup: {
          planId: 'anc_cube_red_green',
          groupKey: 'core_trio',
          branchId: 'mer',
          shipDefId: 'MER',
          startingCount: 0,
          targetCount: 3,
        },
        simulacrum: {
          strategyId: 'anc_vortex_simulacrum',
          completedGoalCount: 1,
          openingComplete: false,
        },
      },
      internalStrategyState: { reservedEnergy: 5 },
    },
  } as const;
  const before = structuredClone(controllers);
  const projected = projectPublicSeatControllers(controllers, {
    speciesSelectionResolved: false,
  });

  assert.deepEqual(projected.player, { kind: 'player' });
  assert.deepEqual(projected.bot, {
    kind: 'bot',
    speciesId: null,
    chosenPlanId: null,
  });
  assert.equal('planProgress' in projected.bot, false);
  assert.equal('internalStrategyState' in projected.bot, false);
  assert.deepEqual(controllers, before);
});

Deno.test('public controller projection restores resolved bot identity', () => {
  const projected = projectPublicSeatControllers({
    player: { kind: 'human' },
    bot: {
      kind: 'bot',
      speciesId: 'ANC',
      chosenPlanId: 'anc_vortex_simulacrum',
      internalStrategyState: { reservedEnergy: 5 },
    },
  }, {
    speciesSelectionResolved: true,
  });

  assert.deepEqual(projected.player, { kind: 'player' });
  assert.deepEqual(projected.bot, {
    kind: 'bot',
    speciesId: 'ANC',
    chosenPlanId: 'anc_vortex_simulacrum',
  });
});
