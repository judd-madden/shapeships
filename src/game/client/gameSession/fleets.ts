/**
 * FLEET DERIVATION
 * 
 * Extract ship ownership, apply visibility rules, and aggregate fleet summaries.
 */

import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import type { PublicVisibleShipSnapshot } from './publicShipSnapshot';

interface BoardFleetSummary {
  shipDefId: ShipDefId;
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

  /**
   * Current charge count for maxCharges>1 active instance entries.
   * Used to select charges_X graphic variant (e.g. charges_6, charges_4, charges_0).
   * Only populated for active instances with maxCharges > 1.
   */
    currentCharges?: number | null;

    /**
     * Optional small caption rendered under the ship graphic.
     * Purely presentational (client-side).
     */
    caption?: string | null;
}

export interface DerivedFleetStackInfo {
  shipDefId: ShipDefId;
  stackKey: string;
  condition?: 'charges_1' | 'charges_0';
  currentCharges?: number | null;
  caption?: string | null;
}

export function deriveFleetStackInfo(
  ship: any,
  frigateTriggerByInstanceId: Record<string, unknown> = {}
): DerivedFleetStackInfo | null {
  const rawShipDefId = String(ship?.shipDefId ?? '');
  if (!isShipDefId(rawShipDefId)) {
    return null;
  }

  const shipDefId = rawShipDefId;
  const def = getShipDefinitionById(shipDefId);
  const maxCharges = def?.maxCharges ?? 0;
  const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
  const instanceId = ship?.instanceId ?? ship?.id ?? '';

  if (maxCharges === 1) {
    if (chargesCurrent >= 1) {
      return {
        shipDefId,
        stackKey: `${shipDefId}__charges_1`,
        condition: 'charges_1',
      };
    }

    return {
      shipDefId,
      stackKey: `${shipDefId}__charges_0`,
      condition: 'charges_0',
    };
  }

  if (maxCharges > 1) {
    if (chargesCurrent > 0) {
      return {
        shipDefId,
        stackKey: `${shipDefId}__inst_${instanceId}`,
        currentCharges: chargesCurrent,
      };
    }

    return {
      shipDefId,
      stackKey: `${shipDefId}__charges_0`,
      condition: 'charges_0',
    };
  }

  if (shipDefId === 'FRI') {
    const rawTrig = frigateTriggerByInstanceId?.[instanceId];
    let trig = Number(rawTrig ?? 1);

    if (!Number.isFinite(trig)) trig = 1;
    trig = Math.max(1, Math.min(6, Math.floor(trig)));

    const caption = String(trig);
    return {
      shipDefId,
      stackKey: `FRI__cap_${caption}`,
      caption,
    };
  }

  return {
    shipDefId,
    stackKey: shipDefId,
  };
}

export function deriveFleets(args: {
  rawState: any;
  me: any;
  opponent: any;
  turnNumber: number;
  majorPhase: string;
  lastKnownOpponentShipsVisible?: ReadonlyArray<Readonly<PublicVisibleShipSnapshot>> | null;
}) {
  const {
    rawState,
    me,
    opponent,
    turnNumber,
    majorPhase,
    lastKnownOpponentShipsVisible,
  } = args;
  

  const frigateTriggerByInstanceId =
    rawState?.gameData?.powerMemory?.frigateTriggerByInstanceId ?? {};

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
  const opponentShipsAuthoritativeVisible = opponentShips.filter((ship: any) => {
    const createdTurn = ship?.createdTurn;
    // If createdTurn is missing, treat as "old" (visible). This avoids accidental hiding due to incomplete data.
    if (typeof createdTurn !== 'number') return true;
    if (createdTurn < turnNumber) return true;
    // createdTurn === turnNumber -> visible only in battle
    return isInBattlePhase;
  });

  // Outside battle, keep rendering the last public opponent snapshot if we have one.
  // This prevents hidden current-turn removals from leaking before their paired build outcomes reveal.
  const opponentShipsVisible =
    !isInBattlePhase && Array.isArray(lastKnownOpponentShipsVisible)
      ? lastKnownOpponentShipsVisible
      : opponentShipsAuthoritativeVisible;
  
  // Aggregate fleet summaries with charge-aware stacking
  function aggregateFleet(ships: any[]): BoardFleetSummary[] {
    // Buckets: stackKey -> { shipDefId, count, condition?, currentCharges? }
    const buckets = new Map<
      string,
      { shipDefId: ShipDefId; count: number; condition?: 'charges_1' | 'charges_0'; currentCharges?: number | null; caption?: string | null }
    >();
    
    for (const ship of ships) {
      const stackInfo = deriveFleetStackInfo(ship, frigateTriggerByInstanceId);
      if (!stackInfo) {
        continue;
      }
      const { shipDefId, stackKey, condition, currentCharges, caption } = stackInfo;
      const existing = buckets.get(stackKey);

      if (existing) {
        existing.count++;
        if (caption != null) {
          existing.caption = caption;
        }
      } else {
        buckets.set(stackKey, {
          shipDefId,
          count: 1,
          condition,
          currentCharges,
          caption,
        });
      }
    }
    
    // Convert to array and sort for stable ordering
    const result: BoardFleetSummary[] = Array.from(buckets.entries()).map(([stackKey, data]) => ({
      shipDefId: data.shipDefId,
      count: data.count,
      stackKey,
      condition: data.condition,
      currentCharges: data.currentCharges ?? null,
      caption: data.caption ?? null,
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
    opponentShipsAuthoritativeVisible,
    opponentShipsVisible,
    myFleet,
    opponentFleet,
  };
}
