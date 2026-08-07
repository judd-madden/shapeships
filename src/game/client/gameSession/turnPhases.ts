import type {
  PublicTurnPhaseProgress,
  TurnPhaseMilestoneId,
  TurnPhaseMilestoneVm,
  TurnPhaseVm,
} from './types';

const MILESTONE_SPECS: ReadonlyArray<{
  id: TurnPhaseMilestoneId;
  label: string;
  isMandatory: boolean;
}> = [
  { id: 'dice_roll', label: 'Dice Roll', isMandatory: true },
  { id: 'drawing', label: 'Drawing', isMandatory: true },
  { id: 'first_strike', label: 'First Strike', isMandatory: false },
  { id: 'charges', label: 'Charges / Solar Powers', isMandatory: false },
  { id: 'turn_resolution', label: 'Turn Resolution', isMandatory: true },
];

const PHASE_TO_MILESTONE: Readonly<Record<string, TurnPhaseMilestoneId>> = {
  'build.dice_roll': 'dice_roll',
  'build.line_generation': 'dice_roll',
  'build.drawing': 'drawing',
  'battle.reveal': 'drawing',
  'battle.first_strike': 'first_strike',
  'battle.charge_declaration': 'charges',
  'battle.end_of_turn_resolution': 'turn_resolution',
};

export function deriveTurnPhaseVm(args: {
  phaseKey: string;
  turnNumber: number;
  progress: PublicTurnPhaseProgress | null;
  isFinished: boolean;
  healthResolutionPresentationActive: boolean;
  healthResolutionDisplayTurnNumber?: number | null;
}): TurnPhaseVm {
  const terminalHealthTurn =
    args.isFinished && args.healthResolutionPresentationActive
      ? args.healthResolutionDisplayTurnNumber ?? args.turnNumber
      : null;
  const presentedTurnNumber = terminalHealthTurn ??
    (Number.isInteger(args.turnNumber) && args.turnNumber > 0 ? args.turnNumber : null);
  const currentMilestone = terminalHealthTurn != null
    ? 'turn_resolution'
    : args.isFinished
      ? null
      : PHASE_TO_MILESTONE[args.phaseKey] ?? null;
  const matchingProgress =
    args.progress && args.progress.turnNumber === presentedTurnNumber
      ? args.progress
      : null;

  const milestones: TurnPhaseMilestoneVm[] = MILESTONE_SPECS.map((spec) => {
    if (spec.isMandatory) {
      return {
        ...spec,
        isAvailable: presentedTurnNumber != null,
        hasOccurred: false,
      };
    }

    const status = spec.id === 'first_strike'
      ? matchingProgress?.firstStrike
      : matchingProgress?.charges;
    const hasOccurred = status?.occurred ?? false;
    return {
      ...spec,
      isAvailable: (status?.expected ?? false) || hasOccurred,
      hasOccurred,
    };
  });

  return {
    turnNumber: presentedTurnNumber,
    currentMilestone,
    milestones,
  };
}
