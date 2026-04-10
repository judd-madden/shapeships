import type { AuthoredBotPlan, BotPlanId } from './botTypes.ts';

export const HUMAN_BOT_PLANS: AuthoredBotPlan[] = [
  {
    id: 'hum_defense_orbit',
    speciesId: 'HUM',
    buildGoals: [
      { shipDefId: 'DEF', targetCount: 2 },
      { shipDefId: 'FIG', targetCount: 2 },
      { shipDefId: 'ORB', targetCount: 1 },
      { shipDefId: 'BAT', targetCount: 1, saveUntilAffordable: true },
    ],
    notes: 'Stable defensive opener into Orbital and Battleship pressure.',
  },
  {
    id: 'hum_tactical_dread',
    speciesId: 'HUM',
    buildGoals: [
      { shipDefId: 'DEF', targetCount: 1 },
      { shipDefId: 'FIG', targetCount: 1 },
      { shipDefId: 'TAC', targetCount: 1 },
      { shipDefId: 'BAT', targetCount: 1, saveUntilAffordable: true },
      { shipDefId: 'DRE', targetCount: 1, saveUntilAffordable: true },
    ],
    notes: 'Simple counted goals that lead into Tactical and Dreadnought scaling.',
  },
];

function hashSeed(seed: string): number {
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export function getHumanBotPlanById(planId: string): AuthoredBotPlan | null {
  return HUMAN_BOT_PLANS.find((plan) => plan.id === planId) ?? null;
}

export function chooseDeterministicHumanBotPlanId(seed: string): BotPlanId {
  if (HUMAN_BOT_PLANS.length === 0) {
    throw new Error('No Human bot plans are registered.');
  }

  const planIndex = hashSeed(seed) % HUMAN_BOT_PLANS.length;
  return HUMAN_BOT_PLANS[planIndex].id;
}
