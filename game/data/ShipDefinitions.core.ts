/**
 * CORE SHIP DEFINITIONS (JSON-NATIVE)
 * 
 * Single source of truth: /game/data/ShipDefinitions.json.ts
 * 
 * This module provides the canonical ship definition array and helper functions
 * for accessing ship data throughout the codebase.
 * 
 * DATA FLOW:
 * - JSON file (SHIP_DEFINITIONS_JSON) is the authoritative source
 * - This module exports typed ShipDefinitionCore array
 * - Engine and UI layers import from here
 * 
 * NO CSV LAYER - The legacy CSV compatibility layer has been removed.
 * All code now consumes JSON-native types.
 */

import { SHIP_DEFINITIONS_JSON } from './ShipDefinitions.json';
import type { ShipDefinitionCore } from '../types/ShipTypes.core';

// ============================================================================
// CORE SHIP DEFINITIONS
// ============================================================================

/**
 * Canonical ship definitions array (JSON-native)
 * 
 * Derived directly from SHIP_DEFINITIONS_JSON with minimal transformation:
 * - Ensures componentShips is always an array (never undefined)
 * - Ensures extraRules is always a string (defaults to empty string)
 * - All other fields pass through unchanged
 */
export const SHIP_DEFINITIONS_CORE: ShipDefinitionCore[] = SHIP_DEFINITIONS_JSON.map((s) => ({
  ...s,
  componentShips: Array.isArray(s.componentShips) ? s.componentShips : [],
  extraRules: s.extraRules ?? '',
}));

// ============================================================================
// LOOKUP MAP (O(1) ACCESS)
// ============================================================================

/**
 * O(1) lookup map for ship definitions by ID
 */
export const SHIP_DEFINITIONS_CORE_MAP: Record<string, ShipDefinitionCore> = 
  SHIP_DEFINITIONS_CORE.reduce((map, ship) => {
    map[ship.id] = ship;
    return map;
  }, {} as Record<string, ShipDefinitionCore>);

// ============================================================================
// DEV-ONLY VALIDATIONS
// ============================================================================

/**
 * Validate ship ID uniqueness
 * Throws in development if duplicates are detected
 */
function validateShipIdUniqueness(ships: ShipDefinitionCore[]): void {
  const ids = new Set<string>();
  const duplicates: string[] = [];
  
  for (const ship of ships) {
    if (!ship.id || ship.id.trim() === '') {
      throw new Error('[ShipDefinitions.core] Ship found with empty ID');
    }
    
    if (ids.has(ship.id)) {
      duplicates.push(ship.id);
    }
    ids.add(ship.id);
  }
  
  if (duplicates.length > 0) {
    throw new Error(
      `[ShipDefinitions.core] Duplicate ship IDs detected: ${duplicates.join(', ')}`
    );
  }
}

/**
 * Validate that NO power text contains real newline characters
 * Power text must use literal "\\n" escape sequences only
 * 
 * CRITICAL INVARIANT: Power text is stored with literal backslash-n sequences
 * and must never contain actual newline characters.
 */
function validateNoRealNewlines(ships: ShipDefinitionCore[]): void {
  const violations: string[] = [];
  
  for (const ship of ships) {
    for (let i = 0; i < ship.powers.length; i++) {
      const power = ship.powers[i];
      
      // Check for ACTUAL newline character (not the literal sequence)
      if (power.text.includes('\n')) {
        violations.push(
          `Ship "${ship.id}" power ${i} (${power.subphase}): contains real newline character`
        );
      }
    }
  }
  
  if (violations.length > 0) {
    throw new Error(
      `[ShipDefinitions.core] Power text contains real newline characters (must use literal "\\\\n"):\n` +
      violations.map(v => `  - ${v}`).join('\n')
    );
  }
}

// Run validations in development only
if (process.env.NODE_ENV !== 'production') {
  validateShipIdUniqueness(SHIP_DEFINITIONS_CORE);
  validateNoRealNewlines(SHIP_DEFINITIONS_CORE);
  
  console.log(
    `[ShipDefinitions.core] ✓ Validated ${SHIP_DEFINITIONS_CORE.length} ships ` +
    `(${SHIP_DEFINITIONS_CORE.reduce((sum, s) => sum + s.powers.length, 0)} powers)`
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get ship definition by ID
 * Returns undefined if not found
 */
export function getShipById(id: string): ShipDefinitionCore | undefined {
  return SHIP_DEFINITIONS_CORE_MAP[id];
}

/**
 * Get ship definition by ID (throws if not found)
 * Use when ship must exist or it's a programmer error
 */
export function getShipByIdOrThrow(id: string): ShipDefinitionCore {
  const ship = SHIP_DEFINITIONS_CORE_MAP[id];
  if (!ship) {
    throw new Error(
      `Ship definition not found for id: "${id}". ` +
      `Available ids: ${Object.keys(SHIP_DEFINITIONS_CORE_MAP).sort().join(', ')}`
    );
  }
  return ship;
}

/**
 * Get all ship definitions
 * Returns a new array (defensive copy)
 */
export function getAllShips(): ShipDefinitionCore[] {
  return [...SHIP_DEFINITIONS_CORE];
}

/**
 * Get ships by species
 */
export function getShipsBySpecies(species: string): ShipDefinitionCore[] {
  return SHIP_DEFINITIONS_CORE.filter(ship => ship.species === species);
}

/**
 * Get ships by type
 */
export function getShipsByType(shipType: string): ShipDefinitionCore[] {
  return SHIP_DEFINITIONS_CORE.filter(ship => ship.shipType === shipType);
}