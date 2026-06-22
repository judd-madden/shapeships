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

const XEN_ZEN_QUEEN_CHRONO_PLAN: AuthoredBotPlan = {
  id: 'xen_zen_queen_chrono',
  name: 'Zen Queen Chrono',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'ZEN', targetCount: 2 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'CHR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ZEN', targetCount: 3 },
    { shipDefId: 'ANT', targetCount: 4 },
    { shipDefId: 'QUE', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'XEN', targetCount: 4 },
  ],
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
  notes: 'Battlelog-derived Xenite Zenith/Queen line into Chronoswarm support.',
};

const XEN_BUG_ASTERITE_FACE_PLAN: AuthoredBotPlan = {
  id: 'xen_bug_asterite_face',
  name: 'Bug Asterite Face',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'EVO', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 1 },
    { shipDefId: 'ASF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'BUG', targetCount: 2 },
    { shipDefId: 'EVO', targetCount: 2 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'ASF', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'EVO', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'ASF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'BUG', targetCount: 1 },
  ],
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
  evolverPolicy: {
    EVO: {
      choiceOrder: ['asterite'],
      maxConversionsPerTurn: 2,
    },
  },
  notes: 'Battlelog-derived Bug/Evolver line focused on Asterite Face damage.',
};

const XEN_BUG_OXITE_FACE_PLAN: AuthoredBotPlan = {
  id: 'xen_bug_oxite_face',
  name: 'Bug Oxite Face',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'EVO', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 1 },
    { shipDefId: 'OXF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'BUG', targetCount: 2 },
    { shipDefId: 'EVO', targetCount: 2 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'OXF', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'EVO', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'OXF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'BUG', targetCount: 1 },
  ],
  chargePolicy: {
    ANT: ANT_SUSTAIN,
  },
  evolverPolicy: {
    EVO: {
      choiceOrder: ['oxite'],
      maxConversionsPerTurn: 2,
    },
  },
  notes: 'Battlelog-derived Bug/Evolver line focused on Oxite Face sustain.',
};

const XEN_MIXED_FACES_ARRAY_PLAN: AuthoredBotPlan = {
  id: 'xen_mixed_faces_array',
  name: 'Mixed Faces Array',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 1 },
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'EVO', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 3 },
    { shipDefId: 'ASF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'DSW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'OXF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'AAR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANT', targetCount: 5 },
  ],
  loopGoals: [
    { shipDefId: 'EVO', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'ASF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'OXF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ANT', targetCount: 2 },
  ],
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
  evolverPolicy: {
    EVO: {
      choiceOrder: ['asterite', 'oxite'],
      maxConversionsPerTurn: 2,
    },
  },
  notes: 'Battlelog-derived mixed Xenite face plan with Antlion Array pressure.',
};

const XEN_SAC_ZEN_PRESSURE_PLAN: AuthoredBotPlan = {
  id: 'xen_sac_zen_pressure',
  name: 'Sac Zen Pressure',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 1 },
    { shipDefId: 'ZEN', targetCount: 2 },
    { shipDefId: 'ANT', targetCount: 3 },
    { shipDefId: 'SAC', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'CHR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'HEL', targetCount: 1 },
    { shipDefId: 'SAC', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'ANT', targetCount: 6 },
  ],
  loopGoals: [
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'SAC', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'HEL', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 3 },
  ],
  chargePolicy: {
    ANT: ANT_AGGRESSIVE,
  },
  targetPolicy: {
    SAC: {
      mode: 'highest_cost_basic',
    },
  },
  notes: 'Battlelog-derived Zenith pressure plan with Sacrificial Pool targeting.',
};

const XEN_BUG_QUEEN_SWARM_PLAN: AuthoredBotPlan = {
  id: 'xen_bug_queen_swarm',
  name: 'Bug Queen Swarm',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'BUG', targetCount: 2 },
    { shipDefId: 'XEN', targetCount: 5 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'HEL', targetCount: 2 },
    { shipDefId: 'MAN', targetCount: 2 },
    { shipDefId: 'QUE', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 4 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'MAN', targetCount: 1 },
    { shipDefId: 'HEL', targetCount: 1 },
  ],
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
  notes: 'Battlelog-derived Bug Breeder and Queen swarm plan.',
};

const XEN_CHRONO_SWARM_PLAN: AuthoredBotPlan = {
  id: 'xen_chrono_swarm',
  name: 'Chrono Swarm',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 6 },
    { shipDefId: 'CHR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'DSW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ZEN', targetCount: 3 },
    { shipDefId: 'ANT', targetCount: 4 },
    { shipDefId: 'CHR', targetCount: 2, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'CHR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'XEN', targetCount: 4 },
  ],
  chargePolicy: {
    ANT: ANT_AGGRESSIVE,
  },
  notes: 'Battlelog-derived Chronoswarm plan with repeated ships-that-build value.',
};

