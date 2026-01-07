/**
 * LEGACY: Ship Types - CSV Layer (DEPRECATED)
 * 
 * ⚠️ THIS FILE IS ARCHIVED AND NO LONGER USED ⚠️
 * 
 * Archive Date: 2026-01-07
 * Reason: Migrated to JSON-native core types (ShipTypes.core.ts)
 * 
 * HISTORICAL CONTEXT:
 * This module previously defined the CSV-based ship type schema.
 * It was used as an intermediate layer between CSV source files and
 * the engine layer.
 * 
 * REPLACEMENT:
 * - New source: /game/data/ShipDefinitions.json.ts (JSON)
 * - New types: /game/types/ShipTypes.core.ts
 * - No CSV compatibility layer remains
 * 
 * KEY DIFFERENCES FROM NEW SYSTEM:
 * - Old: CSV → ShipDefinitionCsv → Engine
 * - New: JSON → ShipDefinitionCore → Engine
 * - Removed: numberOfPowers field (use powers.length instead)
 * - Simplified: componentShips always string[], extraRules always string
 * 
 * DO NOT USE THIS FILE IN NEW CODE.
 */

// NOTE: EffectAst import removed - this file is for reference only

/**
 * @deprecated Use ShipPowerCore from ShipTypes.core.ts instead
 */
export interface ShipPowerTextCsv {
  subphase: string;
  text: string;
  effectAst?: any; // Simplified for archive
}

/**
 * @deprecated Use ShipDefinitionCore from ShipTypes.core.ts instead
 */
export interface ShipDefinitionCsv {
  id: string;
  name: string;
  species: string;
  shipType: string;
  totalLineCost: number | null;
  joiningLineCost?: number | null;
  componentShips?: string[];
  numberOfPowers: number; // REMOVED in new system - use powers.length
  charges?: number | null;
  powers: ShipPowerTextCsv[];
  extraRules?: string;
  stackCaption?: string;
  colour?: string;
  numberOfGraphics?: number | null;
}
