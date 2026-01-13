// ============================================================================
// PHASE TABLE (CANONICAL)
// ============================================================================
// Single source of truth for phase progression order.
// PhaseKey is derived from PHASE_SEQUENCE to prevent drift.

export const PHASE_SEQUENCE = [
  'setup.species_selection',

  'build.dice_roll',
  'build.line_generation',
  'build.ships_that_build',
  'build.drawing',
  'build.end_of_build',

  'battle.first_strike',
  'battle.charge_declaration',
  'battle.charge_response',
  'battle.end_of_turn_resolution',
] as const;

export type PhaseKey = (typeof PHASE_SEQUENCE)[number];

// Optional helpers (safe + derived)
export type MajorPhase = PhaseKey extends `${infer M}.${string}` ? M : never;
export type SubPhase = PhaseKey extends `${string}.${infer S}` ? S : never;
