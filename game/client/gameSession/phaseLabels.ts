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
  'build.ships_that_build': 'Ships That Build',
  'build.drawing': 'Drawing',
  'build.end_of_build': 'End of Build',
  'battle.reveal': 'Reveal',
  'battle.first_strike': 'First Strike',
  'battle.charge_declaration': 'Charge Declaration',
  'battle.charge_response': 'Charge Response',
  'battle.end_of_turn_resolution': 'End of Turn Resolution',
};

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
