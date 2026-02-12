/**
 * useFleetAnimTokens
 * ------------------
 * Client-only animation token controller for fleet stacks.
 *
 * Purpose:
 * - Track per-ship animation nonces for both local and opponent fleets:
 *   - entryNonce: bump when a ship stack transitions 0 -> 1+
 *   - stackAddNonce: bump when a ship stack increases N -> N+1 (where N > 0)
 *   - activationNonce: reserved for future explicit activation triggers (not wired yet)
 *
 * Inputs:
 * - myCountsByShipId: map of shipDefId -> count for local player's visible fleet
 * - opponentCountsByShipId: map of shipDefId -> count for opponent's visible fleet
 *
 * Outputs:
 * - myAnimTokens / opponentAnimTokens: token maps consumed by Board VM fleetAnim
 * - bumpMyEntry / bumpMyStackAdd: helpers for immediate local click feedback
 *
 * Constraints:
 * - Visual-only; not authoritative; no server calls.
 * - Designed to be called unconditionally from useGameSession.
 */

import { useEffect, useRef, useState } from 'react';
import type { ShipDefId } from '../../types/ShipTypes.engine';

export type AnimToken = { entryNonce: number; activationNonce: number; stackAddNonce: number };
export type AnimTokenMap = Record<string, AnimToken>;

// Keep in sync with the animated ship set currently used in useGameSession.
const ANIMATED_SHIPS: ShipDefId[] = [
  'DEF', 'FIG', 'INT', 'COM', 'ORB', 'CAR', 'STA', 'FRI', 'TAC', 'GUA', 'SCI', 'BAT', 'EAR', 'DRE',
  'LEV', 'XEN', 'ANT', 'MAN', 'EVO', 'HEL', 'BUG', 'ZEN', 'DSW', 'AAR', 'OXF', 'ASF', 'SAC', 'QUE',
  'CHR', 'HVE', 'FEA', 'ANG', 'EQU', 'WIS', 'VIG', 'FAM', 'LEG', 'TER', 'FUR', 'KNO', 'ENT', 'RED',
  'POW', 'DES', 'DOM',
];

function makeInitialTokenMap(): AnimTokenMap {
  const base: AnimTokenMap = {};
  for (const id of ANIMATED_SHIPS) {
    base[id] = { entryNonce: 0, activationNonce: 0, stackAddNonce: 0 };
  }
  return base;
}

function makeZeroCounts(): Record<string, number> {
  const base: Record<string, number> = {};
  for (const id of ANIMATED_SHIPS) base[id] = 0;
  return base;
}

export function useFleetAnimTokens(params: {
  myCountsByShipId: Record<string, number>;
  opponentCountsByShipId: Record<string, number>;
}) {
  const { myCountsByShipId, opponentCountsByShipId } = params;

  const [myAnimTokens, setMyAnimTokens] = useState<AnimTokenMap>(() => makeInitialTokenMap());
  const [opponentAnimTokens, setOpponentAnimTokens] = useState<AnimTokenMap>(() => makeInitialTokenMap());

  const prevMyCountsRef = useRef<Record<string, number>>(makeZeroCounts());
  const prevOpponentCountsRef = useRef<Record<string, number>>(makeZeroCounts());

  // Detect entry (0→1+) and stack-add (N→N+1 where N>0)
  useEffect(() => {
    // My fleet
    for (const shipDefId of ANIMATED_SHIPS) {
      const currentCount = myCountsByShipId[shipDefId] ?? 0;
      const prevCount = prevMyCountsRef.current[shipDefId] ?? 0;

      if (prevCount === 0 && currentCount > 0) {
        setMyAnimTokens((prev) => ({
          ...prev,
          [shipDefId]: {
            ...prev[shipDefId],
            entryNonce: prev[shipDefId].entryNonce + 1,
          },
        }));
      } else if (prevCount > 0 && currentCount > prevCount) {
        setMyAnimTokens((prev) => ({
          ...prev,
          [shipDefId]: {
            ...prev[shipDefId],
            stackAddNonce: prev[shipDefId].stackAddNonce + 1,
          },
        }));
      }

      prevMyCountsRef.current[shipDefId] = currentCount;
    }

    // Opponent fleet
    for (const shipDefId of ANIMATED_SHIPS) {
      const currentCount = opponentCountsByShipId[shipDefId] ?? 0;
      const prevCount = prevOpponentCountsRef.current[shipDefId] ?? 0;

      if (prevCount === 0 && currentCount > 0) {
        setOpponentAnimTokens((prev) => ({
          ...prev,
          [shipDefId]: {
            ...prev[shipDefId],
            entryNonce: prev[shipDefId].entryNonce + 1,
          },
        }));
      } else if (prevCount > 0 && currentCount > prevCount) {
        setOpponentAnimTokens((prev) => ({
          ...prev,
          [shipDefId]: {
            ...prev[shipDefId],
            stackAddNonce: prev[shipDefId].stackAddNonce + 1,
          },
        }));
      }

      prevOpponentCountsRef.current[shipDefId] = currentCount;
    }
  }, [myCountsByShipId, opponentCountsByShipId]);

  // Helpers for immediate click feedback (used by onBuildShip)
  function bumpMyEntry(shipDefId: ShipDefId) {
    if (!ANIMATED_SHIPS.includes(shipDefId)) return;
    setMyAnimTokens((prev) => ({
      ...prev,
      [shipDefId]: {
        ...prev[shipDefId],
        entryNonce: prev[shipDefId].entryNonce + 1,
      },
    }));
  }

  function bumpMyStackAdd(shipDefId: ShipDefId) {
    if (!ANIMATED_SHIPS.includes(shipDefId)) return;
    setMyAnimTokens((prev) => ({
      ...prev,
      [shipDefId]: {
        ...prev[shipDefId],
        stackAddNonce: prev[shipDefId].stackAddNonce + 1,
      },
    }));
  }

  return { myAnimTokens, opponentAnimTokens, bumpMyEntry, bumpMyStackAdd };
}
