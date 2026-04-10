export type BotSpeciesId = 'HUM';

export type BotPlanId = string;

export type BuildGoal = {
  shipDefId: string;
  targetCount: number;
  saveUntilAffordable?: boolean;
};

export type SeatController =
  | { kind: 'human' }
  | { kind: 'bot'; speciesId: BotSpeciesId; chosenPlanId: BotPlanId };

export type AuthoredBotPlan = {
  id: BotPlanId;
  speciesId: BotSpeciesId;
  buildGoals: BuildGoal[];
  notes?: string;
};
