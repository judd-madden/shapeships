import type { AuthoredBotPlan, BotPlanId } from './botTypes.ts';

const HUMAN_DEFENSE_ORBIT_PLAN: AuthoredBotPlan = {
  id: 'hum_defense_orbit',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'DEF', targetCount: 2 },
    { shipDefId: 'FIG', targetCount: 2 },
    { shipDefId: 'ORB', targetCount: 1 },
    { shipDefId: 'DEF', targetCount: 2 },
    { shipDefId: 'FIG', targetCount: 2 },
    { shipDefId: 'ORB', targetCount: 1 },
    { shipDefId: 'BAT', targetCount: 4},
  ],
  loopGoals: [    
    { shipDefId: 'DEF', targetCount: 99 },
    { shipDefId: 'FIG', targetCount: 99 },
  ],
  notes: 'Weak beginner Human shell into four Battlecruiser, then Defender overbuild.',
};

const HUMAN_TACTICAL_DREAD_PLAN: AuthoredBotPlan = {
  id: 'hum_tactical_dread',
  speciesId: 'HUM',
  buildGoals: [
  { shipDefId: 'CAR', targetCount: 2, saveUntilAffordable: true },
  { shipDefId: 'COM', targetCount: 1 },
  { shipDefId: 'DEF', targetCount: 2 },
  { shipDefId: 'GUA', targetCount: 1 },
  { shipDefId: 'COM', targetCount: 1 },
  { shipDefId: 'DEF', targetCount: 2 },
  { shipDefId: 'FIG', targetCount: 3 },

  { shipDefId: 'DRE', targetCount: 1 },
],
  loopGoals: [
    { shipDefId: 'CAR', targetCount: 99 },
    { shipDefId: 'COM', targetCount: 99 },
    { shipDefId: 'FIG', targetCount: 99 },
  ],
  shipsThatBuild: {
    CAR: {
      priorityGoals: [
        { choiceId: 'defender', targetShipDefId: 'DEF', targetCount: 2 },
        { choiceId: 'fighter', targetShipDefId: 'FIG', targetCount: 3 },
      ],
      fallbackChoiceId: 'fighter',
    },
  },
  targetPolicy: {
    GUA: {
      mode: 'highest_cost_basic',
    },
  },
  notes: 'Legacy manual/debug plan for the tactical dread line.',
};

const HUMAN_ORBITAL_CARRIER_TACTICAL_PLAN: AuthoredBotPlan = {
  id: 'hum_orbital_carrier_tactical',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'ORB', targetCount: 1 },
    { shipDefId: 'CAR', targetCount: 3 },
    { shipDefId: 'TAC', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'INT', targetCount: 1 },
    { shipDefId: 'FRI', targetCount: 1 },
  ],
  loopGoals: [
    { shipDefId: 'CAR', targetCount: 5 },
    { shipDefId: 'TAC', targetCount: 99 },
  ],
  shipsThatBuild: {
    CAR: {
      priorityGoals: [
        { choiceId: 'defender', targetShipDefId: 'DEF', targetCount: 2 },
        { choiceId: 'fighter', targetShipDefId: 'FIG', targetCount: 2 },
      ],
      fallbackChoiceId: 'defender',
    },
  },
  chargePolicy: {
    INT: {
      preferDamageWhen: 'default',
      healSelfAtOrBelow: 10,
      damageOpponentAtOrBelow: 10,
    },
  },
  frigatePolicy: {
    FRI: {
      firstChoiceMode: 'match_current_roll',
      additionalChoiceMode: 'stack_existing',
    },
  },
  notes: 'Legacy manual/debug plan for the tactical carrier line.',
};

const HUMAN_CARRIER_COMMANDER_AGGRO_PLAN: AuthoredBotPlan = {
  id: 'hum_carrier_commander_aggro',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'CAR', targetCount: 4, saveUntilAffordable: true  },
    { shipDefId: 'COM', targetCount: 4 },
  ],
  loopGoals: [{ shipDefId: 'FIG', targetCount: 99 }],
  shipsThatBuild: {
    CAR: {
      fallbackChoiceId: 'fighter',
    },
  },
  notes: 'Fast Human aggro: Carrier Fighters, Commander scaling, then Fighter flood.',
};

const HUMAN_CARRIER_COMMANDER_SOFT_DEF_OPEN_PLAN: AuthoredBotPlan = {
  id: 'hum_carrier_commander_soft_def_open',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'DEF', targetCount: 1 },
    { shipDefId: 'CAR', targetCount: 4 , saveUntilAffordable: true },
    { shipDefId: 'COM', targetCount: 3 },
    { shipDefId: 'FIG', targetCount: 6 },
  ],
  loopGoals: [{ shipDefId: 'FIG', targetCount: 99 }],
  shipsThatBuild: {
    CAR: {
      fallbackChoiceId: 'fighter',
    },
  },
  notes: 'Softer Carrier/Commander opener with one Defender before aggro.',
};

const HUMAN_CARRIER_COMMANDER_SOFT_FIG_OPEN_PLAN: AuthoredBotPlan = {
  id: 'hum_carrier_commander_soft_fig_open',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'FIG', targetCount: 1 },
    { shipDefId: 'CAR', targetCount: 4 , saveUntilAffordable: true },
    { shipDefId: 'COM', targetCount: 3 },
    { shipDefId: 'FIG', targetCount: 6 },
  ],
  loopGoals: [{ shipDefId: 'FIG', targetCount: 99 }],
  shipsThatBuild: {
    CAR: {
      fallbackChoiceId: 'fighter',
    },
  },
  notes: 'Softer Carrier/Commander opener with one Fighter before aggro.',
};