const XEN_HIVE_LONG_PLAN: AuthoredBotPlan = {
  id: 'xen_hive_long',
  name: 'Hive Long Game',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'BUG', targetCount: 2 },
    { shipDefId: 'EVO', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 4 },
    { shipDefId: 'ASF', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 2 },
    { shipDefId: 'CHR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'SAC', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'DSW', targetCount: 2, saveUntilAffordable: true },
    { shipDefId: 'MAN', targetCount: 2 },
    { shipDefId: 'HEL', targetCount: 2 },
    { shipDefId: 'HVE', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'MAN', targetCount: 1 },
    { shipDefId: 'HEL', targetCount: 1 },
    { shipDefId: 'DSW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'XEN', targetCount: 4 },
  ],
  chargePolicy: {
    ANT: ANT_SUSTAIN,
  },
  targetPolicy: {
    SAC: {
      mode: 'highest_cost_basic',
    },
  },
  evolverPolicy: {
    EVO: {
      choiceOrder: ['asterite', 'oxite'],
      maxConversionsPerTurn: 1,
    },
  },
  notes: 'Battlelog-derived long-game Hive plan with cautious Evolver conversion.',
};

const XEN_ANTLION_ARRAY_PLAN: AuthoredBotPlan = {
  id: 'xen_antlion_array',
  name: 'Antlion Array',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 3 },
    { shipDefId: 'SAC', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'DSW', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'AAR', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'ZEN', targetCount: 3 },
    { shipDefId: 'ANT', targetCount: 8 },
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 3 },
    { shipDefId: 'SAC', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'AAR', targetCount: 1, saveUntilAffordable: true },
  ],
  chargePolicy: {
    ANT: ANT_AGGRESSIVE,
  },
  targetPolicy: {
    SAC: {
      mode: 'highest_cost_basic',
    },
  },
  notes: 'Battlelog-derived Antlion Array plan with aggressive ANT spending.',
};

const XEN_MANTIS_HORNET_QUEEN_PLAN: AuthoredBotPlan = {
  id: 'xen_mantis_hornet_queen',
  name: 'Mantis Hornet Queen',
  speciesId: 'XEN',
  buildGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'XEN', targetCount: 2 },
    { shipDefId: 'ZEN', targetCount: 1 },
    { shipDefId: 'ANT', targetCount: 1 },
    { shipDefId: 'MAN', targetCount: 2 },
    { shipDefId: 'HEL', targetCount: 1 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'MAN', targetCount: 4 },
    { shipDefId: 'HEL', targetCount: 2 },
    { shipDefId: 'CHR', targetCount: 1, saveUntilAffordable: true },
  ],
  loopGoals: [
    { shipDefId: 'BUG', targetCount: 1 },
    { shipDefId: 'MAN', targetCount: 2 },
    { shipDefId: 'HEL', targetCount: 1 },
    { shipDefId: 'QUE', targetCount: 1, saveUntilAffordable: true },
    { shipDefId: 'XEN', targetCount: 3 },
  ],
  chargePolicy: {
    ANT: ANT_DEFAULT,
  },
  notes: 'Battlelog-derived Mantis/Hell Hornet plan with Queen follow-up.',
};

// Order is deliberate: deterministic chooser selection hashes into this array by index.
export const ACTIVE_XENITE_BOT_PLANS: AuthoredBotPlan[] = [
  XEN_ZEN_QUEEN_CHRONO_PLAN,
  XEN_BUG_ASTERITE_FACE_PLAN,
  XEN_BUG_OXITE_FACE_PLAN,
  XEN_MIXED_FACES_ARRAY_PLAN,
  XEN_SAC_ZEN_PRESSURE_PLAN,
  XEN_BUG_QUEEN_SWARM_PLAN,
  XEN_CHRONO_SWARM_PLAN,
  XEN_HIVE_LONG_PLAN,
  XEN_ANTLION_ARRAY_PLAN,
  XEN_MANTIS_HORNET_QUEEN_PLAN,
];

const XENITE_BOT_PLAN_LOOKUP_POOL: AuthoredBotPlan[] = [
  XEN_ZEN_QUEEN_CHRONO_PLAN,
  XEN_BUG_ASTERITE_FACE_PLAN,
  XEN_BUG_OXITE_FACE_PLAN,
  XEN_MIXED_FACES_ARRAY_PLAN,
  XEN_SAC_ZEN_PRESSURE_PLAN,
  XEN_BUG_QUEEN_SWARM_PLAN,
  XEN_CHRONO_SWARM_PLAN,
  XEN_HIVE_LONG_PLAN,
  XEN_ANTLION_ARRAY_PLAN,
  XEN_MANTIS_HORNET_QUEEN_PLAN,
];

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
