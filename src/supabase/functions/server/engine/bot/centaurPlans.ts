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

const CEN_VIG_POWER_FAMILY_DES_PLAN: AuthoredBotPlan = {
  id: 'cen_vig_power_family_des',
  name: 'Vigor Power Family Destruction',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'VIG', targetCount: 2 },
    { shipDefId: 'FEA', targetCount: 1 },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'POW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'EQU', targetCount: 1 },
    { shipDefId: 'DES', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'POW', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'FEA', targetCount: 1 },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'POW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'DES', targetCount: 1, saveUntilAffordable: true },
  ],
  chargePolicy: {
    WIS: WIS_DEFAULT,
    FAM: FAM_DEFAULT,
  },
  targetPolicy: {
    EQU: {
      mode: 'highest_shared_cost_pair',
    },
  },
  notes: 'Battlelog-derived Vigor economy into Ark of Power and Ark of Destruction.',
};

const CEN_LOWTECH_FURY_RUSH_PLAN: AuthoredBotPlan = {
  id: 'cen_lowtech_fury_rush',
  name: 'Low Tech Fury Rush',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'FUR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANG', targetCount: 4 },
    { shipDefId: 'FUR', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANG', targetCount: 6 },
  ],
  loopGoals: [
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'FUR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
  ],
  chargePolicy: {
    WIS: WIS_AGGRESSIVE,
    FAM: FAM_AGGRESSIVE,
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived low-tech Anger and Fury rush with aggressive charge spending.',
};

