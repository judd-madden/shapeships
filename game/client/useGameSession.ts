/**
 * useGameSession - Game Controller Hook
 * 
 * LIVE READ-ONLY INTEGRATION (Chunk 0-1)
 * EVENT TAPE PLUMBING (Chunk 2)
 * AUTO-JOIN ON MOUNT (Chunk 3)
 * SPECIES SELECTION WIRING (Chunk 4)
 * 
 * This is the ONLY place allowed to:
 * - Poll /game-state/:gameId
 * - Map server state to view-models
 * - Expose action callbacks (currently no-ops)
 * - Manage client-only event tape for dev visibility
 * - Attempt one-time auto-join on mount
 * - Submit intents (commit/reveal protocol)
 * - Track local completion by phase instance
 * 
 * This hook must NOT:
 * - Validate actions
 * - Know real rules
 * - Compute eligibility
 * 
 * ALL state and actions flow through this hook.
 * Layout components remain PURE UI.
 */


import { useState, useEffect, useRef } from 'react';
import { authenticatedGet, authenticatedPost, ensureSession } from '../../utils/sessionManager';
import type { ActionPanelId } from '../display/actionPanel/ActionPanelRegistry';
import type { SpeciesId } from '../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ShipDefId } from '../types/ShipTypes.engine';
import type { ShipChoicesPanelGroup } from '../types/ShipChoiceTypes';
import type { FleetAnimVM } from '../display/graphics/animation';
import type { OpponentFleetEntryPlan, ActivationStaggerPlan } from '../display/graphics/animation-stagger';
import { computeOpponentEntryPlan, computeActivationStaggerPlan } from '../display/graphics/animation-stagger';
import { PUBLIC_APP_ORIGIN } from './config';
import { generateNonce, makeCommitHash } from './hashUtils';
import { isValidPhaseKey } from '../../engine/phase/PhaseTable';
import { getPlayerName } from './gameSession/playerName';
import { getMajorPhaseLabel, getSubphaseLabelFromPhaseKey } from './gameSession/phaseLabels';
import { getPhaseKey, getTurnNumber, formatClock, formatClockMs, getClockData } from './gameSession/selectors';
import { deriveIdentity } from './gameSession/identity';
import { deriveFleets } from './gameSession/fleets';
import { appendEventsToTape, formatTapeEntry } from './gameSession/eventTape';
import { usePhaseCommitCache } from './gameSession/commitCache';
import { mapGameSessionVm } from './gameSession/mapVm';
import { runSpeciesConfirmFlow, runReadyToggleFlow, maybeAutoRevealBuild } from './gameSession/intents';
import { getShipDefinitionById } from '../data/ShipDefinitions.engine';
import {
  usePollMarkerEffect,
  useFinishedMarkerEffect,
  useRoleCheckLoggingEffect,
  usePlayersFullSnapshotEffect,
  useSpectatorCountDebugEffect,
} from './gameSession/clienteffects/useDevEffects';
import { useAutoJoinEffect, usePollingEffect } from './gameSession/clienteffects/useNetworkingEffects';
import { useBuildPreviewResetEffect, useAutoRevealBuildEffect } from './gameSession/clienteffects/usePhaseAutomationEffects';
import { useReadyFlash } from './gameSession/clienteffects/useReadyFlash';
import { useFleetOrder } from './gameSession/clienteffects/useFleetOrder';
import { useFleetAnimTokens } from './gameSession/clienteffects/useFleetAnimTokens';
import type {
  HudStatusTone,
  HudViewModel,
  LeftRailViewModel,
  BoardFleetSummary,
  BoardViewModel,
  ChooseSpeciesBoardVm,
  BottomActionRailViewModel,
  ActionPanelTabId,
  ActionPanelTabVm,
  ActionPanelViewModel,
  GameSessionViewModel,
  GameSessionActions,
} from './gameSession/types';

export type {
  HudStatusTone,
  HudViewModel,
  LeftRailViewModel,
  BoardFleetSummary,
  BoardViewModel,
  ChooseSpeciesBoardVm,
  BottomActionRailViewModel,
  ActionPanelTabId,
  ActionPanelTabVm,
  ActionPanelViewModel,
  GameSessionViewModel,
  GameSessionActions,
} from './gameSession/types';

import { decideAutoPanelRouting, speciesToCataloguePanelId } from './gameSession/availableActions';
import { buildMessageAction } from './gameSession/powerIntents';


// ============================================================================

// ============================================================================
// HOOK
// ============================================================================

