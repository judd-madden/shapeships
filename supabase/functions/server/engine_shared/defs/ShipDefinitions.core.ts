/**
 * CANONICAL SHIP DEFINITIONS BRIDGE (SERVER-SIDE)
 * 
 * Single source of truth bridge for engine_shared.
 * Imports the server-local JSON ship definitions and re-exports for server use.
 * 
 * DATA FLOW (SERVER-SIDE ONLY):
 * - ./ShipDefinitions.json.ts (server-local JSON copy)
 * - → THIS FILE (server bridge)
 * - → ShipDefinitions.withStructuredPowers.ts (join layer)
 * - → engine_shared modules (effects, resolution, etc.)
 * 
 * EDGE BUNDLER COMPATIBILITY:
 * All imports stay within /supabase/functions/server/** to ensure clean bundling.
 * No dependencies on /game/** or other repo code outside the server bundle.
 * 
 * CLIENT DATA FLOW (SEPARATE):
 * The client has its own copy at /game/data/ShipDefinitions.json.ts for UI.
 * These copies must be manually kept in sync.
 * 
 * DO NOT:
 * - Import this file outside of /supabase/functions/server/**
 * - Invent ship definitions
 * - Duplicate ship data beyond the JSON source
 */

import { SHIP_DEFINITIONS_JSON, SHIP_DEFS_VERSION } from './ShipDefinitions.json.ts';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ship power structure from JSON
 */
export interface ShipPowerCore {
  subphase: string;
  text: string;
}

/**
 * Ship definition structure from JSON
 * (Minimal type - extends as needed for server processing)
 */
export interface ShipDefinitionCore {
  id: string;
  species: string;
  shipType: string;
  name: string;
  totalLineCost: number | null;
  joiningLineCost: number | null;
  componentShips: string[];
  charges: number | null;
  maxQuantity?: number;
  powers: ShipPowerCore[];
  energyCost: {
    red: number;
    green: number;
    blue: number;
    xBlue: boolean;
  } | null;
  extraRules: string;
  stackCaption: string;
  colour: string;
  numberOfGraphics: number;
}

// ============================================================================
// CANONICAL EXPORT
// ============================================================================

/**
 * Canonical ship definitions array for server-side engine processing
 * 
 * This is the ONLY ship definitions array that engine_shared code should use.
 * It comes directly from the server-local JSON source.
 */
export const SHIP_DEFINITIONS_CORE_SERVER: ShipDefinitionCore[] = SHIP_DEFINITIONS_JSON as any;

/**
 * Server-side version identifier
 * Exposed for diagnostics and drift detection
 */
export const SHIP_DEFS_VERSION_SERVER = SHIP_DEFS_VERSION;

// ============================================================================
// LOOKUP HELPERS
// ============================================================================

/**
 * Get ship definition by ID
 * 
 * @param id - Ship ID (e.g., 'DEF', 'FIG')
 * @returns Ship definition or undefined if not found
 */
export function getShipById(id: string): ShipDefinitionCore | undefined {
  return SHIP_DEFINITIONS_CORE_SERVER.find(ship => ship.id === id);
}

/**
 * Get ship definition by ID (throws if not found)
 * 
 * @param id - Ship ID
 * @returns Ship definition
 * @throws Error if ship not found
 */
export function getShipByIdOrThrow(id: string): ShipDefinitionCore {
  const ship = getShipById(id);
  if (!ship) {
    throw new Error(
      `Ship definition not found for id: "${id}". ` +
      `Available ids: ${SHIP_DEFINITIONS_CORE_SERVER.map(s => s.id).sort().join(', ')}`
    );
  }
  return ship;
}