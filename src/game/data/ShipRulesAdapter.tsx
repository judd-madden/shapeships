/**
 * Ship Rules Adapter
 * 
 * Transforms ShipDefinitionUI data into hover card view models.
 * Uses same logic as SpeciesRulesPanel for consistent rule rendering.
 * 
 * PASS 2: UI-only adapter, no engine/backend dependencies
 */

import type { ShipDefId } from '../types/ShipTypes.engine';
import { SHIP_DEFINITIONS_MAP } from './ShipDefinitionsUI';
import {
  getShipPhaseLabel,
  getShipPowerPresentation,
  type ShipPowerPresentation,
} from './ShipPowerPresentation';

/**
 * Complete ship hover card view model
 */
export interface ShipHoverModel {
  name: string;
  cost: number;
  joiningLines?: number;
  phaseLabel?: string;
  powers: ShipPowerPresentation[];
  italicNotes?: string;
  componentShipIds: readonly string[];
}

/**
 * Transform ship definition into hover card view model
 * 
 * @param shipId - Canonical ship ID (e.g., "DEF", "TAC", "CHR")
 * @returns Hover card view model or null if ship not found
 */
export function getShipHoverModel(shipId: ShipDefId): ShipHoverModel | null {
  const ship = SHIP_DEFINITIONS_MAP[shipId];
  
  if (!ship) {
    console.warn(`[ShipRulesAdapter] Ship not found: ${shipId}`);
    return null;
  }
  
  // Extract cost (use 0 if null for Solar Powers)
  const cost = ship.totalLineCost ?? 0;
  
  // Extract joining lines (undefined if null/0)
  const joiningLines = ship.joiningLineCost && ship.joiningLineCost > 0 
    ? ship.joiningLineCost 
    : undefined;
  
  // Extract phase label
  const phaseLabel = getShipPhaseLabel(ship.powers);
  
  // Transform powers
  const powers = ship.powers.map(getShipPowerPresentation);
  
  // Extract italic notes (extraRules)
  const italicNotes = ship.extraRules || undefined;
  
  // Extract component ship IDs
  const componentShipIds = ship.componentShips || [];
  
  return {
    name: ship.name,
    cost,
    joiningLines,
    phaseLabel,
    powers,
    italicNotes,
    componentShipIds
  };
}