export function useGameSession(gameId: string, propsPlayerName: string) {
  // Post-game polling interval:
  // Keep polling alive for future post-game chat/rematch UI, but slower to reduce load.
  const POSTGAME_POLL_MS = 5000;
  
  // ============================================================================
  // EFFECTIVE PLAYER NAME RESOLUTION
  // ============================================================================
  
  // Resolve effectivePlayerName with priority order:
  // 1. props.playerName (if provided by dashboard launcher)
  // 2. localStorage stored name (key: ss_playerName)
  // 3. Generate random friendly name and store to localStorage
  const effectivePlayerName = getPlayerName(propsPlayerName);
  
  // ============================================================================
  // EFFECTIVE GAMEID RESOLUTION (Part B: Deep link support)
  // ============================================================================
  
  // Resolve effectiveGameId with priority order:
  // 1. props.gameId (dashboard launcher path)
  // 2. URL query param ?game=... (deep link)
  // 3. URL query param ?gameId=... (legacy support)
  // 4. Otherwise: null
  
  const effectiveGameId = (() => {
    // Priority 1: Props gameId (truthy check)
    if (gameId && gameId !== 'demo_game') {
      return gameId;
    }
    
    // Priority 2 & 3: URL params
    const params = new URLSearchParams(window.location.search);
    const urlGameId = params.get('game') || params.get('gameId');
    
    if (urlGameId) {
      return urlGameId;
    }
    
    // No gameId available
    return null;
  })();
  
  // ============================================================================
  // CHUNK 9.1: NULL GAMEID GUARD (DEMO_GAME BOOTSTRAP SAFETY)
  // ============================================================================
  
  // NOTE: Bootstrap VM/actions construction moved to end of hook to comply with Rules of Hooks.
  // All hooks must be called unconditionally; early return removed.
  // See final return statement for bootstrap logic.
  
  // Server state
  const [rawState, setRawState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state (separate from game state)
  const [chatEntries, setChatEntries] = useState<Array<{
    type: 'message';
    playerId: string;
    playerName: string;
    content: string;
    timestamp: number;
  }>>([]);
  
  // Client-only active panel tracking
  const [activePanelId, setActivePanelId] = useState<ActionPanelId>('ap.catalog.ships.human');
  
  // Choose species state (client-only for now)
  const [selectedSpecies, setSelectedSpecies] = useState<SpeciesId>('human');
  const [boardMode, setBoardMode] = useState<BoardViewModel['mode']>('board');
  
  // ============================================================================
  // CLOCK INTERPOLATION STATE (DISPLAY-ONLY, NON-AUTHORITATIVE)
  // ============================================================================
  
  // Store last server clock snapshot for interpolation
  const lastClockRef = useRef<{
    serverNowMs: number;
    remainingMsByPlayerId: Record<string, number>;
    clocksAreLive: boolean;
  } | null>(null);
  
  // Track previous opponent fleet IDs for entry animation stagger
  const prevOpponentFleetIdsRef = useRef<Set<string>>(new Set());
  
  // Tick driver for smooth clock display (forces rerenders)
  const [clockTick, setClockTick] = useState(0);
  
  // ============================================================================
  // CHUNK 6: LOCAL BUILD PREVIEW BUFFER (NON-AUTHORITATIVE)
  // ============================================================================
  
  // Local preview buffer for build.drawing phase
  // Simple count map: { DEF: 2, FIG: 1, ... }
  // Reset when phase changes away from build.drawing
  const [buildPreviewCounts, setBuildPreviewCounts] = useState<Record<string, number>>({});
  
  // Ref-backed draft buffer: authoritative source for BUILD_SUBMIT payload
  // Prevents race condition when Ready is clicked immediately after building
  const buildPreviewCountsRef = useRef<Record<string, number>>({});
  
  // Build submitted tracking: maps turnNumber → submitted flag
  // Used to gate ship clicks after submission
  const [buildSubmittedByTurn, setBuildSubmittedByTurn] = useState<Record<number, boolean>>({});
  
  // Reveal-sync latch: true when BUILD_REVEAL submitted but server fleet not yet updated
  // Prevents flicker by keeping preview overlay active until server catches up
  const [awaitingBuildRevealSync, setAwaitingBuildRevealSync] = useState(false);
  
  // ============================================================================
  // SHIP ANIMATION TOKENS (moved to gameSession/clienteffects/useFleetAnimTokens)
  // ============================================================================

  // POLL GATING STATE (Part A: State-based gating to trigger re-renders)
  // ============================================================================
  
  // Track if we've successfully joined the current game (gates polling)
  const [hasJoinedCurrentGame, setHasJoinedCurrentGame] = useState(false);
  
  // Store sessionId to detect "me" in polled state (for role checking)
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  
  // Part B: Canonical role state (confirmed from polled game-state)
  const [myRole, setMyRole] = useState<'player' | 'spectator' | 'unknown'>('unknown');
  
  // Reset join state when gameId changes
  useEffect(() => {
    setHasJoinedCurrentGame(false);
    setMyRole('unknown'); // Reset role when switching games
  }, [effectiveGameId]);
  
  // ============================================================================
  // LOCAL COMPLETION TRACKING (Chunk 4: Species selection wiring)
  // ============================================================================
  
  // Track completion by phase instance key: ${turnNumber}::${phaseKey}
  // In-memory only - resets on refresh (acceptable for Phase 1)
  const [speciesCommitDoneByPhase, setSpeciesCommitDoneByPhase] = useState<Record<string, boolean>>({});
  const [speciesRevealDoneByPhase, setSpeciesRevealDoneByPhase] = useState<Record<string, boolean>>({});
  
  // Species commit cache (payload + nonce storage with ref-backed same-tick reliability)
  const speciesCommitCache = usePhaseCommitCache<{ species: SpeciesId }>();
  
  // ============================================================================
  // LOCAL COMPLETION TRACKING (Chunk 7: Build commit/reveal)
  // ============================================================================
  
  // Track build submission by phase instance key
  const [buildCommitDoneByPhase, setBuildCommitDoneByPhase] = useState<Record<string, boolean>>({});
  const [buildRevealDoneByPhase, setBuildRevealDoneByPhase] = useState<Record<string, boolean>>({});
  
  // Build commit cache (payload + nonce storage with ref-backed same-tick reliability)
  const buildCommitCache = usePhaseCommitCache<{ builds: Array<{ shipDefId: string; count: number }> }>();
  
  // ============================================================================
  // READY UX STATE (CLIENT-ONLY UI TRACKING)
  // ============================================================================
  
  // Track per-phase ready UX state: explicit clicks + sending status
  // Used to show "SENDING..." while awaiting server response
  // and "WAITING..." when auto-readied with no actions
  const [readyUxByPhaseInstanceKey, setReadyUxByPhaseInstanceKey] = useState<
    Record<string, { clickedThisPhase: boolean; sendingNow: boolean }>
  >({});
  
  // ============================================================================
  // EVENT TAPE (Chunk 2: Dev-only plumbing)
  // ============================================================================
  
  // Event tape: client-only event log, reset on refresh
  const [eventTape, setEventTape] = useState<any[]>([]);
  
  // Track if we've shown the finished marker (one-time only)
  const finishedMarkerShownRef = useRef(false);
  
  // Track last seen phase/turn for poll markers
  const lastSeenRef = useRef<{ turn?: number; phaseKey?: string }>({});
  
  // ============================================================================
  // AUTO-JOIN TRACKING (Part C: Set-based tracking per gameId)
  // ============================================================================
  
  // Track auto-join attempts by gameId (allows new attempt when gameId changes)
  const attemptedJoinForGameRef = useRef<Set<string>>(new Set());
  
  // ============================================================================
  // TASK B: TURN-SCOPED AUTO BUILD_REVEAL TRACKING
  // ============================================================================
  
  // Track which turnNumbers have already had auto-reveal submitted
  // Prevents duplicate auto-reveal attempts for the same turn (fixes BAD_TURN spam)
  const autoBuildRevealSubmittedTurnsRef = useRef<Set<number>>(new Set());
  
  // ============================================================================
  // DEV LOGGING: LOG EFFECTIVE NAMES/IDS ON CHANGE ONLY
  // ============================================================================
  
  // Log effectivePlayerName only when it changes
  useEffect(() => {
    console.log('[useGameSession] effectivePlayerName resolved:', effectivePlayerName, '(props:', propsPlayerName, ')');
  }, [effectivePlayerName, propsPlayerName]);
  
  // Log effectiveGameId only when it changes
  useEffect(() => {
    console.log('[useGameSession] effectiveGameId resolved:', effectiveGameId, '(props:', gameId, ')');
  }, [effectiveGameId, gameId]);
  
  // ============================================================================
  // AUTO-JOIN ON MOUNT (Chunk 3: Fire-and-forget join attempt)
  // ============================================================================
  
  useAutoJoinEffect({
    effectiveGameId,
    effectivePlayerName,
    attemptedJoinForGameRef,
    ensureSession,
    authenticatedPost,
    authenticatedGet,
    setMySessionId,
    setHasJoinedCurrentGame,
  });
  
  // ============================================================================
  // DEV EFFECTS: POLL MARKERS
  // ============================================================================
  
  usePollMarkerEffect({
    rawState,
    lastSeenRef,
    appendEventsToTape: (events, meta) => appendEventsToTape(setEventTape, events, meta),
    getTurnNumber,
    getPhaseKey,
  });
  
  // ============================================================================
  // CHUNK 8: END-OF-GAME LOCKOUT (SERVER AUTHORITATIVE) — DERIVED FLAGS
  // ============================================================================

  const isFinished =
    rawState?.status === 'finished' ||
    rawState?.gameData?.status === 'finished';

  // Keep result text minimal and TDZ-safe.
  // (Winner mapping can be added later, but do not depend on me/opponent here.)
  const finishedResultText = 'GAME OVER';
  
  // ============================================================================
  // LIVE POLLING (AFTER isFinished IS DERIVED)
  // ============================================================================
  
  usePollingEffect({
    effectiveGameId,
    hasJoinedCurrentGame,
    authenticatedGet,
    setRawState,
    setLoading,
    setError,
    isFinished,
    postGamePollMs: POSTGAME_POLL_MS,
  });
  
  // ============================================================================
  // CHAT POLLING (SEPARATE 5s CADENCE)
  // ============================================================================
  
  // Poll chat every 5 seconds (slower than game-state to reduce load)
  useEffect(() => {
    // Don't poll without a usable gameId
    if (!effectiveGameId) return;
    
    // Gate until join succeeds (same as game-state polling)
    if (!hasJoinedCurrentGame) return;
    
    const CHAT_POLL_MS = 5000; // Fixed 5 second interval (both active and finished)
    
    let mounted = true;
    let chatPollTimer: NodeJS.Timeout | null = null;
    
    const pollChat = async () => {
      try {
        const response = await authenticatedGet(`/chat-state/${effectiveGameId}`);
        
        if (!response.ok) {
          // Log error but don't crash or throw
          const errorText = await response.text();
          console.warn(`[useGameSession] Chat poll error: ${response.status} ${errorText}`);
          return;
        }
        
        const data = await response.json();
        
        if (mounted && data.ok && Array.isArray(data.entries)) {
          setChatEntries(data.entries);
        }
      } catch (err: any) {
        console.warn(`[useGameSession] Chat poll error:`, err.message);
        // Don't throw - continue polling
      }
      
      // Schedule next poll
      if (mounted) {
        chatPollTimer = setTimeout(pollChat, CHAT_POLL_MS);
      }
    };
    
    // Start polling immediately
    pollChat();
    
    return () => {
      mounted = false;
      if (chatPollTimer) {
        clearTimeout(chatPollTimer);
      }
    };
  }, [effectiveGameId, hasJoinedCurrentGame]);
  
  // ============================================================================
  // DEV EFFECTS: ONE-TIME GAME OVER MARKER
  // ============================================================================
  
  useFinishedMarkerEffect({
    isFinished,
    finishedResultText,
    rawState,
    finishedMarkerShownRef,
    appendEventsToTape: (events, meta) => appendEventsToTape(setEventTape, events, meta),
    getTurnNumber,
    getPhaseKey,
  });
  
  // ============================================================================
  // DEV EFFECTS: ROLE CHECK + JOIN OUTCOME LOGGING
  // ============================================================================
  
  useRoleCheckLoggingEffect({
    rawState,
    mySessionId,
    effectivePlayerName,
    myRole,
    setMyRole,
  });
  
  // ============================================================================
  // DEV EFFECTS: FULL PLAYER SNAPSHOT
  // ============================================================================
  
  usePlayersFullSnapshotEffect({ rawState });
  
  // ============================================================================
  // DEV EFFECTS: SPECTATOR COUNT DEBUG LOG
  // ============================================================================
  
  useSpectatorCountDebugEffect({ rawState, effectiveGameId });
  
  // ============================================================================
  // CHUNK 7: INTERNAL REFRESH HELPER
  // ============================================================================
  
  /**
   * Internal helper to refresh game state immediately (does NOT replace polling)
   * Used after build reveal and declare ready to pull fresh state faster
   */
  async function refreshGameStateOnce(): Promise<void> {
    try {
      const response = await authenticatedGet(`/game-state/${effectiveGameId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[useGameSession] refreshGameStateOnce failed: ${response.status} ${errorText}`);
        return;
      }
      
      const data = await response.json();
      setRawState(data);
      console.log('[useGameSession] refreshGameStateOnce succeeded');
    } catch (err: any) {
      console.error('[useGameSession] refreshGameStateOnce error:', err.message);
    }
  }
  
  /**
   * Submit intent wrapper (delegates to authenticatedPost)
   */
  async function submitIntent(body: any, timeoutMs?: number): Promise<Response> {
    return authenticatedPost('/intent', body, timeoutMs);
  }
  
  // ============================================================================
  // MAP LIVE STATE TO VIEW-MODELS
  // ============================================================================
  
  // ============================================================================
  // IDENTITY DERIVATION (AUTHORITATIVE - ME VS OPPONENT)
  // ============================================================================
  
  const { allPlayers, playerUsers, me, opponent, meReadyKey, opponentReadyKey } = deriveIdentity(rawState, mySessionId);
  
  // ============================================================================
  // GAME LOGIC - USE ME/OPPONENT (NOT LEFT/RIGHT)
  // ============================================================================
  
  // Phase data
  const phaseKey = rawState ? getPhaseKey(rawState) : 'unknown';
  const turnNumber = rawState ? getTurnNumber(rawState) : 1;
  
  // Phase 3.x: server-authoritative actions availability (declare early to avoid TDZ)
  const availableActions = rawState?.availableActions;
  const hasServerActionsAvailable =
    Array.isArray(availableActions) && availableActions.length > 0;
  
  // ============================================================================
  // READY FLASH ANIMATION HOOK
  // ============================================================================
  
  const { readyFlashSelected, pendingReadyFlashRef } = useReadyFlash(phaseKey);
  
  // ============================================================================
  // SHIP CHOICE SELECTION STATE (for charge panels)
  // ============================================================================
  
  const [shipChoiceSelectionByInstanceId, setShipChoiceSelectionByInstanceId] = useState<Record<string, string>>({});
  
  // ============================================================================
  // TASK A: HARD RESET PREVIEW STATE ON TURN CHANGE
  // ============================================================================
  
  // When server turnNumber changes, clear all local build preview state
  // This prevents cross-turn contamination (e.g., turn 1 preview overlaying turn 2 fleet)
  useEffect(() => {
    if (!rawState) return;
    
    const serverTurnNumber = getTurnNumber(rawState);
    
    // Turn boundary: any local build preview is now invalid
    setBuildPreviewCounts({});
    buildPreviewCountsRef.current = {};
    setAwaitingBuildRevealSync(false);
    
    console.log('[useGameSession] Turn boundary reset: cleared preview state for turn', serverTurnNumber);
  }, [rawState?.gameData?.turnNumber ?? rawState?.turnNumber]);
  
  // ============================================================================
  // SHIP CHOICE SELECTION EFFECT (maintain defaults for charge phases)
  // ============================================================================
  
  useEffect(() => {
    // Only for charge phases
    if (phaseKey !== 'battle.charge_declaration' && phaseKey !== 'battle.charge_response') {
      return;
    }
    
    // Extract choice actions from availableActions
    const choiceActions = Array.isArray(availableActions)
      ? availableActions.filter(
          (a: any) =>
            a?.kind === 'choice' &&
            typeof a?.sourceInstanceId === 'string' &&
            Array.isArray(a?.choices) &&
            a.choices.length > 0
        )
      : [];
    
    if (choiceActions.length === 0) {
      // No actions available, clear selection
      setShipChoiceSelectionByInstanceId({});
      return;
    }
    
    // Build new selection map
    const newSelection: Record<string, string> = {};
    
    for (const action of choiceActions) {
      const instanceId = action.sourceInstanceId;
      const allowedChoiceIds = action.choices.map((c: any) => c.choiceId);
      
      // Keep existing selection if still valid
      const existingChoice = shipChoiceSelectionByInstanceId[instanceId];
      if (existingChoice && allowedChoiceIds.includes(existingChoice)) {
        newSelection[instanceId] = existingChoice;
      } else {
        // Default to 'damage' if available, else first choice
        const defaultChoice = allowedChoiceIds.includes('damage') 
          ? 'damage' 
          : allowedChoiceIds[0];
        newSelection[instanceId] = defaultChoice;
      }
    }
    
    setShipChoiceSelectionByInstanceId(newSelection);
  }, [phaseKey, availableActions]);
  
  // ============================================================================
  // CHUNK 9.1: BOOTSTRAP READINESS CHECK (BOOT GATING)
  // ============================================================================
  
  // Determine if we have a valid server state with valid phaseKey
  // - true = still bootstrapping (no valid state yet)
  // - false = ready to render game UI
  // Defensive: check typeof to prevent crashes if import resolution fails
  const hasValidPhaseKey = 
    typeof phaseKey === 'string' && 
    phaseKey.length > 0 && 
    phaseKey !== 'unknown' &&
    typeof isValidPhaseKey === 'function' &&
    isValidPhaseKey(phaseKey);
  
  const isBootstrapping = !rawState || !hasValidPhaseKey;
  
  // Phase instance key for completion tracking
  // MUST be defined early — used by preview merge, build gating, and ready logic
  const phaseInstanceKey = `${turnNumber}::${phaseKey}`;
  
  // Ready UX state for current phase (for SENDING/WAITING labels)
  const readyUxForCurrentPhase =
    readyUxByPhaseInstanceKey[phaseInstanceKey] ?? { clickedThisPhase: false, sendingNow: false };
  
  // Client-only key (UI gating / local phase completion concept)
  const buildPhaseInstanceKey = `${turnNumber}::build`;
  
  // Server-facing commitments key (MUST match turnData.commitments keys)
  const buildServerKey = `BUILD_${turnNumber}`;
  
  // Determine major phase for icon
  const majorPhase = phaseKey.split('.')[0] || 'build';
  const phaseIcon: 'build' | 'battle' = majorPhase === 'battle' ? 'battle' : 'build';
  
  // Determine if we're in species selection phase
  const isInSpeciesSelection = phaseKey === 'setup.species_selection';
  
  // Helper: normalize species from server data
  function normalizeSpecies(serverValue: string | null | undefined): SpeciesId | null {
    if (!serverValue) return null;
    const normalized = serverValue.toLowerCase();
    
    switch (normalized) {
      case 'human':
        return 'human';
      case 'xenite':
        return 'xenite';
      case 'centaur':
        return 'centaur';
      case 'ancient':
        return 'ancient';
      default:
        return null;
    }
  }
  
  // Species detection (from ME and OPPONENT)
  const mySpecies = normalizeSpecies(me?.faction ?? me?.species);
  const opponentSpecies = normalizeSpecies(opponent?.faction ?? opponent?.species);
  
  // Species labels for HUD (show "Selecting Species" if not revealed yet)
  function getSpeciesLabelForHud(player: any, species: SpeciesId | null): string {
    // If in species selection and species not yet revealed, show "Selecting Species"
    if (isInSpeciesSelection && !species) {
      return 'Selecting Species';
    }
    
    // Otherwise show the actual species (or default to Human if missing)
    const effectiveSpecies = species ?? 'human';
    return getSpeciesDisplayName(effectiveSpecies);
  }
  
  // Helper: Get species display name (Title Case)
  function getSpeciesDisplayName(species: SpeciesId): string {
    switch (species) {
      case 'human': return 'Human';
      case 'xenite': return 'Xenite';
      case 'centaur': return 'Centaur';
      case 'ancient': return 'Ancient';
    }
  }
  
  // My species label and opponent species label for HUD
  const mySpeciesLabel = me ? getSpeciesLabelForHud(me, mySpecies) : 'Human';
  const p2HasJoined = opponent?.role === 'player';
  const opponentSpeciesLabel =
    p2HasJoined ? getSpeciesLabelForHud(opponent, opponentSpecies) : '';
  
  // ============================================================================
  // SHIP OWNERSHIP (ME/OPPONENT)
  // ============================================================================
  
  const { myShips, opponentShips, opponentShipsVisible, myFleet, opponentFleet } = deriveFleets({
    rawState,
    me,
    opponent,
    turnNumber,
    majorPhase,
  });
  
  // ============================================================================
  // CHUNK 6: MERGE PREVIEW COUNTS INTO FLEET (ENTIRE BUILD PHASE)
  // ============================================================================
  
  // Determine if we're in build major phase (any build subphase)
  const isInBuildPhase = majorPhase === 'build';
  
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
  useBuildPreviewResetEffect({
    turnNumber,
    effectiveGameId,
    setBuildPreviewCounts,
  });
  
  // Keep ref aligned with state reset (same deps as useBuildPreviewResetEffect)
  useEffect(() => {
    buildPreviewCountsRef.current = {};
  }, [turnNumber, effectiveGameId]);
  
  // ============================================================================
  // CHUNK 6.2: AUTO-SUBMIT BUILD_REVEAL WHEN ENTERING BATTLE.REVEAL PHASE
  // ============================================================================
  
  // REMOVED: Build reveal automation removed in favor of BUILD_SUBMIT
  // BUILD_SUBMIT is applied during build.drawing phase only
  
  // Check if build reveal is done for this phase instance
  const buildRevealDoneThisPhase = !!buildRevealDoneByPhase[buildServerKey];
  
  // ============================================================================
  // B3) STABLE PREVIEW OVERLAY RULE (SIMPLIFIED)
  // ============================================================================
  
  // Single derived rule for preview display:
  // - If majorPhase === 'build': Display serverFleet + buildPreviewCounts (overlay)
  // - Else: Display serverFleet only
  
  const shouldShowPreview = majorPhase === 'build';
  
  // Merge preview counts into my fleet (if shouldShowPreview is true)
  const myFleetWithPreview: BoardFleetSummary[] = shouldShowPreview
    ? (() => {
        // Start from the existing aggregated myFleet (already has stackKey + condition)
        const byStackKey = new Map(myFleet.map(s => [s.stackKey, { ...s }]));

        // Apply preview overlay
        for (const [shipDefId, previewCount] of Object.entries(buildPreviewCounts)) {
          const delta = Math.max(0, previewCount);

          // Check ship definition for maxCharges
          const def = getShipDefinitionById(shipDefId as any);
          const maxCharges = def?.maxCharges ?? 0;

          // For charge ships (maxCharges === 1), always target charges_1 stack
          if (maxCharges === 1) {
            const chargedKey = `${shipDefId}__charges_1`;
            const anyCharged = byStackKey.get(chargedKey);

            if (anyCharged) {
              // Increment existing charged stack
              anyCharged.count += delta;
              byStackKey.set(chargedKey, anyCharged);
            } else {
              // Create new charged stack
              byStackKey.set(chargedKey, {
                shipDefId,
                count: delta,
                stackKey: chargedKey,
                condition: 'charges_1',
              });
            }
            continue;
          }

          // For non-charge ships: prefer adding preview ships into an existing charges_1 stack if present
          const chargedKey = `${shipDefId}__charges_1`;
          const anyCharged = byStackKey.get(chargedKey);

          if (anyCharged) {
            anyCharged.count += delta;
            byStackKey.set(chargedKey, anyCharged);
            continue;
          }

          // Otherwise add to first matching stack by shipDefId (stable existing stack)
          const existing = Array.from(byStackKey.values()).find(s => s.shipDefId === shipDefId);
          if (existing) {
            existing.count += delta;
            byStackKey.set(existing.stackKey, existing);
            continue;
          }

          // Otherwise create a new stable stack (no condition)
          byStackKey.set(shipDefId, { shipDefId, count: delta, stackKey: shipDefId });
        }

        const result = Array.from(byStackKey.values()).filter(s => s.count > 0);
        
        return result;
      })()
    : myFleet;
  
  // ============================================================================
  // FLEET ORDER HOOK (UI-only stable ordering, append-only)
  // ============================================================================
  
  const myFleetIds = myFleetWithPreview.map((s) => s.shipDefId as ShipDefId);
  const opponentFleetIds = opponentFleet.map((s) => s.shipDefId as ShipDefId);
  
  const { myFleetOrder, opponentFleetOrder, setMyFleetOrder, setOpponentFleetOrder } =
    useFleetOrder({ myFleetIds, opponentFleetIds });

  // ============================================================================
  // FLEET ANIMATION TOKENS (client-only; extracted from useGameSession)
  // ============================================================================
  
  // Helper to pick the best stackKey for local build click feedback
  function getPreferredStackKeyForLocalBuild(
    shipDefId: string,
    myFleet: Array<{ shipDefId: string; stackKey: string }>
  ): string {
    // Check if ship has maxCharges === 1
    const def = getShipDefinitionById(shipDefId as any);
    const maxCharges = def?.maxCharges ?? 0;

    // For charge ships, always return charges_1 stack (even if not currently present)
    if (maxCharges === 1) {
      return `${shipDefId}__charges_1`;
    }

    // For other ships: prefer charged stack if present
    const chargedKey = `${shipDefId}__charges_1`;
    if (myFleet.some(s => s.stackKey === chargedKey)) return chargedKey;

    const any = myFleet.find(s => s.shipDefId === shipDefId);
    if (any) return any.stackKey;

    return shipDefId;
  }
  
  // Build count maps for the token hook (server fleet + preview overlay for "me")
  const myCountsByStackKey: Record<string, number> = {};
  for (const entry of myFleetWithPreview) myCountsByStackKey[entry.stackKey] = entry.count;

  const opponentCountsByStackKey: Record<string, number> = {};
  for (const entry of opponentFleet) opponentCountsByStackKey[entry.stackKey] = entry.count;

  const { myAnimTokens, opponentAnimTokens, bumpMyEntry, bumpMyStackAdd } = useFleetAnimTokens({
    myCountsByStackKey,
    opponentCountsByStackKey,
  });

  

  // ============================================================================
  // BOARD MODE + COMPLETION TRACKING (ME/OPPONENT)
  // ============================================================================
  
  // Check completion status for this phase instance
  const isCommitDone = speciesCommitDoneByPhase[phaseInstanceKey] || false;
  const isRevealDone = speciesRevealDoneByPhase[phaseInstanceKey] || false;
  const isSpeciesSelectionComplete = isCommitDone && isRevealDone;

  // Compute board mode based on server phase
  let board: BoardViewModel;

  if (isInSpeciesSelection) {
    // Choose species mode
    const shareGameUrl = `${PUBLIC_APP_ORIGIN}/?game=${effectiveGameId}&view=gameScreen`;

    // Determine if Confirm button should be enabled
    // Strict gating: requires phase, player role, and active status
    const canConfirmSpecies =
      !isSpeciesSelectionComplete &&
      myRole === 'player' &&
      me?.isActive === true;

    const confirmDisabledReason =
      myRole !== 'player' ? 'Only players can confirm species' :
      me?.isActive !== true ? 'Inactive player cannot confirm' :
      isSpeciesSelectionComplete ? 'Already confirmed' :
      undefined;

    board = {
      mode: 'choose_species',
      selectedSpecies,
      gameUrl: shareGameUrl,
      canConfirmSpecies,
      confirmDisabledReason,
    };
  } else {
    // Normal board mode (REAL DATA WIRING)
    const effectiveMySpecies: SpeciesId = mySpecies ?? 'human';
    const effectiveOpponentSpecies: SpeciesId = opponentSpecies ?? 'human';

    // Extract server-authoritative health
    const myHealth = typeof me?.health === 'number' ? me.health : 25;
    const opponentHealth = typeof opponent?.health === 'number' ? opponent.health : 25;

    // Extract server-authoritative deltas (last turn heal/damage/net)
    const lastTurnHealById = rawState?.gameData?.lastTurnHealByPlayerId as Record<string, number> | undefined;
    const lastTurnDamageById = rawState?.gameData?.lastTurnDamageByPlayerId as Record<string, number> | undefined;
    const lastTurnNetById = rawState?.gameData?.lastTurnNetByPlayerId as Record<string, number> | undefined;

    const myLastTurnHeal = me?.id ? (lastTurnHealById?.[me.id] ?? 0) : 0;
    // NOTE: server lastTurnDamageByPlayerId is damage TAKEN (target).
    // UI "Damage" row is damage DEALT, so we swap sides:
    const myLastTurnDamage = opponent?.id ? (lastTurnDamageById?.[opponent.id] ?? 0) : 0;
    const myLastTurnNet = me?.id ? (lastTurnNetById?.[me.id] ?? 0) : 0;

    const opponentLastTurnHeal = opponent?.id ? (lastTurnHealById?.[opponent.id] ?? 0) : 0;
    const opponentLastTurnDamage = me?.id ? (lastTurnDamageById?.[me.id] ?? 0) : 0;
    const opponentLastTurnNet = opponent?.id ? (lastTurnNetById?.[opponent.id] ?? 0) : 0;

    // Server-authoritative bonus lines (top-level response projection)
    const bonusLinesByPlayerId = rawState?.bonusLinesByPlayerId as Record<string, number> | undefined;

    const myBonusLines = me?.id ? (bonusLinesByPlayerId?.[me.id] ?? 0) : 0;
    const opponentBonusLines = opponent?.id ? (bonusLinesByPlayerId?.[opponent.id] ?? 0) : 0;

    board = {
      mode: 'board',
      mySpeciesId: effectiveMySpecies,
      opponentSpeciesId: effectiveOpponentSpecies,

      turnNumber,

      // Server-authoritative health
      myHealth,
      opponentHealth,

      // Fleet data: server + local preview overlay (build phase only)
      myFleet: myFleetWithPreview,
      opponentFleet: opponentFleet,

      // UI-only stable ordering (append-only)
      myFleetOrder: myFleetOrder,
      opponentFleetOrder: opponentFleetOrder,
      
      // Animation tokens (client-only)
      fleetAnim: (() => {
        const makeSide = (tokens: Record<string, any>, fleet: BoardFleetSummary[]) => {
          const out: any = {};
          for (const s of fleet) {
            const t = tokens[s.stackKey];
            if (!t) continue;
            out[s.stackKey] = {
              ...t,
              stackCount: s.count,
            };
          }
          return out;
        };

        return {
          my: makeSide(myAnimTokens, myFleetWithPreview),
          opponent: makeSide(opponentAnimTokens, opponentFleet),
        };
      })(),

      // Last turn deltas (server-authoritative)
      myLastTurnHeal,
      myLastTurnDamage,
      myLastTurnNet,
      opponentLastTurnHeal,
      opponentLastTurnDamage,
      opponentLastTurnNet,

      // Bonus lines (server-authoritative)
      myBonusLines,
      opponentBonusLines,

      // Compute animation stagger plans
      opponentFleetEntryPlan: (() => {
        const { plan, nextPrevIds } = computeOpponentEntryPlan(
          prevOpponentFleetIdsRef.current,
          opponentFleetOrder,
          400
        );
        prevOpponentFleetIdsRef.current = nextPrevIds;
        return plan;
      })(),
      
      activationStaggerPlan: computeActivationStaggerPlan(
        myFleetOrder,
        opponentFleetOrder
      ),
    };
  }
  
  // ============================================================================
  // SPECIES TAB RULES (A-C: Selection phase vs locked-in phase)
  // ============================================================================
  
  // Map species to canonical catalog panel ID
  
  // Map phase + species to action panel ID (UI routing for ship choice panels)
  function phaseToActionPanelId(
    phaseKey: string,
    mySpecies: SpeciesId | null
  ): ActionPanelId | null {
    switch (phaseKey) {
      case 'build.dice_roll':
        // Only Centaur has this panel
        return mySpecies === 'centaur' ? 'ap.build.dice_roll.centaur' : null;
      
      case 'build.ships_that_build':
        if (mySpecies === 'human') return 'ap.build.ships_that_build.human';
        if (mySpecies === 'xenite') return 'ap.build.ships_that_build.xenite';
        return null;
      
      case 'build.drawing':
        if (mySpecies === 'human') return 'ap.build.drawing.human';
        if (mySpecies === 'xenite') return 'ap.build.drawing.xenite';
        return null;
      
      case 'battle.first_strike':
        if (mySpecies === 'human') return 'ap.battle.first_strike.human';
        if (mySpecies === 'centaur') return 'ap.battle.first_strike.centaur';
        return null;
      
      case 'battle.charge_declaration':
      case 'battle.charge_response':
        if (mySpecies === 'human') return 'ap.battle.charges.human';
        if (mySpecies === 'xenite') return 'ap.battle.charges.xenite';
        if (mySpecies === 'centaur') {
          // ROUTING ORDER GUARANTEE (PRESCRIPTIVE):
          // ap.battle.charges.centaur must be selected before
          // ap.battle.charges.centaur.ship_of_equality
          // 
          // Logic: Show ship_of_equality ONLY if player has EQU but NO WIS/FAM.
          // Otherwise, show the main centaur charges panel.
          const myFleet = rawState?.myFleet;
          const hasWIS = myFleet?.some((entry: any) => entry?.shipDefId === 'WIS' && entry?.count > 0);
          const hasFAM = myFleet?.some((entry: any) => entry?.shipDefId === 'FAM' && entry?.count > 0);
          const hasEQU = myFleet?.some((entry: any) => entry?.shipDefId === 'EQU' && entry?.count > 0);
          
          // If player has WIS or FAM, always show the main panel (which includes both)
          if (hasWIS || hasFAM) {
            return 'ap.battle.charges.centaur';
          }
          
          // If player ONLY has EQU, show the ship_of_equality panel
          if (hasEQU) {
            return 'ap.battle.charges.centaur.ship_of_equality';
          }
          
          // Otherwise, default to main centaur panel
          return 'ap.battle.charges.centaur';
        }
        if (mySpecies === 'ancient') return 'ap.battle.charges.ancient.black_hole'; // Placeholder
        return null;
      
      default:
        return null;
    }
  }
  
  // Helper: Check if a panel ID is a catalogue panel
  
  // Helper: Get species display label (Title Case)
  function getSpeciesLabel(species: SpeciesId): string {
    switch (species) {
      case 'human': return 'Human';
      case 'xenite': return 'Xenite';
      case 'centaur': return 'Centaur';
      case 'ancient': return 'Ancient';
    }
  }
  
  // ============================================================================
  // ACTIONS TAB: COMPUTE AVAILABILITY (UI-ONLY)
  // ============================================================================
  
  // Determine target panel ID for Actions tab (panel routing target when actions exist)
  const actionsTargetPanelId = phaseToActionPanelId(phaseKey, mySpecies);
  
  // Actions tab is visible only if server says we have actions AND we have a target panel for this phase/species
  const hasActionsAvailable =
    !isBootstrapping && hasServerActionsAvailable && !!actionsTargetPanelId;
  
  // Build tabs based on phase
  let tabs: ActionPanelTabVm[];
  
  if (isInSpeciesSelection) {
    // RULE B: Species Selection phase
    // Show ONE species tab for ME (live updating from selectedSpecies) + Menu
    tabs = [
      {
        tabId: 'tab.catalog.selected',
        label: getSpeciesLabel(selectedSpecies), // Live updates when user clicks species cards
        visible: true,
        targetPanelId: speciesToCataloguePanelId(selectedSpecies),
      },
      {
        tabId: 'tab.menu',
        label: 'Menu',
        visible: true,
        targetPanelId: 'ap.menu.root',
      },
    ];
  } else {
    // RULE C: After species are locked in
    // Show species tabs based on MY species and OPPONENT species
    
    // Use my species and opponent species (not left/right)
    const effectiveMySpecies = mySpecies ?? 'human';
    const effectiveOpponentSpecies = opponentSpecies ?? 'human';
    
    // Determine if both players have same species
    const bothSameSpecies = mySpecies && opponentSpecies && mySpecies === opponentSpecies;
    
    // Show opponent tab only if:
    // 1. Opponent species is known (not null)
    // 2. Opponent species is different from mine
    const showOpponentTab = opponentSpecies !== null && !bothSameSpecies;
    
    tabs = [
      // Actions tab (conditional - first position when visible)
      {
        tabId: 'tab.actions',
        label: 'Actions',
        visible: hasActionsAvailable,
        targetPanelId: hasActionsAvailable && actionsTargetPanelId
          ? actionsTargetPanelId
          : speciesToCataloguePanelId(effectiveMySpecies),
      },
      // My species tab (always visible in post-selection)
      {
        tabId: 'tab.catalog.self',
        label: getSpeciesLabel(effectiveMySpecies),
        visible: true,
        targetPanelId: speciesToCataloguePanelId(effectiveMySpecies),
      },
      // Opponent species tab (only if different species and known)
      {
        tabId: 'tab.catalog.opponent',
        label: getSpeciesLabel(effectiveOpponentSpecies),
        visible: showOpponentTab,
        targetPanelId: speciesToCataloguePanelId(effectiveOpponentSpecies),
      },
      // Menu tab (always visible)
      {
        tabId: 'tab.menu',
        label: 'Menu',
        visible: true,
        targetPanelId: 'ap.menu.root',
      },
    ];
  }
  
  // ============================================================================
  // CHUNK 5: READY BUTTON GATING
  // ============================================================================
  
  // Identify if I am a player
  const amPlayer = myRole === 'player';
  
  // Compute species selection completion for ME
  const mySpeciesSelectionComplete = 
    !!speciesCommitDoneByPhase[phaseInstanceKey] &&
    !!speciesRevealDoneByPhase[phaseInstanceKey];
  
  // Ready gating logic
  let readyEnabled = true;
  let readyDisabledReason: string | null = null;
  
  // CHUNK 8: Game finished overrides everything
  if (isFinished) {
    readyEnabled = false;
    readyDisabledReason = 'Game over.';
  } else if (!amPlayer) {
    readyEnabled = false;
    readyDisabledReason = 'Spectators cannot ready up.';
  } else if (isInSpeciesSelection && !mySpeciesSelectionComplete) {
    readyEnabled = false;
    readyDisabledReason = 'Select and confirm your species first.';
  } else if (
    phaseKey === 'battle.reveal' &&
    buildCommitDoneByPhase[buildServerKey] === true &&
    buildRevealDoneByPhase[buildServerKey] === false
  ) {
    // Prevent spamming DECLARE_READY while reveal is pending
    readyEnabled = false;
    readyDisabledReason = 'Revealing build…';
  } else {
    readyEnabled = true;
    readyDisabledReason = null;
  }
  
  // ============================================================================
  // VIEW-MODEL CONSTRUCTION
  // ============================================================================
  
  // ============================================================================
  // CHUNK 10: PLAYER STATUS DERIVATION (READINESS + STATUS TEXT/TONE)
  // ============================================================================
  
  // Extract phaseReadiness from server state (defensive)
  const phaseReadiness: any[] =
    (rawState?.phaseReadiness ??
     rawState?.gameData?.phaseReadiness ??
     []) as any[];
  
  // Helper: Check if a player is ready for the current phase
  function isPlayerReady(playerId: string | null | undefined): boolean {
    if (!playerId) return false;
    return phaseReadiness.some((r: any) => r?.playerId === playerId && r?.isReady === true);
  }
  
  // Compute joined state
  const p1HasJoined = me?.role === 'player';
  // p2HasJoined already defined earlier (line 632) for species label logic
  
  // Compute readiness
  const p1IsReady = p1HasJoined ? isPlayerReady(meReadyKey) : false;
  const p2IsReady = p2HasJoined ? isPlayerReady(opponentReadyKey) : false;
  
  // DEV: Diagnostic log for identity key alignment (only when values change)
  const prevReadyKeysRef = useRef<string>('');
  useEffect(() => {
    const current = JSON.stringify({
      meId: me?.id,
      mePlayerId: me?.playerId,
      meReadyKey,
      opponentId: opponent?.id,
      opponentPlayerId: opponent?.playerId,
      opponentReadyKey,
    });
    
    if (current !== prevReadyKeysRef.current) {
      prevReadyKeysRef.current = current;
      console.log('[useGameSession] Identity key alignment:', {
        me: { id: me?.id, playerId: me?.playerId, readyKey: meReadyKey },
        opponent: { id: opponent?.id, playerId: opponent?.playerId, readyKey: opponentReadyKey },
      });
    }
  }, [me?.id, me?.playerId, meReadyKey, opponent?.id, opponent?.playerId, opponentReadyKey]);
  
  // Get current subphase label for status indicators
  const currentSubphaseLabel =
    isBootstrapping ? 'Loading…' : getSubphaseLabelFromPhaseKey(phaseKey);
  
  // Compute status text: undefined if not joined, "Ready" if ready, subphase label otherwise
  const p1StatusText =
    !p1HasJoined ? undefined : (p1IsReady ? 'Ready' : currentSubphaseLabel);
  
  const p2StatusText =
    !p2HasJoined ? undefined : (p2IsReady ? 'Ready' : currentSubphaseLabel);
  
  // Compute status tone: hidden if no text, 'ready' if "Ready", 'neutral' otherwise
  const p1StatusTone: HudStatusTone =
    !p1StatusText ? 'hidden' : (p1StatusText === 'Ready' ? 'ready' : 'neutral');
  
  const p2StatusTone: HudStatusTone =
    !p2StatusText ? 'hidden' : (p2StatusText === 'Ready' ? 'ready' : 'neutral');
  
  // ============================================================================
  // CLOCK DATA EXTRACTION
  // ============================================================================
  
  // Extract clock data from server state (only when rawState changes)
  // Store in ref for interpolation - this anchors to server poll updates
  useEffect(() => {
    if (!rawState) return;
    const clockData = getClockData(rawState);
    lastClockRef.current = clockData;
  }, [rawState]);
  
  // Determine if clocks should tick (display-only animation driver)
  const shouldTick =
    !isFinished &&
    lastClockRef.current &&
    lastClockRef.current.clocksAreLive &&
    ((p1HasJoined && !p1IsReady) || (p2HasJoined && !p2IsReady));
  
  // Tick driver effect (forces rerenders for smooth clock animation)
  // Use 250ms interval for smoother visual updates (still displays as MM:SS)
  useEffect(() => {
    if (!shouldTick) return;
    const id = window.setInterval(() => setClockTick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, [shouldTick]);
  

  // ============================================================================
  // ACTION PANEL ROUTING (PHASE-DRIVEN ONLY)
  // ============================================================================
  // Default to Actions on phase entry if actions are available.
  // Respect user panel clicks within the same phase.
  // ============================================================================

  useEffect(() => {
    if (!phaseKey) return;

    const decision = decideAutoPanelRouting({
      phaseKey,
      hasActionsAvailable,
      actionsTargetPanelId,
      activePanelId,
      mySpecies,
    });

    if (decision.kind === 'setActivePanelId' && decision.nextPanelId !== activePanelId) {
      console.log(decision.log);
      setActivePanelId(decision.nextPanelId);
    }

    // IMPORTANT:
    // This effect intentionally depends ONLY on phaseKey.
    // We do not depend on activePanelId or hasActionsAvailable,
    // otherwise polling would re-trigger routing.
  }, [phaseKey]);

  
  // Display-only interpolation helper
  // Snaps to server on every poll, interpolates between polls
  function getDisplayMs(playerId?: string, isReady?: boolean): number | undefined {
    const snap = lastClockRef.current;
    if (!snap || !playerId) return undefined;

    const base = snap.remainingMsByPlayerId[playerId];
    if (base == null) return undefined;

    // Game over: freeze display at last server snapshot (no interpolation)
    if (isFinished) return base;

    if (!snap.clocksAreLive) return base;
    if (isReady) return base;

    const elapsed = Math.max(0, Date.now() - snap.serverNowMs);
    return Math.max(0, base - elapsed);
  }
  
  // Get interpolated display values for both players
  const p1DisplayMs = getDisplayMs(me?.id, p1IsReady);
  const p2DisplayMs = getDisplayMs(opponent?.id, p2IsReady);
  
  // Format clock times (show "--:--" when undefined, never fake "00:00")
  const p1ClockFormatted = p1DisplayMs == null ? '--:--' : formatClockMs(p1DisplayMs);
  const p2ClockFormatted = p2DisplayMs == null ? '--:--' : formatClockMs(p2DisplayMs);
  
  const vm: GameSessionViewModel = mapGameSessionVm({
    isBootstrapping,

    me,
    opponent,
    mySpeciesLabel,
    opponentSpeciesLabel,

    p1HasJoined,
    p2HasJoined,

    p1IsReady,
    p2IsReady,
    
    p1ClockFormatted,
    p2ClockFormatted,

    p1StatusText,
    p2StatusText,

    p1StatusTone,
    p2StatusTone,

    turnNumber,
    phaseKey,
    phaseIcon,

    effectiveGameId,
    allPlayers,

    activePanelId,
    tabs,

    board,

    readyEnabled,
    readyDisabledReason,

    eventTape,
    formatTapeEntry,

    getMajorPhaseLabel,
    getSubphaseLabelFromPhaseKey,
    
    chatEntries,

    // New params for menu/end-of-game panels
    isFinished,
    mySpeciesId: mySpecies,
    opponentSpeciesId: opponentSpecies,
    
    // Ready flash state (visual-only)
    readyFlashSelected,
    
    // Ready UX state (SENDING/WAITING labels)
    readyUx: readyUxForCurrentPhase,

    // Server availableActions for charge panels
    availableActions: Array.isArray(availableActions) ? availableActions : null,

    // Selection state for ship choice panels
    selectedChoiceIdBySourceInstanceId: shipChoiceSelectionByInstanceId,
    
    // Raw gameData for server truth
    gameData: rawState?.gameData,
  });
  
  // ============================================================================
  // ACTION CALLBACKS (NO-OPS)
  // ============================================================================
  
  const actions: GameSessionActions = {
    onReadyToggle: async () => {
      // Snapshot build preview before async flow to prevent race conditions
      const buildPreviewSnapshot = { ...buildPreviewCountsRef.current };
      
      // Capture the phase key at click time (important: don't drift if phase advances mid-await)
      const clickedPhaseInstanceKey = phaseInstanceKey;
      
      // Only show "SENDING..." if this click is actually allowed to send
      const willAttemptSend =
        myRole === 'player' && !isFinished && readyEnabled && !readyDisabledReason;
      
      if (willAttemptSend) {
        // Mark that player explicitly acted this phase, and we are now waiting on server.
        setReadyUxByPhaseInstanceKey(prev => ({
          ...prev,
          [clickedPhaseInstanceKey]: { clickedThisPhase: true, sendingNow: true },
        }));
        
        // Existing flash latch behavior unchanged
        pendingReadyFlashRef.current = true;
      }
      
      try {
        await runReadyToggleFlow({
          isFinished,
          readyEnabled,
          readyDisabledReason,

          phaseKey,
          myRole,
          mySessionId,

          effectiveGameId,
          turnNumber,

          buildInstanceKey: buildServerKey,
          buildPreviewCounts: buildPreviewSnapshot,

          setBuildSubmittedByTurn,

          buildCommitDoneByPhase,
          buildRevealDoneByPhase,
          setBuildCommitDoneByPhase,
          setBuildRevealDoneByPhase,

          buildCommitCache,

          rawState,
          me,
          setAwaitingBuildRevealSync,

          generateNonce,
          makeCommitHash,
          submitIntent,
          appendEvents: (events, meta) => appendEventsToTape(setEventTape, events, meta),
          refreshGameStateOnce,
          maybeAutoRevealBuild,

          // Charge panel context (Prompt 9)
          availableActions: Array.isArray(availableActions) ? availableActions : null,
          selectedChoiceIdBySourceInstanceId: shipChoiceSelectionByInstanceId,
        });
      } finally {
        if (willAttemptSend) {
          // Clear SENDING... regardless of success/failure so the UI can't get stuck.
          setReadyUxByPhaseInstanceKey(prev => ({
            ...prev,
            [clickedPhaseInstanceKey]: {
              ...(prev[clickedPhaseInstanceKey] ?? { clickedThisPhase: true, sendingNow: false }),
              sendingNow: false,
            },
          }));
        }
      }
    },
    
    onUndoActions: () => {
      console.log('[useGameSession] Undo actions clicked (no-op)');
    },
    
    onOpenMenu: () => {
      console.log('[useGameSession] Open menu clicked');
      setActivePanelId('ap.menu.root');
    },
    
    onActionPanelTabClick: (tabId: ActionPanelTabId) => {
      console.log('[useGameSession] Action panel tab clicked:', tabId);
      
      // Find the tab and navigate to its target panel
      const tab = tabs.find(t => t.tabId === tabId);
      if (tab && tab.visible) {
        setActivePanelId(tab.targetPanelId);
      }
    },
    
    onShipClick: (shipId: string) => {
      console.log('[useGameSession] Ship clicked (no-op):', shipId);
    },
    
    onSendChat: async (text: string) => {
      // Trim text; if empty, return early
      const trimmedText = text.trim();
      
      if (!trimmedText) {
        console.log('[useGameSession] onSendChat: Empty message, ignoring');
        return;
      }
      
      try {
        console.log('[useGameSession] onSendChat: Sending message via ACTION intent');
        
        // Submit ACTION intent with message payload
        const response = await submitIntent({
          gameId: effectiveGameId,
          intentType: 'ACTION',
          turnNumber, // Current authoritative turn number
          payload: buildMessageAction(trimmedText),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[useGameSession] onSendChat failed:', response.status, errorText);
          return;
        }
        
        const result = await response.json();
        
        if (!result.ok) {
          console.error('[useGameSession] onSendChat rejected:', result.rejected?.code, result.rejected?.message);
          return;
        }
        
        console.log('[useGameSession] onSendChat: Message sent successfully');
        // Do NOT optimistically append to chat UI; rely on chat poll refresh
        
      } catch (err: any) {
        console.error('[useGameSession] onSendChat error:', err.message);
      }
    },
    
    onAcceptDraw: () => {
      console.log('[useGameSession] Accept draw (no-op)');
    },
    
    onRefuseDraw: () => {
      console.log('[useGameSession] Refuse draw (no-op)');
    },
    
    onOpenBattleLogFullscreen: () => {
      console.log('[useGameSession] Open battle log fullscreen (no-op)');
    },
    
    onSelectSpecies: (species: SpeciesId) => {
      console.log('[useGameSession] Select species:', species);
      setSelectedSpecies(species);
      // Switch to the species' catalogue panel
      setActivePanelId(speciesToCataloguePanelId(species));
    },
    
    onConfirmSpecies: async () => {
      // PART E: Diagnostic logging before submission
      console.log('[useGameSession] onConfirmSpecies clicked:', {
        gameId: effectiveGameId,
        phaseKey,
        meRole: me?.role,
        meIsActive: me?.isActive,
        selectedSpecies,
      });
      
      // PART D4: Strict client gating - button should be disabled but extra safety
      if (phaseKey !== 'setup.species_selection') {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: wrong phase', { phaseKey });
        return;
      }
      
      if (me?.role !== 'player') {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: not a player', { role: me?.role });
        return;
      }
      
      if (me?.isActive !== true) {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: not active', { isActive: me?.isActive });
        return;
      }
      
      if (!selectedSpecies) {
        console.error('[useGameSession] SPECIES_SUBMIT blocked: no species selected');
        return;
      }
      
      await runSpeciesConfirmFlow({
        selectedSpecies,
        phaseKey,
        phaseInstanceKey,
        effectiveGameId,
        turnNumber,

        speciesCommitDoneByPhase,
        speciesRevealDoneByPhase,
        setSpeciesCommitDoneByPhase,
        setSpeciesRevealDoneByPhase,

        speciesCommitCache,

        generateNonce,
        makeCommitHash,
        submitIntent,
        appendEvents: (events, meta) => appendEventsToTape(setEventTape, events, meta),
        refreshGameStateOnce,
        mySessionId: mySessionId!,
        getLatestRawState: () => rawState,
      });
    },
    
    onCopyGameUrl: () => {
      // Copy the shareable game URL to clipboard
      // Include view=gameScreen to land directly on GameScreen (not dashboard)
      const shareGameUrl = `${PUBLIC_APP_ORIGIN}/?game=${effectiveGameId}&view=gameScreen`;
      
      navigator.clipboard.writeText(shareGameUrl)
        .then(() => {
          console.log('[useGameSession] Game URL copied to clipboard:', shareGameUrl);
        })
        .catch((err) => {
          console.error('[useGameSession] Failed to copy URL:', err);
        });
    },
    
    onBuildShip: (shipDefId: ShipDefId) => {
      // CHUNK 8: Hard stop if game finished (silent)
      if (isFinished) return;
      
      // ========================================================================
      // B) GATED LOCAL BUILD PREVIEW WITH AUTHORITATIVE TURN GATING
      // ========================================================================
      
      // Gate 1: Only in build.drawing phase
      if (phaseKey !== 'build.drawing') {
        return; // Silent no-op outside build.drawing
      }
      
      // Gate 2: Only for players (not spectators)
      if (myRole !== 'player') {
        return; // Silent no-op for spectators
      }
      
      // Gate 3: Use the UI-driving turnNumber for gating.
      // rawState can lag between polls and incorrectly block ship clicks.
      const uiTurnNumber = turnNumber;
      
      const buildSubmitted = buildSubmittedByTurn[uiTurnNumber] === true;
      if (buildSubmitted) {
        return; // Silent no-op if build already submitted for this turn
      }
      
      // All gates passed - update preview buffer
      console.log('[useGameSession] onBuildShip:', shipDefId, 'turn:', uiTurnNumber);
      
      // Update persistent order (append-only, first time only)
      setMyFleetOrder((prev) => (prev.includes(shipDefId) ? prev : [...prev, shipDefId]));
      
      setBuildPreviewCounts(prev => {
        const next = {
          ...prev,
          [shipDefId]: (prev[shipDefId] || 0) + 1,
        };
        
        buildPreviewCountsRef.current = next;
        return next;
      });
      
      // ANIMATION: instant local click feedback for entry / stack-add
      // (use stackKey to prevent jolt when charged stacks are split)
      const targetStackKey = getPreferredStackKeyForLocalBuild(shipDefId, myFleetWithPreview);
      const currentCount = myCountsByStackKey[targetStackKey] ?? 0;
      if (currentCount === 0) bumpMyEntry(targetStackKey);
      else bumpMyStackAdd(targetStackKey);
    },
    
    onOfferDraw: () => {
      console.log('[useGameSession] Offer draw (no-op)');
    },
    
    onResignGame: () => {
      console.log('[useGameSession] Resign game (no-op)');
    },
    
    onRematch: () => {
      console.log('[useGameSession] Rematch (no-op)');
    },
    
    onDownloadBattleLog: () => {
      console.log('[useGameSession] Download battle log (no-op)');
    },
    
    onSelectShipChoiceForInstance: (sourceInstanceId: string, choiceId: string) => {
      setShipChoiceSelectionByInstanceId(prev => ({ ...prev, [sourceInstanceId]: choiceId }));
    },
  };
  
  // ============================================================================
  // BOOTSTRAP RETURN (when no gameId provided)
  // ============================================================================
  
  const shouldBootstrap = !effectiveGameId;
  
  if (shouldBootstrap) {
    console.log('[useGameSession] No gameId provided - returning bootstrap VM');
    
    // Minimal safe VM that triggers "LOADING GAME" screen
    const bootstrapVm: GameSessionViewModel = {
      isBootstrapping: true,
      hud: {
        p1Name: 'Player 1',
        p1Species: 'Unknown',
        p1IsOnline: false,
        p1Clock: '00:00',
        p1IsReady: false,
        p1StatusText: undefined,
        p1StatusTone: 'hidden',
        p2Name: 'Player 2',
        p2Species: 'Unknown',
        p2IsOnline: false,
        p2Clock: '00:00',
        p2IsReady: false,
        p2StatusText: undefined,
        p2StatusTone: 'hidden',
      },
      leftRail: {
        diceValue: 1,
        turn: 1,
        phase: 'UNKNOWN PHASE',
        phaseIcon: 'build',
        subphase: 'Unknown',
        gameCode: 'NOGAME',
        chatMessages: [],
        drawOffer: null,
        battleLogEntries: [],
      },
      board: {
        mode: 'board',
        mySpeciesId: 'human',
        opponentSpeciesId: 'human',
        turnNumber: 1,
        myHealth: 25,
        opponentHealth: 25,
        myFleet: [],
        opponentFleet: [],
        myFleetOrder: [],
        opponentFleetOrder: [],
        fleetAnim: {
          my: {},
          opponent: {},
        },
        myLastTurnHeal: 0,
        myLastTurnDamage: 0,
        myLastTurnNet: 0,
        opponentLastTurnHeal: 0,
        opponentLastTurnDamage: 0,
        opponentLastTurnNet: 0,
        opponentFleetEntryPlan: { opponent: {} },
        activationStaggerPlan: { myIndexByShipId: {}, opponentIndexByShipId: {} },
      },
      bottomActionRail: {
        subphaseTitle: '',
        subphaseSubheading: '',
        canUndoActions: false,
        readyButtonVisible: true,
        readyButtonLabel: 'READY',
        readyButtonNote: null,
        nextPhaseLabel: 'NEXT PHASE',
        readyDisabled: true,
        readyDisabledReason: 'No game loaded',
        readySelected: false,
        readyFlashSelected: false,
        spectatorCount: 0,
      },
      actionPanel: {
        activePanelId: 'ap.catalog.ships.human',
        tabs: [],
        menu: {
          title: 'Menu',
          subtitle: 'Game Options',
        },
      },
    };
    
    const bootstrapActions: GameSessionActions = {
      onReadyToggle: () => {},
      onUndoActions: () => {},
      onOpenMenu: () => {},
      onActionPanelTabClick: () => {},
      onShipClick: () => {},
      onSendChat: () => {},
      onAcceptDraw: () => {},
      onRefuseDraw: () => {},
      onOpenBattleLogFullscreen: () => {},
      onSelectSpecies: () => {},
      onConfirmSpecies: () => {},
      onCopyGameUrl: () => {},
      onBuildShip: () => {},
      onOfferDraw: () => {},
      onResignGame: () => {},
      onRematch: () => {},
      onDownloadBattleLog: () => {},
    };
    
    return {
      vm: bootstrapVm,
      actions: bootstrapActions,
      loading: false,
      error: 'No gameId provided',
    };
  }
  
  return { vm, actions, loading, error };
}