/**
 * SHIP DEFINITIONS UI LAYER
 * 
 * Decorates core ship definitions with React graphics components for UI rendering.
 * 
 * NAMING CONVENTION:
 * - UI components import from this file (ShipDefinitionsUI.tsx)
 * - Engine/server code imports from ShipDefinitions.core.ts
 * - Raw data source: ShipDefinitions.json.ts
 * 
 * This file is UI-ONLY and contains React component imports.
 * DO NOT import this file from engine/server code.
 */

import { SHIP_DEFINITIONS_CORE } from './ShipDefinitions.core';
import type { ShipDefinitionUI } from '../types/ShipTypes.ui';
import type { ShipDefId } from '../types/ShipTypes.engine';
import type { ShipDefinitionCore } from '../types/ShipTypes.core';
import type { ShipGraphic } from '../types/ShipTypes.ui';

// Import all ship graphics
import {
  DefenderShip,
  FighterShip,
  CommanderShip,
  InterceptorShip1,
  InterceptorShip0,
  OrbitalShip,
  CarrierShip6,
  CarrierShip5,
  CarrierShip4,
  CarrierShip3,
  CarrierShip2,
  CarrierShip1,
  CarrierShip0,
  StarshipShip,
  FrigateShip,
  TacticalCruiserShip,
  GuardianShip2,
  GuardianShip1,
  GuardianShip0,
  ScienceVesselShip,
  BattlecruiserShip,
  EarthShip,
  DreadnoughtShip,
  LeviathanShip
} from '../../graphics/human/assets';

import {
  XeniteShip,
  AntlionShip1,
  AntlionShip0,
  MantisShip,
  EvolverShip,
  OxiteShip,
  AsteriteShip,
  HellHornetShip,
  BugBreeder4Ship,
  BugBreeder3Ship,
  BugBreeder2Ship,
  BugBreeder1Ship,
  BugBreederDepletedShip,
  ZenithShip,
  DefenseSwarmShip,
  AntlionArrayShip,
  OxiteFaceShip,
  AsteriteFaceShip,
  SacrificialPoolShip,
  QueenShip,
  ChronoswarmShip,
  HiveShip
} from '../../graphics/xenite/assets';

import {
  ShipOfFearShip,
  ShipOfAngerShip,
  ShipOfEquality2Ship,
  ShipOfEquality1Ship,
  ShipOfEquality0Ship,
  ShipOfWisdom2Ship,
  ShipOfWisdom1Ship,
  ShipOfWisdom0Ship,
  ShipOfVigorShip,
  ShipOfFamily3Ship,
  ShipOfFamily2Ship,
  ShipOfFamily1Ship,
  ShipOfFamily0Ship,
  ShipOfLegacyShip,
  ArkOfTerrorShip,
  ArkOfFuryShip,
  ArkOfKnowledgeShip,
  ArkOfEntropyShip,
  ArkOfRedemptionShip,
  ArkOfPowerShip,
  ArkOfDestructionShip,
  ArkOfDominationShip
} from '../../graphics/centaur/assets';

import {
  MercuryCore,
  PlutoCore,
  QuantumMystic,
  Spiral,
  UranusCore,
  SolarReserve4,
  SolarReserve3,
  SolarReserve2,
  SolarReserve1,
  SolarReserve0,
  Cube
} from '../../graphics/ancient/assets';

// ============================================================================
// GRAPHICS MAPPING (Ship ID → Graphics)
// ============================================================================
// This is the ONLY place where ship IDs are associated with graphics
// NO duplication of ship stats/rules - those come from core

