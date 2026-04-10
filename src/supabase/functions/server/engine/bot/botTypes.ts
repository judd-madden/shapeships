export type BotSpeciesId = 'HUM';

export type BotPlanId = string;

export type BuildGoal = {
  shipDefId: string;
  targetCount: number;
  saveUntilAffordable?: boolean;
};

export type CarrierChoiceId = 'defender' | 'fighter' | 'hold';

export type CarrierPriorityGoal = {
  choiceId: Exclude<CarrierChoiceId, 'hold'>;
  targetShipDefId: 'DEF' | 'FIG';
  targetCount: number;
};

export type CarrierShipsThatBuildPolicy = {
  priorityGoals?: CarrierPriorityGoal[];
  fallbackChoiceId?: CarrierChoiceId;
};

export type SeatController =
  | { kind: 'human' }
  | { kind: 'bot'; speciesId: BotSpeciesId; chosenPlanId: BotPlanId };

export type AuthoredBotPlan = {
  id: BotPlanId;
  speciesId: BotSpeciesId;
  buildGoals: BuildGoal[];
  shipsThatBuild?: {
    CAR?: CarrierShipsThatBuildPolicy;
  };
  notes?: string;
};
