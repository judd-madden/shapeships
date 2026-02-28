/**
 * SHIP TOKEN PARSER
 * 
 * Parses ship token strings like "CAR(0)" into base ID + explicit charges.
 * 
 * Token format:
 * - Canonical: CAR(3) → { baseId: "CAR", explicitCharges: 3 }
 * - Legacy support: CAR[3] → { baseId: "CAR", explicitCharges: 3 }
 * - No token: "CAR" → { baseId: "CAR" }
 * 
 * IMPORTANT: This is UI-only. Does NOT import engine code.
 */

export type ShipTokenParse = {
  baseId: string;            // canonical ship ID e.g. "CAR"
  explicitCharges?: number;  // parsed charge number if present
};

/**
 * Parse a ship token string into base ID and optional explicit charges.
 * 
 * @param token - Ship token string (e.g. "CAR(0)", "CAR[3]", "DEF")
 * @returns Parsed token with baseId and optionalexplicitCharges
 * 
 * @example
 * parseShipToken("CAR(0)") → { baseId: "CAR", explicitCharges: 0 }
 * parseShipToken("CAR")    → { baseId: "CAR" }
 * parseShipToken("DEF")    → { baseId: "DEF" }
 */
export function parseShipToken(token: string): ShipTokenParse {
  // Match canonical format: ABC(3)
  const canonicalMatch = token.match(/^([A-Z]+)\((\d+)\)$/);
  if (canonicalMatch) {
    return {
      baseId: canonicalMatch[1],
      explicitCharges: parseInt(canonicalMatch[2], 10)
    };
  }
  
  // Match legacy format: ABC[3]
  const legacyMatch = token.match(/^([A-Z]+)\[(\d+)\]$/);
  if (legacyMatch) {
    return {
      baseId: legacyMatch[1],
      explicitCharges: parseInt(legacyMatch[2], 10)
    };
  }
  
  // No token, just base ID
  return {
    baseId: token
  };
}
