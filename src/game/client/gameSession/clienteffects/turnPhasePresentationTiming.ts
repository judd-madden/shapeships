import type { TurnPhaseMilestoneId } from '../types';

export const TURN_PHASE_PRESENTATION_TIMING = {
  minimumVisibleMs: {
    diceRoll: 1000,
    drawing: 450,
  },
  movementMs: {
    adjacent: 300,
    twoSteps: 360,
    threeOrMoreSteps: 420,
  },
  movementEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  availabilityFadeMs: 180,
  advanceChevronBlinkMs: 700,
} as const;

const MILESTONE_INDEX: Record<TurnPhaseMilestoneId, number> = {
  dice_roll: 0,
  drawing: 1,
  first_strike: 2,
  charges: 3,
  turn_resolution: 4,
};

export function getTurnPhaseMilestoneIndex(id: TurnPhaseMilestoneId | null): number {
  return id == null ? -1 : MILESTONE_INDEX[id];
}

export function getTurnPhaseMovementDurationMs(
  from: TurnPhaseMilestoneId | null,
  to: TurnPhaseMilestoneId | null
): number {
  const distance = Math.abs(getTurnPhaseMilestoneIndex(to) - getTurnPhaseMilestoneIndex(from));
  if (distance <= 1) return TURN_PHASE_PRESENTATION_TIMING.movementMs.adjacent;
  if (distance === 2) return TURN_PHASE_PRESENTATION_TIMING.movementMs.twoSteps;
  return TURN_PHASE_PRESENTATION_TIMING.movementMs.threeOrMoreSteps;
}
