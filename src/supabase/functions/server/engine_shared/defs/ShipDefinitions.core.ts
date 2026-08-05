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
export type ShipPowerTag = 'makes_ships' | 'targets_ships';

export type ShipPowerActivationTiming =
  | 'start_of_drawing'
  | 'when_built'
  | 'on_destruction'
  | 'reveal'
  | 'turn_start_materialisation';

export interface ShipPowerCore {
  readonly subphase: string;
  readonly text: string;
  readonly tags?: readonly ShipPowerTag[];
  readonly activationTiming?: ShipPowerActivationTiming;
}

/**
 * Ship definition structure from JSON
 * (Minimal type - extends as needed for server processing)
 */
export interface ShipDefinitionCore {
  readonly id: string;
  readonly species: string;
  readonly shipType: string;
  readonly name: string;
  readonly totalLineCost: number | null;
  readonly joiningLineCost: number | null;
  readonly componentShips: readonly string[];
  readonly charges: number | null;
  readonly maxQuantity?: number;
  readonly powers: readonly ShipPowerCore[];
  readonly energyCost: {
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly xBlue: boolean;
  } | null;
  readonly extraRules: string;
  readonly stackCaption: string;
  readonly colour: string;
  readonly numberOfGraphics: number;
}

export interface ShipPowerMetadataRow {
  readonly shipDefId: string;
  readonly rawPowerIndex: number;
  readonly tags: readonly ShipPowerTag[];
  readonly activationTiming: ShipPowerActivationTiming | null;
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
export const SHIP_DEFINITIONS_CORE_SERVER: readonly ShipDefinitionCore[] =
  SHIP_DEFINITIONS_JSON;

/**
 * Server-side version identifier
 * Exposed for diagnostics and drift detection
 */
export const SHIP_DEFS_VERSION_SERVER = SHIP_DEFS_VERSION;

const SHIP_POWER_TAG_ORDER: readonly ShipPowerTag[] = [
  'makes_ships',
  'targets_ships',
];

/**
 * Return normalized metadata for every raw power in definition order.
 */
export function getShipPowerMetadataRows(
  definitions: readonly ShipDefinitionCore[] = SHIP_DEFINITIONS_CORE_SERVER,
): ShipPowerMetadataRow[] {
  return definitions.flatMap((ship) =>
    ship.powers.map((power, rawPowerIndex) => ({
      shipDefId: ship.id,
      rawPowerIndex,
      tags: power.tags ? [...power.tags] : [],
      activationTiming: power.activationTiming ?? null,
    }))
  );
}

/**
 * Aggregate raw per-power tags for inspection only.
 * This helper is not an authoritative activation or legality query.
 */
export function getAggregatedShipPowerTags(
  ship: Pick<ShipDefinitionCore, 'powers'>,
): ShipPowerTag[] {
  const presentTags = new Set(
    ship.powers.flatMap((power) => power.tags ?? []),
  );
  return SHIP_POWER_TAG_ORDER.filter((tag) => presentTags.has(tag));
}

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