const GRAPHICS_BY_ID: Record<ShipDefId, ShipGraphic[]> = {
  // HUMAN
  'DEF': [{ component: DefenderShip, condition: 'default' }],
  'FIG': [{ component: FighterShip, condition: 'default' }],
  'COM': [{ component: CommanderShip, condition: 'default' }],
  'INT': [
    { component: InterceptorShip1, condition: 'charges_1' },
    { component: InterceptorShip0, condition: 'charges_0' }
  ],
  'ORB': [{ component: OrbitalShip, condition: 'default' }],
  'CAR': [
    { component: CarrierShip6, condition: 'charges_6' },
    { component: CarrierShip5, condition: 'charges_5' },
    { component: CarrierShip4, condition: 'charges_4' },
    { component: CarrierShip3, condition: 'charges_3' },
    { component: CarrierShip2, condition: 'charges_2' },
    { component: CarrierShip1, condition: 'charges_1' },
    { component: CarrierShip0, condition: 'charges_0' }
  ],
  'STA': [{ component: StarshipShip, condition: 'default' }],
  'FRI': [{ component: FrigateShip, condition: 'default' }],
  'TAC': [{ component: TacticalCruiserShip, condition: 'default' }],
  'GUA': [
    { component: GuardianShip2, condition: 'charges_2' },
    { component: GuardianShip1, condition: 'charges_1' },
    { component: GuardianShip0, condition: 'charges_0' }
  ],
  'SCI': [{ component: ScienceVesselShip, condition: 'default' }],
  'BAT': [{ component: BattlecruiserShip, condition: 'default' }],
  'EAR': [{ component: EarthShip, condition: 'default' }],
  'DRE': [{ component: DreadnoughtShip, condition: 'default' }],
  'LEV': [{ component: LeviathanShip, condition: 'default' }],

  // XENITE
  'XEN': [{ component: XeniteShip, condition: 'default' }],
  'ANT': [
    { component: AntlionShip1, condition: 'charges_1' },
    { component: AntlionShip0, condition: 'charges_0' }
  ],
  'MAN': [{ component: MantisShip, condition: 'default' }],
  'EVO': [{ component: EvolverShip, condition: 'default' }],
  'OXI': [{ component: OxiteShip, condition: 'default' }],
  'AST': [{ component: AsteriteShip, condition: 'default' }],
  'HEL': [{ component: HellHornetShip, condition: 'default' }],
  'BUG': [
    { component: BugBreeder4Ship, condition: 'charges_4' },
    { component: BugBreeder3Ship, condition: 'charges_3' },
    { component: BugBreeder2Ship, condition: 'charges_2' },
    { component: BugBreeder1Ship, condition: 'charges_1' },
    { component: BugBreederDepletedShip, condition: 'charges_depleted' }
  ],
  'ZEN': [{ component: ZenithShip, condition: 'default' }],
  'DSW': [{ component: DefenseSwarmShip, condition: 'default' }],
  'AAR': [{ component: AntlionArrayShip, condition: 'default' }],
  'OXF': [{ component: OxiteFaceShip, condition: 'default' }],
  'ASF': [{ component: AsteriteFaceShip, condition: 'default' }],
  'SAC': [{ component: SacrificialPoolShip, condition: 'default' }],
  'QUE': [{ component: QueenShip, condition: 'default' }],
  'CHR': [{ component: ChronoswarmShip, condition: 'default' }],
  'HVE': [{ component: HiveShip, condition: 'default' }],

  // CENTAUR
  'FEA': [{ component: ShipOfFearShip, condition: 'default' }],
  'ANG': [{ component: ShipOfAngerShip, condition: 'default' }],
  'EQU': [
    { component: ShipOfEquality2Ship, condition: 'charges_2' },
    { component: ShipOfEquality1Ship, condition: 'charges_1' },
    { component: ShipOfEquality0Ship, condition: 'charges_0' }
  ],
  'WIS': [
    { component: ShipOfWisdom2Ship, condition: 'charges_2' },
    { component: ShipOfWisdom1Ship, condition: 'charges_1' },
    { component: ShipOfWisdom0Ship, condition: 'charges_0' }
  ],
  'VIG': [{ component: ShipOfVigorShip, condition: 'default' }],
  'FAM': [
    { component: ShipOfFamily3Ship, condition: 'charges_3' },
    { component: ShipOfFamily2Ship, condition: 'charges_2' },
    { component: ShipOfFamily1Ship, condition: 'charges_1' },
    { component: ShipOfFamily0Ship, condition: 'charges_0' }
  ],
  'LEG': [{ component: ShipOfLegacyShip, condition: 'default' }],
  'TER': [{ component: ArkOfTerrorShip, condition: 'default' }],
  'FUR': [{ component: ArkOfFuryShip, condition: 'default' }],
  'KNO': [{ component: ArkOfKnowledgeShip, condition: 'default' }],
  'ENT': [{ component: ArkOfEntropyShip, condition: 'default' }],
  'RED': [{ component: ArkOfRedemptionShip, condition: 'default' }],
  'POW': [{ component: ArkOfPowerShip, condition: 'default' }],
  'DES': [{ component: ArkOfDestructionShip, condition: 'default' }],
  'DOM': [{ component: ArkOfDominationShip, condition: 'default' }],

  // ANCIENT
  'MER': [{ component: MercuryCore, condition: 'default' }],
  'PLU': [{ component: PlutoCore, condition: 'default' }],
  'QUA': [{ component: QuantumMystic, condition: 'default' }],
  'SPI': [{ component: Spiral, condition: 'default' }],
  'URA': [{ component: UranusCore, condition: 'default' }],
  'SOL': [
    { component: SolarReserve4, condition: 'charges_4' },
    { component: SolarReserve3, condition: 'charges_3' },
    { component: SolarReserve2, condition: 'charges_2' },
    { component: SolarReserve1, condition: 'charges_1' },
    { component: SolarReserve0, condition: 'charges_0' }
  ],
  'CUB': [{ component: Cube, condition: 'default' }],
};

