/**
 * Ship Rules Adapter
 * 
 * Transforms ShipDefinitionUI data into hover card view models.
 * Uses same logic as SpeciesRulesPanel for consistent rule rendering.
 * 
 * PASS 2: UI-only adapter, no engine/backend dependencies
 */

import type { ShipDefId } from '../types/ShipTypes.engine';
import type { ShipDefinitionUI } from '../types/ShipTypes.ui';
import { SHIP_DEFINITIONS_MAP } from './ShipDefinitionsUI';

/**
 * Icon type for ship powers
 * - pencil: Build-phase powers (Ships That Build, Line Generation, etc.)
 * - star: Battle-phase powers (Automatic, Charge Declaration, etc.)
 */
export type PowerIcon = 'pencil' | 'star';

/**
 * Ship power display model for hover cards
 */
export interface ShipPowerViewModel {
  icon: PowerIcon;
  text: string; // Already processed with newlines
}

/**
 * Complete ship hover card view model
 */
export interface ShipHoverModel {
  name: string;
  cost: number;
  joiningLines?: number;
  phaseLabel?: string;
  powers: ShipPowerViewModel[];
  italicNotes?: string;
  componentShipIds: ShipDefId[];
}

/**
 * Determine phase icon from subphase string
 * Same logic as SpeciesRulesPanel.getPhaseIcon()
 */
function getPhaseIcon(subphase: string): PowerIcon {
  const buildSubphases = [
    'Dice Manipulation',
    'Line Generation',
    'Ships That Build',
    'Drawing',
    'End of Build Phase'
  ];
  
  const battleSubphases = [
    'First Strike',
    'Charge Declaration',
    'Automatic',
    'Upon Destruction',
    'Energy',
    'Solar',
    'End of Battle Phase'
  ];
  
  if (buildSubphases.some(s => subphase.includes(s))) {
    return 'pencil';
  }
  
  if (battleSubphases.some(s => subphase.includes(s))) {
    return 'star';
  }
  
  // Default to star for unknown subphases
  return 'star';
}

/**
 * Convert literal \\n sequences to real newlines
 * Same logic as SpeciesRulesPanel.renderPowerText()
 */
function renderPowerText(text: string): string {
  return text.replace(/\\n/g, '\n');
}

/**
 * Get deduplicated phase label from ship powers
 * Same logic as SpeciesRulesPanel.getSubphaseLabel()
 */
function getSubphaseLabel(ship: ShipDefinitionUI): string {
  const seen = new Set<string>();
  const uniqueSubphases: string[] = [];
  
  for (const power of ship.powers) {
    const subphase = power.subphase;
    // Skip empty values and N/A
    if (!subphase || subphase.trim() === '' || subphase.toUpperCase() === 'N/A') {
      continue;
    }
    
    const normalized = subphase.toUpperCase();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueSubphases.push(normalized);
    }
  }
  
  return uniqueSubphases.join(', ');
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
  const phaseLabel = getSubphaseLabel(ship);
  
  // Transform powers
  const powers: ShipPowerViewModel[] = ship.powers.map(power => ({
    icon: getPhaseIcon(power.subphase),
    text: renderPowerText(power.text)
  }));
  
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
