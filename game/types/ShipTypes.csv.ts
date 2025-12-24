/**
 * Ship Types - CSV Layer (Lossless)
 * 
 * This module defines the LOSSLESS CSV schema.
 * - Preserves raw strings exactly as they appear in CSV
 * - No enums, no interpretation, no inferred meaning
 * - Server-safe (no React)
 * - Single source of truth for ship text data
 * 
 * The CSV is parsed into this schema by the auto-generator.
 */

import type { EffectAst } from './EffectTypes';

/**
 * Raw power text from CSV (lossless)
 * Optional effectAst can be attached later for advanced parsing
 */
export interface ShipPowerTextCsv {
  /** Raw subphase string from CSV (e.g., "Automatic", "Charge Declaration") */
  subphase: string;
  
  /** Raw power text from CSV (exact string, uninterpreted) */
  text: string;
  
  /** Optional: Pre-parsed effect AST (can be added via annotations) */
  effectAst?: EffectAst;
}

/**
 * Ship definition from CSV (lossless)
 * Fields map directly to CSV columns
 */
export interface ShipDefinitionCsv {
  /** Ship ID (e.g., "DEF", "FIG", "SOL") */
  id: string;
  
  /** Ship display name (e.g., "Defender", "Solar Grid") */
  name: string;
  
  /** Species string from CSV (e.g., "Human", "Xenite", "Centaur", "Ancient") */
  species: string;
  
  /** Ship type string from CSV (e.g., "Basic", "Upgraded", "Solar Power", "Basic - Evolved") */
  shipType: string;
  
  /** Total line cost for basic ships (null for upgraded/solar) */
  totalLineCost: number | null;
  
  /** Joining line cost for upgraded ships (null for basic/solar) */
  joiningLineCost?: number | null;
  
  /** Component ships (raw strings like "DEF", "FIG", "CAR(0)", "1 red energy") */
  componentShips?: string[];
  
  /** Number of powers this ship has */
  numberOfPowers: number;
  
  /** Maximum charges (if applicable) */
  charges?: number | null;
  
  /** Power definitions (raw CSV text) */
  powers: ShipPowerTextCsv[];
  
  /** Extra rules text from CSV */
  extraRules?: string;
  
  /** Stack caption for UI display */
  stackCaption?: string;
  
  /** Color name from CSV */
  colour?: string;
  
  /** Number of graphics variants */
  numberOfGraphics?: number | null;
}
