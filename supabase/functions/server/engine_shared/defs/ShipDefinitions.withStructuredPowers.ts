/**
 * SHIP DEFINITIONS WITH STRUCTURED POWERS
 *
 * Join layer that attaches structured powers to ship definitions.
 *
 * INPUT:
 * - Canonical ship definitions from ./ShipDefinitions.core.ts (JSON source-of-truth)
 * - Structured powers overlay from ./StructuredPowers.overlays.ts
 *
 * OUTPUT:
 * - Ship definitions with:
 *   1) per-power `structuredPowers?: StructuredShipPower[]` (optional, for debugging)
 *   2) ship-level flattened `structuredPowers: StructuredShipPower[]` (runtime source for resolution)
 *
 * GUARDRAILS:
 * - Warns if an overlay key doesn't match any ship definition power (unused overlay keys)
 */

import type { ShipDefinitionCore } from './ShipDefinitions.core.ts';
import { SHIP_DEFINITIONS_CORE_SERVER } from './ShipDefinitions.core.ts';
import type { StructuredShipPower } from '../effects/translateShipPowers.ts';
import { STRUCTURED_POWERS_HUMAN } from './StructuredPowers.overlays.ts';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Ship power with optional structured powers attached.
 */
export type ShipPowerWithStructured = ShipDefinitionCore['powers'][number] & {
  structuredPowers?: StructuredShipPower[];
};

/**
 * Ship definition with structured powers attached.
 *
 * NOTE:
 * - `powers[].structuredPowers` remains optional and is primarily for trace/debug.
 * - `structuredPowers` is the deterministic flattened list used by resolution.
 */
export type ShipDefinitionWithStructuredPowers = Omit<ShipDefinitionCore, 'powers'> & {
  powers: ShipPowerWithStructured[];
  structuredPowers: StructuredShipPower[];
};

// ============================================================================
// JOIN LOGIC
// ============================================================================

/**
 * Attach structured powers to ship definitions.
 *
 * Deterministic ordering:
 * - JSON powers[] order
 * - then overlay array order within each power
 */
function attachStructuredPowers(): ShipDefinitionWithStructuredPowers[] {
  const usedKeys = new Set<string>();

  const result = SHIP_DEFINITIONS_CORE_SERVER.map((ship) => {
    const flattened: StructuredShipPower[] = [];

    const powersWithStructured: ShipPowerWithStructured[] = ship.powers.map((power, powerIndex) => {
      const key = `${ship.id}#${powerIndex}`;
      const structuredPowers = STRUCTURED_POWERS_HUMAN[key];

      if (structuredPowers && structuredPowers.length > 0) {
        usedKeys.add(key);
        flattened.push(...structuredPowers);
        return { ...power, structuredPowers };
      }

      return power as ShipPowerWithStructured;
    });

    return {
      ...ship,
      powers: powersWithStructured,
      structuredPowers: flattened,
    };
  });

  // GUARDRAIL: Check for unused overlay keys
  const allOverlayKeys = Object.keys(STRUCTURED_POWERS_HUMAN);
  const unusedKeys = allOverlayKeys.filter((k) => !usedKeys.has(k));

  if (unusedKeys.length > 0) {
    console.warn(
      `[ShipDefinitions.withStructuredPowers] Overlay keys did not match any ship power: ${unusedKeys.join(', ')}`
    );
  }

  return result;
}

// ============================================================================
// PUBLIC EXPORTS (JOINED DEFINITIONS)
// ============================================================================

/**
 * Joined ship definitions (server runtime view).
 */
export const SHIP_DEFINITIONS_WITH_STRUCTURED_POWERS_SERVER: ShipDefinitionWithStructuredPowers[] =
  attachStructuredPowers();

/**
 * Fast lookup by shipDefId.
 */
export const SHIP_DEFINITIONS_WITH_STRUCTURED_POWERS_BY_ID: Record<string, ShipDefinitionWithStructuredPowers> =
  Object.fromEntries(SHIP_DEFINITIONS_WITH_STRUCTURED_POWERS_SERVER.map((d) => [d.id, d]));

/**
 * Lookup joined definition. Returns undefined if unknown.
 */
export function getShipDefinition(id: string): ShipDefinitionWithStructuredPowers | undefined {
  return SHIP_DEFINITIONS_WITH_STRUCTURED_POWERS_BY_ID[id];
}

/**
 * Lookup joined definition. Throws if unknown.
 */
export function getShipDefinitionOrThrow(id: string): ShipDefinitionWithStructuredPowers {
  const def = getShipDefinition(id);
  if (!def) throw new Error(`[ShipDefinitions.withStructuredPowers] Unknown shipDefId: ${id}`);
  return def;
}
