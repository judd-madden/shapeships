/**
 * Ship Build Eligibility
 * 
 * UI-only eligibility computation for ship catalogue hover cards.
 * Determines if a ship can be built and provides user-facing feedback.
 * 
 * PASS 2: No engine validation, no backend calls.
 * All inputs are provided by UI layer (VM or stubs).
 */

import type { ShipDefId } from '../../../../../types/ShipTypes.engine';

/**
 * Ship build eligibility states
 */
export type ShipEligibilityState =
  | 'CAN_BUILD'           // All requirements met
  | 'NEED_COMPONENTS'     // Missing required component ships
  | 'NOT_ENOUGH_LINES'    // Insufficient lines or joining lines
  | 'MAX_LIMIT'           // Ship limit reached (e.g., Orbital, Science Vessel, Chronoswarm)
  | 'OPPONENT_VIEW';      // Viewing opponent's catalogue

/**
 * Eligibility computation result
 */
export interface ShipEligibility {
  state: ShipEligibilityState;
  /** Missing component ship IDs (only populated for NEED_COMPONENTS state) */
  missingComponentShipIds?: ShipDefId[];
}

/**
 * Inputs for eligibility computation
 */
export interface ShipEligibilityInputs {
  /** Ship ID to check */
  shipId: ShipDefId;
  
  /** Is this the opponent's catalogue view? */
  isOpponentView: boolean;
  
  /** Map of owned ship IDs to counts */
  ownedShipsById: Record<ShipDefId, number>;
  
  /** Total line cost required for this ship */
  totalLineCost: number;
  
  /** Joining line cost required (0 if not an upgrade) */
  joiningLineCost: number;
  
  /** Available lines (regular + bonus + dice) */
  availableLines: number;
  
  /** Available joining lines from owned ships */
  availableJoiningLines: number;
  
  /** Ships that have reached max limit (UI-only stub in PASS 2) */
  maxLimitReachedById: Partial<Record<ShipDefId, boolean>>;
  
  /** Required component ship IDs */
  componentShipIds: ShipDefId[];
}

/**
 * Compute ship build eligibility
 * 
 * Logic order (first match wins):
 * 1. Opponent view → OPPONENT_VIEW
 * 2. Max limit reached → MAX_LIMIT
 * 3. Missing components → NEED_COMPONENTS
 * 4. Insufficient lines → NOT_ENOUGH_LINES
 * 5. Else → CAN_BUILD
 */
export function computeShipEligibility(inputs: ShipEligibilityInputs): ShipEligibility {
  // 1. Opponent view check
  if (inputs.isOpponentView) {
    return { state: 'OPPONENT_VIEW' };
  }
  
  // 2. Max limit check
  if (inputs.maxLimitReachedById[inputs.shipId]) {
    return { state: 'MAX_LIMIT' };
  }
  
  // 3. Component ships check
  const missingComponents: ShipDefId[] = [];
  for (const componentId of inputs.componentShipIds) {
    const owned = inputs.ownedShipsById[componentId] || 0;
    if (owned === 0) {
      missingComponents.push(componentId);
    }
  }
  
  if (missingComponents.length > 0) {
    return {
      state: 'NEED_COMPONENTS',
      missingComponentShipIds: missingComponents
    };
  }
  
  // 4. Line cost check
  const totalCostRequired = inputs.totalLineCost + inputs.joiningLineCost;
  const canAffordRegularLines = inputs.availableLines >= inputs.totalLineCost;
  const canAffordJoiningLines = inputs.availableJoiningLines >= inputs.joiningLineCost;
  
  if (!canAffordRegularLines || !canAffordJoiningLines) {
    return { state: 'NOT_ENOUGH_LINES' };
  }
  
  // 5. Can build
  return { state: 'CAN_BUILD' };
}