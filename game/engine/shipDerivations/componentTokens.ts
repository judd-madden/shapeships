/**
 * COMPONENT SHIP TOKEN DSL PARSER
 * 
 * Component ships use a small DSL for expressing requirements:
 * 
 * - Plain ID:     "DEF"      → Just requires a Defender ship
 * - Depleted:     "CAR(0)"   → Requires a Carrier with 0 charges remaining
 * 
 * The "(0)" token means the component ship must have its charges depleted.
 * Only ships with charges != null can be used with "(0)" notation.
 * 
 * ARCHITECTURE:
 * - This is an ENGINE module (not data layer)
 * - Used by cost calculators and ship building logic
 * - Validates tokens in dev mode to catch authoring errors early
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
