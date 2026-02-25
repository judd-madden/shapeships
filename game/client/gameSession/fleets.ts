/**
 * FLEET DERIVATION
 * 
 * Extract ship ownership, apply visibility rules, and aggregate fleet summaries.
 */

import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import type { ShipDefId } from '../../types/ShipTypes.engine';

interface BoardFleetSummary {
  shipDefId: string;
  count: number;

  /**
   * Stable unique key for rendered fleet stack.
   * - default: shipDefId
   * - maxCharges=1 split: `${shipDefId}__charges_1` / `${shipDefId}__charges_0`
   * - maxCharges>1 active: `${shipDefId}__inst_${instanceId}`
   * - maxCharges>1 depleted bucket: `${shipDefId}__charges_0`
   */
  stackKey: string;

  /**
   * Optional condition (used later for graphics selection).
   * Only required for charge-split/bucket stacks.
   */
  condition?: 'charges_1' | 'charges_0';
}

export function deriveFleets(args: {
  rawState: any;
  me: any;
  opponent: any;
  turnNumber: number;
  majorPhase: string;
}) {
  const { rawState, me, opponent, turnNumber, majorPhase } = args;
  
  // ============================================================================
  // SHIP OWNERSHIP (ME/OPPONENT)
  // ============================================================================
  
  // Extract ships from server state
  const shipsData = rawState?.gameData?.ships || rawState?.ships || {};
  
  // Map ships to me/opponent (not server array order)
  const myShips = me?.id ? (shipsData[me.id] || []) : [];
  const opponentShips = opponent?.id ? (shipsData[opponent.id] || []) : [];
  
  // Use majorPhase already defined earlier (line ~798)
  const isInBattlePhase = majorPhase === 'battle';
  
  // Opponent visibility rule:
  // - Always show opponent ships from prior turns
  // - Hide opponent ships created this turn until battle
  const opponentShipsVisible = opponentShips.filter((ship: any) => {
    const createdTurn = ship?.createdTurn;
    // If createdTurn is missing, treat as "old" (visible). This avoids accidental hiding due to incomplete data.
    if (typeof createdTurn !== 'number') return true;
    if (createdTurn < turnNumber) return true;
    // createdTurn === turnNumber -> visible only in battle
    return isInBattlePhase;
  });
  
  // Aggregate fleet summaries with charge-aware stacking
  function aggregateFleet(ships: any[]): BoardFleetSummary[] {
    // Buckets: stackKey -> { shipDefId, count, condition? }
    const buckets = new Map<string, { shipDefId: string; count: number; condition?: 'charges_1' | 'charges_0' }>();
    
    for (const ship of ships) {
      const shipDefId = (ship.shipDefId || 'UNKNOWN') as ShipDefId;
      const def = getShipDefinitionById(shipDefId);
      const maxCharges = def?.maxCharges ?? 0;
      const chargesCurrent = Number((ship as any).chargesCurrent ?? 0);
      const instanceId = (ship as any).instanceId ?? (ship as any).id ?? '';
      
      let stackKey: string;
      let condition: 'charges_1' | 'charges_0' | undefined = undefined;
      
      if (maxCharges === 1) {
        // Rule 1: maxCharges === 1 (split into 2 stacks)
        if (chargesCurrent >= 1) {
          stackKey = `${shipDefId}__charges_1`;
          condition = 'charges_1';
        } else {
          stackKey = `${shipDefId}__charges_0`;
          condition = 'charges_0';
        }
        
        const existing = buckets.get(stackKey);
        if (existing) {
          existing.count++;
        } else {
          buckets.set(stackKey, { shipDefId, count: 1, condition });
        }
      } else if (maxCharges > 1) {
        // Rule 2: maxCharges > 1
        if (chargesCurrent > 0) {
          // Active: do not stack, emit one entry per instance
          stackKey = `${shipDefId}__inst_${instanceId}`;
          buckets.set(stackKey, { shipDefId, count: 1, condition: undefined });
        } else {
          // Depleted: accumulate into depleted bucket
          stackKey = `${shipDefId}__charges_0`;
          condition = 'charges_0';
          
          const existing = buckets.get(stackKey);
          if (existing) {
            existing.count++;
          } else {
            buckets.set(stackKey, { shipDefId, count: 1, condition });
          }
        }
      } else {
        // Rule 3: maxCharges === 0 (normal stacking)
        stackKey = shipDefId;
        
        const existing = buckets.get(stackKey);
        if (existing) {
          existing.count++;
        } else {
          buckets.set(stackKey, { shipDefId, count: 1, condition: undefined });
        }
      }
    }
    
    // Convert to array and sort for stable ordering
    const result: BoardFleetSummary[] = Array.from(buckets.entries()).map(([stackKey, data]) => ({
      shipDefId: data.shipDefId,
      count: data.count,
      stackKey,
      condition: data.condition,
    }));
    
    // Stable ordering:
    // 1. Sort by shipDefId
    // 2. Within same shipDefId, sort by stack category:
    //    - For maxCharges > 1: active instances (__inst_) before depleted bucket (__charges_0)
    //    - For maxCharges === 1: charges_1 before charges_0
    // 3. Within same category, sort by stackKey (covers instanceId stability)
    result.sort((a, b) => {
      // Primary: shipDefId
      if (a.shipDefId !== b.shipDefId) {
        return a.shipDefId.localeCompare(b.shipDefId);
      }
      
      // Secondary: stack category order
      const aIsActive = a.stackKey.includes('__inst_');
      const bIsActive = b.stackKey.includes('__inst_');
      const aIsCharged = a.condition === 'charges_1';
      const bIsCharged = b.condition === 'charges_1';
      const aIsDepleted = a.condition === 'charges_0';
      const bIsDepleted = b.condition === 'charges_0';
      
      // Active instances or charged stacks come first
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      if (aIsCharged && !bIsCharged) return -1;
      if (!aIsCharged && bIsCharged) return 1;
      if (aIsDepleted && !bIsDepleted) return 1;
      if (!aIsDepleted && bIsDepleted) return -1;
      
      // Tertiary: stackKey
      return a.stackKey.localeCompare(b.stackKey);
    });
    
    return result;
  }
  
  const myFleet = aggregateFleet(myShips);
  const opponentFleet = aggregateFleet(opponentShipsVisible);
  
  return {
    myShips,
    opponentShips,
    opponentShipsVisible,
    myFleet,
    opponentFleet,
  };
}