import { useEffect, useRef } from 'react';

type AppendEventsFn = (events: any[], meta?: any) => void;

// 1) POLL MARKERS
export function usePollMarkerEffect(args: {
  rawState: any;
  lastSeenRef: React.MutableRefObject<{ turn?: number; phaseKey?: string }>;
  appendEventsToTape: AppendEventsFn;
  getTurnNumber: (s: any) => number;
  getPhaseKey: (s: any) => string;
}) {
  const { rawState, lastSeenRef, appendEventsToTape, getTurnNumber, getPhaseKey } = args;

  useEffect(() => {
    if (!rawState) return;

    const currentTurn = getTurnNumber(rawState);
    const currentPhaseKey = getPhaseKey(rawState);

    const lastTurn = lastSeenRef.current.turn;
    const lastPhaseKey = lastSeenRef.current.phaseKey;

    // Only append marker when turn or phase changes (not on every poll)
    if (currentTurn !== lastTurn || currentPhaseKey !== lastPhaseKey) {
      appendEventsToTape(
        [], // No actual events, just a marker
        {
          label: `TURN ${currentTurn} — ${currentPhaseKey}`,
          turn: currentTurn,
          phaseKey: currentPhaseKey,
        }
      );

      // Update last seen
      lastSeenRef.current = {
        turn: currentTurn,
        phaseKey: currentPhaseKey,
      };
    }
  }, [rawState]);
}

// 2) ONE-TIME GAME OVER MARKER
export function useFinishedMarkerEffect(args: {
  isFinished: boolean;
  finishedResultText: string;
  rawState: any;
  finishedMarkerShownRef: React.MutableRefObject<boolean>;
  appendEventsToTape: AppendEventsFn;
  getTurnNumber: (s: any) => number;
  getPhaseKey: (s: any) => string;
}) {
  const {
    isFinished,
    finishedResultText,
    rawState,
    finishedMarkerShownRef,
    appendEventsToTape,
    getTurnNumber,
    getPhaseKey,
  } = args;

  useEffect(() => {
    if (!isFinished) {
      finishedMarkerShownRef.current = false;
      return;
    }

    if (finishedMarkerShownRef.current) return;
    finishedMarkerShownRef.current = true;

    appendEventsToTape([], {
      label: finishedResultText,
      turn: rawState ? getTurnNumber(rawState) : undefined,
      phaseKey: rawState ? getPhaseKey(rawState) : undefined,
    });
  }, [isFinished, finishedResultText, rawState]);
}

// 3) ROLE CHECK + JOIN OUTCOME LOGGING
export function useRoleCheckLoggingEffect(args: {
  rawState: any;
  mySessionId: string | null;
  effectivePlayerName: string;
  myRole: 'player' | 'spectator' | 'unknown';
  setMyRole: (r: 'player' | 'spectator' | 'unknown') => void;
}) {
  const { rawState, mySessionId, effectivePlayerName, myRole, setMyRole } = args;
  
  const lastLoggedRef = useRef<string | null>(null);

  useEffect(() => {
    // Guard: require both rawState and sessionId
    if (!rawState || !mySessionId) return;

    const players = rawState.players || [];

    // Find "me" in the player list
    const me = players.find((p: any) => p.id === mySessionId);
    const meRole = me?.role || 'missing';

    // Count players with role='player'
    const numPlayers = players.filter((p: any) => p.role === 'player').length;

    // Compute player slots for signature
    const playerSlots = players.filter((p: any) => p.role === 'player');
    const short = (id: string) => id ? id.slice(-8) : 'NONE';
    
    const slot1 = playerSlots[0];
    const slot2 = playerSlots[1];
    const slot1Str = slot1 ? `${short(slot1.id)} ${slot1.displayName || slot1.playerName || 'Unknown'}` : null;
    const slot2Str = slot2 ? `${short(slot2.id)} ${slot2.displayName || slot2.playerName || 'Unknown'}` : 'empty';

    // Show "me" info with shortened ID (last 8 chars)
    const shortMyId = mySessionId ? mySessionId.slice(-8) : 'NONE';
    const myName = me?.displayName || me?.playerName || effectivePlayerName || 'Unknown';

    // Build signature string for change detection
    const signature = [
      `meRole=${meRole}`,
      `numPlayers=${numPlayers}`,
      `slot1=${slot1Str ?? 'none'}`,
      `slot2=${slot2Str ?? 'none'}`,
      `me=${shortMyId}`,
      `name=${myName}`,
    ].join('|');

    // Skip logging if nothing changed
    if (lastLoggedRef.current === signature) {
      // Still update canonical role state (below), but skip logging.
      setMyRole(meRole as 'player' | 'spectator' | 'unknown');
      return;
    }
    lastLoggedRef.current = signature;

    // Log role check (only when changed)
    console.log(`[useGameSession] role-check: meRole=${meRole} numPlayers=${numPlayers} sessionId=${mySessionId}`);

    // 1) Players Debug: Show which two sessions occupy player slots
    if (playerSlots.length > 0) {
      console.log(`[useGameSession] player-slots: #1=${slot1Str} | #2=${slot2Str}`);
    }

    console.log(`[useGameSession] me=${shortMyId} ${myName} role=${myRole}`);

    // Explain spectator status
    if (meRole === 'spectator' && numPlayers >= 2) {
      console.log(`[useGameSession] spectator because player slots full (${numPlayers}/2 players)`);
    } else if (meRole === 'spectator' && numPlayers < 2) {
      console.warn(`[useGameSession] spectator unexpectedly — join bug (only ${numPlayers}/2 players)`);
    }

    // Update canonical role state
    setMyRole(meRole as 'player' | 'spectator' | 'unknown');
  }, [rawState, mySessionId, effectivePlayerName]);
}

// 4) FULL PLAYER SNAPSHOT
export function usePlayersFullSnapshotEffect(args: { rawState: any }) {
  const { rawState } = args;
  
  const lastSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rawState?.players) return;

    const players = rawState.players || [];
    const snapshot = players
      .map((p: any) => `${p.id ?? ''}:${p.role ?? ''}:${p.name ?? ''}:${p.isActive ?? ''}:${p.joinedAt ?? ''}`)
      .join(',');

    if (lastSnapshotRef.current === snapshot) return;
    lastSnapshotRef.current = snapshot;

    console.log(
      '[useGameSession] PLAYERS_FULL',
      rawState.players.map((p: any) => ({
        id: p.id,
        role: p.role,
        name: p.name,
        isActive: p.isActive,
        joinedAt: p.joinedAt,
      }))
    );
  }, [rawState]);
}

// 5) SPECTATOR COUNT DEBUG LOG
export function useSpectatorCountDebugEffect(args: { rawState: any; effectiveGameId: string }) {
  const { rawState, effectiveGameId } = args;
  
  const lastCountsRef = useRef<string | null>(null);

  useEffect(() => {
    if (!rawState) return;

    const players = rawState.players || [];
    const spectatorCount = players.filter((p: any) => p?.role === 'spectator').length;
    const totalPlayers = players.length;
    
    const sig = `${effectiveGameId}:${totalPlayers}:${spectatorCount}`;
    if (lastCountsRef.current === sig) return;
    lastCountsRef.current = sig;

    console.log('[useGameSession] spectator-count:', {
      gameId: effectiveGameId,
      totalPlayers: players.length,
      spectatorCount,
    });
  }, [rawState, effectiveGameId]);
}