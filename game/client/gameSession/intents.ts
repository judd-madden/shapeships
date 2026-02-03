/**
 * INTENT FLOWS
 * 
 * Extracted intent submission logic (commit/reveal sequences).
 * These functions do NOT import authenticatedPost/authenticatedGet/ensureSession.
 * All network calls are injected via submitIntent callback.
 */

import type React from 'react';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';

const INTENT_TIMEOUT_MS = 8000; // fail fast to avoid wedged commits

export type PhaseCommitCache<TPayload extends object> = {
  setCache: (key: string, payload: TPayload, nonce: string) => void;
  getCache: (key: string) => { payload?: TPayload; nonce?: string };
  clearCache: (key: string) => void;
};

function isRetryableIntentError(err: any): boolean {
  const name = err?.name || '';
  const msg = String(err?.message || '');
  // AbortError is typical when AbortController triggers
  if (name === 'AbortError') return true;
  // Some environments stringify this differently
  if (msg.toLowerCase().includes('abort')) return true;
  if (msg.toLowerCase().includes('network')) return true;
  return false;
}

/**
 * Canonical build payload builder
 * Ensures consistent ordering and structure for hash computation
 */
function makeCanonicalBuildPayload(buildPreviewCounts: Record<string, number>): {
  builds: Array<{ shipDefId: string; count: number }>;
} {
  const buildsArray: Array<{ shipDefId: string; count: number }> = [];
  
  for (const [shipDefId, count] of Object.entries(buildPreviewCounts)) {
    // Only include entries with count > 0
    if (count <= 0) continue;
    
    // Include any shipDefId with count > 0 (UI-only; server remains authoritative)
    
    buildsArray.push({ shipDefId, count });
  }
  
  // Sort by shipDefId ascending for consistent ordering
  buildsArray.sort((a, b) => a.shipDefId.localeCompare(b.shipDefId));
  
  return { builds: buildsArray };
}

