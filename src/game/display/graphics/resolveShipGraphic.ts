/**
 * SHIP GRAPHIC RESOLVER
 * 
 * Central utility for selecting the correct ship graphic based on context.
 * 
 * Contexts:
 * - 'default': Catalogue tiles, generic thumbnails → charge ships show FULL
 * - 'hover': Hover cards, component thumbnails → charge ships show DEPLETED (0)
 * - 'live': Fleet board, active gameplay → charge ships show CURRENT from state
 * 
 * Priority:
 * 1. explicitCharges (from token like CAR(0)) always wins
 * 2. currentCharges (from live game state) for 'live' context
 * 3. Context policy (full for default, depleted for hover)
 * 4. Fallback to closest available or first graphic
 */

import type { ShipDefinitionUI, ShipGraphic } from '../../types/ShipTypes.ui';

export type GraphicContext = 'default' | 'hover' | 'live';

export interface ResolveGraphicOptions {
  context: GraphicContext;
  explicitCharges?: number;   // From token like CAR(0)
  currentCharges?: number | null;  // From live game state
}

/**
 * Resolve which graphic to use for a ship based on context and charge state.
 * 
 * @param ship - Ship definition with graphics array
 * @param opts - Resolution options (context + optional charge overrides)
 * @returns Selected graphic or null if none available
 */
export function resolveShipGraphic(
  ship: ShipDefinitionUI,
  opts: ResolveGraphicOptions
): ShipGraphic | null {
  const { context, explicitCharges, currentCharges } = opts;
  
  if (!ship.graphics || ship.graphics.length === 0) {
    return null;
  }
  
  // Check if ship has charge-based graphics
  const chargeGraphics = ship.graphics.filter(g => 
    g.condition.startsWith('charges_')
  );
  
  const isChargeBased = chargeGraphics.length > 0;
  
  if (!isChargeBased) {
    // Non-charge ship: prefer 'default' condition, else first graphic
    const defaultGraphic = ship.graphics.find(g => g.condition === 'default');
    return defaultGraphic || ship.graphics[0] || null;
  }
  
  // Charge-based ship: determine desired charge number
  let desiredCharges: number | null = null;
  
  // Priority 1: Explicit charges from token (always wins)
  if (explicitCharges !== undefined) {
    desiredCharges = explicitCharges;
  }
  // Priority 2: Current charges from live state (for 'live' context only)
  else if (context === 'live' && currentCharges !== null && currentCharges !== undefined) {
    desiredCharges = currentCharges;
  }
  // Priority 3: Context policy
  else if (context === 'hover') {
    desiredCharges = 0; // Depleted for hover
  }
  else if (context === 'default' || (context === 'live' && currentCharges === null)) {
    // Full charges for default, or live without state
    desiredCharges = getMaxCharges(chargeGraphics);
  }
  
  // Find exact match for desired charges
  if (desiredCharges !== null) {
    const exactMatch = chargeGraphics.find(g => 
      g.condition === `charges_${desiredCharges}`
    );
    if (exactMatch) {
      return exactMatch;
    }
  }
  
  // Fallback: find closest available charge graphic
  return findClosestChargeGraphic(chargeGraphics, desiredCharges, context);
}

/**
 * Extract the maximum charge number from charge graphics.
 */
function getMaxCharges(chargeGraphics: ShipGraphic[]): number {
  let max = 0;
  for (const graphic of chargeGraphics) {
    const match = graphic.condition.match(/^charges_(\d+)$/);
    if (match) {
      const charges = parseInt(match[1], 10);
      if (charges > max) {
        max = charges;
      }
    }
  }
  return max;
}

/**
 * Find the closest available charge graphic when exact match not found.
 */
function findClosestChargeGraphic(
  chargeGraphics: ShipGraphic[],
  desiredCharges: number | null,
  context: GraphicContext
): ShipGraphic | null {
  if (chargeGraphics.length === 0) {
    return null;
  }
  
  // Extract charge numbers from graphics
  const available = chargeGraphics.map(g => {
    const match = g.condition.match(/^charges_(\d+)$/);
    return {
      graphic: g,
      charges: match ? parseInt(match[1], 10) : 0
    };
  });
  
  if (desiredCharges === null) {
    // No desired charges: use context policy
    if (context === 'hover') {
      // Prefer lowest available
      available.sort((a, b) => a.charges - b.charges);
      return available[0].graphic;
    } else {
      // Prefer highest available
      available.sort((a, b) => b.charges - a.charges);
      return available[0].graphic;
    }
  }
  
  // Find closest match to desired charges
  available.sort((a, b) => {
    const diffA = Math.abs(a.charges - desiredCharges);
    const diffB = Math.abs(b.charges - desiredCharges);
    if (diffA !== diffB) {
      return diffA - diffB; // Closer is better
    }
    // Tie-breaker based on context
    if (context === 'hover') {
      return a.charges - b.charges; // Prefer lower
    } else {
      return b.charges - a.charges; // Prefer higher
    }
  });
  
  return available[0].graphic;
}
