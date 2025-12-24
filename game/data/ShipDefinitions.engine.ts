/**
 * Ship Definitions - ENGINE LAYER (CSV → Engine Conversion)
 * 
 * PURPOSE:
 * Converts CSV-shaped definitions (lossless raw text) into engine-ready
 * definitions (typed enums, parsed costs, structured powers).
 * 
 * ARCHITECTURE:
 * CSV (source of truth) → [THIS FILE] → Engine runtime
 * 
 * INPUT:  ShipDefinitionCsv (from ShipDefinitions.core.ts)
 * OUTPUT: EngineShipDefinition (canonical engine type)
 * 
 * RULES:
 * - Deterministic and reproducible: same CSV => same engine output
 * - No React imports (server-safe for Deno edge functions)
 * - Always preserves rawSubphase and rawText in powers
 * - Does NOT default to EffectKind.CUSTOM - leaves kind undefined when unknown
 * - Manual overrides are minimal and explicit
 * - Validation errors logged to ENGINE_CONVERSION_ERRORS
 * 
 * GENERATED: 2024-12-24
 */

import { PURE_SHIP_DEFINITIONS } from './ShipDefinitions.core';
import type { ShipDefinitionCsv, ShipPowerTextCsv } from '../types/ShipTypes.csv';
import type {
  EngineShipDefinition,
  EngineShipPower,
  ShipDefId,
  Species,
  ShipType,
  ShipPowerPhase,
  PowerTiming,
  BasicShipCost,
  UpgradedShipCost,
  EnergyCost,
  ComponentShipRequirement,
  SpecialLogic
} from '../types/ShipTypes.engine';
import {
  Species as SpeciesEnum,
  ShipType as ShipTypeEnum,
  ShipPowerPhase as PhaseEnum,
  PowerTiming as TimingEnum
} from '../types/ShipTypes.engine';
import { EffectKind } from '../types/EffectTypes';

// ============================================================================
// CONVERSION ERRORS (EXPORTED FOR SERVER LOGGING)
// ============================================================================

export const ENGINE_CONVERSION_ERRORS: string[] = [];

function logError(message: string): void {
  ENGINE_CONVERSION_ERRORS.push(message);
  console.error(`[ShipDefinitions.engine] ${message}`);
}

// ============================================================================
// SHIP NAME → ID LOOKUP
// ============================================================================

const SHIP_NAME_TO_ID_MAP: Record<string, ShipDefId> = {};

function buildShipNameLookup(): void {
  for (const ship of PURE_SHIP_DEFINITIONS) {
    const normalized = ship.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    SHIP_NAME_TO_ID_MAP[normalized] = ship.id;
    SHIP_NAME_TO_ID_MAP[ship.name.toLowerCase()] = ship.id;
  }
  
  // Known special cases
  SHIP_NAME_TO_ID_MAP['earthship'] = 'EAR';
  SHIP_NAME_TO_ID_MAP['earth ship'] = 'EAR';
}

buildShipNameLookup();

function resolveShipName(shipName: string): ShipDefId | undefined {
  const normalized = shipName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const result = SHIP_NAME_TO_ID_MAP[normalized];
  if (!result) {
    logError(`Failed to resolve ship name: "${shipName}"`);
  }
  return result;
}

// ============================================================================
// PHASE 1: ENUM MAPPING
// ============================================================================

function mapSpecies(csvSpecies: string): Species {
  switch (csvSpecies) {
    case 'Human': return SpeciesEnum.HUMAN;
    case 'Xenite': return SpeciesEnum.XENITE;
    case 'Centaur': return SpeciesEnum.CENTAUR;
    case 'Ancient': return SpeciesEnum.ANCIENT;
    default:
      logError(`Unknown species: ${csvSpecies}, defaulting to HUMAN`);
      return SpeciesEnum.HUMAN;
  }
}

function mapShipType(csvShipType: string): ShipType {
  switch (csvShipType) {
    case 'Basic':
    case 'Basic - Evolved':
      return ShipTypeEnum.BASIC;
    case 'Upgraded':
      return ShipTypeEnum.UPGRADED;
    case 'Solar Power':
      return ShipTypeEnum.SOLAR_POWER;
    default:
      logError(`Unknown ship type: ${csvShipType}, defaulting to BASIC`);
      return ShipTypeEnum.BASIC;
  }
}

// ============================================================================
// PHASE 2: COST PARSING
// ============================================================================

