/**
 * INTENT FLOWS
 * 
 * Extracted intent submission logic (commit/reveal sequences).
 * These functions do NOT import authenticatedPost/authenticatedGet/ensureSession.
 * All network calls are injected via submitIntent callback.
 */

import type React from 'react';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import { buildPowerAction } from './powerIntents';

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
 * Count DICE_ROLLED events in an event array
 * Supports multiple naming conventions: DICE_ROLLED, dice.rolled, dice_rolled
 */
function countDiceRolledEvents(events: any[]): number {
  if (!Array.isArray(events)) return 0;
  let n = 0;
  for (const e of events) {
    const t = e?.type;
    if (t === 'DICE_ROLLED' || t === 'dice.rolled' || t === 'dice_rolled') {
      n++;
    }
  }
  return n;
}

/**
 * Canonical build payload builder
 * Ensures consistent ordering and structure for hash computation
 */
function makeCanonicalBuildPayload(
  buildPreviewCounts: Record<string, number>,
  frigateTriggers: number[]
): {
  builds: Array<{ shipDefId: string; count: number }>;
  frigateTriggers?: number[];
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
  
  const frigateCount = buildsArray.find(b => b.shipDefId === 'FRI')?.count ?? 0;

  // Only include frigateTriggers when we are actually building Frigates.
  // Length must match; otherwise omit (server will default triggers to 1).
  if (frigateCount > 0 && Array.isArray(frigateTriggers) && frigateTriggers.length === frigateCount) {
    return { builds: buildsArray, frigateTriggers: [...frigateTriggers] };
  }

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
  mySessionId: string;
  getLatestRawState: () => any;
  bumpDiceRollSeq: (n: number) => void;
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
      refreshGameStateOnce,
      mySessionId,
      getLatestRawState,
      bumpDiceRollSeq,
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

    const events = result.events || [];
    appendEvents(events, {
      label: `SPECIES_SUBMIT (${selectedSpecies.toUpperCase()})`,
      turn: turnNumber,
      phaseKey,
    });
    
    const diceCount = countDiceRolledEvents(events);
    if (diceCount > 0) {
      bumpDiceRollSeq(diceCount);
    }

    // Refresh game state immediately to pull server's updated commitments
    await refreshGameStateOnce();

    // Verify server state reflects the selection via commitments (authoritative)
    const s = getLatestRawState();

    // Keep a correct player lookup available for debugging (server uses players[].id)
    const me = s?.players?.find((p: any) => p?.id === mySessionId);

    const commitKey = `SPECIES_${turnNumber}`;
    const commitment = s?.turnData?.commitments?.[commitKey]?.[mySessionId];
    const serverCommitDone = !!(commitment?.hasCommitted && commitment?.hasRevealed);

    if (!serverCommitDone) {
      console.warn('[SPECIES_SUBMIT] server commitments did not reflect selection after refresh', {
        mySessionId,
        selectedSpecies,
        turnNumber: s?.gameData?.turnNumber ?? turnNumber,
        phaseKey: s?.gameData?.phaseKey ?? phaseKey,
        commitKey,
        commitment: commitment ?? null,
        commitmentKeys: Object.keys(s?.turnData?.commitments?.[commitKey] ?? {}),
        debugPlayerId: me?.id,
      });
      // Do not mark as done - allow user to retry
      return;
    }

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

  frigateSelectedTriggers: number[];
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
  bumpDiceRollSeq: (n: number) => void;

  // charge panel context (Prompt 9)
  availableActions: any[] | null;
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
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
    frigateSelectedTriggers,
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
    bumpDiceRollSeq,
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
    // ========================================================================
    // CHARGE PHASES: Batch submit ACTIONS_SUBMIT for all selected choices, then DECLARE_READY
    // ========================================================================
    if (phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response') {
      console.log(`[useGameSession] ${phaseKey}: preparing batch submission...`);
      
      // Validate availableActions is array
      if (!Array.isArray(args.availableActions)) {
        console.log('[useGameSession] No availableActions array, falling through to DECLARE_READY only');
        // Fall through to DECLARE_READY
      } else {
        // Filter to choice actions with required fields
        const choiceActions = args.availableActions.filter(
          (a: any) =>
            a?.kind === 'choice' &&
            typeof a?.sourceInstanceId === 'string' &&
            typeof a?.actionId === 'string' &&
            Array.isArray(a?.choices)
        );
        
        console.log(`[useGameSession] Found ${choiceActions.length} choice actions to process`);
        
        // Build batch actions array (skip 'hold')
        const actions: any[] = [];
        
        for (const action of choiceActions) {
          const { sourceInstanceId, actionId, choices } = action;
          
          // Determine selected choiceId
          const selectedChoiceId = args.selectedChoiceIdBySourceInstanceId[sourceInstanceId];
          const choiceId = selectedChoiceId || choices[0]?.choiceId;
          
          // Skip if choice is 'hold' (no ACTION sent)
          if (choiceId === 'hold') {
            continue;
          }
          
          // Add to batch
          actions.push({
            actionType: 'power',
            actionId,
            sourceInstanceId,
            choiceId,
          });
        }
        
        // Submit batch if any actions exist
        if (actions.length > 0) {
          console.log(`[useGameSession] ${phaseKey}: submitting ACTIONS_SUBMIT count=${actions.length}`);
          
          const batchResponse = await submitIntent({
            gameId: effectiveGameId,
            intentType: 'ACTIONS_SUBMIT',
            turnNumber,
            payload: { actions },
          });
          
          if (!batchResponse.ok) {
            const errorText = await batchResponse.text();
            console.error('[useGameSession] ACTIONS_SUBMIT failed:', errorText);
            return;
          }
          
          const result = await batchResponse.json();
          
          if (!result.ok) {
            console.error('[useGameSession] ACTIONS_SUBMIT rejected:', result.rejected);
            return;
          }
          
          const events = result.events || [];
          appendEvents(events, {
            label: `ACTIONS_SUBMIT (${actions.length})`,
            turn: turnNumber,
            phaseKey,
          });
          
          const diceCount = countDiceRolledEvents(events);
          if (diceCount > 0) {
            bumpDiceRollSeq(diceCount);
          }
          
          console.log(`✅ [useGameSession] ACTIONS_SUBMIT accepted (${actions.length})`);
        } else {
          console.log('[useGameSession] No actions to submit (all hold or no choices)');
        }
      }
      
      // After ACTIONS_SUBMIT (or if no actions), submit DECLARE_READY
      console.log(`[useGameSession] ${phaseKey}: submitting DECLARE_READY...`);
      
      const readyResponse = await submitIntent({
        gameId: effectiveGameId,
        intentType: 'DECLARE_READY',
        turnNumber,
      });
      
      if (!readyResponse.ok) {
        const errorText = await readyResponse.text();
        console.error('[useGameSession] DECLARE_READY failed:', errorText);
        return;
      }
      
      const readyResult = await readyResponse.json();
      
      if (!readyResult.ok) {
        console.error('[useGameSession] DECLARE_READY rejected:', readyResult.rejected);
        return;
      }
      
      const readyEvents = readyResult.events || [];
      appendEvents(readyEvents, {
        label: 'DECLARE_READY',
        turn: turnNumber,
        phaseKey,
      });
      
      const readyDiceCount = countDiceRolledEvents(readyEvents);
      if (readyDiceCount > 0) {
        bumpDiceRollSeq(readyDiceCount);
      }
      
      console.log('✅ [useGameSession] DECLARE_READY accepted');
      await refreshGameStateOnce();
      return;
    }
    
    // ========================================================================
    // BUILD.SHIPS_THAT_BUILD: Batch submit ACTIONS_SUBMIT for all selected choices, then DECLARE_READY
    // ========================================================================
    if (phaseKey === 'build.ships_that_build') {
      console.log(`[useGameSession] ${phaseKey}: preparing batch submission...`);
      
      // Validate availableActions is array
      if (!Array.isArray(args.availableActions)) {
        console.log('[useGameSession] No availableActions array, refreshing once then proceeding...');
        await refreshGameStateOnce();
        
        // After refresh, check again
        if (!Array.isArray(args.availableActions)) {
          console.log('[useGameSession] Still no availableActions after refresh, falling through to DECLARE_READY only');
          // Fall through to DECLARE_READY
        } else {
          // After refresh it became available, but we won't process it in this flow
          // Just fall through to DECLARE_READY (user can click again if needed)
          console.log('[useGameSession] availableActions now available after refresh, falling through to DECLARE_READY');
        }
      } else {
        // Filter to choice actions with required fields
        const choiceActions = args.availableActions.filter(
          (a: any) =>
            a?.kind === 'choice' &&
            typeof a?.sourceInstanceId === 'string' &&
            typeof a?.actionId === 'string' &&
            Array.isArray(a?.choices)
        );
        
        console.log(`[useGameSession] Found ${choiceActions.length} choice actions to process`);
        
        // Build batch actions array (skip 'hold')
        const actions: any[] = [];
        
        for (const action of choiceActions) {
          const { sourceInstanceId, actionId, choices } = action;
          
          // Determine selected choiceId
          const selectedChoiceId = args.selectedChoiceIdBySourceInstanceId[sourceInstanceId];
          const choiceId = selectedChoiceId || choices[0]?.choiceId;
          
          // Skip if choice is 'hold' (no ACTION sent)
          if (choiceId === 'hold') {
            continue;
          }
          
          // Add to batch
          actions.push({
            actionType: 'power',
            actionId,
            sourceInstanceId,
            choiceId,
          });
        }
        
        // Submit batch if any actions exist
        if (actions.length > 0) {
          console.log(`[useGameSession] ${phaseKey}: submitting ACTIONS_SUBMIT count=${actions.length}`);
          
          const batchResponse = await submitIntent({
            gameId: effectiveGameId,
            intentType: 'ACTIONS_SUBMIT',
            turnNumber,
            payload: { actions },
          });
          
          if (!batchResponse.ok) {
            const errorText = await batchResponse.text();
            console.error('[useGameSession] ACTIONS_SUBMIT failed:', errorText);
            return;
          }
          
          const result = await batchResponse.json();
          
          if (!result.ok) {
            console.error('[useGameSession] ACTIONS_SUBMIT rejected:', result.rejected);
            return;
          }
          
          const events = result.events || [];
          appendEvents(events, {
            label: `ACTIONS_SUBMIT (${actions.length})`,
            turn: turnNumber,
            phaseKey,
          });
          
          const diceCount = countDiceRolledEvents(events);
          if (diceCount > 0) {
            bumpDiceRollSeq(diceCount);
          }
          
          console.log(`✅ [useGameSession] ACTIONS_SUBMIT accepted (${actions.length})`);
        } else {
          console.log('[useGameSession] No actions to submit (all hold or no choices)');
        }
      }
      
      // After ACTIONS_SUBMIT (or if no actions), submit DECLARE_READY
      console.log(`[useGameSession] ${phaseKey}: submitting DECLARE_READY...`);
      
      const readyResponse = await submitIntent({
        gameId: effectiveGameId,
        intentType: 'DECLARE_READY',
        turnNumber,
      });
      
      if (!readyResponse.ok) {
        const errorText = await readyResponse.text();
        console.error('[useGameSession] DECLARE_READY failed:', errorText);
        return;
      }
      
      const readyResult = await readyResponse.json();
      
      if (!readyResult.ok) {
        console.error('[useGameSession] DECLARE_READY rejected:', readyResult.rejected);
        return;
      }
      
      const readyEvents = readyResult.events || [];
      appendEvents(readyEvents, {
        label: 'DECLARE_READY',
        turn: turnNumber,
        phaseKey,
      });
      
      const readyDiceCount = countDiceRolledEvents(readyEvents);
      if (readyDiceCount > 0) {
        bumpDiceRollSeq(readyDiceCount);
      }
      
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
      const canonicalPayload = makeCanonicalBuildPayload(buildPreviewCounts, frigateSelectedTriggers);
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
          
          // Refresh state to get latest (server already set readiness via BUILD_SUBMIT)
          await refreshGameStateOnce();
          return;
        }
        
        console.error('[useGameSession] BUILD_SUBMIT rejected:', result.rejected);
        return;
      }
      
      const events = result.events || [];
      appendEvents(events, {
        label: 'BUILD_SUBMIT',
        turn: canonicalTurnNumber,
        phaseKey,
      });
      
      const diceCount = countDiceRolledEvents(events);
      if (diceCount > 0) {
        bumpDiceRollSeq(diceCount);
      }
      
      console.log('✅ [useGameSession] BUILD_SUBMIT accepted');
      
      // Mark as submitted locally using the turn we actually submitted
      setBuildSubmittedByTurn(prev => ({ ...prev, [submittedTurnNumber]: true }));
      
      // Refresh state to get latest (server already set readiness via BUILD_SUBMIT)
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
    const events = result.events || [];
    appendEvents(events, {
      label: 'DECLARE_READY',
      turn: turnNumber,
      phaseKey,
    });
    
    const diceCount = countDiceRolledEvents(events);
    if (diceCount > 0) {
      bumpDiceRollSeq(diceCount);
    }
    
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
  bumpDiceRollSeq: (n: number) => void;
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
    bumpDiceRollSeq,
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
    
    const events = revealResult.events || [];
    appendEvents(events, {
      label: 'BUILD_REVEAL (auto @ battle.reveal)',
      turn: turnNumber,
      phaseKey,
    });
    
    const diceCount = countDiceRolledEvents(events);
    if (diceCount > 0) {
      bumpDiceRollSeq(diceCount);
    }
    
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