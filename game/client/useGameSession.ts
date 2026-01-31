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
import {
  usePollMarkerEffect,
  useFinishedMarkerEffect,
  useRoleCheckLoggingEffect,
  usePlayersFullSnapshotEffect,
  useSpectatorCountDebugEffect,
} from './gameSession/clienteffects/useDevEffects';
import { useAutoJoinEffect, usePollingEffect } from './gameSession/clienteffects/useNetworkingEffects';
import { useBuildPreviewResetEffect, useAutoRevealBuildEffect } from './gameSession/clienteffects/usePhaseAutomationEffects';

// ============================================================================
// VIEW-MODEL TYPES
// ============================================================================

export type HudStatusTone = 'ready' | 'neutral' | 'hidden';

export interface HudViewModel {
  // Player 1 (local, always left)
  p1Name: string;
  p1Species: string;
  p1IsOnline: boolean;
  p1Clock: string; // "MM:SS"
  p1IsReady: boolean;
  p1StatusText?: string;       // "Ready" or subphase label; undefined hides pill
  p1StatusTone: HudStatusTone; // ready | neutral | hidden
  
  // Player 2 (opponent, always right)
  p2Name: string;
  p2Species: string;
  p2IsOnline: boolean;
  p2Clock: string; // "MM:SS"
  p2IsReady: boolean;
  p2StatusText?: string;
  p2StatusTone: HudStatusTone;
}

export interface LeftRailViewModel {
  // Dice
  diceValue: number; // 1-6
  
  // Phase card
  turn: number;
  phase: string; // "BUILD PHASE", "BATTLE PHASE"
  phaseIcon: 'build' | 'battle';
  subphase: string;
  
  // Chat
  gameCode: string;
  chatMessages: Array<{
    type: 'player' | 'system';
    playerName?: string;
    text: string;
  }>;
  drawOffer: {
    fromPlayer: string;
  } | null;
  
  // Battle log
  battleLogEntries: Array<{
    type: 'event' | 'turn-marker';
    text?: string;
    turn?: number;
    phase?: string;
  }>;
}

export interface BoardFleetSummary {
  shipDefId: string;
  count: number;
}

export type BoardViewModel =
  | {
      mode: 'choose_species';
      selectedSpecies: SpeciesId;
      gameUrl: string;
      canConfirmSpecies: boolean;
      confirmDisabledReason?: string;
    }
  | {
      mode: 'board';
      myHealth: number;
      opponentHealth: number;
      myFleet: BoardFleetSummary[];
      opponentFleet: BoardFleetSummary[];
    };

// Type alias for choose species board mode
export type ChooseSpeciesBoardVm = Extract<BoardViewModel, { mode: 'choose_species' }>;

export interface BottomActionRailViewModel {
  // Subphase info
  subphaseTitle: string; // e.g., "Subphase information"
  subphaseSubheading: string;
  
  // Ready controls
  canUndoActions: boolean;
  readyButtonNote: string | null;
  nextPhaseLabel: string; // e.g., "BATTLE PHASE"
  readyDisabled: boolean;
  readyDisabledReason: string | null;
  
  // NEW: server-authoritative ready indicator for button selected state
  readySelected: boolean;
  
  // Misc
  spectatorCount: number;
}

// Action Panel Tab ID (fixed set of reference tabs)
export type ActionPanelTabId =
  | 'tab.catalog.selected'   // choose_species mode only
  | 'tab.catalog.self'       // in-game reference tab
  | 'tab.catalog.opponent'   // in-game reference tab (conditional)
  | 'tab.menu';

export interface ActionPanelTabVm {
  tabId: ActionPanelTabId;
  label: string;              // e.g. "[Species 1]" "[Species 2]" "Menu"
  visible: boolean;           // opponent tab hidden when same species
  targetPanelId: ActionPanelId; // which panel this tab jumps to
}

export interface ActionPanelViewModel {
  activePanelId: ActionPanelId;
  tabs: ActionPanelTabVm[];
}

export interface GameSessionViewModel {
  isBootstrapping: boolean; // true until valid server state with valid phaseKey
  hud: HudViewModel;
  leftRail: LeftRailViewModel;
  board: BoardViewModel;
  bottomActionRail: BottomActionRailViewModel;
  actionPanel: ActionPanelViewModel;
}

// ============================================================================
// ACTION CALLBACKS
// ============================================================================

