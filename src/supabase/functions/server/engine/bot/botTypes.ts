export type BotSpeciesId = 'HUM';

export type BotPlanId = string;

export type BotBuildGoal = {
  shipDefId: string;
  targetCount: number;
  saveUntilAffordable?: boolean;
};

export type BuildGoal = BotBuildGoal;

export type CarrierChoiceId = 'defender' | 'fighter' | 'hold';
export type InterceptorChoiceId = 'damage' | 'heal';

export type CarrierPriorityGoal = {
  choiceId: Exclude<CarrierChoiceId, 'hold'>;
  targetShipDefId: 'DEF' | 'FIG';
  targetCount: number;
};

export type CarrierShipsThatBuildPolicy = {
  priorityGoals?: CarrierPriorityGoal[];
  fallbackChoiceId?: CarrierChoiceId;
};

export type InterceptorChargePolicy = {
  preferDamageWhen?: 'default';
  healSelfAtOrBelow?: number;
  damageOpponentAtOrBelow?: number;
};

export type GuardianTargetMode = 'highest_cost_basic';

export type SeatController =
  | { kind: 'human' }
  | { kind: 'bot'; speciesId: BotSpeciesId; chosenPlanId: BotPlanId };

export type AuthoredBotPlan = {
  id: BotPlanId;
  speciesId: BotSpeciesId;
  buildGoals: BotBuildGoal[];
  loopGoals?: BotBuildGoal[];
  shipsThatBuild?: {
    CAR?: CarrierShipsThatBuildPolicy;
  };
  chargePolicy?: {
    INT?: InterceptorChargePolicy;
  };
  targetPolicy?: {
    GUA?: {
      mode: GuardianTargetMode;
    };
  };
  notes?: string;
};
