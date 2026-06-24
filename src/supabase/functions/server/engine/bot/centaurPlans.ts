import type { AuthoredBotPlan, BotPlanId } from './botTypes.ts';

const WIS_DEFAULT = {
  healSelfAtOrBelow: 14,
  damageOpponentAtOrBelow: 12,
};

const WIS_AGGRESSIVE = {
  healSelfAtOrBelow: 10,
  damageOpponentAtOrBelow: 18,
};

const WIS_SUSTAIN = {
  healSelfAtOrBelow: 18,
  damageOpponentAtOrBelow: 10,
};

const FAM_DEFAULT = {
  healSelfAtOrBelow: 14,
  damageOpponentAtOrBelow: 12,
};

const FAM_AGGRESSIVE = {
  healSelfAtOrBelow: 10,
  damageOpponentAtOrBelow: 18,
};

const FAM_SUSTAIN = {
  healSelfAtOrBelow: 18,
  damageOpponentAtOrBelow: 10,
};

const CEN_VIGOR_POWER_DESTRUCTION_PLAN: AuthoredBotPlan = {
  id: 'cen_vigor_power_destruction',
  name: 'Vigor Power Destruction',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'VIG',
      'VIG',
      'VIG',
      'LEG',
      'FEA',
      'ANG',
      'ANG',
      { shipDefId: 'POW', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] },
      'VIG',
      'FEA',
      'ANG',
      'ANG',
      { shipDefId: 'POW', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] },
      'EQU',
      'FEA',
      'FEA',
      'ANG',
      'LEG',
      { shipDefId: 'DES', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'EQU', 'ANG'] },
    ],
    endLoop: ['FEA'],
    fallbacks: {
      default: ['FEA', 'ANG', 'EQU'],
      defensive: ['FEA', 'EQU'],
      aggressive: ['ANG', 'FEA'],
    },
  },
  targetPolicy: {
    EQU: { mode: 'lowest_shared_cost_pair' },
  },
};

const CEN_FURY_RUSH_PLAN: AuthoredBotPlan = {
  id: 'cen_fury_rush',
  name: 'Fury Rush',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
    ],
    endLoop: [
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
    ],
    fallbacks: {
      default: ['ANG'],
      aggressive: ['ANG'],
    },
  },
};

const CEN_VIGOR_LEGACY_FURY_PLAN: AuthoredBotPlan = {
  id: 'cen_vigor_legacy_fury',
  name: 'Vigor Legacy Fury',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'VIG',
      'VIG',
      'LEG',
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
    ],
    endLoop: [
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
    ],
    fallbacks: {
      default: ['ANG'],
      aggressive: ['ANG'],
    },
  },
};

const CEN_FAMILY_AGGRO_PLAN: AuthoredBotPlan = {
  id: 'cen_family_aggro',
  name: 'Family Aggro',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'VIG',
      'VIG',
      'FEA',
      'ANG',
      'ANG',
      { shipDefId: 'POW', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] },
      'LEG',
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
      'ANG',
      'FEA',
      'WIS',
      'FAM',
      'FAM',
      'FAM',
      { shipDefId: 'KNO', saveUntilAffordable: true, fallbackShipDefIds: ['FAM', 'WIS', 'ANG'] },
    ],
    endLoop: ['FAM'],
    fallbacks: {
      default: ['FAM', 'WIS', 'ANG'],
      defensive: ['FAM', 'WIS', 'FEA'],
      aggressive: ['FAM', 'ANG'],
    },
  },
  chargePolicy: {
    WIS: WIS_AGGRESSIVE,
    FAM: FAM_AGGRESSIVE,
  },
  dicePolicy: {
    KNO: { mode: 'reroll_odd_hold_even' },
  },
};

const CEN_GREED_KNO_DES_PLAN: AuthoredBotPlan = {
  id: 'cen_greed_kno_des',
  name: 'Greed KNO DES',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'VIG',
      'VIG',
      'VIG',
      'FEA',
      'ANG',
      'ANG',
      { shipDefId: 'POW', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] },
      'WIS',
      'FAM',
      { shipDefId: 'KNO', saveUntilAffordable: true, fallbackShipDefIds: ['WIS', 'FAM', 'FEA'] },
      'VIG',
      'FEA',
      'ANG',
      'ANG',
      { shipDefId: 'POW', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] },
      'VIG',
      'LEG',
      'FEA',
      'FEA',
      'ANG',
      'EQU',
      { shipDefId: 'DES', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'EQU', 'ANG'] },
    ],
    endLoop: ['FEA'],
    fallbacks: {
      default: ['FEA', 'ANG', 'WIS', 'FAM'],
      defensive: ['FEA', 'WIS', 'FAM'],
      aggressive: ['ANG', 'FEA'],
    },
  },
  chargePolicy: {
    WIS: WIS_DEFAULT,
    FAM: FAM_DEFAULT,
  },
  targetPolicy: {
    EQU: { mode: 'highest_shared_cost_pair' },
  },
  dicePolicy: {
    KNO: { mode: 'reroll_odd_hold_even' },
  },
};