// ============================================================================
// SHIP DEFINITIONS WITH GRAPHICS (UI-only)
// ============================================================================
// Decorates core definitions with graphics
// Single source of truth for ship stats: ShipDefinitions.core.ts

export const SHIP_DEFINITIONS: ShipDefinitionUI[] = SHIP_DEFINITIONS_CORE.map(
  (coreDef: ShipDefinitionCore): ShipDefinitionUI => ({
    ...coreDef,
    graphics: GRAPHICS_BY_ID[coreDef.id]
  })
);

// DEV-ONLY: Warn about ships with missing graphics
if (process.env.NODE_ENV === 'development') {
  // Known missing graphics (post-alpha): Ancient Solar Powers
  const knownMissingGraphics = new Set([
    'SAST', 'SSUP', 'SLIF', 'SSTA', 'SCON', 'SSIM', 'SSIP', 'SVOR', 'SBLA'
  ]);
  
  const shipsWithoutGraphics = SHIP_DEFINITIONS.filter(
    ship => !ship.graphics || ship.graphics.length === 0
  ).filter(ship => !knownMissingGraphics.has(ship.id));
  
  if (shipsWithoutGraphics.length > 0) {
    console.warn(
      '⚠️ ShipDefinitionsUI: The following ships are missing graphics:',
      shipsWithoutGraphics.map(ship => `${ship.id} (${ship.name})`).join(', ')
    );
    console.warn('Check that GRAPHICS_BY_ID keys match the canonical ship IDs in ShipDefinitions.core.ts');
  }
}

// Build lookup map
export const SHIP_DEFINITIONS_MAP: Record<ShipDefId, ShipDefinitionUI> = 
  SHIP_DEFINITIONS.reduce((map, def) => {
    map[def.id] = def;
    return map;
  }, {} as Record<ShipDefId, ShipDefinitionUI>);

// Helper functions (UI versions - delegate to core for logic)
export { 
  getShipDefinitionById as getShipById,
  getBasicShipCost,
  getUpgradedShipCost,
  getShipCost
} from './ShipDefinitions.core';

// Get UI definition with graphics
export function getShipDefinitionUI(shipDefId: ShipDefId): ShipDefinitionUI | undefined {
  return SHIP_DEFINITIONS_MAP[shipDefId];
}