const HUMAN_ORBITAL_CARRIER_EARTHSHIP_SHELL_PLAN: AuthoredBotPlan = {
  id: 'hum_orbital_carrier_earthship_shell',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'ORB', targetCount: 2 },
    { shipDefId: 'CAR', targetCount: 2 },
    { shipDefId: 'ORB', targetCount: 3 },
    { shipDefId: 'CAR', targetCount: 6 },
    { shipDefId: 'EAR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'CAR', targetCount: 8 },
    { shipDefId: 'EAR', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [{ shipDefId: 'CAR', targetCount: 99 }],
  shipsThatBuild: {
    CAR: {
      fallbackChoiceId: 'defender',
    },
  },
  notes: 'Greedy Orbital/Carrier shell into Earth Ships; all Carriers build Defenders.',
};

const HUMAN_ORBITAL_CARRIER_SCIENCE_SHELL_PLAN: AuthoredBotPlan = {
  id: 'hum_orbital_carrier_science_shell',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'ORB', targetCount: 3 },
    { shipDefId: 'CAR', targetCount: 6 },
    { shipDefId: 'FIG', targetCount: 1 },
    { shipDefId: 'STA', targetCount: 1 },
    { shipDefId: 'SCI', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'EAR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'CAR', targetCount: 8 },
    { shipDefId: 'FIG', targetCount: 1 },
    { shipDefId: 'STA', targetCount: 1 },
    { shipDefId: 'SCI', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'EAR', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [{ shipDefId: 'CAR', targetCount: 1 }],
  shipsThatBuild: {
    CAR: {
      fallbackChoiceId: 'defender',
    },
  },
  notes:
    'Safer Orbital/Carrier shell with Science Vessel stabilizer before Earth Ship pressure.',
};

// Order is deliberate: deterministic chooser selection hashes into this array by index.
export const ACTIVE_HUMAN_BOT_PLANS: AuthoredBotPlan[] = [
  HUMAN_DEFENSE_ORBIT_PLAN,
  HUMAN_CARRIER_COMMANDER_SOFT_DEF_OPEN_PLAN,
  HUMAN_TACTICAL_DREAD_PLAN,
  HUMAN_ORBITAL_CARRIER_EARTHSHIP_SHELL_PLAN,
  HUMAN_CARRIER_COMMANDER_SOFT_FIG_OPEN_PLAN,
  HUMAN_CARRIER_COMMANDER_AGGRO_PLAN,
  HUMAN_ORBITAL_CARRIER_TACTICAL_PLAN,
  HUMAN_ORBITAL_CARRIER_SCIENCE_SHELL_PLAN,
];

const HUMAN_BOT_PLAN_LOOKUP_POOL: AuthoredBotPlan[] = [
  HUMAN_DEFENSE_ORBIT_PLAN,
  HUMAN_TACTICAL_DREAD_PLAN,
  HUMAN_ORBITAL_CARRIER_TACTICAL_PLAN,
  HUMAN_CARRIER_COMMANDER_SOFT_DEF_OPEN_PLAN,
  HUMAN_CARRIER_COMMANDER_SOFT_FIG_OPEN_PLAN,
  HUMAN_CARRIER_COMMANDER_AGGRO_PLAN,
  HUMAN_ORBITAL_CARRIER_EARTHSHIP_SHELL_PLAN,
  HUMAN_ORBITAL_CARRIER_SCIENCE_SHELL_PLAN,
];

function hashSeed(seed: string): number {
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export function getHumanBotPlanById(planId: string): AuthoredBotPlan | null {
  return HUMAN_BOT_PLAN_LOOKUP_POOL.find((plan) => plan.id === planId) ?? null;
}

function getUniformRandomIndex(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error('maxExclusive must be a positive integer.');
  }

  const maxUint32 = 0x1_0000_0000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const randomBuffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(randomBuffer);
    const value = randomBuffer[0] ?? 0;
    if (value < limit) {
      return value % maxExclusive;
    }
  }
}

export function chooseFreshHumanBotPlanId(previousPlanId?: string | null): BotPlanId {
  if (ACTIVE_HUMAN_BOT_PLANS.length === 0) {
    throw new Error('No Human bot plans are registered.');
  }

  const candidatePlans =
    typeof previousPlanId === 'string' &&
    previousPlanId.length > 0 &&
    ACTIVE_HUMAN_BOT_PLANS.length > 1
      ? ACTIVE_HUMAN_BOT_PLANS.filter((plan) => plan.id !== previousPlanId)
      : ACTIVE_HUMAN_BOT_PLANS;

  const selectedPlan = candidatePlans[getUniformRandomIndex(candidatePlans.length)];
  if (!selectedPlan) {
    throw new Error('Failed to select a Human bot plan.');
  }

  return selectedPlan.id;
}

export function chooseDeterministicHumanBotPlanId(seed: string): BotPlanId {
  if (ACTIVE_HUMAN_BOT_PLANS.length === 0) {
    throw new Error('No Human bot plans are registered.');
  }

  const planIndex = hashSeed(seed) % ACTIVE_HUMAN_BOT_PLANS.length;
  return ACTIVE_HUMAN_BOT_PLANS[planIndex].id;
}