const CEN_GREED_DOM_PLAN: AuthoredBotPlan = {
  id: 'cen_greed_dom',
  name: 'Greed DOM',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'VIG',
      'VIG',
      'LEG',
      'FEA',
      'ANG',
      'ANG',
      { shipDefId: 'POW', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] },
      'VIG',
      'FEA',
      'ANG',
      'ANG',
      { shipDefId: 'POW', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG', 'VIG'] },
      'VIG',
      'VIG',
      'FAM',
      'FAM',
      'FEA',
      { shipDefId: 'DOM', saveUntilAffordable: true, fallbackShipDefIds: ['FAM', 'FEA', 'LEG', 'VIG'] },
      'LEG',
      'FEA',
      'FEA',
      'ANG',
      'EQU',
      { shipDefId: 'DES', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'EQU', 'ANG'] },
      'WIS',
      'FAM',
      { shipDefId: 'KNO', saveUntilAffordable: true, fallbackShipDefIds: ['WIS', 'FAM', 'FEA'] },
    ],
    endLoop: ['FEA'],
    fallbacks: {
      default: ['FEA', 'FAM', 'ANG'],
      defensive: ['FAM', 'FEA', 'WIS'],
      aggressive: ['ANG', 'FEA', 'FAM'],
    },
  },
  chargePolicy: {
    WIS: WIS_DEFAULT,
    FAM: FAM_SUSTAIN,
  },
  targetPolicy: {
    DOM: { mode: 'highest_cost_basic' },
    EQU: { mode: 'highest_shared_cost_pair' },
  },
  dicePolicy: {
    KNO: { mode: 'reroll_odd_hold_even' },
  },
};

const CEN_REDEMPTION_PLAN: AuthoredBotPlan = {
  id: 'cen_redemption',
  name: 'Redemption',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'VIG',
      'VIG',
      'VIG',
      'WIS',
      'WIS',
      'WIS',
      { shipDefId: 'RED', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG'] },
      'WIS',
      'WIS',
      'WIS',
      { shipDefId: 'RED', saveUntilAffordable: true, fallbackShipDefIds: ['FEA', 'ANG'] },
    ],
    endLoop: [
      { shipDefId: 'TER', saveUntilAffordable: true },
      { shipDefId: 'FUR', saveUntilAffordable: true },
    ],
    fallbacks: {
      default: ['WIS', 'FEA', 'ANG'],
      defensive: ['WIS', 'FEA'],
      aggressive: ['ANG', 'WIS'],
    },
  },
  chargePolicy: {
    WIS: WIS_AGGRESSIVE,
  },
};

const CEN_FAMILY_PRESSURE_DOM_PLAN: AuthoredBotPlan = {
  id: 'cen_family_pressure_dom',
  name: 'Family Pressure DOM',
  speciesId: 'CEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'VIG',
      'VIG',
      'LEG',
      'ANG',
      'ANG',
      { shipDefId: 'FUR', saveUntilAffordable: true },
      'FEA',
      'ANG',
      'WIS',
      'FAM',
      'FAM',
      { shipDefId: 'DOM', saveUntilAffordable: true, fallbackShipDefIds: ['FAM', 'FEA', 'LEG', 'VIG'] },
      'VIG',
      'LEG',
      'FEA',
      'FAM',
      'FAM',
      { shipDefId: 'DOM', saveUntilAffordable: true, fallbackShipDefIds: ['FAM', 'FEA', 'LEG', 'VIG'] },
      'VIG',
      'LEG',
      'FEA',
    ],
    endLoop: ['FAM', 'FUR'],
    fallbacks: {
      default: ['FAM', 'FEA', 'WIS'],
      defensive: ['FAM', 'WIS', 'FEA'],
      aggressive: ['FAM', 'ANG'],
    },
  },
  chargePolicy: {
    WIS: WIS_DEFAULT,
    FAM: FAM_AGGRESSIVE,
  },
  targetPolicy: {
    DOM: { mode: 'highest_cost_basic' },
  },
};

// Order is deliberate: deterministic chooser selection hashes into this array by index.
export const ACTIVE_CENTAUR_BOT_PLANS: AuthoredBotPlan[] = [
  CEN_VIGOR_POWER_DESTRUCTION_PLAN,
  CEN_FURY_RUSH_PLAN,
  CEN_VIGOR_LEGACY_FURY_PLAN,
  CEN_FAMILY_AGGRO_PLAN,
  CEN_GREED_KNO_DES_PLAN,
  CEN_GREED_DOM_PLAN,
  CEN_REDEMPTION_PLAN,
  CEN_FAMILY_PRESSURE_DOM_PLAN,
];

const CENTAUR_BOT_PLAN_LOOKUP_POOL: AuthoredBotPlan[] = ACTIVE_CENTAUR_BOT_PLANS;

function hashSeed(seed: string): number {
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export function getCentaurBotPlanById(planId: string): AuthoredBotPlan | null {
  return CENTAUR_BOT_PLAN_LOOKUP_POOL.find((plan) => plan.id === planId) ?? null;
}

export function chooseDeterministicCentaurBotPlanId(seed: string): BotPlanId {
  if (ACTIVE_CENTAUR_BOT_PLANS.length === 0) {
    throw new Error('No Centaur bot plans are registered.');
  }

  const planIndex = hashSeed(seed) % ACTIVE_CENTAUR_BOT_PLANS.length;
  return ACTIVE_CENTAUR_BOT_PLANS[planIndex].id;
}