function parseComponentShips(components: string[], shipId: string): ComponentShipRequirement[] {
  const grouped: Record<string, { quantity: number; mustBeDepleted: boolean }> = {};
  
  for (const comp of components) {
    if (comp.includes('energy')) continue; // Skip energy strings
    
    const depletedMatch = comp.match(/^([A-Z]+)\(0\)$/);
    if (depletedMatch) {
      const componentShipId = depletedMatch[1];
      if (!grouped[componentShipId]) {
        grouped[componentShipId] = { quantity: 0, mustBeDepleted: true };
      }
      grouped[componentShipId].quantity++;
    } else {
      const componentShipId = comp.trim();
      if (!grouped[componentShipId]) {
        grouped[componentShipId] = { quantity: 0, mustBeDepleted: false };
      }
      grouped[componentShipId].quantity++;
    }
  }
  
  return Object.entries(grouped).map(([componentShipId, data]) => ({
    shipId: componentShipId as ShipDefId,
    quantity: data.quantity,
    mustBeDepleted: data.mustBeDepleted || undefined
  }));
}

function parseSolarEnergyCost(components: string[]): EnergyCost | undefined {
  const cost: EnergyCost = {};
  
  for (const comp of components) {
    const lowerComp = comp.toLowerCase();
    
    if (lowerComp.includes('x ')) {
      cost.variable = 'ship_line_cost';
      continue;
    }
    
    const match = lowerComp.match(/(\d+)\s*(red|green|blue)/);
    if (match) {
      const amount = parseInt(match[1], 10);
      const color = match[2] as 'red' | 'green' | 'blue';
      cost[color] = (cost[color] || 0) + amount;
    }
  }
  
  return Object.keys(cost).length > 0 ? cost : undefined;
}

function convertCost(csvShip: ShipDefinitionCsv, shipType: ShipType): {
  basicCost?: BasicShipCost;
  upgradedCost?: UpgradedShipCost;
  energyCost?: EnergyCost;
} {
  const result: ReturnType<typeof convertCost> = {};
  
  if (shipType === ShipTypeEnum.BASIC) {
    if (csvShip.totalLineCost !== null) {
      result.basicCost = { totalLines: csvShip.totalLineCost };
    }
  } else if (shipType === ShipTypeEnum.UPGRADED) {
    const components = parseComponentShips(csvShip.componentShips || [], csvShip.id);
    result.upgradedCost = {
      joiningLines: csvShip.joiningLineCost ?? 0,
      components
    };
  } else if (shipType === ShipTypeEnum.SOLAR_POWER) {
    const energyCost = parseSolarEnergyCost(csvShip.componentShips || []);
    result.energyCost = energyCost;
  }
  
  return result;
}

// ============================================================================
// PHASE 3: POWER PHASE MAPPING
// ============================================================================

function mapSubphaseToPhase(subphase: string): ShipPowerPhase {
  const normalized = subphase.trim();
  
  if (normalized === 'Line Generation') return PhaseEnum.LINE_GENERATION;
  if (normalized === 'Ships That Build') return PhaseEnum.SHIPS_THAT_BUILD;
  if (normalized === 'Drawing') return PhaseEnum.DRAWING;
  if (normalized === 'End of Build Phase') return PhaseEnum.END_OF_BUILD;
  if (normalized === 'First Strike') return PhaseEnum.FIRST_STRIKE;
  if (normalized === 'Charge Declaration') return PhaseEnum.SIMULTANEOUS_DECLARATION;
  if (normalized === 'Dice Manipulation') return PhaseEnum.DICE_MANIPULATION;
  if (normalized === 'Automatic') return PhaseEnum.AUTOMATIC;
  
  if (normalized.includes('(Passive)') || normalized.includes('(passive)')) {
    return PhaseEnum.EVENT;
  }
  if (normalized.includes('Upon Destruction')) {
    return PhaseEnum.EVENT;
  }
  
  if (!normalized || normalized === '') {
    return PhaseEnum.EVENT;
  }
  
  console.warn(`[ShipDefinitions.engine] Unknown subphase: "${subphase}", mapping to EVENT`);
  return PhaseEnum.EVENT;
}

// ============================================================================
// PHASE 4: TIMING INFERENCE
// ============================================================================

function inferTiming(csvPower: ShipPowerTextCsv): PowerTiming {
  const subphase = csvPower.subphase.trim();
  const text = csvPower.text.toLowerCase();
  
  if (subphase.includes('Upon Destruction')) {
    return TimingEnum.UPON_DESTRUCTION;
  }
  
  if (text.includes('once only') && subphase === 'Automatic') {
    return TimingEnum.ONCE_ONLY_AUTOMATIC;
  }
  
  if (subphase.includes('(Passive)') || subphase.includes('(passive)')) {
    return TimingEnum.PASSIVE;
  }
  
  return TimingEnum.CONTINUOUS;
}

