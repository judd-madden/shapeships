import assert from 'node:assert/strict';
import {
  projectPublicSeatControllers,
} from '../../../engine/bot/botControllerProjection.ts';

Deno.test('public controller projection uses player terminology and hides bot progress', () => {
  const projected = projectPublicSeatControllers({
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
  });

  assert.deepEqual(projected.player, { kind: 'player' });
  assert.deepEqual(projected.bot, {
    kind: 'bot',
    speciesId: 'ANC',
    chosenPlanId: 'anc_vortex_simulacrum',
  });
  assert.equal('planProgress' in projected.bot, false);
  assert.equal('internalStrategyState' in projected.bot, false);
});
