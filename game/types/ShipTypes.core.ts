/**
 * CORE SHIP TYPES (JSON-NATIVE)
 * 
 * Canonical type definitions for ship data consumed by core engine and UI layers.
 * These types match the structure of SHIP_DEFINITIONS_JSON exactly.
 * 
 * SOURCE OF TRUTH: /game/data/ShipDefinitions.json.ts
 * 
 * NO CSV COMPATIBILITY LAYER - This is the pure JSON representation.
 * 
 * CRITICAL INVARIANT:
 * - Power text fields contain literal "\\n" escape sequences (backslash + n)
 * - Real newline characters ('\n') are FORBIDDEN and validated against
 */

import type { EnergyCost } from './EnergyCostTypes';

// ============================================================================
// CORE TYPES
// ============================================================================

export type ShipId = string;

/**
 * Energy cost structure for Solar Powers
 * @deprecated Use EnergyCost from EnergyCostTypes.ts instead
 */
export type EnergyCostCore = EnergyCost;

/**
 * Individual ship power definition
 * 
 * INVARIANT: text field must contain literal "\\n" sequences, not real newlines
 */
export interface ShipPowerCore {
  subphase: string;  // e.g., "Automatic", "Charge Declaration", "Line Generation"
  text: string;      // Power description with literal "\\n" sequences allowed
  effectAst?: any;   // Optional structured effect AST (for advanced interpretation)
}

/**
 * Complete ship definition (JSON-native structure)
 * 
 * This is the canonical representation used throughout the codebase.
 * All fields are required; use null for optional numeric values.
 */
export interface ShipDefinitionCore {
  /** Unique ship identifier (3-5 uppercase alphanumeric) */
  id: ShipId;
  
  /** Species name (Human, Xenite, Centaur, Ancient) */
  species: string;
  
  /** Ship type (Basic, Upgraded, Solar Power, etc.) */
  shipType: string;
  
  /** Human-readable ship name */
  name: string;
  
  /** Total line cost to build (null for Solar Powers) */
  totalLineCost: number | null;
  
  /** Additional joining lines required for upgrades (null for Basic) */
  joiningLineCost: number | null;
  
  /** Component ship IDs required for upgrades (can include DSL tokens like "CAR(0)") */
  componentShips: ShipId[];
  
  /** Maximum charges (null if ship has no charges) */
  charges: number | null;
  
  /** Maximum quantity of this ship allowed in fleet (optional) */
  maxQuantity?: number;
  
  /** Ship powers (can be empty array) */
  powers: ShipPowerCore[];
  
  /** Energy cost (non-null only for Solar Powers) */
  energyCost: EnergyCostCore | null;
  
  /** Additional rules text (empty string if none) */
  extraRules: string;
  
  /** Stack caption for UI display */
  stackCaption: string;
  
  /** Color/faction indicator */
  colour: string;
  
  /** Number of graphics variants (for charge states, etc.) */
  numberOfGraphics: number;
}