// ============================================================================
// PHASE 5: EFFECT INFERENCE (MINIMAL - Only Obvious Cases)
// ============================================================================

/**
 * Minimal effect type detection
 * Only handles SIMPLE literal cases.
 * Does NOT default to CUSTOM - returns undefined kind for unknown patterns.
 */
function inferEffect(text: string): {
  kind?: EffectKind;
  baseAmount?: number;
  specialLogic?: Partial<SpecialLogic>;
} {
  const lower = text.toLowerCase();
  
  // Simple literal patterns only
  const healMatch = lower.match(/^heal (\d+)\.$/);
  if (healMatch) {
    return {
      kind: EffectKind.HEAL,
      baseAmount: parseInt(healMatch[1], 10)
    };
  }
  
  const damageMatch = lower.match(/^deal (\d+) damage\.$/);
  if (damageMatch) {
    return {
      kind: EffectKind.DAMAGE,
      baseAmount: parseInt(damageMatch[1], 10)
    };
  }
  
  const lineMatch = lower.match(/^generate (\d+) additional lines?\.$/);
  if (lineMatch) {
    return {
      kind: EffectKind.GAIN_LINES,
      baseAmount: parseInt(lineMatch[1], 10)
    };
  }
  
  if (lower === 'generate an additional line in each future build phase.') {
    return {
      kind: EffectKind.GAIN_LINES,
      baseAmount: 1
    };
  }
  
  const buildMatch = text.match(/^Make an? ([A-Za-z\s]+)\.$/);
  if (buildMatch) {
    const shipName = buildMatch[1].trim();
    const shipId = resolveShipName(shipName);
    
    if (shipId) {
      return {
        kind: EffectKind.BUILD_SHIP,
        specialLogic: { buildShipId: shipId }
      };
    }
  }
  
  // Unknown pattern - return empty (kind will be undefined)
  return {};
}

// ============================================================================
// PHASE 6: MANUAL POWER OVERRIDES
// ============================================================================

/**
 * Minimal manual overrides for specific ships/powers
 * Only set when necessary for correct engine behavior
 */
const MANUAL_POWER_OVERRIDES: Record<string, Record<number, Partial<EngineShipPower>>> = {
  'CAR': {
    0: {
      kind: EffectKind.BUILD_SHIP,
      requiresCharge: true,
      chargesRequired: 1,
      specialLogic: { buildShipId: 'DEF', chargesRequired: 1 }
    },
    1: {
      kind: EffectKind.BUILD_SHIP,
      requiresCharge: true,
      chargesRequired: 2,
      specialLogic: { buildShipId: 'FIG', chargesRequired: 2 }
    }
  },
  
  'ORB': {
    0: {
      kind: EffectKind.GAIN_LINES,
      baseAmount: 1,
      specialLogic: {
        lineGeneration: { amount: 1, applyToFutureTurns: true }
      }
    }
  },
  
  'SOL': {
    0: {
      kind: EffectKind.GAIN_ENERGY,
      requiresCharge: true,
      chargesRequired: 1,
      specialLogic: {
        energyGeneration: { red: 1, green: 1, blue: 1 },
        chargesRequired: 1
      }
    },
    1: {
      kind: EffectKind.HEAL,
      baseAmount: 2,
      specialLogic: {
        condition: 'charges_depleted'
      }
    }
  },
  
  'INT': {
    0: {
      kind: EffectKind.HEAL,
      baseAmount: 5,
      requiresCharge: true,
      chargesRequired: 1
    },
    1: {
      kind: EffectKind.DAMAGE,
      baseAmount: 5,
      requiresCharge: true,
      chargesRequired: 1
    }
  },
  
  'COM': {
    0: {
      kind: EffectKind.COUNT_AND_DAMAGE,
      specialLogic: {
        countType: 'specific_ship_type',
        countTarget: 'FIG',
        countMultiplier: 3
      }
    }
  },
  
  'BAT': {
    0: {
      kind: EffectKind.GAIN_LINES,
      baseAmount: 2,
      specialLogic: {
        lineGeneration: { amount: 2, applyToFutureTurns: true }
      }
    },
    1: {
      kind: EffectKind.HEAL,
      baseAmount: 3
    },
    2: {
      kind: EffectKind.DAMAGE,
      baseAmount: 2
    }
  }
};

// ============================================================================
// PHASE 7: COMPILE POWER
// ============================================================================

