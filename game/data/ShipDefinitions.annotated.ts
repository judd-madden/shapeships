/**
 * Ship Definitions with Effect AST Annotations
 * 
 * ⚠️ OPTIONAL/WIP – Not used by engine yet
 * 
 * DEMONSTRATION ONLY: Shows how effectAst can be added to powers.
 * 
 * WORKFLOW:
 * 1. Import PURE_SHIP_DEFINITIONS from auto-generated core file
 * 2. Add effectAst to specific powers (gradual migration)
 * 3. Export annotated definitions for engine use
 * 
 * CRITICAL PRINCIPLES:
 * - CSV text remains authoritative (never modified)
 * - AST is additive metadata only
 * - Powers without AST still work (engine falls back)
 * - Migration happens power-by-power, not all-at-once
 * 
 * FUTURE: EffectAst should eventually map to canonical EffectKind from /game/types/EffectTypes.ts
 * For now, EffectAst is designer-friendly metadata that's easier to write manually.
 * 
 * EXAMPLE USAGE:
 * ```
 * // In engine/display code:
 * import { SHIP_DEFINITIONS_WITH_AST } from './ShipDefinitions.annotated';
 * // OR continue using PURE_SHIP_DEFINITIONS if AST not needed
 * ```
 */

import { PURE_SHIP_DEFINITIONS, SHIP_DEFINITIONS_CORE_MAP } from './ShipDefinitions.core';
import type { ShipDefinitionCsv, ShipPowerText } from '../types/ShipTypes.csv';
import type { EffectAst } from '../effects/EffectAst';

// ============================================================================
// AST ANNOTATIONS (Gradual Migration)
// ============================================================================

/**
 * Power AST annotations - indexed by ship ID and power index
 * 
 * Format: { [shipId]: { [powerIndex]: EffectAst } }
 * 
 * Only annotate powers that are:
 * - Unambiguous (no complex interpretation needed)
 * - Well-understood (clear what the effect does)
 * - Safe (won't change engine behavior accidentally)
 */
const POWER_AST_ANNOTATIONS: Record<string, Record<number, EffectAst>> = {
  // ========================================================================
  // EXAMPLE 1: Defender - Simple heal
  // ========================================================================
  'DEF': {
    0: {
      kind: 'heal',
      amount: { type: 'literal', value: 1 }
    }
  },
  
  // ========================================================================
  // EXAMPLE 2: Fighter - Simple damage
  // ========================================================================
  'FIG': {
    0: {
      kind: 'deal_damage',
      amount: { type: 'literal', value: 1 }
    }
  },
  
  // ========================================================================
  // EXAMPLE 3: Battle Cruiser - Multiple effects
  // Power 1: Generate 2 lines (Line Generation)
  // Power 2: Heal 3 (Automatic)
  // Power 3: Deal 2 damage (Automatic)
  // ========================================================================
  'BAT': {
    0: {
      kind: 'generate_lines',
      amount: { type: 'literal', value: 2 }
    },
    1: {
      kind: 'heal',
      amount: { type: 'literal', value: 3 }
    },
    2: {
      kind: 'deal_damage',
      amount: { type: 'literal', value: 2 }
    }
  }
  
  // ========================================================================
  // FUTURE ANNOTATIONS (Examples of what COULD be added later)
  // ========================================================================
  
  // Commander - Count-and-apply pattern
  // 'COM': {
  //   0: {
  //     kind: 'count_and_apply',
  //     count: {
  //       scope: 'player',
  //       entity: 'ships',
  //       filter: { shipIds: ['FIG'] },
  //       divisor: 3
  //     },
  //     apply: {
  //       kind: 'deal_damage',
  //       amount: { type: 'literal', value: 1 }
  //     }
  //   }
  // },
  
  // Carrier - Build ships with charges
  // 'CAR': {
  //   0: {
  //     kind: 'use_charge',
  //     amount: 1,
  //     effect: { kind: 'build_ship', shipId: 'DEF' }
  //   },
  //   1: {
  //     kind: 'use_charge',
  //     amount: 2,
  //     effect: { kind: 'build_ship', shipId: 'FIG' }
  //   }
  // },
  
  // Cube - Custom (too complex for current AST)
  // 'CUB': {
  //   0: {
  //     kind: 'custom',
  //     note: 'Repeat first solar power (requires state tracking)'
  //   }
  // }
};

// ============================================================================
// APPLY ANNOTATIONS
// ============================================================================

/**
 * Apply AST annotations to ship definitions
 * 
 * This function:
 * 1. Deep-clones the pure definitions
 * 2. Adds effectAst to annotated powers
 * 3. Leaves unannotated powers unchanged
 */
function applyAstAnnotations(
  definitions: ShipDefinitionCsv[]
): ShipDefinitionCsv[] {
  return definitions.map(ship => {
    const annotations = POWER_AST_ANNOTATIONS[ship.id];
    
    // No annotations for this ship - return as-is
    if (!annotations) {
      return ship;
    }
    
    // Clone ship and add AST to annotated powers
    return {
      ...ship,
      powers: ship.powers.map((power, index) => {
        const ast = annotations[index];
        
        // No annotation for this power - return as-is
        if (!ast) {
          return power;
        }
        
        // Add AST to power
        return {
          ...power,
          effectAst: ast
        } as ShipPowerText;
      })
    };
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Ship definitions with AST annotations applied
 * 
 * Use this if you want to take advantage of structured effect interpretation.
 * Falls back gracefully - unannotated powers still work.
 */
export const SHIP_DEFINITIONS_WITH_AST: ShipDefinitionCsv[] = 
  applyAstAnnotations(PURE_SHIP_DEFINITIONS);

/**
 * Lookup map with AST annotations
 */
export const SHIP_DEFINITIONS_WITH_AST_MAP: Record<string, ShipDefinitionCsv> = 
  SHIP_DEFINITIONS_WITH_AST.reduce((map, def) => {
    map[def.id] = def;
    return map;
  }, {} as Record<string, ShipDefinitionCsv>);

/**
 * Get ship definition with AST annotations
 */
export function getShipWithAst(shipDefId: string): ShipDefinitionCsv | undefined {
  return SHIP_DEFINITIONS_WITH_AST_MAP[shipDefId];
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get annotation statistics
 * 
 * Useful for tracking migration progress.
 */
export function getAnnotationStats() {
  const totalShips = PURE_SHIP_DEFINITIONS.length;
  const annotatedShips = Object.keys(POWER_AST_ANNOTATIONS).length;
  
  let totalPowers = 0;
  let annotatedPowers = 0;
  
  PURE_SHIP_DEFINITIONS.forEach(ship => {
    totalPowers += ship.powers.length;
    const annotations = POWER_AST_ANNOTATIONS[ship.id];
    if (annotations) {
      annotatedPowers += Object.keys(annotations).length;
    }
  });
  
  return {
    totalShips,
    annotatedShips,
    shipsPercentage: Math.round((annotatedShips / totalShips) * 100),
    totalPowers,
    annotatedPowers,
    powersPercentage: Math.round((annotatedPowers / totalPowers) * 100)
  };
}