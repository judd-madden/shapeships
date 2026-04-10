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
  loopGoals: [
    { shipDefId: 'FIG', targetCount: 1 },
    { shipDefId: 'COM', targetCount: 1 },
    { shipDefId: 'DEF', targetCount: 1 },
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
    { shipDefId: 'INT', targetCount: 1 },
    { shipDefId: 'TAC', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'DEF', targetCount: 1 },
    { shipDefId: 'FIG', targetCount: 1 },
    { shipDefId: 'TAC', targetCount: 1, saveUntilAffordable: true },
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
  notes: 'Orbital and Carrier anchor into an Interceptor/Tactical opener, then repeat a simple Defender/Fighter/Tactical tail.',
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
