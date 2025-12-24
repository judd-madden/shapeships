// Ship data types - PURE (No React dependencies)
// This file can be imported by both client AND server (Deno edge function)
// Graphics types are in ShipTypes.ui.tsx (client-only)

import type { GameState } from './GameTypes';
import { EffectKind } from './EffectTypes';

// Re-export all types from main ShipTypes except graphics
export type {
  PlayerId,
  ShipDefId,
  ShipInstanceId,
  ShipPower,
  SpecialLogic,
  BasicShipCost,
  UpgradedShipCost,
  ComponentShipRequirement,
  SolarPowerCost,
  ShipInstance,
  PowerUsageRecord,
  PlayerShipCollection,
  ShipBuildingValidation,
  PowerExecutionContext,
  GameContext,
  ShipColor,
  QueuedEffect,
  TriggeredEffect,
  EvaluatedEffect,
  AnyEffect,
  EffectSource,
  EffectTarget,
  EnergyColor
} from './ShipTypes';

export {
  ShipType,
  Species,
  ShipPowerPhase,
  PowerTiming,
  PowerEffectType,
  EffectKind,
  SHIP_COLORS
} from './ShipTypes';

// Pure ship definition without graphics
export interface PureShipDefinition {
  // Basic identification
  id: string;
  name: string;
  species: 'human' | 'xenite' | 'centaur' | 'ancient';
  type: 'basic' | 'upgraded' | 'solar_power';
  
  // Visual properties (non-React)
  color: string;
  
  // Cost structure
  basicCost?: { lines: number };
  upgradedCost?: {
    componentShips: Array<{
      shipId: string;
      quantity: number;
      mustBeDepleted?: boolean;
    }>;
    joiningLines: number;
    totalLines: number;
  };
  solarCost?: { energy: number };
  
  // Energy cost (Ancient)
  energyCost?: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';
  };
  
  // Powers
  powers: any[]; // Import ShipPower from './ShipTypes' in actual usage
  
  // Charge system
  maxCharges?: number;
  chargesPerTurn?: number;
  
  // Maximum quantity allowed
  maxQuantity?: number;
  
  // Metadata
  description?: string;
  rulesNotes?: string;
}
