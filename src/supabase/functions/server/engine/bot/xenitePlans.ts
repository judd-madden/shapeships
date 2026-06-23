import type { AuthoredBotPlan, BotPlanId } from './botTypes.ts';

const ANT_DEFAULT = {
  healSelfAtOrBelow: 14,
  damageOpponentAtOrBelow: 12,
};

const ANT_AGGRESSIVE = {
  healSelfAtOrBelow: 10,
  damageOpponentAtOrBelow: 18,
};

const ANT_SUSTAIN = {
  healSelfAtOrBelow: 16,
  damageOpponentAtOrBelow: 10,
};

const XEN_MASS_BUG_BASICS_PLAN: AuthoredBotPlan = {
  id: 'xen_mass_bug_basics',
  name: 'Mass Bug Basics',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: ['BUG', 'EVO', 'BUG', 'MAN', 'BUG', 'BUG', 'MAN', 'MAN', 'HEL', 'HEL', 'HEL'],
    endLoop: ['BUG', 'MAN', 'HEL'],
    evolverConversions: {
      mode: 'when_available',
      choiceOrder: ['asterite', 'oxite'],
      maxConversionsPerTurn: 1,
    },
  },
};

const XEN_CHRONO_QUEEN_STANDARD_PLAN: AuthoredBotPlan = {
  id: 'xen_chrono_queen_standard',
  name: 'Chrono Queen Standard',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'ZEN',
      'BUG',
      'BUG',
      { shipDefId: 'DSW', saveUntilAffordable: true },
      { shipDefId: 'CHR', saveUntilAffordable: true },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['DSW'] },
      'ZEN',
      { shipDefId: 'DSW', saveUntilAffordable: true },
      'ZEN',
      'BUG',
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['DSW'] },
    ],
    endLoop: [
      'ZEN',
      'BUG',
      { shipDefId: 'DSW', saveUntilAffordable: true },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['DSW'] },
      'HEL',
      'HEL',
    ],
    fallbacks: {
      default: ['DSW'],
      defensive: ['DSW'],
      aggressive: ['DSW'],
    },
    manualBridgeLimits: { XEN: 2 },
  },
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
};

const XEN_SAC_DENIAL_PLAN: AuthoredBotPlan = {
  id: 'xen_sac_denial',
  name: 'SAC Denial',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'ZEN',
      'BUG',
      { shipDefId: 'SAC', saveUntilAffordable: true },
      { shipDefId: 'SAC', saveUntilAffordable: true },
      { shipDefId: 'SAC', saveUntilAffordable: true },
      'ZEN',
      { shipDefId: 'SAC', saveUntilAffordable: true },
      { shipDefId: 'AAR', saveUntilAffordable: true, fallbackShipDefIds: ['ANT', 'BUG'] },
    ],
    endLoop: [
      { shipDefId: 'SAC', saveUntilAffordable: true },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['ANT', 'BUG'] },
      'MAN',
      'HEL',
    ],
    fallbacks: {
      default: ['ANT', 'BUG'],
      defensive: ['ANT', 'BUG'],
      aggressive: ['SAC', 'ANT', 'BUG'],
    },
    manualBridgeLimits: { XEN: 2 },
  },
  chargePolicy: {
    ANT: ANT_AGGRESSIVE,
  },
  targetPolicy: {
    SAC: {
      mode: 'highest_cost_basic',
    },
  },
};

