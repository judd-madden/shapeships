/**
 * useFleetAnimTokens
 * ------------------
 * Client-only animation token controller for fleet stacks.
 *
 * Purpose:
 * - Track per-stack animation nonces for both local and opponent fleets:
 *   - entryNonce: bump when a stack transitions 0 -> 1+
 *   - stackAddNonce: bump when a stack increases N -> N+1 (where N > 0)
 *   - activationNonce: reserved for future explicit activation triggers (not wired yet)
 *
 * Inputs:
 * - myCountsByStackKey: map of stackKey -> count for local player's visible fleet
 * - opponentCountsByStackKey: map of stackKey -> count for opponent's visible fleet
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

export type AnimToken = { entryNonce: number; activationNonce: number; stackAddNonce: number };
export type AnimTokenMap = Record<string, AnimToken>;

// Initial token for any new stackKey
function makeEmptyToken(): AnimToken {
  return { entryNonce: 0, activationNonce: 0, stackAddNonce: 0 };
}

export function useFleetAnimTokens(params: {
  myCountsByStackKey: Record<string, number>;
  opponentCountsByStackKey: Record<string, number>;
}) {
  const { myCountsByStackKey, opponentCountsByStackKey } = params;

  const [myAnimTokens, setMyAnimTokens] = useState<AnimTokenMap>({});
  const [opponentAnimTokens, setOpponentAnimTokens] = useState<AnimTokenMap>({});

  const prevMyCountsRef = useRef<Record<string, number>>({});
  const prevOpponentCountsRef = useRef<Record<string, number>>({});

  // Detect entry (0→1+) and stack-add (N→N+1 where N>0)
  useEffect(() => {
    // My fleet - detect changes for all stackKeys
    const allMyStackKeys = new Set([
      ...Object.keys(myCountsByStackKey),
      ...Object.keys(prevMyCountsRef.current),
    ]);
    
    for (const stackKey of allMyStackKeys) {
      const currentCount = myCountsByStackKey[stackKey] ?? 0;
      const prevCount = prevMyCountsRef.current[stackKey] ?? 0;

      if (prevCount === 0 && currentCount > 0) {
        setMyAnimTokens((prev) => ({
          ...prev,
          [stackKey]: {
            ...(prev[stackKey] ?? makeEmptyToken()),
            entryNonce: (prev[stackKey]?.entryNonce ?? 0) + 1,
          },
        }));
      } else if (prevCount > 0 && currentCount > prevCount) {
        setMyAnimTokens((prev) => ({
          ...prev,
          [stackKey]: {
            ...(prev[stackKey] ?? makeEmptyToken()),
            stackAddNonce: (prev[stackKey]?.stackAddNonce ?? 0) + 1,
          },
        }));
      }

      prevMyCountsRef.current[stackKey] = currentCount;
    }

    // Opponent fleet - detect changes for all stackKeys
    const allOpponentStackKeys = new Set([
      ...Object.keys(opponentCountsByStackKey),
      ...Object.keys(prevOpponentCountsRef.current),
    ]);
    
    for (const stackKey of allOpponentStackKeys) {
      const currentCount = opponentCountsByStackKey[stackKey] ?? 0;
      const prevCount = prevOpponentCountsRef.current[stackKey] ?? 0;

      if (prevCount === 0 && currentCount > 0) {
        setOpponentAnimTokens((prev) => ({
          ...prev,
          [stackKey]: {
            ...(prev[stackKey] ?? makeEmptyToken()),
            entryNonce: (prev[stackKey]?.entryNonce ?? 0) + 1,
          },
        }));
      } else if (prevCount > 0 && currentCount > prevCount) {
        setOpponentAnimTokens((prev) => ({
          ...prev,
          [stackKey]: {
            ...(prev[stackKey] ?? makeEmptyToken()),
            stackAddNonce: (prev[stackKey]?.stackAddNonce ?? 0) + 1,
          },
        }));
      }

      prevOpponentCountsRef.current[stackKey] = currentCount;
    }
  }, [myCountsByStackKey, opponentCountsByStackKey]);

  // Helpers for immediate click feedback (used by onBuildShip)
  function bumpMyEntry(stackKey: string) {
    setMyAnimTokens((prev) => ({
      ...prev,
      [stackKey]: {
        ...(prev[stackKey] ?? makeEmptyToken()),
        entryNonce: (prev[stackKey]?.entryNonce ?? 0) + 1,
      },
    }));
  }

  function bumpMyStackAdd(stackKey: string) {
    setMyAnimTokens((prev) => ({
      ...prev,
      [stackKey]: {
        ...(prev[stackKey] ?? makeEmptyToken()),
        stackAddNonce: (prev[stackKey]?.stackAddNonce ?? 0) + 1,
      },
    }));
  }

  return { myAnimTokens, opponentAnimTokens, bumpMyEntry, bumpMyStackAdd };
}