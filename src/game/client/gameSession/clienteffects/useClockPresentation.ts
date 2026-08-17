import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { formatClockMs, getClockData } from '../selectors';
import type { GameStateClockSnapshot } from '../types';

interface ClockPresentationArgs {
  effectiveGameId: string | null;
  rawState: unknown;
  isFinished: boolean;
}

interface ClockAnchor {
  gameId: string;
  snapshot: GameStateClockSnapshot;
}

function getRawStateGameId(rawState: unknown): string | null {
  if (rawState == null || typeof rawState !== 'object' || Array.isArray(rawState)) {
    return null;
  }

  const gameId = (rawState as Record<string, unknown>).gameId;
  return typeof gameId === 'string' ? gameId : null;
}

export function useClockPresentation({
  effectiveGameId,
  rawState,
  isFinished,
}: ClockPresentationArgs): {
  applyHeadClockSnapshot: (clockSnapshot: GameStateClockSnapshot | null) => void;
  formatPlayerClock: (playerId?: string | null, isReady?: boolean) => string;
} {
  const [clockAnchor, setClockAnchor] = useState<ClockAnchor | null>(null);
  const [presentationNowMs, setPresentationNowMs] = useState(() => Date.now());

  const activeSnapshot =
    clockAnchor?.gameId === effectiveGameId ? clockAnchor.snapshot : null;

  const applyHeadClockSnapshot = useCallback(
    (clockSnapshot: GameStateClockSnapshot | null): void => {
      if (!clockSnapshot || !effectiveGameId) {
        return;
      }

      setClockAnchor({
        gameId: effectiveGameId,
        snapshot: clockSnapshot,
      });
      setPresentationNowMs(Date.now());
    },
    [effectiveGameId],
  );

  useLayoutEffect(() => {
    const nextPresentationNowMs = Date.now();

    if (!effectiveGameId || getRawStateGameId(rawState) !== effectiveGameId) {
      setClockAnchor(null);
      setPresentationNowMs(nextPresentationNowMs);
      return;
    }

    setClockAnchor({
      gameId: effectiveGameId,
      snapshot: getClockData(rawState),
    });
    setPresentationNowMs(nextPresentationNowMs);
  }, [effectiveGameId, rawState]);

  const clocksAreLive = activeSnapshot?.clocksAreLive === true;

  useEffect(() => {
    if (isFinished || !clocksAreLive) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPresentationNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [clocksAreLive, isFinished]);

  const formatPlayerClock = useCallback(
    (playerId?: string | null, isReady = false): string => {
      if (!activeSnapshot || !playerId) {
        return '--:--';
      }

      const remainingMs = activeSnapshot.remainingMsByPlayerId[playerId];
      if (remainingMs == null) {
        return '--:--';
      }

      if (isFinished || !activeSnapshot.clocksAreLive || isReady) {
        return formatClockMs(remainingMs);
      }

      const elapsedMs = Math.max(0, presentationNowMs - activeSnapshot.serverNowMs);
      return formatClockMs(Math.max(0, remainingMs - elapsedMs));
    },
    [activeSnapshot, isFinished, presentationNowMs],
  );

  return {
    applyHeadClockSnapshot,
    formatPlayerClock,
  };
}