function compilePower(
  csvPower: ShipPowerTextCsv,
  powerIndex: number,
  shipId: string
): EngineShipPower {
  const phase = mapSubphaseToPhase(csvPower.subphase);
  const timing = inferTiming(csvPower);
  const inferred = inferEffect(csvPower.text);
  const override = MANUAL_POWER_OVERRIDES[shipId]?.[powerIndex];
  
  const power: EngineShipPower = {
    powerIndex,
    phase: override?.phase ?? phase,
    timing: override?.timing ?? timing,
    rawSubphase: csvPower.subphase,
    rawText: csvPower.text,
    
    // Optional fields (only set when known)
    effectAst: csvPower.effectAst,
    kind: override?.kind ?? inferred.kind,
    baseAmount: override?.baseAmount ?? inferred.baseAmount,
    specialLogic: override?.specialLogic ?? inferred.specialLogic,
    requiresCharge: override?.requiresCharge,
    chargesRequired: override?.chargesRequired,
    requiresPlayerChoice: override?.requiresPlayerChoice,
    choiceType: override?.choiceType,
    isOptional: override?.isOptional
  };
  
  return power;
}

// ============================================================================
// PHASE 8: MAX QUANTITY INFERENCE
// ============================================================================

function inferMaxQuantity(extraRules?: string): number | undefined {
  if (!extraRules) return undefined;
  
  const lower = extraRules.toLowerCase();
  
  if (lower.includes('maximum of 6')) return 6;
  if (lower.includes('maximum of 3')) return 3;
  if (lower.includes('maximum of 2')) return 2;
  
  return undefined;
}

// ============================================================================
// PHASE 9: CONVERT SHIP
// ============================================================================

function convertShipDefinition(csvShip: ShipDefinitionCsv): EngineShipDefinition {
  const species = mapSpecies(csvShip.species);
  const shipType = mapShipType(csvShip.shipType);
  const costs = convertCost(csvShip, shipType);
  
  const powers = csvShip.powers.map((csvPower, index) =>
    compilePower(csvPower, index, csvShip.id)
  );
  
  const engineShip: EngineShipDefinition = {
    id: csvShip.id,
    name: csvShip.name,
    species,
    type: shipType,
    color: csvShip.colour,
    
    basicCost: costs.basicCost,
    upgradedCost: costs.upgradedCost,
    energyCost: costs.energyCost,
    
    powers,
    
    maxCharges: csvShip.charges ?? undefined,
    maxQuantity: inferMaxQuantity(csvShip.extraRules),
    
    rulesNotes: csvShip.extraRules,
    stackCaption: csvShip.stackCaption
  };
  
  return engineShip;
}

// ============================================================================
// PUBLIC API: ENGINE SHIP DEFINITIONS
// ============================================================================

export const ENGINE_SHIP_DEFINITIONS: EngineShipDefinition[] = 
  PURE_SHIP_DEFINITIONS.map(convertShipDefinition);

export const ENGINE_SHIP_DEFINITIONS_MAP: Record<ShipDefId, EngineShipDefinition> =
  ENGINE_SHIP_DEFINITIONS.reduce((map, def) => {
    map[def.id] = def;
    return map;
  }, {} as Record<ShipDefId, EngineShipDefinition>);

// ============================================================================
// PUBLIC API: HELPER FUNCTIONS
// ============================================================================

export function getShipDefinitionById(shipDefId: ShipDefId): EngineShipDefinition | undefined {
  return ENGINE_SHIP_DEFINITIONS_MAP[shipDefId];
}

export function getShipById(shipDefId: ShipDefId): EngineShipDefinition | undefined {
  return getShipDefinitionById(shipDefId);
}

export function getBasicShipCost(shipDefId: ShipDefId): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.basicCost?.totalLines ?? null;
}

export function getUpgradedShipCost(shipDefId: ShipDefId): number | null {
  const ship = getShipDefinitionById(shipDefId);
  return ship?.upgradedCost?.joiningLines ?? null;
}

export function getShipCost(shipDefId: ShipDefId): number | null {
  const ship = getShipDefinitionById(shipDefId);
  if (!ship) return null;
  
  if (ship.upgradedCost) return ship.upgradedCost.joiningLines;
  if (ship.basicCost) return ship.basicCost.totalLines;
  return null;
}

// ============================================================================
// LOGGING
// ============================================================================

if (ENGINE_CONVERSION_ERRORS.length > 0) {
  console.warn(`[ShipDefinitions.engine] ${ENGINE_CONVERSION_ERRORS.length} conversion errors`);
}