export interface GameSessionActions {
  onReadyToggle: () => void;
  onUndoActions: () => void;
  onOpenMenu: () => void;
  onActionPanelTabClick: (tabId: ActionPanelTabId) => void;
  onShipClick: (shipId: string) => void;
  onSendChat: (text: string) => void;
  onAcceptDraw: () => void;
  onRefuseDraw: () => void;
  onOpenBattleLogFullscreen: () => void;
  onSelectSpecies: (species: SpeciesId) => void;
  onConfirmSpecies: () => void;
  onCopyGameUrl: () => void;
  onBuildShip: (shipDefId: ShipDefId) => void; // Chunk 6: Local build preview
}

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
  
  // If no gameId is available (demo_game path), return early with bootstrap VM
  // This prevents noisy errors and crashes from attempting join/poll logic
  if (!effectiveGameId) {
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
        myHealth: 25,
        opponentHealth: 25,
        myFleet: [],
        opponentFleet: [],
      },
      bottomActionRail: {
        subphaseTitle: '',
        subphaseSubheading: '',
        canUndoActions: false,
        readyButtonNote: null,
        nextPhaseLabel: 'NEXT PHASE',
        readyDisabled: true,
        readyDisabledReason: 'No game loaded',
        readySelected: false,
        spectatorCount: 0,
      },
      actionPanel: {
        activePanelId: 'ap.catalog.ships.human',
        tabs: [],
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
    };
    
    return {
      vm: bootstrapVm,
      actions: bootstrapActions,
      loading: false,
      error: 'No gameId provided',
    };
  }
  
  // Server state
  const [rawState, setRawState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
  
  const { allPlayers, playerUsers, me, opponent } = deriveIdentity(rawState, mySessionId);
  
  // ============================================================================
  // GAME LOGIC - USE ME/OPPONENT (NOT LEFT/RIGHT)
  // ============================================================================
  
  // Phase data
  const phaseKey = rawState ? getPhaseKey(rawState) : 'unknown';
  const turnNumber = rawState ? getTurnNumber(rawState) : 1;
  
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
        // Start with canonical fleet counts
        const merged: Record<string, number> = {};
        for (const entry of myFleet) {
          merged[entry.shipDefId] = entry.count;
        }
        
        // Apply preview overlay using Math.max to prevent subtraction
        for (const [shipDefId, previewCount] of Object.entries(buildPreviewCounts)) {
          const base = merged[shipDefId] || 0;
          merged[shipDefId] = base + Math.max(0, previewCount);
        }
        
        // Convert back to array format
        const result = Object.entries(merged).map(([shipDefId, count]) => ({ shipDefId, count }));
        
        return result;
      })()
    : myFleet;
  
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
    const canConfirmSpecies = !isSpeciesSelectionComplete && myRole === 'player';
    const confirmDisabledReason = 
      myRole !== 'player' ? 'Only players can confirm species' :
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
    // Normal board mode
    
    board = {
      mode: 'board',
      myHealth: me?.health ?? 35,
      opponentHealth: opponent?.health ?? 35,
      myFleet: myFleetWithPreview,
      opponentFleet, // already filtered by createdTurn
    };
  }
  
  // ============================================================================
  // SPECIES TAB RULES (A-C: Selection phase vs locked-in phase)
  // ============================================================================
  
  // Map species to canonical catalog panel ID
  function speciesToCataloguePanelId(species: SpeciesId): ActionPanelId {
    switch (species) {
      case 'human':
        return 'ap.catalog.ships.human';
      case 'xenite':
        return 'ap.catalog.ships.xenite';
      case 'centaur':
        return 'ap.catalog.ships.centaur';
      case 'ancient':
        return 'ap.catalog.ships.ancient';
    }
  }
  
  // Helper: Get species display label (Title Case)
  function getSpeciesLabel(species: SpeciesId): string {
    switch (species) {
      case 'human': return 'Human';
      case 'xenite': return 'Xenite';
      case 'centaur': return 'Centaur';
      case 'ancient': return 'Ancient';
    }
  }
  
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
  const p1IsReady = p1HasJoined ? isPlayerReady(me?.id) : false;
  const p2IsReady = p2HasJoined ? isPlayerReady(opponent?.id) : false;
  
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
  });
  
  // ============================================================================
  // ACTION CALLBACKS (NO-OPS)
  // ============================================================================
  
  const actions: GameSessionActions = {
    onReadyToggle: async () => {
      // Snapshot build preview before async flow to prevent race conditions
      const buildPreviewSnapshot = { ...buildPreviewCountsRef.current };
      
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
      });
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
    
    onSendChat: (text: string) => {
      console.log('[useGameSession] Send chat (no-op):', text);
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
      
      // Gate 3: Only DEF and FIG for Chunk 6 (temporary constraint)
      if (shipDefId !== 'DEF' && shipDefId !== 'FIG') {
        return; // Silent no-op for other ships
      }
      
      // Gate 4: Use the UI-driving turnNumber for gating.
      // rawState can lag between polls and incorrectly block ship clicks.
      const uiTurnNumber = turnNumber;
      
      const buildSubmitted = buildSubmittedByTurn[uiTurnNumber] === true;
      if (buildSubmitted) {
        return; // Silent no-op if build already submitted for this turn
      }
      
      // All gates passed - update preview buffer
      console.log('[useGameSession] onBuildShip:', shipDefId, 'turn:', uiTurnNumber);
      setBuildPreviewCounts(prev => {
        const next = {
          ...prev,
          [shipDefId]: (prev[shipDefId] || 0) + 1,
        };
        
        buildPreviewCountsRef.current = next;
        return next;
      });
    },
  };
  
  return { vm, actions, loading, error };
}