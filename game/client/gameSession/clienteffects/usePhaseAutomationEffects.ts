import { useEffect, useRef } from 'react';
import type React from 'react';

export function useBuildPreviewResetEffect(args: {
  turnNumber: number;
  effectiveGameId: string;
  setBuildPreviewCounts: (v: Record<string, number>) => void;
}) {
  const { turnNumber, effectiveGameId, setBuildPreviewCounts } = args;

  // ============================================================================
  // CHUNK 6.1: RESET PREVIEW BUFFER ON TURN TRANSITION
  // ============================================================================
  
  // Reset preview buffer when:
  // - turnNumber changes (new turn begins)
  // - effectiveGameId changes (switched games)
  // 
  // IMPORTANT: We must NOT reset on phaseKey changes because clicking Ready
  // advances subphases within BUILD (e.g. build.drawing → build.end_of_build),
  // and we want preview to persist through the entire BUILD major phase.
  // 
  // This effect does NOT depend on buildPreviewCounts (avoids noise)
  useEffect(() => {
    // Reset only on turn or game change (NOT on phase/subphase changes)
    setBuildPreviewCounts({});
  }, [turnNumber, effectiveGameId]);
}

export function useAutoRevealBuildEffect(args: {
  phaseKey: string;
  effectiveGameId: string;
  turnNumber: number;
  buildInstanceKey: string;

  buildCommitDoneByPhase: Record<string, boolean>;
  buildRevealDoneByPhase: Record<string, boolean>;
  setBuildRevealDoneByPhase: (updater: any) => void;

  buildCommitCache: any;
  
  rawState: any;
  me: any;
  mySessionId: string | null;
  
  setAwaitingBuildRevealSync: (value: boolean) => void;

  submitIntent: (body: any) => Promise<Response>;
  maybeAutoRevealBuild: (args: any) => Promise<void>;

  appendEvents: (events: any[], meta?: any) => void;
  refreshGameStateOnce: () => Promise<void>;
  bumpDiceRollSeq: (n: number) => void;
  
  autoBuildRevealSubmittedTurnsRef: React.MutableRefObject<Set<number>>;
}) {
  const {
    phaseKey,
    effectiveGameId,
    buildInstanceKey,
    buildCommitDoneByPhase,
    buildRevealDoneByPhase,
    setBuildRevealDoneByPhase,
    buildCommitCache,
    rawState,
    me,
    mySessionId,
    setAwaitingBuildRevealSync,
    submitIntent,
    maybeAutoRevealBuild,
    appendEvents,
    refreshGameStateOnce,
    bumpDiceRollSeq,
    autoBuildRevealSubmittedTurnsRef,
  } = args;

  // ============================================================================
  // TASK B: TURN-SCOPED AUTO BUILD_REVEAL (FIX BAD_TURN)
  // ============================================================================
  
  // Auto-submit BUILD_REVEAL when entering battle.reveal phase
  // Uses turn-scoped tracking to prevent duplicate submissions (fixes BAD_TURN spam)
  useEffect(() => {
    // Only run during battle.reveal phase
    if (phaseKey !== 'battle.reveal') return;
    if (!effectiveGameId) return;
    if (!rawState) return;

    // Extract CURRENT server turn number (not from stale closure)
    const serverTurnNumber =
      rawState?.gameData?.turnData?.turnNumber ??
      rawState?.gameData?.turnNumber ??
      rawState?.turnNumber ??
      1;
    
    // Compute buildInstanceKey from serverTurnNumber (not from stale closure)
    const buildInstanceKey = `BUILD_${serverTurnNumber}`;
    
    // ========================================================================
    // SERVER-AUTHORITATIVE GATING: Use server commitments only
    // ========================================================================
    const commitments = rawState?.gameData?.turnData?.commitments ?? {};
    const buildCommitmentsForTurn = commitments[buildInstanceKey] ?? {};
    const myCommit = me?.id ? buildCommitmentsForTurn[me.id] : undefined;

    const hasServerCommit = !!myCommit?.commitHash;
    const hasServerReveal =
      !!myCommit?.revealPayload || typeof myCommit?.revealedAt === 'number';

    // Gate 1: Server must have my BUILD commit for this turn
    if (!hasServerCommit) {
      console.log('[useAutoRevealBuildEffect] Skip: no server BUILD commit yet for turn', serverTurnNumber);
      return;
    }

    // Gate 2: Server must NOT already have my reveal
    if (hasServerReveal) {
      console.log('[useAutoRevealBuildEffect] Skip: server already has BUILD reveal for turn', serverTurnNumber);
      return;
    }
    
    // Check if we've already submitted auto-reveal for this turn
    if (autoBuildRevealSubmittedTurnsRef.current.has(serverTurnNumber)) {
      console.log('[useAutoRevealBuildEffect] Skip: auto-reveal already submitted for turn', serverTurnNumber);
      return;
    }

    // All checks passed - trigger auto-reveal
    console.log('[useAutoRevealBuildEffect] Auto-submitting BUILD_REVEAL for turn', serverTurnNumber);

    const submitBuildReveal = async () => {
      try {
        await maybeAutoRevealBuild({
          phaseKey,
          effectiveGameId,
          turnNumber: serverTurnNumber, // Use server turn number, not stale closure
          buildInstanceKey,

          buildCommitDoneByPhase,
          buildRevealDoneByPhase,
          setBuildRevealDoneByPhase,

          buildCommitCache,
          
          rawState,
          me,
          mySessionId,
          
          setAwaitingBuildRevealSync,

          submitIntent,
          appendEvents,
          refreshGameStateOnce,
          bumpDiceRollSeq,
        });

        // Only mark as submitted AFTER the call succeeds.
        autoBuildRevealSubmittedTurnsRef.current.add(serverTurnNumber);
      } catch (err: any) {
        // If the request fails, DO NOT mark the turn as submitted.
        // This allows the effect to retry on the next poll while stuck in battle.reveal.
        console.warn('[useAutoRevealBuildEffect] Auto-reveal failed (will retry)', err);
        
        // If server says BAD_TURN, never latch this turn as submitted.
        const msg = typeof err?.message === 'string' ? err.message : '';
        if (msg.includes('BAD_TURN') || msg.includes('Expected turn')) {
          autoBuildRevealSubmittedTurnsRef.current.delete(serverTurnNumber);
        }
      }
    };

    submitBuildReveal();
  }, [phaseKey, buildInstanceKey, effectiveGameId, rawState, me, mySessionId, buildCommitDoneByPhase, buildRevealDoneByPhase]);
}