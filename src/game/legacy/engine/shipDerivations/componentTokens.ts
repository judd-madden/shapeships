/**
 * DEPRECATED — LEGACY CLIENT ENGINE
 *
 * This file is part of an old client-authoritative engine.
 * It must not be used for authoritative gameplay.
 *
 * Canonical shared engine code lives in /engine.
 * This file is retained for reference only.
 */

/**
 * Component Tokens
 */
export type ComponentToken = 
  | { kind: 'id'; id: string }
  | { kind: 'requirement'; id: string; chargeState: 'depleted' };

/**
 * Parse a component ship token from the DSL.
 * 
 * @param token - Component ship token (e.g., "DEF", "CAR(0)")
 * @returns Structured component requirement
 * @throws Error in dev mode if token format is invalid
 * 
 * @example
 * parseComponentToken("DEF")     → { kind: 'id', id: 'DEF' }
 * parseComponentToken("CAR(0)")  → { kind: 'requirement', id: 'CAR', chargeState: 'depleted' }
 */
export function parseComponentToken(token: string): ComponentToken {
  // Dev-only validation: ensure token matches expected format
  if (process.env.NODE_ENV !== 'production') {
    if (!/^[A-Z0-9]+(\(0\))?$/.test(token)) {
      throw new Error(
        `Invalid component token format: "${token}". ` +
        `Expected format: uppercase alphanumeric ID optionally followed by "(0)". ` +
        `Examples: "DEF", "CAR(0)"`
      );
    }
  }
  
  const depletedMatch = token.match(/^([A-Z0-9]+)\(0\)$/);
  
  if (depletedMatch) {
    return {
      kind: 'requirement',
      id: depletedMatch[1],
      chargeState: 'depleted'
    };
  }
  
  return {
    kind: 'id',
    id: token
  };
}

/**
 * Parse all component requirements from a ship's componentShips array.
 * 
 * @param componentShips - Array of component ship tokens
 * @returns Array of structured component requirements
 * 
 * @example
 * parseComponentRequirements(["DEF", "CAR(0)"])
 * → [
 *     { kind: 'id', id: 'DEF' },
 *     { kind: 'requirement', id: 'CAR', chargeState: 'depleted' }
 *   ]
 */
export function parseComponentRequirements(componentShips: readonly string[]): ComponentToken[] {
  return componentShips.map(parseComponentToken);
}