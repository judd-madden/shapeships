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
 * - myCountsByRenderKey: map of renderKey -> count for local player's visible fleet
 * - opponentCountsByRenderKey: map of renderKey -> count for opponent's visible fleet
 *
 * Outputs:
 * - myAnimTokens / opponentAnimTokens: token maps consumed by Board VM fleetAnim
 * - bumpMyEntry / bumpMyStackAdd: helpers for local click feedback
 *
 * Constraints:
 * - Visual-only; not authoritative; no server calls.
 * - Designed to be called unconditionally from useGameSession.
 * - Owns one-shot suppression for local manual stack-add bumps so the matching
 *   next diff does not replay the same pulse.
 */

import { useLayoutEffect, useRef, useState } from 'react';

export type AnimToken = { entryNonce: number; activationNonce: number; stackAddNonce: number };
export type AnimTokenMap = Record<string, AnimToken>;
type PendingStackAddSuppression = { prevCount: number; nextCount: number };
type TokenNonceField = 'entryNonce' | 'stackAddNonce';

// Initial token for any new renderKey
function makeEmptyToken(): AnimToken {
  return { entryNonce: 0, activationNonce: 0, stackAddNonce: 0 };
}

function bumpTokenNonces(
  previousTokens: AnimTokenMap,
  renderKeys: string[],
  field: TokenNonceField
): AnimTokenMap {
  if (renderKeys.length === 0) {
    return previousTokens;
  }

  const nextTokens = { ...previousTokens };

  for (const renderKey of renderKeys) {
    const currentToken = nextTokens[renderKey] ?? makeEmptyToken();
    nextTokens[renderKey] = {
      ...currentToken,
      [field]: currentToken[field] + 1,
    };
  }

  return nextTokens;
}

export function useFleetAnimTokens(params: {
  myCountsByRenderKey: Record<string, number>;
  opponentCountsByRenderKey: Record<string, number>;
}) {
  const { myCountsByRenderKey, opponentCountsByRenderKey } = params;

  const [myAnimTokens, setMyAnimTokens] = useState<AnimTokenMap>({});
  const [opponentAnimTokens, setOpponentAnimTokens] = useState<AnimTokenMap>({});

  const prevMyCountsRef = useRef<Record<string, number>>({});
  const prevOpponentCountsRef = useRef<Record<string, number>>({});
  const didInitializeCountsRef = useRef(false);
  const pendingMyStackAddSuppressionRef =
    useRef<Record<string, PendingStackAddSuppression>>({});

  // Detect entry (0->1+) and stack-add (N->N+1 where N>0).
  // True entry remains fully diff-owned; only local manual stack-add is deduped.
  useLayoutEffect(() => {
    if (!didInitializeCountsRef.current) {
      prevMyCountsRef.current = { ...myCountsByRenderKey };
      prevOpponentCountsRef.current = { ...opponentCountsByRenderKey };
      didInitializeCountsRef.current = true;
      return;
    }

    const allMyRenderKeys = new Set([
      ...Object.keys(myCountsByRenderKey),
      ...Object.keys(prevMyCountsRef.current),
      ...Object.keys(pendingMyStackAddSuppressionRef.current),
    ]);
    const myEntryRenderKeys: string[] = [];
    const myStackAddRenderKeys: string[] = [];

    for (const renderKey of allMyRenderKeys) {
      const currentCount = myCountsByRenderKey[renderKey] ?? 0;
      const prevCount = prevMyCountsRef.current[renderKey] ?? 0;
      const pendingSuppression = pendingMyStackAddSuppressionRef.current[renderKey];

      if (prevCount === 0 && currentCount > 0) {
        myEntryRenderKeys.push(renderKey);
      } else if (prevCount > 0 && currentCount > prevCount) {
        const matchesPendingStackAdd =
          pendingSuppression?.prevCount === prevCount &&
          pendingSuppression?.nextCount === currentCount;

        if (matchesPendingStackAdd) {
          delete pendingMyStackAddSuppressionRef.current[renderKey];
        } else {
          if (
            pendingSuppression &&
            (prevCount !== pendingSuppression.prevCount ||
              currentCount >= pendingSuppression.nextCount)
          ) {
            delete pendingMyStackAddSuppressionRef.current[renderKey];
          }

          myStackAddRenderKeys.push(renderKey);
        }
      } else if (
        pendingSuppression &&
        (currentCount === 0 ||
          prevCount > pendingSuppression.prevCount ||
          currentCount > pendingSuppression.nextCount)
      ) {
        delete pendingMyStackAddSuppressionRef.current[renderKey];
      }
    }

    if (myEntryRenderKeys.length > 0 || myStackAddRenderKeys.length > 0) {
      setMyAnimTokens((prev) => {
        let next = prev;

        next = bumpTokenNonces(next, myEntryRenderKeys, 'entryNonce');
        next = bumpTokenNonces(next, myStackAddRenderKeys, 'stackAddNonce');

        return next;
      });
    }

    prevMyCountsRef.current = { ...myCountsByRenderKey };

    const allOpponentRenderKeys = new Set([
      ...Object.keys(opponentCountsByRenderKey),
      ...Object.keys(prevOpponentCountsRef.current),
    ]);
    const opponentEntryRenderKeys: string[] = [];
    const opponentStackAddRenderKeys: string[] = [];

    for (const renderKey of allOpponentRenderKeys) {
      const currentCount = opponentCountsByRenderKey[renderKey] ?? 0;
      const prevCount = prevOpponentCountsRef.current[renderKey] ?? 0;

      if (prevCount === 0 && currentCount > 0) {
        opponentEntryRenderKeys.push(renderKey);
      } else if (prevCount > 0 && currentCount > prevCount) {
        opponentStackAddRenderKeys.push(renderKey);
      }
    }

    if (opponentEntryRenderKeys.length > 0 || opponentStackAddRenderKeys.length > 0) {
      setOpponentAnimTokens((prev) => {
        let next = prev;

        next = bumpTokenNonces(next, opponentEntryRenderKeys, 'entryNonce');
        next = bumpTokenNonces(next, opponentStackAddRenderKeys, 'stackAddNonce');

        return next;
      });
    }

    prevOpponentCountsRef.current = { ...opponentCountsByRenderKey };
  }, [myCountsByRenderKey, opponentCountsByRenderKey]);

  // Immediate local entry still means "true new rendered stack" and is not
  // deduped here. Callers should use it only when they truly want manual entry.
  function bumpMyEntry(renderKey: string) {
    setMyAnimTokens((prev) => ({
      ...prev,
      [renderKey]: {
        ...(prev[renderKey] ?? makeEmptyToken()),
        entryNonce: (prev[renderKey]?.entryNonce ?? 0) + 1,
      },
    }));
  }

  // Immediate local stack-add registers a one-shot suppression for the matching
  // next my-side render-count diff on this same renderKey.
  function bumpMyStackAdd(renderKey: string) {
    const prevCount = prevMyCountsRef.current[renderKey] ?? 0;

    if (prevCount > 0) {
      pendingMyStackAddSuppressionRef.current[renderKey] = {
        prevCount,
        nextCount: prevCount + 1,
      };
    }

    setMyAnimTokens((prev) => ({
      ...prev,
      [renderKey]: {
        ...(prev[renderKey] ?? makeEmptyToken()),
        stackAddNonce: (prev[renderKey]?.stackAddNonce ?? 0) + 1,
      },
    }));
  }

  return { myAnimTokens, opponentAnimTokens, bumpMyEntry, bumpMyStackAdd };
}
