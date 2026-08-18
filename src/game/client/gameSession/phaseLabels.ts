/**
 * PHASE LABEL HELPERS
 * 
 * Extract human-readable labels from phaseKey strings.
 * Used for HUD, phase cards, and UI display.
 */

// Major phase labels mapping
const MAJOR_PHASE_LABELS: Record<string, string> = {
  'setup': 'SETUP',
  'build': 'BUILD',
  'battle': 'BATTLE',
};

// Subphase label overrides (for special cases)
const SUBPHASE_LABEL_OVERRIDES: Record<string, string> = {
  'setup.species_selection': 'Species Selection',
  'build.dice_roll': 'Dice Roll',
  'build.line_generation': 'Line Generation',
  'build.drawing': 'Drawing',
  'battle.reveal': 'Reveal',
  'battle.first_strike': 'First Strike',
  'battle.charge_declaration': 'Charges',
  'battle.end_of_turn_resolution': 'Turn Resolution',
};

export type RuntimePhaseRow = {
  key: string;
  label: string;
  group: 'build' | 'battle';
};

export const RUNTIME_PHASE_ROWS: readonly RuntimePhaseRow[] = [
  { key: 'build.dice_roll', label: '1 Dice Roll & Dice Manipulation', group: 'build' },
  { key: 'build.line_generation', label: '2 Line Generation', group: 'build' },
  { key: 'build.drawing', label: '3 Drawing', group: 'build' },
  { key: 'battle.reveal', label: '4 Reveal', group: 'battle' },
  { key: 'battle.first_strike', label: '5 First Strike', group: 'battle' },
  { key: 'battle.charge_declaration', label: '6 Charges / Solar Powers', group: 'battle' },
  { key: 'battle.end_of_turn_resolution', label: '7 Turn Resolution', group: 'battle' },
] as const;

// Title case helper
function titleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

/**
 * Extract major phase label from phaseKey
 * Returns "UNKNOWN PHASE" if invalid or during bootstrap
 */
export function getMajorPhaseLabel(phaseKey: string): string {
  // Don't log errors for empty/null/undefined during bootstrap
  if (!phaseKey || phaseKey.length === 0 || phaseKey === 'unknown') {
    return 'UNKNOWN PHASE';
  }
  
  // Extract major phase segment (before first dot)
  const majorSegment = phaseKey.split('.')[0];
  
  // If this is a valid major phase, return the label
  if (majorSegment && MAJOR_PHASE_LABELS[majorSegment]) {
    return `${MAJOR_PHASE_LABELS[majorSegment]} PHASE`;
  }
  
  // Invalid phase key - return safe placeholder
  return 'UNKNOWN PHASE';
}

/**
 * Extract subphase label from phaseKey
 * Returns "Unknown" if invalid or during bootstrap
 */
export function getSubphaseLabelFromPhaseKey(phaseKey: string): string {
  // Don't log errors for empty/null/undefined during bootstrap
  if (!phaseKey || phaseKey.length === 0 || phaseKey === 'unknown') {
    return 'Unknown';
  }
  
  // Check if we have an explicit override
  if (SUBPHASE_LABEL_OVERRIDES[phaseKey]) {
    return SUBPHASE_LABEL_OVERRIDES[phaseKey]!;
  }
  
  // Fallback: extract last segment, title-case, replace underscores
  const segments = phaseKey.split('.');
  const lastSegment = segments[segments.length - 1];
  
  if (!lastSegment) {
    return 'Unknown';
  }
  
  // Replace underscores with spaces and title-case
  return titleCase(lastSegment.replace(/_/g, ' '));
}

export type PhasePresentation = {
  title: string;
  titleSuffix: string | null;
  subheading: string;
};

export function derivePhasePresentation(args: {
  phaseKey: string;
  isFinished: boolean;
  isSpectator: boolean;
  drawingStageKind: 'prelude' | 'normal' | 'submitted' | 'blocked' | 'passive';
  drawingEconomy?: { ordinary: number; joining: number } | null;
  committedDrawingProjection?: { ordinary: number; joining: number } | null;
  requesterIsReady: boolean;
  opponentIsReady: boolean;
  hasAvailableActions: boolean;
  ancientChargeStage?: 'charges' | 'powers' | null;
}): PhasePresentation {
  const blank = '\u00A0';
  const withJoining = (base: string, joining: number): string =>
    joining > 0 ? `${base} +${joining} joining` : base;

  if (args.isFinished) {
    return { title: 'Game Over', titleSuffix: null, subheading: blank };
  }

  if (args.phaseKey === 'battle.end_of_turn_resolution') {
    return {
      title: 'Turn Resolution',
      titleSuffix: null,
      subheading: 'Healing and damage are resolved',
    };
  }

  if (args.isSpectator) {
    return args.phaseKey === 'build.drawing'
      ? { title: 'Drawing', titleSuffix: null, subheading: 'Players are drawing ships' }
      : {
          title: getSubphaseLabelFromPhaseKey(args.phaseKey),
          titleSuffix: null,
          subheading: blank,
        };
  }

  if (
    args.phaseKey === 'battle.charge_declaration' &&
    args.ancientChargeStage === 'powers'
  ) {
    return {
      title: 'Solar Powers',
      titleSuffix: null,
      subheading: 'Use your Energy to cast Solar Powers',
    };
  }

  if (args.phaseKey === 'build.drawing') {
    if (args.drawingStageKind === 'submitted') {
      const committed = args.committedDrawingProjection;
      return committed
        ? {
            title: String(committed.ordinary),
            titleSuffix: withJoining('lines saved', committed.joining),
            subheading: 'Opponent drawing...',
          }
        : { title: 'Drawing', titleSuffix: null, subheading: 'Opponent drawing...' };
    }

    const economy = args.drawingEconomy;
    if (economy && (args.drawingStageKind === 'prelude' || args.drawingStageKind === 'normal')) {
      return {
        title: String(economy.ordinary),
        titleSuffix: withJoining('lines available', economy.joining),
        subheading:
          args.drawingStageKind === 'prelude'
            ? 'You have powers available'
            : 'Spend lines to build ships',
      };
    }

    return { title: 'Drawing', titleSuffix: null, subheading: blank };
  }

  if (args.phaseKey === 'battle.first_strike' || args.phaseKey === 'battle.charge_declaration') {
    const title = getSubphaseLabelFromPhaseKey(args.phaseKey);
    if (args.requesterIsReady && !args.opponentIsReady) {
      return { title, titleSuffix: null, subheading: 'Opponent choosing...' };
    }
    if (args.hasAvailableActions) {
      return { title, titleSuffix: null, subheading: 'You have powers available' };
    }
    return { title, titleSuffix: null, subheading: blank };
  }

  return {
    title: getSubphaseLabelFromPhaseKey(args.phaseKey),
    titleSuffix: null,
    subheading: blank,
  };
}
