export type BotSpeciesId = 'HUM' | 'XEN' | 'CEN';

export type BotPlanId = string;

export type BotBuildGoal = {
  shipDefId: string;
  targetCount: number;
  saveUntilAffordable?: boolean;
};

export type BuildGoal = BotBuildGoal;

export type CarrierChoiceId = 'defender' | 'fighter' | 'hold';
export type DamageHealChoiceId = 'damage' | 'heal';
export type InterceptorChoiceId = DamageHealChoiceId;
export type DamageHealChargePhase =
  | 'battle.charge_declaration'
  | 'battle.charge_response';
export type FrigateFirstChoiceMode = 'match_current_roll';
export type FrigateAdditionalChoiceMode = 'stack_existing' | 'spread_sequence';

export type CarrierPriorityGoal = {
  choiceId: Exclude<CarrierChoiceId, 'hold'>;
  targetShipDefId: 'DEF' | 'FIG';
  targetCount: number;
};

export type CarrierShipsThatBuildPolicy = {
  priorityGoals?: CarrierPriorityGoal[];
  fallbackChoiceId?: CarrierChoiceId;
};

export type DamageHealChargePolicy = {
  preferDamageWhen?: 'default';
  healSelfAtOrBelow?: number;
  damageOpponentAtOrBelow?: number;
  phases?: DamageHealChargePhase[];
};

export type InterceptorChargePolicy = DamageHealChargePolicy;

export type GuardianTargetMode = 'highest_cost_basic';
export type HighestCostBasicTargetMode = 'highest_cost_basic';
export type EqualityTargetMode = 'highest_shared_cost_pair';
export type KnowledgeDiceMode = 'reroll_odd_hold_even';
export type EvolverChoiceOrderId = 'oxite' | 'asterite';

export type EvolverPolicy = {
  choiceOrder: EvolverChoiceOrderId[];
  maxConversionsPerTurn?: number;
};

export type FrigateTriggerPolicy = {
  firstChoiceMode: FrigateFirstChoiceMode;
  additionalChoiceMode?: FrigateAdditionalChoiceMode;
  spreadSequence?: number[];
};

export type SeatController =
  | { kind: 'human' }
  | { kind: 'bot'; speciesId: BotSpeciesId | null; chosenPlanId: BotPlanId | null };

export type AuthoredBotPlan = {
  id: BotPlanId;
  speciesId: BotSpeciesId;
  buildGoals: BotBuildGoal[];
  loopGoals?: BotBuildGoal[];
  shipsThatBuild?: {
    CAR?: CarrierShipsThatBuildPolicy;
  };
  chargePolicy?: {
    INT?: DamageHealChargePolicy;
    ANT?: DamageHealChargePolicy;
    WIS?: DamageHealChargePolicy;
    FAM?: DamageHealChargePolicy;
  };
  frigatePolicy?: {
    FRI?: FrigateTriggerPolicy;
  };
  targetPolicy?: {
    GUA?: {
      mode: GuardianTargetMode;
    };
    SAC?: {
      mode: HighestCostBasicTargetMode;
    };
    DOM?: {
      mode: HighestCostBasicTargetMode;
    };
    EQU?: {
      mode: EqualityTargetMode;
    };
  };
  dicePolicy?: {
    KNO?: {
      mode: KnowledgeDiceMode;
    };
  };
  evolverPolicy?: {
    EVO?: EvolverPolicy;
  };
  notes?: string;
};
