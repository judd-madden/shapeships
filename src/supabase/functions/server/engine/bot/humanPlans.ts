import type { AuthoredBotPlan, BotPlanId } from './botTypes.ts';

const HUMAN_DEFENSE_ORBIT_COMPAT_PLAN: AuthoredBotPlan = {
  id: 'hum_defense_orbit',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'DEF', targetCount: 2 },
    { shipDefId: 'FIG', targetCount: 2 },
    { shipDefId: 'ORB', targetCount: 1 },
    { shipDefId: 'BAT', targetCount: 1, saveUntilAffordable: true },
  ],
  notes: 'Legacy defensive opener kept lookup-valid for compatibility and debugging.',
};

const HUMAN_TACTICAL_DREAD_PLAN: AuthoredBotPlan = {
  id: 'hum_tactical_dread',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'CAR', targetCount: 2 },
    { shipDefId: 'COM', targetCount: 1 },
    { shipDefId: 'DRE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'FIG', targetCount: 4 },
  ],
  shipsThatBuild: {
    CAR: {
      priorityGoals: [
        { choiceId: 'fighter', targetShipDefId: 'FIG', targetCount: 3 },
        { choiceId: 'defender', targetShipDefId: 'DEF', targetCount: 2 },
      ],
      fallbackChoiceId: 'fighter',
    },
  },
  notes: 'Carrier-led Dread opener that leans on early Fighters before rounding out Defenders.',
};

const HUMAN_ORBITAL_CARRIER_TACTICAL_PLAN: AuthoredBotPlan = {
  id: 'hum_orbital_carrier_tactical',
  speciesId: 'HUM',
  buildGoals: [
    { shipDefId: 'ORB', targetCount: 1 },
    { shipDefId: 'CAR', targetCount: 2 },
    { shipDefId: 'TAC', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ORB', targetCount: 2 },
    { shipDefId: 'CAR', targetCount: 3 },
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
  notes: 'Orbital and Carrier ramp into Tactical Cruiser first, then widen back into more economy and Carrier scaling.',
};

export const ACTIVE_HUMAN_BOT_PLANS: AuthoredBotPlan[] = [
  HUMAN_TACTICAL_DREAD_PLAN,
  HUMAN_ORBITAL_CARRIER_TACTICAL_PLAN,
];

const HUMAN_BOT_PLAN_LOOKUP_POOL: AuthoredBotPlan[] = [
  HUMAN_DEFENSE_ORBIT_COMPAT_PLAN,
  ...ACTIVE_HUMAN_BOT_PLANS,
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

export function chooseDeterministicHumanBotPlanId(seed: string): BotPlanId {
  if (ACTIVE_HUMAN_BOT_PLANS.length === 0) {
    throw new Error('No Human bot plans are registered.');
  }

  const planIndex = hashSeed(seed) % ACTIVE_HUMAN_BOT_PLANS.length;
  return ACTIVE_HUMAN_BOT_PLANS[planIndex].id;
}