const XEN_FACES_PLAN: AuthoredBotPlan = {
  id: 'xen_faces',
  name: 'Faces',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'BUG',
      'EVO',
      { shipDefId: 'OXF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      'EVO',
      { shipDefId: 'OXF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      'BUG',
      'EVO',
      { shipDefId: 'OXF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      'EVO',
      { shipDefId: 'OXF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      'BUG',
      'EVO',
      { shipDefId: 'ASF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      'EVO',
      { shipDefId: 'ASF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      'BUG',
      'EVO',
      { shipDefId: 'ASF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['BUG'] },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['BUG'] },
    ],
    endLoop: [
      'BUG',
      'EVO',
      { shipDefId: 'ASF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
      'EVO',
      { shipDefId: 'OXF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'EVO', 'ZEN'] },
    ],
    fallbacks: {
      default: ['BUG', 'EVO', 'ZEN'],
      defensive: ['BUG', 'ZEN'],
      aggressive: ['BUG', 'EVO'],
    },
    manualBridgeLimits: { XEN: 2 },
  },
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
  evolverPolicy: {
    EVO: {
      choiceOrder: ['oxite', 'oxite', 'asterite'],
      maxConversionsPerTurn: 2,
    },
  },
};

const XEN_QUEEN_NO_CHRONO_PLAN: AuthoredBotPlan = {
  id: 'xen_queen_no_chrono',
  name: 'Queen No Chrono',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'BUG',
      { shipDefId: 'DSW', saveUntilAffordable: true },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['DSW', 'BUG'] },
      { shipDefId: 'DSW', saveUntilAffordable: true },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['DSW', 'BUG'] },
      'MAN',
      'HEL',
      'HEL',
    ],
    endLoop: ['BUG', 'MAN', 'HEL'],
    fallbacks: {
      default: ['DSW', 'BUG'],
      defensive: ['DSW', 'BUG'],
      aggressive: ['BUG', 'HEL'],
    },
    manualBridgeLimits: { XEN: 2 },
  },
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
};

const XEN_HIVE_PLAN: AuthoredBotPlan = {
  id: 'xen_hive',
  name: 'Hive',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'ZEN',
      'BUG',
      'BUG',
      'MAN',
      'MAN',
      'BUG',
      'HEL',
      { shipDefId: 'HVE', saveUntilAffordable: true, fallbackShipDefIds: ['MAN', 'HEL', 'DSW'] },
    ],
    endLoop: ['BUG', 'ZEN'],
    fallbacks: {
      default: ['MAN', 'HEL', 'DSW'],
      defensive: ['DSW', 'MAN', 'ZEN'],
      aggressive: ['HEL', 'MAN', 'BUG'],
    },
    manualBridgeLimits: { XEN: 2 },
  },
  chargePolicy: {
    ANT: ANT_SUSTAIN,
  },
};

const XEN_DOUBLE_CHRONO_QUEEN_PLAN: AuthoredBotPlan = {
  id: 'xen_double_chrono_queen',
  name: 'Double Chrono Queen',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'ZEN',
      'BUG',
      { shipDefId: 'DSW', saveUntilAffordable: true },
      'ZEN',
      'BUG',
      {
        shipDefId: 'CHR',
        saveUntilAffordable: true,
        fallbackShipDefIds: ['BUG', 'ZEN', 'DSW', 'HEL'],
      },
      {
        shipDefId: 'QUE',
        saveUntilAffordable: true,
        fallbackShipDefIds: ['BUG', 'ZEN', 'DSW', 'HEL'],
      },
      { shipDefId: 'DSW', saveUntilAffordable: true },
      'BUG',
      {
        shipDefId: 'CHR',
        saveUntilAffordable: true,
        fallbackShipDefIds: ['BUG', 'ZEN', 'DSW', 'HEL'],
      },
      {
        shipDefId: 'QUE',
        saveUntilAffordable: true,
        fallbackShipDefIds: ['BUG', 'ZEN', 'DSW', 'HEL'],
      },
      'HEL',
      'HEL',
    ],
    endLoop: [
      {
        shipDefId: 'QUE',
        saveUntilAffordable: true,
        fallbackShipDefIds: ['BUG', 'ZEN', 'DSW', 'HEL'],
      },
      { shipDefId: 'DSW', saveUntilAffordable: true },
    ],
    fallbacks: {
      default: ['BUG', 'ZEN', 'DSW', 'HEL'],
      defensive: ['DSW', 'ZEN', 'BUG'],
      aggressive: ['HEL', 'BUG', 'ZEN'],
    },
    manualBridgeLimits: { XEN: 2 },
  },
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
};

const XEN_AGGRO_PLAN: AuthoredBotPlan = {
  id: 'xen_aggro',
  name: 'Aggro',
  speciesId: 'XEN',
  buildGoals: [],
  loopGoals: [],
  orderedBuildPlan: {
    buildOrder: [
      'BUG',
      'EVO',
      'BUG',
      'EVO',
      'BUG',
      { shipDefId: 'AAR', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'ANT', 'MAN', 'HEL'] },
      'BUG',
      'MAN',
      { shipDefId: 'ASF', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'ANT', 'MAN', 'HEL'] },
      { shipDefId: 'QUE', saveUntilAffordable: true, fallbackShipDefIds: ['BUG', 'ANT', 'MAN', 'HEL'] },
    ],
    endLoop: ['BUG'],
    fallbacks: {
      default: ['BUG', 'ANT', 'MAN', 'HEL'],
      defensive: ['MAN', 'BUG', 'ANT'],
      aggressive: ['BUG', 'HEL', 'ANT'],
    },
    manualBridgeLimits: { XEN: 2 },
    evolverConversions: {
      mode: 'when_available',
      choiceOrder: ['asterite'],
      maxConversionsPerTurn: 2,
    },
  },
  chargePolicy: {
    ANT: ANT_AGGRESSIVE,
  },
  evolverPolicy: {
    EVO: {
      choiceOrder: ['asterite'],
      maxConversionsPerTurn: 2,
    },
  },
};

// Order is deliberate: deterministic chooser selection hashes into this array by index.
export const ACTIVE_XENITE_BOT_PLANS: AuthoredBotPlan[] = [
  XEN_MASS_BUG_BASICS_PLAN,
  XEN_CHRONO_QUEEN_STANDARD_PLAN,
  XEN_SAC_DENIAL_PLAN,
  XEN_FACES_PLAN,
  XEN_QUEEN_NO_CHRONO_PLAN,
  XEN_HIVE_PLAN,
  XEN_DOUBLE_CHRONO_QUEEN_PLAN,
  XEN_AGGRO_PLAN,
];

const XENITE_BOT_PLAN_LOOKUP_POOL: AuthoredBotPlan[] = ACTIVE_XENITE_BOT_PLANS;

function hashSeed(seed: string): number {
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  return hash;
}

export function getXeniteBotPlanById(planId: string): AuthoredBotPlan | null {
  return XENITE_BOT_PLAN_LOOKUP_POOL.find((plan) => plan.id === planId) ?? null;
}

export function chooseDeterministicXeniteBotPlanId(seed: string): BotPlanId {
  if (ACTIVE_XENITE_BOT_PLANS.length === 0) {
    throw new Error('No Xenite bot plans are registered.');
  }

  const planIndex = hashSeed(seed) % ACTIVE_XENITE_BOT_PLANS.length;
  return ACTIVE_XENITE_BOT_PLANS[planIndex].id;
}
