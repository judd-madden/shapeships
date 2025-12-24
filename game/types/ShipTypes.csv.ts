/**
 * Ship Types - CSV RAW (Lossless Mirror)
 * 
 * This file contains LOSSLESS representations of CSV data.
 * NO interpretation, NO enums, NO parsing - just raw strings and numbers.
 * 
 * PURPOSE:
 * - Direct mirror of CSV structure
 * - Source of truth for ship data
 * - Used by CSV generator output
 * 
 * NOT FOR:
 * - Engine runtime logic (use ShipTypes.core.ts)
 * - Game state (use GameTypes.ts)
 */

import type { EffectAst } from '../effects/EffectAst';

// ============================================================================
// CSV RAW POWER
// ============================================================================

/**
 * ShipPowerText - Raw power text from CSV (no interpretation)
 * 
 * AUTHORITATIVE: The `text` field is the source of truth for power behavior.
 * OPTIONAL: `effectAst` provides structured interpretation metadata.
 */
export interface ShipPowerText {
  /** Exact from CSV: "Automatic", "Ships That Build", "Drawing", etc. */
  subphase: string;
  
  /** Exact from CSV field, trimmed - AUTHORITATIVE SOURCE OF TRUTH */
  text: string;
  
  /**
   * OPTIONAL: Structured interpretation (added gradually, power-by-power)
   * 
   * If absent, engine falls back to existing logic or manual handling.
   * If present, engine MAY use it for interpretation (not required).
   * 
   * NOTE: This is designer-friendly AST. Eventually should map to
   * canonical EffectKind from /game/types/EffectTypes.ts
   */
  effectAst?: EffectAst;
}

// ============================================================================
// CSV RAW SHIP DEFINITION
// ============================================================================

/**
 * ShipDefinitionCsv - Lossless CSV representation
 * 
 * Fields map directly to CSV columns without interpretation.
 * All enums are strings, all tokens are unparsed.
 * 
 * This is what the CSV generator outputs.
 */
export interface ShipDefinitionCsv {
  // ========================================================================
  // IDENTITY (CSV Columns: ID, SHIP NAME)
  // ========================================================================
  
  /** Ship ID token: "DEF", "FIG", "CAR", etc. */
  id: string;
  
  /** Human-readable name: "Defender", "Fighter", "Carrier" */
  name: string;
  
  // ========================================================================
  // CLASSIFICATION (CSV Columns: SPECIES, SHIP TYPE)
  // ========================================================================
  
  /** Species string (not enum): "Human", "Xenite", "Centaur", "Ancient" */
  species: string;
  
  /** Ship type string (not enum): "Basic", "Upgraded", "Basic - Evolved", "Solar Power" */
  shipType: string;
  
  // ========================================================================
  // COSTS (CSV Columns: TOTAL LINE COST, JOINING LINE COST)
  // ========================================================================
  
  /** Total line cost for basic ships (number or null for N/A) */
  totalLineCost: number | null;
  
  /** Joining line cost for upgraded ships (number or null if blank/N/A) */
  joiningLineCost?: number | null;
  
  // ========================================================================
  // COMPONENTS (CSV Column: COMPONENT SHIPS)
  // ========================================================================
  
  /**
   * Component ship tokens (unparsed)
   * 
   * Examples:
   * - ['DEF', 'FIG'] - simple components
   * - ['CAR(0)', 'ANT(0)'] - must be depleted
   * - ['1 red energy'] - solar power cost
   * 
   * NO PARSING - just raw strings from CSV
   */
  componentShips?: string[];
  
  // ========================================================================
  // POWERS (CSV Columns: NUMBER OF POWERS, CHARGES, POWER 1/2/3)
  // ========================================================================
  
  /** Number of powers (from CSV count) */
  numberOfPowers: number;
  
  /** Charges (number or null if blank) */
  charges?: number | null;
  
  /** Powers (up to 3, only if fields present in CSV) */
  powers: ShipPowerText[];
  
  // ========================================================================
  // METADATA (CSV Columns: EXTRA RULES, STACK CAPTION, COLOUR, etc.)
  // ========================================================================
  
  /** Extra rules text (unparsed) */
  extraRules?: string;
  
  /** Stack caption template */
  stackCaption?: string;
  
  /** Color name string: "Pastel Green", "Yellow", "N/A" */
  colour?: string;
  
  /** Number of graphics variants */
  numberOfGraphics?: number | null;
}

/**
 * Alias for clarity in some contexts
 */
export type ShipDefinitionRaw = ShipDefinitionCsv;
