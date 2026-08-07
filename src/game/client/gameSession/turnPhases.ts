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
  isBootstrapping?: boolean;
  isFinished: boolean;
  displayLeftSpeciesId?: string | null;
  displayRightSpeciesId?: string | null;
  /** @deprecated Presentation ownership now lives in useTurnPhasePresentation. */
  healthResolutionPresentationActive?: boolean;
  /** @deprecated Presentation ownership now lives in useTurnPhasePresentation. */
  healthResolutionDisplayTurnNumber?: number | null;
}): TurnPhaseVm {
  const presentedTurnNumber = Number.isInteger(args.turnNumber) && args.turnNumber > 0
    ? args.turnNumber
    : null;
  const currentMilestone = args.isFinished ? null : PHASE_TO_MILESTONE[args.phaseKey] ?? null;
  const context = args.isBootstrapping
    ? 'bootstrap'
    : args.phaseKey === 'setup.species_selection'
      ? 'species_selection'
      : 'turn';
  const hasAncientPlayer =
    args.displayLeftSpeciesId === 'ancient' || args.displayRightSpeciesId === 'ancient';
  const matchingProgress =
    args.progress && args.progress.turnNumber === presentedTurnNumber
      ? args.progress
      : null;

  const milestones: TurnPhaseMilestoneVm[] = MILESTONE_SPECS.map((spec) => {
    const label = spec.id === 'charges'
      ? hasAncientPlayer ? 'Charges / Solar Powers' : 'Charges'
      : spec.label;
    if (spec.isMandatory) {
      return {
        ...spec,
        label,
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
      label,
      isAvailable: (status?.expected ?? false) || hasOccurred,
      hasOccurred,
    };
  });

  return {
    turnNumber: presentedTurnNumber,
    currentMilestone,
    context,
    milestones,
  };
}