export async function runSpeciesConfirmFlow(args: {
  selectedSpecies: string;
  phaseKey: string;
  phaseInstanceKey: string;
  effectiveGameId: string;
  turnNumber: number;

  speciesCommitDoneByPhase: Record<string, boolean>;
  speciesRevealDoneByPhase: Record<string, boolean>;
  setSpeciesCommitDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSpeciesRevealDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  speciesCommitCache: PhaseCommitCache<{ species: string }>;
  generateNonce: () => string;
  makeCommitHash: (payload: any, nonce: string) => Promise<string>;
  submitIntent: (body: any) => Promise<Response>;
  appendEvents: (events: any[], meta?: { label?: string; turn?: number; phaseKey?: string }) => void;
  refreshGameStateOnce: () => Promise<void>;
}) {
  try {
    const {
      selectedSpecies,
      phaseKey,
      phaseInstanceKey,
      effectiveGameId,
      turnNumber,
      speciesCommitDoneByPhase,
      setSpeciesCommitDoneByPhase,
      generateNonce,
      makeCommitHash,
      submitIntent,
      appendEvents,
    } = args;

    const payload = { species: selectedSpecies };
    
    // Check if already submitted (using commit done flag for backward compatibility)
    const commitDone = !!speciesCommitDoneByPhase[phaseInstanceKey];

    console.log('[useGameSession] onConfirmSpecies', phaseInstanceKey, { commitDone });

    if (commitDone) return;

    // PART D: Submit SPECIES_SUBMIT (single atomic intent with nonce)
    console.log('[useGameSession] Submitting SPECIES_SUBMIT...');

    // Generate nonce
    const nonce = generateNonce();

    const response = await submitIntent({
      gameId: effectiveGameId,
      intentType: 'SPECIES_SUBMIT',
      turnNumber,
      payload,
      nonce,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[useGameSession] SPECIES_SUBMIT failed:', errorText);
      return;
    }

    const result = await response.json();

    if (!result.ok) {
      console.error('[useGameSession] SPECIES_SUBMIT rejected:', result.rejected);
      return;
    }

    appendEvents(result.events || [], {
      label: `SPECIES_SUBMIT (${selectedSpecies.toUpperCase()})`,
      turn: turnNumber,
      phaseKey,
    });

    setSpeciesCommitDoneByPhase(prev => ({ ...prev, [phaseInstanceKey]: true }));
    console.log('✅ [useGameSession] SPECIES_SUBMIT succeeded');
    console.log('✅ [useGameSession] Species selection complete!');
  } catch (err: any) {
    console.error('[useGameSession] Species confirmation error:', err);
  }
}

export async function runReadyToggleFlow(args: {
  // stop conditions / gating
  isFinished: boolean;
  readyEnabled: boolean;
  readyDisabledReason: string | null;

  // phase + identity
  phaseKey: string;
  myRole: 'player' | 'spectator' | 'unknown';
  mySessionId: string | null;

  // core routing
  effectiveGameId: string;
  turnNumber: number;

  // build commit context
  buildInstanceKey: string;
  buildPreviewCounts: Record<string, number>;

  // build submitted tracking
  setBuildSubmittedByTurn: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;

  // done flags (legacy, kept for compatibility)
  buildCommitDoneByPhase: Record<string, boolean>;
  buildRevealDoneByPhase: Record<string, boolean>;
  setBuildCommitDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setBuildRevealDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // cache
  buildCommitCache: PhaseCommitCache<{ builds: Array<{ shipDefId: string; count: number }> }>;

  // raw state + reveal sync latch
  rawState: any;
  me: any;
  setAwaitingBuildRevealSync: (value: boolean) => void;

  // helpers
  generateNonce: () => string;
  makeCommitHash: (payload: any, nonce: string) => Promise<string>;
  submitIntent: (body: any, timeoutMs?: number) => Promise<Response>;
  appendEvents: (events: any[], meta?: { label?: string; turn?: number; phaseKey?: string }) => void;
  refreshGameStateOnce: () => Promise<void>;
  maybeAutoRevealBuild: (args: any) => Promise<void>;
}): Promise<void> {
  const {
    isFinished,
    readyEnabled,
    readyDisabledReason,
    phaseKey,
    myRole,
    mySessionId,
    effectiveGameId,
    turnNumber,
    buildInstanceKey,
    buildPreviewCounts,
    setBuildSubmittedByTurn,
    buildCommitDoneByPhase,
    buildRevealDoneByPhase,
    setBuildCommitDoneByPhase,
    setBuildRevealDoneByPhase,
    buildCommitCache,
    generateNonce,
    makeCommitHash,
    submitIntent,
    appendEvents,
    refreshGameStateOnce,
    maybeAutoRevealBuild,
    rawState,
    me,
    setAwaitingBuildRevealSync,
  } = args;

  // Hard stop if game finished
  if (isFinished) {
    console.log('[useGameSession] onReadyToggle ignored: game finished');
    return;
  }
  
  // Early guard: mySessionId required for build commit caching
  if (!mySessionId) {
    console.error('[useGameSession] Ready: cannot proceed because mySessionId is not set yet');
    return;
  }
  
  console.log(
    `[useGameSession] onReadyToggle clicked (enabled=${readyEnabled}) reason=${readyDisabledReason ?? 'none'}`
  );
  
  // Keep existing readyEnabled guard
  if (!readyEnabled) {
    console.log(`[useGameSession] Ready disabled: ${readyDisabledReason}`);
    return;
  }
  
  try {
    // A1) build.ships_that_build → DECLARE_READY always (server auto-ready handles ineligible)
    if (phaseKey === 'build.ships_that_build') {
      console.log('[useGameSession] build.ships_that_build: submitting DECLARE_READY...');
      
      const response = await submitIntent({
        gameId: effectiveGameId,
        intentType: 'DECLARE_READY',
        turnNumber,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useGameSession] DECLARE_READY failed:', errorText);
        return;
      }
      
      const result = await response.json();
      
      if (!result.ok) {
        console.error('[useGameSession] DECLARE_READY rejected:', result.rejected);
        return;
      }
      
      appendEvents(result.events || [], {
        label: 'DECLARE_READY',
        turn: turnNumber,
        phaseKey,
      });
      
      console.log('✅ [useGameSession] DECLARE_READY accepted');
      await refreshGameStateOnce();
      return;
    }
    
    // A2) build.drawing → BUILD_SUBMIT only (no DECLARE_READY)
    if (phaseKey === 'build.drawing') {
      console.log('[useGameSession] build.drawing: submitting BUILD_SUBMIT...');
      
      // A) Derive authoritative serverTurnNumber from latest rawState at click time
      const serverTurnNumber =
        rawState?.gameData?.turnData?.turnNumber ??
        rawState?.gameData?.turnNumber ??
        rawState?.turnNumber ??
        turnNumber;
      
      console.log('[useGameSession] Using authoritative serverTurnNumber:', serverTurnNumber);
      
      // Track the turn number we're submitting for local gating
      const submittedTurnNumber = serverTurnNumber;
      
      // Construct canonical payload from current local preview counts
      const canonicalPayload = makeCanonicalBuildPayload(buildPreviewCounts);
      const payload = canonicalPayload;
      
      console.log('[useGameSession] BUILD_SUBMIT payload:', payload);
      
      // Generate nonce
      const nonce = generateNonce();
      
      // Submit BUILD_SUBMIT with timeout + single retry on abort/network error
      const body = {
        gameId: effectiveGameId,
        intentType: 'BUILD_SUBMIT',
        turnNumber: serverTurnNumber,
        payload,
        nonce,
      };
      
      let response: Response | null = null;
      
      try {
        response = await submitIntent(body, INTENT_TIMEOUT_MS);
      } catch (err: any) {
        if (isRetryableIntentError(err)) {
          console.warn('[useGameSession] BUILD_SUBMIT timed out/aborted - retrying once');
          // One retry only
          response = await submitIntent(body, INTENT_TIMEOUT_MS);
        } else {
          throw err;
        }
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[useGameSession] BUILD_SUBMIT failed:', errorText);
        return;
      }
      
      const result = await response.json();
      
      // Derive canonical turn from server response (server may have normalized)
      const canonicalTurnNumber =
        result?.state?.gameData?.turnData?.turnNumber ??
        result?.state?.gameData?.turnNumber ??
        serverTurnNumber;
      
      if (!result.ok) {
        // Handle DUPLICATE_SUBMIT/DUPLICATE_COMMIT: treat as success locally
        if (
          result.rejected?.code === 'DUPLICATE_SUBMIT' ||
          result.rejected?.code === 'DUPLICATE_COMMIT'
        ) {
          console.warn('[useGameSession] BUILD_SUBMIT duplicate detected, treating as success', {
            serverTurnNumber,
            canonicalTurnNumber,
            code: result.rejected.code,
          });
          
          // Mark as submitted locally using the turn we actually submitted
          setBuildSubmittedByTurn(prev => ({ ...prev, [submittedTurnNumber]: true }));
          
          // Refresh state to get latest
          await refreshGameStateOnce();
          return;
        }
        
        console.error('[useGameSession] BUILD_SUBMIT rejected:', result.rejected);
        return;
      }
      
      appendEvents(result.events || [], {
        label: 'BUILD_SUBMIT',
        turn: canonicalTurnNumber,
        phaseKey,
      });
      
      console.log('✅ [useGameSession] BUILD_SUBMIT accepted');
      
      // Mark as submitted locally using the turn we actually submitted
      setBuildSubmittedByTurn(prev => ({ ...prev, [submittedTurnNumber]: true }));
      
      // Refresh state to get latest
      await refreshGameStateOnce();
      return;
    }
    
    // A3) All other phases → DECLARE_READY
    console.log('[useGameSession] Submitting DECLARE_READY...');
    
    const response = await submitIntent({
      gameId: effectiveGameId,
      intentType: 'DECLARE_READY',
      turnNumber,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[useGameSession] DECLARE_READY failed:', errorText);
      return;
    }
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error('[useGameSession] DECLARE_READY rejected:', result.rejected);
      return;
    }
    
    // Append events to tape
    appendEvents(result.events || [], {
      label: 'DECLARE_READY',
      turn: turnNumber,
      phaseKey,
    });
    
    console.log('✅ [useGameSession] DECLARE_READY accepted');
    
    // Refresh game state immediately after declare ready
    await refreshGameStateOnce();
    
  } catch (err: any) {
    console.error('[useGameSession] onReadyToggle error:', err);
  }
}

export async function maybeAutoRevealBuild(args: {
  // guards
  phaseKey: string;
  effectiveGameId: string;

  // core routing
  turnNumber: number;
  buildInstanceKey: string;

  // done flags
  buildCommitDoneByPhase: Record<string, boolean>;
  buildRevealDoneByPhase: Record<string, boolean>;
  setBuildRevealDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // cache
  buildCommitCache: PhaseCommitCache<{ builds: Array<{ shipDefId: string; count: number }> }>;

  // server state for truth checking
  rawState: any;
  me: any;
  mySessionId: string | null;
  
  // reveal sync latch (prevents fleet flicker)
  setAwaitingBuildRevealSync?: React.Dispatch<React.SetStateAction<boolean>>;

  // helpers
  submitIntent: (body: any) => Promise<Response>;
  appendEvents: (events: any[], meta?: { label?: string; turn?: number; phaseKey?: string }) => void;
  refreshGameStateOnce: () => Promise<void>;
}): Promise<void> {
  const {
    phaseKey,
    effectiveGameId,
    turnNumber,
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
  } = args;

  try {
    // Early guard: mySessionId required for cache key stability
    if (!mySessionId) {
      console.warn('[maybeAutoRevealBuild] Cannot auto-reveal: mySessionId is not set');
      return;
    }
    
    // ========================================================================
    // SERVER-AUTHORITATIVE GATING FOR BUILD_REVEAL
    // ========================================================================
    
    // Check server state for actual commit existence
    const commitments = rawState?.gameData?.turnData?.commitments ?? {};
    const buildCommitKey = `BUILD_${turnNumber}`;
    const myServerCommit = commitments?.[buildCommitKey]?.[me?.id];
    const hasServerBuildCommit = !!myServerCommit?.commitHash;
    const hasServerBuildReveal = !!myServerCommit?.revealPayload || typeof myServerCommit?.revealedAt === 'number';
    
    // Gate 1: Server must have a BUILD commit for me for this turn
    if (!hasServerBuildCommit) {
      console.log('[maybeAutoRevealBuild] Skip: no server commit found for turn', turnNumber);
      return;
    }
    
    // Gate 2: Server must NOT already have a reveal
    if (hasServerBuildReveal) {
      console.log('[maybeAutoRevealBuild] Skip: already revealed on server for turn', turnNumber);
      return;
    }
    
    // Retrieve cached payload + nonce from client-side cache
    const buildCacheKey = `${effectiveGameId}:${mySessionId}:${buildInstanceKey}`;
    let cached = buildCommitCache.getCache(buildCacheKey);
    let cachedPayload = cached.payload;
    let cachedNonce = cached.nonce;
    
    // Fallback: Load from localStorage if in-memory cache is missing
    const storageKey = `shapeships:buildCommit:${effectiveGameId}:${mySessionId}:${buildInstanceKey}`;
    
    if (!cachedPayload || !cachedNonce) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.nonce && Array.isArray(parsed?.builds)) {
            cachedPayload = { builds: parsed.builds };
            cachedNonce = parsed.nonce;
            // Repopulate in-memory cache for the rest of this session
            buildCommitCache.setCache(buildCacheKey, cachedPayload, cachedNonce);
            console.log('[maybeAutoRevealBuild] Loaded build cache from localStorage');
          }
        }
      } catch (e) {
        console.warn('[maybeAutoRevealBuild] Failed to load from localStorage', e);
      }
    }
    
    if (!cachedPayload || !cachedNonce) {
      console.error(
        '[maybeAutoRevealBuild] Cannot auto-reveal: missing cached payload/nonce. ' +
        'This indicates the client lost its nonce after committing.'
      );
      return;
    }
    
    // Set reveal sync latch BEFORE submitting (prevents fleet flicker)
    if (setAwaitingBuildRevealSync) {
      setAwaitingBuildRevealSync(true);
    }
    
    const revealResponse = await submitIntent({
      gameId: effectiveGameId,
      intentType: 'BUILD_REVEAL',
      turnNumber,
      payload: cachedPayload,
      nonce: cachedNonce,
    });
    
    if (!revealResponse.ok) {
      const errorText = await revealResponse.text();
      console.error('[useGameSession] Auto BUILD_REVEAL failed:', errorText);
      return; // keep cache for retry
    }
    
    const revealResult = await revealResponse.json();
    
    if (!revealResult.ok) {
      console.error('[useGameSession] Auto BUILD_REVEAL rejected:', revealResult.rejected);
      return; // keep cache for retry
    }
    
    appendEvents(revealResult.events || [], {
      label: 'BUILD_REVEAL (auto @ battle.reveal)',
      turn: turnNumber,
      phaseKey,
    });
    
    setBuildRevealDoneByPhase(prev => ({ ...prev, [buildInstanceKey]: true }));
    buildCommitCache.clearCache(buildCacheKey);
    
    // Clear persisted cache from localStorage (prevent stale data across turns)
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('[maybeAutoRevealBuild] Failed to clear localStorage cache', e);
    }
    
    console.log('✅ [useGameSession] Auto BUILD_REVEAL succeeded');
    
    await refreshGameStateOnce();
  } catch (err: any) {
    console.error('[useGameSession] Auto BUILD_REVEAL error:', err);
  }
}