// ============================================================================
// PHASE TABLE (CLIENT MIRROR OF CANONICAL KEYS)
// ============================================================================
//
// This file mirrors the server's canonical phase sequence.
// Must match /supabase/functions/server/engine/phase/PhaseTable.ts exactly.
//
// CRITICAL RULES:
// - Do NOT add new literals here without changing server first
// - Do NOT invent ad-hoc phase strings (e.g., "Battle:Resolution")
// - Use these constants for all client-side phase routing
// - Phase keys are always lowercase with dot separator: "major.subphase"
//
// ============================================================================

/**
 * Canonical phase sequence (client mirror)
 * 
 * MUST match server PhaseTable.ts strings exactly.
 * Any drift between client and server will cause routing bugs.
 */
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

/**
 * PhaseKey type - union of all valid phase keys
 * 
 * Example values:
 * - 'setup.species_selection'
 * - 'build.dice_roll'
 * - 'battle.charge_declaration'
 * - 'battle.end_of_turn_resolution'
 */
export type PhaseKey = (typeof PHASE_SEQUENCE)[number];

/**
 * MajorPhase type - extracted major phase portion (before the dot)
 * 
 * Possible values: 'setup' | 'build' | 'battle'
 */
export type MajorPhase = PhaseKey extends `${infer M}.${string}` ? M : never;

/**
 * SubPhase type - extracted subphase portion (after the dot)
 * 
 * Example values: 'species_selection', 'dice_roll', 'charge_declaration', etc.
 */
export type SubPhase = PhaseKey extends `${string}.${infer S}` ? S : never;

/**
 * Validates whether a string is a valid PhaseKey
 * 
 * @param key - String to validate
 * @returns True if key is in PHASE_SEQUENCE
 */
export function isValidPhaseKey(key: string): key is PhaseKey {
  return PHASE_SEQUENCE.includes(key as PhaseKey);
}

/**
 * Constructs a phase key from major and subphase components
 * 
 * STRICT BEHAVIOR:
 * - Expects lowercase canonical tokens (no normalization applied)
 * - Returns null if inputs don't match PHASE_SEQUENCE exactly
 * - Use normalizePhaseToken() first if you need to clean input
 * 
 * @param major - Major phase (e.g., 'build', 'battle')
 * @param sub - Subphase (e.g., 'dice_roll', 'charge_declaration')
 * @returns Validated PhaseKey or null if invalid
 */
export function buildPhaseKey(major: string, sub: string): PhaseKey | null {
  const key = `${major}.${sub}`;
  return isValidPhaseKey(key) ? key : null;
}

/**
 * Normalizes a phase token to lowercase canonical format
 * 
 * USE CASE:
 * - For future migration when cleaning legacy phase data
 * - NOT used automatically in buildPhaseKey (we want strictness)
 * - Useful for data repair scripts or migration tools
 * 
 * @param input - Raw phase token string
 * @returns Normalized lowercase trimmed string
 */
export function normalizePhaseToken(input: string): string {
  return String(input ?? '').trim().toLowerCase();
}