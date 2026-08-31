export type BotSpeciesId = 'HUM' | 'XEN' | 'CEN' | 'ANC';

export type BotPlanId = string;

export type BotBuildGoal = {
  shipDefId: string;
  targetCount: number;
  saveUntilAffordable?: boolean;
};

export type BotAdaptiveBuildRule = {
  shipDefId: string;
  targetCount: number;
  selfHealthAtOrBelow?: number;
  opponentHealthAtOrBelow?: number;
  saveUntilAffordable?: boolean;
  placement?: 'before_plan' | 'after_ordered_opening';
};

export type BuildGoal = BotBuildGoal;

export type OrderedBotCommittedGroupBranch = {
  branchId: string;
  shipDefId: string;
  count: number;
};

export type OrderedBotCommittedHealthGroup = {
  groupKey: string;
  selfHealthBelow: number;
  below: OrderedBotCommittedGroupBranch;
  atOrAbove: OrderedBotCommittedGroupBranch;
  repeat?: boolean;
  completionWitnessShipDefId?: string;
};

export type OrderedBotProgressGate = {
  progressGate: 'simulacrum_opening_complete';
};

export type OrderedBotBuildStep =
  | string
  | {
      shipDefId: string;
      saveUntilAffordable?: boolean;
      fallbackShipDefIds?: string[];
    }
  | {
      committedHealthGroup: OrderedBotCommittedHealthGroup;
    }
  | OrderedBotProgressGate;

export type OrderedBotEndLoopStep =
  | OrderedBotBuildStep
  | {
      firstAffordableShipDefIds: string[];
      targetCountByShipDefId?: Record<string, number>;
      fallbackShipDefIdWhenCandidatesComplete?: string;
    };

export type OrderedBotBuildFallbacks = {
  default?: string[];
  defensive?: string[];
  aggressive?: string[];
};

export type OrderedBotEvolverConversionPlan = {
  mode: 'when_available';
  choiceOrder: Array<'oxite' | 'asterite'>;
  maxConversionsPerTurn?: number;
};

export type OrderedBotBuildPlan = {
  buildOrder: OrderedBotBuildStep[];
  endLoop?: OrderedBotEndLoopStep[];
  endLoopProgress?: 'fleet_counts';
  fallbacks?: OrderedBotBuildFallbacks;
  manualBridgeLimits?: Partial<Record<string, number>>;
  evolverConversions?: OrderedBotEvolverConversionPlan;
};

export type CarrierChoiceId = 'defender' | 'fighter' | 'hold';
export type DamageHealChoiceId = 'damage' | 'heal';
export type InterceptorChoiceId = DamageHealChoiceId;
export type DamageHealChargeShipDefId = 'INT' | 'ANT' | 'WIS' | 'FAM';
export type FrigateFirstChoiceMode = 'match_current_roll' | 'fixed';
export type FrigateAdditionalChoiceMode = 'stack_existing' | 'spread_sequence';

export type CarrierPriorityGoal = {
  choiceId: Exclude<CarrierChoiceId, 'hold'>;
  targetShipDefId: 'DEF' | 'FIG';
  targetCount: number;
};

export type CarrierDrawingPreludePolicy =
  | {
      mode?: 'priority';
      priorityGoals?: CarrierPriorityGoal[];
      fallbackChoiceId?: CarrierChoiceId;
    }
  | {
      mode: 'deterministic_seeded_legal_choice';
    };

export type DamageHealChargePolicy = {
  preferDamageWhen?: 'default';
  healSelfAtOrBelow?: number;
  damageOpponentAtOrBelow?: number;
};

export type DamageHealChargePolicyMap = Partial<
  Record<DamageHealChargeShipDefId, DamageHealChargePolicy>
>;

export type InterceptorChargePolicy = DamageHealChargePolicy;

export type GuardianTargetMode = 'highest_cost_basic';
export type HighestCostBasicTargetMode = 'highest_cost_basic';
export type EqualityTargetMode =
  | 'highest_shared_cost_pair'
  | 'lowest_shared_cost_pair';
export type KnowledgeDiceMode = 'reroll_odd_hold_even';
export type EvolverChoiceOrderId = 'oxite' | 'asterite';

export type EvolverPolicy = {
  choiceOrder: EvolverChoiceOrderId[];
  maxConversionsPerTurn?: number;
};

export type FrigateTriggerPolicy = {
  firstChoiceMode: FrigateFirstChoiceMode;
  fixedTrigger?: number;
  additionalChoiceMode?: FrigateAdditionalChoiceMode;
  spreadSequence?: number[];
};

export type QuantumMysticSelectionMode = 'fixed_6' | 'match_effective_dice';

export type QuantumMysticSelectionPolicy = {
  mode: QuantumMysticSelectionMode;
};

export type CommittedBotBuildGroupProgress = {
  planId: BotPlanId;
  groupKey: string;
  branchId: string;
  shipDefId: string;
  startingCount: number;
  targetCount: number;
};

export type AncientSimulacrumBotProgress = {
  strategyId: BotPlanId;
  completedGoalCount: number;
  openingComplete: boolean;
};

export type BotPlanProgress = {
  committedBuildGroup?: CommittedBotBuildGroupProgress;
  simulacrum?: AncientSimulacrumBotProgress;
};

export type SeatController =
  | { kind: 'human' }
  | {
      kind: 'bot';
      speciesId: BotSpeciesId | null;
      chosenPlanId: BotPlanId | null;
      planProgress?: BotPlanProgress;
    };

export type AuthoredBotPlan = {
  id: BotPlanId;
  name?: string;
  speciesId: BotSpeciesId;
  buildGoals: BotBuildGoal[];
  loopGoals?: BotBuildGoal[];
  adaptiveBuildRules?: BotAdaptiveBuildRule[];
  orderedBuildPlan?: OrderedBotBuildPlan;
  drawingPrelude?: {
    CAR?: CarrierDrawingPreludePolicy;
  };
  chargePolicy?: DamageHealChargePolicyMap;
  frigatePolicy?: {
    FRI?: FrigateTriggerPolicy;
  };
  quantumMysticPolicy?: {
    QUA?: QuantumMysticSelectionPolicy;
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
    SPI?: {
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
  opportunisticForeignUpgrades?: {
    mode: 'highest_total_line_cost';
  };
  notes?: string;
};