const CEN_VIG_LEGACY_FURY_PLAN: AuthoredBotPlan = {
  id: 'cen_vig_legacy_fury',
  name: 'Vigor Legacy Fury',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'FUR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 2 },
    { shipDefId: 'ANG', targetCount: 4 },
    { shipDefId: 'FUR', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'FUR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
  ],
  chargePolicy: {
    WIS: WIS_DEFAULT,
    FAM: FAM_AGGRESSIVE,
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived Vigor opener with Legacy and Fury pressure.',
};

const CEN_EQU_DES_RUSH_PLAN: AuthoredBotPlan = {
  id: 'cen_equ_des_rush',
  name: 'Equality Destruction Rush',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'EQU', targetCount: 1 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FEA', targetCount: 2 },
    { shipDefId: 'ANG', targetCount: 1 },
    { shipDefId: 'EQU', targetCount: 2 },
    { shipDefId: 'DES', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'EQU', targetCount: 1 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FEA', targetCount: 2 },
    { shipDefId: 'ANG', targetCount: 1 },
    { shipDefId: 'DES', targetCount: 1, saveUntilAffordable: true },
  ],
  chargePolicy: {
    WIS: WIS_DEFAULT,
    FAM: FAM_DEFAULT,
  },
  targetPolicy: {
    EQU: {
      mode: 'highest_shared_cost_pair',
    },
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived Equality line into Ark of Destruction.',
};

const CEN_FAMILY_WIS_KNO_PLAN: AuthoredBotPlan = {
  id: 'cen_family_wis_kno',
  name: 'Family Wisdom Knowledge',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 3 },
    { shipDefId: 'RED', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FAM', targetCount: 2 },
    { shipDefId: 'KNO', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 2 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'WIS', targetCount: 3 },
    { shipDefId: 'RED', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 1 },
  ],
  chargePolicy: {
    WIS: WIS_SUSTAIN,
    FAM: FAM_SUSTAIN,
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived Wisdom and Family sustain line with Knowledge support.',
};

const CEN_TERROR_POWER_MIDRANGE_PLAN: AuthoredBotPlan = {
  id: 'cen_terror_power_midrange',
  name: 'Terror Power Midrange',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'FEA', targetCount: 2 },
    { shipDefId: 'TER', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'POW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 2 },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'TER', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'FEA', targetCount: 2 },
    { shipDefId: 'TER', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'POW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
  ],
  chargePolicy: {
    WIS: WIS_SUSTAIN,
    FAM: FAM_DEFAULT,
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived Terror and Power midrange line.',
};

const CEN_DOM_CONTROL_PLAN: AuthoredBotPlan = {
  id: 'cen_dom_control',
  name: 'Domination Control',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 2 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FEA', targetCount: 1 },
    { shipDefId: 'DOM', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 3 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 2 },
    { shipDefId: 'DOM', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'FAM', targetCount: 2 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FEA', targetCount: 1 },
    { shipDefId: 'DOM', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
  ],
  chargePolicy: {
    FAM: FAM_SUSTAIN,
    WIS: WIS_SUSTAIN,
  },
  targetPolicy: {
    DOM: {
      mode: 'highest_cost_basic',
    },
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived Domination control line with post-Domination Knowledge support.',
};

const CEN_REDEMPTION_WIS_PLAN: AuthoredBotPlan = {
  id: 'cen_redemption_wis',
  name: 'Redemption Wisdom',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'WIS', targetCount: 3 },
    { shipDefId: 'RED', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 2 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 6 },
    { shipDefId: 'RED', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'WIS', targetCount: 3 },
    { shipDefId: 'RED', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 1 },
  ],
  chargePolicy: {
    WIS: WIS_SUSTAIN,
    FAM: FAM_DEFAULT,
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived Wisdom-heavy Redemption line.',
};

const CEN_ENTROPY_EQUALITY_PLAN: AuthoredBotPlan = {
  id: 'cen_entropy_equality',
  name: 'Entropy Equality',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'EQU', targetCount: 2 },
    { shipDefId: 'ENT', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'EQU', targetCount: 4 },
    { shipDefId: 'ENT', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'DES', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'EQU', targetCount: 2 },
    { shipDefId: 'ENT', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'WIS', targetCount: 1 },
    { shipDefId: 'FAM', targetCount: 1 },
    { shipDefId: 'KNO', targetCount: 1, saveUntilAffordable: true },
  ],
  chargePolicy: {
    WIS: WIS_DEFAULT,
    FAM: FAM_DEFAULT,
  },
  targetPolicy: {
    EQU: {
      mode: 'highest_shared_cost_pair',
    },
  },
  dicePolicy: {
    KNO: {
      mode: 'reroll_odd_hold_even',
    },
  },
  notes: 'Battlelog-derived Equality line into Entropy and late Destruction.',
};

const CEN_FEAR_POWER_FLOOD_PLAN: AuthoredBotPlan = {
  id: 'cen_fear_power_flood',
  name: 'Fear Power Flood',
  speciesId: 'CEN',
  buildGoals: [
    { shipDefId: 'VIG', targetCount: 1 },
    { shipDefId: 'FEA', targetCount: 2 },
    { shipDefId: 'TER', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'POW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FEA', targetCount: 4 },
    { shipDefId: 'TER', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'VIG', targetCount: 2 },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'DOM', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'FEA', targetCount: 2 },
    { shipDefId: 'TER', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANG', targetCount: 2 },
    { shipDefId: 'POW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'LEG', targetCount: 1, saveUntilAffordable: true },
  ],
  targetPolicy: {
    DOM: {
      mode: 'highest_cost_basic',
    },
  },
  notes: 'Battlelog-derived Fear and Power flood with late Domination.',
};

// Order is deliberate: deterministic chooser selection hashes into this array by index.
export const ACTIVE_CENTAUR_BOT_PLANS: AuthoredBotPlan[] = [
  CEN_VIG_POWER_FAMILY_DES_PLAN,
  CEN_LOWTECH_FURY_RUSH_PLAN,
  CEN_VIG_LEGACY_FURY_PLAN,
  CEN_EQU_DES_RUSH_PLAN,
  CEN_FAMILY_WIS_KNO_PLAN,
  CEN_TERROR_POWER_MIDRANGE_PLAN,
  CEN_DOM_CONTROL_PLAN,
  CEN_REDEMPTION_WIS_PLAN,
  CEN_ENTROPY_EQUALITY_PLAN,
  CEN_FEAR_POWER_FLOOD_PLAN,
];

const CENTAUR_BOT_PLAN_LOOKUP_POOL: AuthoredBotPlan[] = [
  CEN_VIG_POWER_FAMILY_DES_PLAN,
  CEN_LOWTECH_FURY_RUSH_PLAN,
  CEN_VIG_LEGACY_FURY_PLAN,
  CEN_EQU_DES_RUSH_PLAN,
  CEN_FAMILY_WIS_KNO_PLAN,
  CEN_TERROR_POWER_MIDRANGE_PLAN,
  CEN_DOM_CONTROL_PLAN,
  CEN_REDEMPTION_WIS_PLAN,
  CEN_ENTROPY_EQUALITY_PLAN,
  CEN_FEAR_POWER_FLOOD_PLAN,
];

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
