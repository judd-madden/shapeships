import type { AuthoredBotPlan } from './botTypes.ts';

export const ACTIVE_ANCIENT_AUTHORED_PLANS: readonly AuthoredBotPlan[] = [
  {
    id: 'anc_cube_red_green',
    name: 'Simple Cube Red/Green',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: ['CUB'],
      endLoop: [{
        committedHealthGroup: {
          groupKey: 'core_trio',
          selfHealthBelow: 20,
          below: {
            branchId: 'plu',
            shipDefId: 'PLU',
            count: 3,
          },
          atOrAbove: {
            branchId: 'mer',
            shipDefId: 'MER',
            count: 3,
          },
          repeat: true,
        },
      }],
    },
  },
  {
    id: 'anc_big_standard_econ',
    name: 'Big Standard Econ',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [
        'CUB',
        'NEP', 'NEP',
        'PLU', 'PLU', 'PLU',
        'NEP', 'NEP',
        'PLU', 'PLU', 'PLU',
        'NEP', 'NEP',
        'MER', 'MER', 'MER', 'MER', 'MER', 'MER',
      ],
      endLoop: ['PLU', 'PLU', 'PLU', 'MER', 'MER', 'MER'],
      endLoopProgress: 'fleet_counts',
    },
  },
  {
    id: 'anc_cube_quantum_solar_snowball',
    name: 'Cube Quantum Solar Snowball',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    adaptiveBuildRules: [{
      shipDefId: 'PLU',
      targetCount: 3,
      selfHealthAtOrBelow: 14,
      saveUntilAffordable: true,
      placement: 'after_ordered_opening',
    }],
    orderedBuildPlan: {
      buildOrder: ['CUB', 'QUA', 'NEP', 'CUB'],
      endLoop: [{
        firstAffordableShipDefIds: ['QUA', 'NEP', 'CUB'],
        targetCountByShipDefId: { CUB: 4 },
        fallbackShipDefIdWhenCandidatesComplete: 'SOL',
      }],
    },
    quantumMysticPolicy: {
      QUA: { mode: 'fixed_6' },
    },
  },
  {
    id: 'anc_vortex_no_simulacrum',
    name: 'Vortex — No Simulacrum',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [
        'CUB',
        'NEP',
        'SPI', 'SPI', 'SPI',
        'NEP', 'NEP',
        'MER', 'MER', 'MER',
        'PLU', 'PLU', 'PLU',
        'QUA',
        'SOL',
      ],
      endLoop: ['SOL'],
    },
    quantumMysticPolicy: {
      QUA: { mode: 'fixed_6' },
    },
    targetPolicy: {
      SPI: { mode: 'highest_cost_basic' },
    },
  },
  {
    id: 'anc_small_econ_siphon',
    name: 'Small Econ Siphon',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: ['NEP', 'NEP'],
      endLoop: ['PLU', 'PLU', 'PLU', 'MER', 'MER', 'MER'],
      endLoopProgress: 'fleet_counts',
    },
  },
  {
    id: 'anc_sol_reach_black_hole',
    name: 'Sol Reach Black Hole',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [
        'NEP', 'NEP', 'NEP',
        {
          committedHealthGroup: {
            groupKey: 'plu_reach',
            selfHealthBelow: 16,
            below: {
              branchId: 'plu_6',
              shipDefId: 'PLU',
              count: 6,
            },
            atOrAbove: {
              branchId: 'plu_3',
              shipDefId: 'PLU',
              count: 3,
            },
            completionWitnessShipDefId: 'SOL',
          },
        },
        'SOL',
        'MER', 'MER', 'MER',
      ],
      endLoop: ['SOL'],
    },
  },
  {
    id: 'anc_sol_blue_snowball',
    name: 'Sol Blue Snowball',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    adaptiveBuildRules: [{
      shipDefId: 'PLU',
      targetCount: 3,
      selfHealthAtOrBelow: 15,
      saveUntilAffordable: true,
      placement: 'after_ordered_opening',
    }],
    orderedBuildPlan: {
      buildOrder: ['NEP', 'NEP'],
      endLoop: [{ firstAffordableShipDefIds: ['SOL', 'NEP'] }],
    },
  },
  {
    id: 'anc_vortex_simulacrum',
    name: 'Vortex + Simulacrum',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [
        'NEP', 'NEP', 'NEP',
        { progressGate: 'simulacrum_opening_complete' },
        'PLU', 'PLU',
        'MER', 'MER',
        'QUA',
        'SPI',
        'SOL',
        'PLU', 'PLU', 'PLU',
        'NEP',
        'MER', 'MER',
      ],
      endLoop: ['SOL'],
    },
    quantumMysticPolicy: {
      QUA: { mode: 'match_effective_dice' },
    },
    targetPolicy: {
      SPI: { mode: 'highest_cost_basic' },
    },
  },
  {
    id: 'anc_silly_simulacrum',
    name: 'Silly Simulacrum',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [
        'NEP', 'NEP', 'NEP', 'NEP', 'NEP', 'NEP',
        'SPI', 'SPI', 'SPI',
        'PLU', 'PLU', 'PLU',
      ],
      endLoop: ['SOL'],
    },
    drawingPrelude: {
      CAR: { mode: 'deterministic_seeded_legal_choice' },
    },
    targetPolicy: {
      SPI: { mode: 'highest_cost_basic' },
    },
    opportunisticForeignUpgrades: {
      mode: 'highest_total_line_cost',
    },
  },
  {
    id: 'anc_spiral_aggro',
    name: 'Spiral Into Aggro',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: ['SPI', 'SPI', 'SPI'],
      endLoop: ['MER'],
    },
    targetPolicy: {
      SPI: { mode: 'highest_cost_basic' },
    },
  },
  {
    id: 'anc_mer_aggro',
    name: 'Simple Aggro',
    speciesId: 'ANC',
    buildGoals: [],
    loopGoals: [],
    orderedBuildPlan: {
      buildOrder: [],
      endLoop: ['MER'],
    },
  },
];

export function getAncientAuthoredPlanByStrategyId(
  strategyId: string,
): AuthoredBotPlan | null {
  return ACTIVE_ANCIENT_AUTHORED_PLANS.find((plan) => plan.id === strategyId) ?? null;
}
