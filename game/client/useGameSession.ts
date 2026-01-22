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

// ============================================================================
// PLAYER NAME UTILITIES
// ============================================================================

const PLAYER_NAME_KEY = 'ss_playerName';

// Two-word random name generation (friendly style)
const ADJECTIVES = [
  'Swift', 'Brave', 'Clever', 'Bold', 'Wise', 'Calm', 'Noble', 'Fierce',
  'Bright', 'Quick', 'Strong', 'Silent', 'Wild', 'Keen', 'Sharp', 'Steady'
];

const FIRST_NAMES = [
  'Alex', 'Blake', 'Casey', 'Drew', 'Ellis', 'Finley', 'Gray', 'Harper',
  'Iris', 'Jordan', 'Kai', 'Logan', 'Morgan', 'Nico', 'Parker', 'Quinn'
];

function generateRandomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  return `${adjective} ${firstName}`;
}

function getPlayerName(propsPlayerName: string): string {
  // Priority 1: props.playerName (if provided by dashboard launcher)
  if (propsPlayerName && propsPlayerName.trim() && propsPlayerName !== 'Guest') {
    return propsPlayerName;
  }
  
  // Priority 2: localStorage stored name
  const storedName = localStorage.getItem(PLAYER_NAME_KEY);
  if (storedName && storedName.trim()) {
    return storedName;
  }
  
  // Priority 3: Generate random friendly name
  const randomName = generateRandomName();
  
  // Store to localStorage for stability across refresh
  localStorage.setItem(PLAYER_NAME_KEY, randomName);
  console.log('[useGameSession] Generated random player name:', randomName);
  
  return randomName;
}

// ============================================================================
// VIEW-MODEL TYPES
// ============================================================================

export interface HudViewModel {
  // Player 1 (local, always left)
  p1Name: string;
  p1Species: string;
  p1IsOnline: boolean;
  p1Clock: string; // \"MM:SS\"
  p1IsReady: boolean;
  p1ReadyLabel: string; // \"Ready\", \"Subphase / Ready\", etc.
  
  // Player 2 (opponent, always right)
  p2Name: string;
  p2Species: string;
  p2IsOnline: boolean;
  p2Clock: string; // \"MM:SS\"
  p2IsReady: boolean;
  p2ReadyLabel: string; // \"Ready\", \"Subphase / Ready\", etc.
}

export interface LeftRailViewModel {
  // Dice
  diceValue: number; // 1-6
  
  // Phase card
  turn: number;
  phase: string; // \"BUILD PHASE\", \"BATTLE PHASE\"
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
  label: string;              // e.g. \"[Species 1]\" \"[Species 2]\" \"Menu\"
  visible: boolean;           // opponent tab hidden when same species
  targetPanelId: ActionPanelId; // which panel this tab jumps to
}

export interface ActionPanelViewModel {
  activePanelId: ActionPanelId;
  tabs: ActionPanelTabVm[];
}

export interface GameSessionViewModel {
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
  // ============================================================================
  // EFFECTIVE PLAYER NAME RESOLUTION
  // ============================================================================
  
  // Resolve effectivePlayerName with priority order:
  // 1. props.playerName (if provided by dashboard launcher)
  // 2. localStorage stored name (key: ss_playerName)
  // 3. Generate random friendly name and store to localStorage
  const effectivePlayerName = getPlayerName(propsPlayerName);
  
  console.log('[useGameSession] effectivePlayerName resolved:', effectivePlayerName, '(props:', propsPlayerName, ')');
  
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
  
  console.log('[useGameSession] effectiveGameId resolved:', effectiveGameId, '(props:', gameId, ')');
  
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
  // CHUNK 6: LOCAL BUILD PREVIEW BUFFER (NON-AUTHORITATIVE)
  // ============================================================================
  
  // Local preview buffer for build.drawing phase
  // Simple count map: { DEF: 2, FIG: 1, ... }
  // Reset when phase changes away from build.drawing
  const [buildPreviewCounts, setBuildPreviewCounts] = useState<Record<string, number>>({});
  
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
  
  // ============================================================================
  // LOCAL COMPLETION TRACKING (Chunk 7: Build commit/reveal)
  // ============================================================================
  
  // Track build submission by phase instance key
  const [buildCommitDoneByPhase, setBuildCommitDoneByPhase] = useState<Record<string, boolean>>({});
  const [buildRevealDoneByPhase, setBuildRevealDoneByPhase] = useState<Record<string, boolean>>({});
  
  // ============================================================================
  // EVENT TAPE (Chunk 2: Dev-only plumbing)
  // ============================================================================
  
  // Event tape: client-only event log, reset on refresh
  const [eventTape, setEventTape] = useState<any[]>([]);
  
  // Track last seen phase/turn for poll markers
  const lastSeenRef = useRef<{ turn?: number; phaseKey?: string }>({});
  
  // ============================================================================
  // AUTO-JOIN TRACKING (Part C: Set-based tracking per gameId)
  // ============================================================================
  
  // Track auto-join attempts by gameId (allows new attempt when gameId changes)
  const attemptedJoinForGameRef = useRef<Set<string>>(new Set());
  
  // Append events to tape (resilient to null/undefined)
  const appendEvents = (events: any[], meta?: { label?: string; turn?: number; phaseKey?: string }) => {
    const newEntries: any[] = [];
    
    // Optional: Add marker entry if label provided
    if (meta?.label) {
      newEntries.push({
        type: 'client.marker',
        text: meta.label,
        turn: meta.turn,
        phaseKey: meta.phaseKey,
      });
    }
    
    // Append all events (if provided)
    if (events && events.length > 0) {
      newEntries.push(...events);
    }
    
    // Only update if we have something to add
    if (newEntries.length === 0) return;
    
    setEventTape(prev => {
      const updated = [...prev, ...newEntries];
      // Keep last ~200 entries to prevent unbounded growth
      return updated.slice(-200);
    });
  };
  
  // Clear event tape (optional, not surfaced yet)
  const clearEventTape = () => {
    setEventTape([]);
  };
  
  // Format a tape entry for display
  function formatTapeEntry(entry: any): string {
    if (!entry) return '(null)';
    
    // Marker entries
    if (entry.type === 'client.marker' && entry.text) {
      return entry.text;
    }
    
    // Build a compact representation
    const parts: string[] = [];
    
    if (entry.type) {
      parts.push(`[${entry.type}]`);
    }
    
    // Common fields
    if (entry.playerId) parts.push(`player=${entry.playerId}`);
    if (entry.from) parts.push(`from=${entry.from}`);
    if (entry.to) parts.push(`to=${entry.to}`);
    if (entry.amount !== undefined) parts.push(`amt=${entry.amount}`);
    if (entry.shipId) parts.push(`ship=${entry.shipId}`);
    if (entry.targetId) parts.push(`target=${entry.targetId}`);
    
    // If we have parts, return them
    if (parts.length > 0) {
      return parts.join(' ');
    }
    
    // Fallback: JSON stringify (compact)
    try {
      return JSON.stringify(entry);
    } catch {
      return String(entry);
    }
  }
  
  // ============================================================================
  // AUTO-JOIN ON MOUNT (Chunk 3: Fire-and-forget join attempt)
  // ============================================================================
  
  useEffect(() => {
    // Guard: only attempt once per gameId
    if (effectiveGameId && attemptedJoinForGameRef.current.has(effectiveGameId)) return;
    
    // Guard: require gameId
    if (!effectiveGameId) return;
    
    // Mark as attempted immediately to prevent re-runs
    attemptedJoinForGameRef.current.add(effectiveGameId);
    
    // Fire-and-forget auto-join attempt
    const attemptJoin = async () => {
      try {
        console.log(`[useGameSession] Auto-join attempt for gameId=${effectiveGameId}, playerName=${effectivePlayerName}`);
        
        // Ensure session BEFORE join (remove race condition)
        const sessionData = await ensureSession(effectivePlayerName);
        console.log(`[useGameSession] Session ensured before join (sessionId: ${sessionData.sessionId})`);
        
        // Store sessionId for "me" detection in polled state
        setMySessionId(sessionData.sessionId);
        
        // Step 1: Attempt to join as player first
        console.log(`[useGameSession] Attempting join as player...`);
        
        let response = await authenticatedPost(`/join-game/${effectiveGameId}`, {
          playerName: effectivePlayerName,
          role: 'player', // Request player role explicitly
        });
        
        // Step 2: If game is full, fallback to spectator
        if (!response.ok) {
          const errorText = await response.text();
          
          // Check for benign "already joined" errors
          const isBenignError = 
            errorText.toLowerCase().includes('already joined') ||
            errorText.toLowerCase().includes('already in game') ||
            response.status === 409; // Conflict (already joined)
          
          if (isBenignError) {
            console.log(`✅ [useGameSession] Already joined gameId=${effectiveGameId} (benign)`);
            console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
            setHasJoinedCurrentGame(true);
            return; // Exit early - already joined
          }
          
          // Check for "game full" / "no slots" errors
          const isGameFull = 
            errorText.toLowerCase().includes('game full') ||
            errorText.toLowerCase().includes('no slots') ||
            errorText.toLowerCase().includes('full') ||
            response.status === 403;
          
          if (isGameFull) {
            console.log(`⚠️ [useGameSession] Game full - falling back to spectator join...`);
            
            // Retry as spectator
            response = await authenticatedPost(`/join-game/${effectiveGameId}`, {
              playerName: effectivePlayerName,
              role: 'spectator',
            });
            
            if (response.ok) {
              // Part A: Do not claim role from join response (await polled game-state)
              console.log(`✅ [useGameSession] Auto-join request ok (awaiting role confirmation via game-state)`);
              console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
              setHasJoinedCurrentGame(true);
              return;
            } else {
              const spectatorErrorText = await response.text();
              console.error(`❌ [useGameSession] Spectator join failed: ${response.status} ${spectatorErrorText}`);
              return;
            }
          }
          
          // Other real failure (e.g., "Player name is required")
          console.warn(`⚠️ [useGameSession] Auto-join failed for gameId=${effectiveGameId}: ${response.status} ${errorText}`);
          return;
        }
        
        // Part A: Join request succeeded - do not claim role yet (await polled game-state)
        console.log(`✅ [useGameSession] Auto-join request ok (awaiting role confirmation via game-state)`);
        console.log(`[useGameSession] Poll unlocked for gameId=${effectiveGameId}`);
        setHasJoinedCurrentGame(true);
        
      } catch (err: any) {
        // Network error or other exception
        console.error(`❌ [useGameSession] Auto-join error for gameId=${effectiveGameId}:`, err.message);
      }
    };
    
    // Execute join attempt (non-blocking)
    attemptJoin();
  }, [effectiveGameId, effectivePlayerName]);
  
  // ============================================================================
  // LIVE POLLING
  // ============================================================================
  
  useEffect(() => {
    // Don't poll without a usable gameId
    if (!effectiveGameId) {
      setLoading(false);
      setError('No gameId provided');
      return;
    }
    
    // Part C: Gate polling until join succeeds (avoid 403)
    // Use state variable hasJoinedCurrentGame to trigger re-renders
    if (!hasJoinedCurrentGame) {
      console.log(`[useGameSession] Polling gated for gameId=${effectiveGameId} (waiting for join to succeed)`);
      setLoading(true);
      return;
    }
    
    let mounted = true;
    let pollTimer: NodeJS.Timeout | null = null;
    let shouldStopPolling = false;
    
    const poll = async () => {
      // Stop if flag is set
      if (shouldStopPolling) {
        return;
      }
      
      try {
        // Fetch game state (authenticatedGet handles session automatically)
        const response = await authenticatedGet(`/game-state/${effectiveGameId}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          
          // Stop polling on 404 Game not found
          if (response.status === 404 && errorText.toLowerCase().includes('game not found')) {
            console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}: Game not found (404) - stopping polling`);
            shouldStopPolling = true;
            if (mounted) {
              setError(`Game not found: ${effectiveGameId}`);
              setLoading(false);
            }
            return;
          }
          
          throw new Error(`Failed to fetch game state: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        
        if (mounted) {
          setRawState(data);
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error(`❌ [useGameSession] Poll error gameId=${effectiveGameId}:`, err);
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
      
      // Schedule next poll (only if not stopped)
      if (mounted && !shouldStopPolling) {
        pollTimer = setTimeout(poll, 1200); // ~1.2s interval
      }
    };
    
    // Start polling
    poll();
    
    return () => {
      mounted = false;
      shouldStopPolling = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
    };
  }, [effectiveGameId, hasJoinedCurrentGame]);
  
  // ============================================================================
  // POLL MARKERS (Chunk 2: Dev-only tape markers on phase/turn changes)
  // ============================================================================
  
  useEffect(() => {
    if (!rawState) return;
    
    const currentTurn = getTurnNumber(rawState);
    const currentPhaseKey = getPhaseKey(rawState);
    
    const lastTurn = lastSeenRef.current.turn;
    const lastPhaseKey = lastSeenRef.current.phaseKey;
    
    // Only append marker when turn or phase changes (not on every poll)
    if (currentTurn !== lastTurn || currentPhaseKey !== lastPhaseKey) {
      appendEvents(
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
  // CHUNK 8: ADD ONE-TIME GAME OVER MARKER (CLIENT EVENT TAPE)
  // ============================================================================
  
  const finishedMarkerShownRef = useRef(false);

  useEffect(() => {
    if (!isFinished) {
      finishedMarkerShownRef.current = false;
      return;
    }

    if (finishedMarkerShownRef.current) return;
    finishedMarkerShownRef.current = true;

    appendEvents([], {
      label: finishedResultText,
      turn: rawState ? getTurnNumber(rawState) : undefined,
      phaseKey: rawState ? getPhaseKey(rawState) : undefined,
    });
  }, [isFinished, finishedResultText, rawState]);
  
  // ============================================================================
  // ROLE CHECK + JOIN OUTCOME LOGGING (Step 2: Make join outcome explicit)
  // ============================================================================
  
  useEffect(() => {
    // Guard: require both rawState and sessionId
    if (!rawState || !mySessionId) return;
    
    const players = rawState.players || [];
    
    // Find "me" in the player list
    const me = players.find((p: any) => p.id === mySessionId);
    const meRole = me?.role || 'missing';
    
    // Count players with role='player'
    const numPlayers = players.filter((p: any) => p.role === 'player').length;
    
    // Log role check (one-time after first poll)
    console.log(`[useGameSession] role-check: meRole=${meRole} numPlayers=${numPlayers} sessionId=${mySessionId}`);
    
    // 1) Players Debug: Show which two sessions occupy player slots
    const playerSlots = players.filter((p: any) => p.role === 'player');
    if (playerSlots.length > 0) {
      const slot1 = playerSlots[0];
      const slot2 = playerSlots[1];
      
      // Step C: Shorten IDs to last 8 chars (prevents collision in logs)
      const short = (id: string) => id ? id.slice(-8) : 'NONE';
      
      const slot1Str = `${short(slot1.id)} ${slot1.displayName || slot1.playerName || 'Unknown'}`;
      const slot2Str = slot2 ? `${short(slot2.id)} ${slot2.displayName || slot2.playerName || 'Unknown'}` : 'empty';
      
      console.log(`[useGameSession] player-slots: #1=${slot1Str} | #2=${slot2Str}`);
    }
    
    // Show "me" info with shortened ID (last 8 chars)
    const shortMyId = mySessionId ? mySessionId.slice(-8) : 'NONE';
    const myName = me?.displayName || me?.playerName || effectivePlayerName || 'Unknown';
    console.log(`[useGameSession] me=${shortMyId} ${myName} role=${myRole}`);
    
    // Explain spectator status
    if (meRole === 'spectator' && numPlayers >= 2) {
      console.log(`[useGameSession] spectator because player slots full (${numPlayers}/2 players)`);
    } else if (meRole === 'spectator' && numPlayers < 2) {
      console.warn(`[useGameSession] spectator unexpectedly — join bug (only ${numPlayers}/2 players)`);
    }
    
    // Update canonical role state
    setMyRole(meRole as 'player' | 'spectator' | 'unknown');
  }, [rawState, mySessionId, effectivePlayerName]); // Trigger on first poll or sessionId change
  
  // ============================================================================
  // FULL PLAYER SNAPSHOT (Debug-only: unambiguous player state logging)
  // ============================================================================
  
  useEffect(() => {
    if (!rawState?.players) return;

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
  
  // ============================================================================
  // SPECTATOR COUNT DEBUG LOG (Step A: Dev-only spectator count logging)
  // ============================================================================
  
  useEffect(() => {
    if (!rawState) return;
    
    const players = rawState.players || [];
    const spectatorCount = players.filter((p: any) => p?.role === 'spectator').length;
    
    console.log('[useGameSession] spectator-count:', {
      gameId: effectiveGameId,
      totalPlayers: players.length,
      spectatorCount,
    });
  }, [rawState, effectiveGameId]);
  
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
  
  // ============================================================================
  // PHASE KEY NORMALIZATION
  // ============================================================================
  
  function getPhaseKey(state: any): string {
    // Prefer server-provided phaseKey
    if (state?.phaseKey) {
      return state.phaseKey;
    }
    
    // Otherwise construct from major.sub
    const major = state?.gameData?.currentPhase || state?.currentPhase;
    const sub = state?.gameData?.currentSubPhase || state?.currentSubPhase;
    
    if (major && sub) {
      return `${major}.${sub}`;
    }
    
    return 'unknown';
  }
  
  function getTurnNumber(state: any): number {
    return state?.gameData?.turnNumber ?? state?.turnNumber ?? 1;
  }
  
  // ============================================================================
  // MAP LIVE STATE TO VIEW-MODELS
  // ============================================================================
  
  // ============================================================================
  // IDENTITY DERIVATION (AUTHORITATIVE - ME VS OPPONENT)
  // ============================================================================
  
  // Extract all players from server state
  const allPlayers = rawState?.players ?? [];
  
  // Filter to role='player' only
  const playerUsers = allPlayers.filter((p: any) => p.role === 'player');
  
  // Find "me" in the player list (using mySessionId for stable identity)
  // "me" is the player whose id === mySessionId
  const me = mySessionId ? allPlayers.find((p: any) => p.id === mySessionId) : null;
  
  // Find "opponent" (the other player, if I'm a player)
  // Opponent is ONLY valid if I'm a player myself
  const opponent = (me?.role === 'player' && mySessionId)
    ? playerUsers.find((p: any) => p.id !== mySessionId) || null
    : null;
  
  // ============================================================================
  // GAME LOGIC - USE ME/OPPONENT (NOT LEFT/RIGHT)
  // ============================================================================
  
  // Phase data
  const phaseKey = rawState ? getPhaseKey(rawState) : 'unknown';
  const turnNumber = rawState ? getTurnNumber(rawState) : 1;
  
  // Phase instance key for completion tracking
  // MUST be defined early — used by preview merge, build gating, and ready logic
  const phaseInstanceKey = `${turnNumber}::${phaseKey}`;
  
  // Determine major phase for icon
  const majorPhase = phaseKey.split('.')[0] || 'build';
  const phaseIcon: 'build' | 'battle' = majorPhase === 'battle' ? 'battle' : 'build';
  
  // Format clock time as MM:SS
  function formatClock(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
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
  const opponentSpeciesLabel = opponent ? getSpeciesLabelForHud(opponent, opponentSpecies) : 'Human';
  
  // ============================================================================
  // SHIP OWNERSHIP (ME/OPPONENT)
  // ============================================================================
  
  // Extract ships from server state
  const shipsData = rawState?.gameData?.ships || rawState?.ships || {};
  
  // Map ships to me/opponent (not server array order)
  const myShips = me?.id ? (shipsData[me.id] || []) : [];
  const opponentShips = opponent?.id ? (shipsData[opponent.id] || []) : [];
  
  // Use majorPhase already defined earlier (line ~798)
  const isInBattlePhase = majorPhase === 'battle';
  
  // Opponent visibility rule:
  // - Always show opponent ships from prior turns
  // - Hide opponent ships created this turn until battle
  const opponentShipsVisible = opponentShips.filter((ship: any) => {
    const createdTurn = ship?.createdTurn;
    // If createdTurn is missing, treat as "old" (visible). This avoids accidental hiding due to incomplete data.
    if (typeof createdTurn !== 'number') return true;
    if (createdTurn < turnNumber) return true;
    // createdTurn === turnNumber -> visible only in battle
    return isInBattlePhase;
  });
  
  // Aggregate fleet summaries
  function aggregateFleet(ships: any[]): BoardFleetSummary[] {
    const counts: Record<string, number> = {};
    
    for (const ship of ships) {
      const defId = ship.shipDefId || 'UNKNOWN';
      counts[defId] = (counts[defId] || 0) + 1;
    }
    
    return Object.entries(counts).map(([shipDefId, count]) => ({ shipDefId, count }));
  }
  
  const myFleet = aggregateFleet(myShips);
  const opponentFleet = aggregateFleet(opponentShipsVisible);
  
  // ============================================================================
  // CHUNK 6: MERGE PREVIEW COUNTS INTO FLEET (BUILD.DRAWING ONLY)
  // ============================================================================
  
  // Determine if we're in build.drawing phase
  const isInBuildDrawing = phaseKey === 'build.drawing';
  
  // ============================================================================
  // CHUNK 6.1: RESET PREVIEW BUFFER ON PHASE-INSTANCE TRANSITION
  // ============================================================================
  
  // Reset preview buffer when:
  // - phaseKey changes away from build.drawing
  // - turnNumber changes
  // - effectiveGameId changes
  // This effect does NOT depend on buildPreviewCounts (avoids noise)
  useEffect(() => {
    // Reset when leaving build.drawing phase OR when turn/game changes
    setBuildPreviewCounts({});
  }, [phaseKey, turnNumber, effectiveGameId]);
  
  // Check if build reveal is done for this phase instance
  const buildRevealDoneThisPhase = !!buildRevealDoneByPhase[phaseInstanceKey];
  
  // Merge preview counts into my fleet (if in build.drawing AND reveal not done)
  const myFleetWithPreview: BoardFleetSummary[] =
    (isInBuildDrawing && !buildRevealDoneThisPhase)
      ? (() => {
          // Start with canonical fleet counts
          const merged: Record<string, number> = {};
          for (const entry of myFleet) {
            merged[entry.shipDefId] = entry.count;
          }
          
          // Add preview counts
          for (const [shipDefId, previewCount] of Object.entries(buildPreviewCounts)) {
            merged[shipDefId] = (merged[shipDefId] || 0) + previewCount;
          }
          
          // Convert back to array format
          const result = Object.entries(merged).map(([shipDefId, count]) => ({ shipDefId, count }));
          
          // Debug log when preview is active (only if buffer is non-empty)
          if (Object.keys(buildPreviewCounts).length > 0) {
            console.log('[useGameSession] Build preview active:', {
              canonical: myFleet,
              preview: buildPreviewCounts,
              merged: result,
            });
          }
          
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
  } else {
    readyEnabled = true;
    readyDisabledReason = null;
  }
  
  // ============================================================================
  // VIEW-MODEL CONSTRUCTION
  // ============================================================================
  
  const vm: GameSessionViewModel = {
    hud: {
      p1Name: me?.name || 'Player 1',
      p1Species: mySpeciesLabel, // STEP E: Use leftSpecies from server mapping
      p1IsOnline: true,
      p1Clock: formatClock(604), // Placeholder clock
      p1IsReady: false,
      p1ReadyLabel: 'Subphase / Ready',
      
      p2Name: opponent?.name || 'Player 2',
      p2Species: opponentSpeciesLabel, // STEP E: Use rightSpecies from server mapping
      p2IsOnline: true,
      p2Clock: formatClock(585), // Placeholder clock
      p2IsReady: true,
      p2ReadyLabel: 'Ready',
    },
    
    leftRail: {
      diceValue: 1,
      turn: turnNumber,
      phase: phaseIcon === 'build' ? 'BUILD PHASE' : 'BATTLE PHASE',
      phaseIcon,
      subphase: phaseKey,
      gameCode: effectiveGameId ? effectiveGameId.substring(0, 6).toUpperCase() : 'NOGAME',
      chatMessages: [],
      drawOffer: null,
      battleLogEntries: eventTape.map(entry => ({
        type: 'event' as const,
        text: formatTapeEntry(entry),
      })),
    },
    
    board,
    
    bottomActionRail: {
      subphaseTitle: 'Subphase information',
      subphaseSubheading: phaseKey,
      canUndoActions: false,
      readyButtonNote: null,
      nextPhaseLabel: 'NEXT PHASE',
      readyDisabled: !readyEnabled,
      readyDisabledReason,
      spectatorCount: allPlayers.filter((p: any) => p?.role === 'spectator').length,
    },
    
    actionPanel: {
      activePanelId,
      tabs,
    },
  };
  
  // ============================================================================
  // ACTION CALLBACKS (NO-OPS)
  // ============================================================================
  
  const actions: GameSessionActions = {
    onReadyToggle: async () => {
      // CHUNK 8: Hard stop if game finished
      if (isFinished) {
        console.log('[useGameSession] onReadyToggle ignored: game finished');
        return;
      }
      
      // ========================================================================
      // CHUNK 7: BUILD COMMIT + REVEAL + DECLARE_READY SEQUENCE
      // ========================================================================
      
      console.log(
        `[useGameSession] onReadyToggle clicked (enabled=${readyEnabled}) reason=${readyDisabledReason ?? 'none'}`
      );
      
      // E1) Keep existing readyEnabled guard (from Chunk 5)
      if (!readyEnabled) {
        console.log(`[useGameSession] Ready disabled: ${readyDisabledReason}`);
        return;
      }
      
      try {
        // E2) If in build.drawing AND player role, do build submission first
        const isBuildDrawing = phaseKey === 'build.drawing';
        
        if (isBuildDrawing && myRole === 'player') {
          // Check if build already submitted for this phase instance
          const buildCommitDone = !!buildCommitDoneByPhase[phaseInstanceKey];
          const buildRevealDone = !!buildRevealDoneByPhase[phaseInstanceKey];
          
          if (!(buildCommitDone && buildRevealDone)) {
            console.log('[useGameSession] Performing BUILD flow before DECLARE_READY...');
            
            // ====================================================================
            // BUILD PAYLOAD CONSTRUCTION
            // ====================================================================
            
            // Convert buildPreviewCounts to builds array
            const buildsArray: Array<{ shipDefId: string; count: number }> = [];
            
            for (const [shipDefId, count] of Object.entries(buildPreviewCounts)) {
              // Only include entries with count > 0
              if (count <= 0) continue;
              
              // Only allow DEF and FIG for Chunk 7 (temporary constraint)
              if (shipDefId !== 'DEF' && shipDefId !== 'FIG') {
                console.warn(`[useGameSession] Skipping disallowed shipDefId: ${shipDefId}`);
                continue;
              }
              
              buildsArray.push({ shipDefId, count });
            }
            
            // Build payload (empty builds array is valid if player built nothing)
            const payload = { builds: buildsArray };
            
            console.log('[useGameSession] Build payload:', payload);
            
            // ====================================================================
            // COMMIT + REVEAL HASHING
            // ====================================================================
            
            // Generate nonce and compute commit hash
            const nonce = generateNonce();
            const commitHash = await makeCommitHash(payload, nonce);
            
            // ====================================================================
            // STEP 1: BUILD_COMMIT
            // ====================================================================
            
            if (!buildCommitDone) {
              console.log('[useGameSession] Submitting BUILD_COMMIT...');
              
              const commitResponse = await authenticatedPost('/intent', {
                gameId: effectiveGameId,
                intentType: 'BUILD_COMMIT',
                turnNumber,
                commitHash,
              });
              
              if (!commitResponse.ok) {
                const errorText = await commitResponse.text();
                console.error('[useGameSession] BUILD_COMMIT failed:', errorText);
                return; // Fail early
              }
              
              const commitResult = await commitResponse.json();
              
              if (!commitResult.ok) {
                console.error('[useGameSession] BUILD_COMMIT rejected:', commitResult.rejected);
                return; // Fail early
              }
              
              // Append events to tape
              appendEvents(commitResult.events || [], {
                label: 'BUILD_COMMIT',
                turn: turnNumber,
                phaseKey,
              });
              
              // Mark commit done for this phase instance
              setBuildCommitDoneByPhase(prev => ({
                ...prev,
                [phaseInstanceKey]: true,
              }));
              
              console.log('✅ [useGameSession] BUILD_COMMIT succeeded');
            }
            
            // ====================================================================
            // STEP 2: BUILD_REVEAL
            // ====================================================================
            
            if (!buildRevealDone) {
              console.log('[useGameSession] Submitting BUILD_REVEAL...');
              
              const revealResponse = await authenticatedPost('/intent', {
                gameId: effectiveGameId,
                intentType: 'BUILD_REVEAL',
                turnNumber,
                payload,
                nonce,
              });
              
              if (!revealResponse.ok) {
                const errorText = await revealResponse.text();
                console.error('[useGameSession] BUILD_REVEAL failed:', errorText);
                return; // Fail early
              }
              
              const revealResult = await revealResponse.json();
              
              if (!revealResult.ok) {
                console.error('[useGameSession] BUILD_REVEAL rejected:', revealResult.rejected);
                return; // Fail early
              }
              
              // Append events to tape
              appendEvents(revealResult.events || [], {
                label: 'BUILD_REVEAL',
                turn: turnNumber,
                phaseKey,
              });
              
              // Mark reveal done for this phase instance
              setBuildRevealDoneByPhase(prev => ({
                ...prev,
                [phaseInstanceKey]: true,
              }));
              
              console.log('✅ [useGameSession] BUILD_REVEAL succeeded');
              
              // Clear local preview buffer once the reveal is accepted.
              // After reveal, the server will persist these ships into gameData.ships,
              // so keeping the preview causes double counting.
              setBuildPreviewCounts({});
              
              // Refresh game state immediately after build reveal
              await refreshGameStateOnce();
            }
          } else {
            console.log('[useGameSession] Build already submitted for this phase instance, skipping BUILD flow');
          }
        }
        
        // E3) Always send DECLARE_READY after build flow (or immediately if not build.drawing)
        console.log('[useGameSession] Submitting DECLARE_READY...');
        
        const response = await authenticatedPost('/intent', {
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
      // CHUNK 8: Hard stop if game finished
      if (isFinished) {
        console.log('[useGameSession] onConfirmSpecies ignored: game finished');
        return;
      }
      
      console.log('[useGameSession] Confirm species:', selectedSpecies);
      
      // ========================================================================
      // CHUNK 4: SPECIES COMMIT + REVEAL SEQUENCE
      // ========================================================================
      
      // Part C: Guard using canonical myRole state (confirmed from polled game-state)
      if (myRole !== 'player') {
        const numPlayers = allPlayers.filter((p: any) => p.role === 'player').length;
        console.warn(
          '[useGameSession] Only players can submit species selection intents',
          `| myRole=${myRole} numPlayers=${numPlayers} sessionId=${mySessionId}`
        );
        return;
      }
      
      // Guard: Human-only constraint for Phase 1
      if (selectedSpecies !== 'human') {
        console.warn('[useGameSession] Non-Human species not supported in Phase 1');
        return;
      }
      
      // Guard: Don't re-submit if already complete for this phase instance
      if (isSpeciesSelectionComplete) {
        console.log('[useGameSession] Species selection already complete for this phase instance');
        return;
      }
      
      try {
        // ========================================================================
        // STEP 1: SPECIES_COMMIT
        // ========================================================================
        
        if (!isCommitDone) {
          console.log('[useGameSession] Submitting SPECIES_COMMIT...');
          
          // Build payload
          const payload = { species: selectedSpecies };
          
          // Generate nonce and compute commit hash
          const nonce = generateNonce();
          const commitHash = await makeCommitHash(payload, nonce);
          
          // POST SPECIES_COMMIT intent
          const commitResponse = await authenticatedPost('/intent', {
            gameId: effectiveGameId,
            intentType: 'SPECIES_COMMIT',
            turnNumber,
            commitHash,
          });
          
          if (!commitResponse.ok) {
            const errorText = await commitResponse.text();
            console.error('[useGameSession] SPECIES_COMMIT failed:', errorText);
            return;
          }
          
          const commitResult = await commitResponse.json();
          
          if (!commitResult.ok) {
            console.error('[useGameSession] SPECIES_COMMIT rejected:', commitResult.rejected);
            return;
          }
          
          // Append events to tape
          appendEvents(commitResult.events || [], {
            label: `SPECIES_COMMIT (${selectedSpecies.toUpperCase()})`,
            turn: turnNumber,
            phaseKey,
          });
          
          // Mark commit done for this phase instance
          setSpeciesCommitDoneByPhase(prev => ({
            ...prev,
            [phaseInstanceKey]: true,
          }));
          
          console.log('✅ [useGameSession] SPECIES_COMMIT succeeded');
          
          // ========================================================================
          // STEP 2: SPECIES_REVEAL
          // ========================================================================
          
          console.log('[useGameSession] Submitting SPECIES_REVEAL...');
          
          // POST SPECIES_REVEAL intent (with same payload and nonce)
          const revealResponse = await authenticatedPost('/intent', {
            gameId: effectiveGameId,
            intentType: 'SPECIES_REVEAL',
            turnNumber,
            payload,
            nonce,
          });
          
          if (!revealResponse.ok) {
            const errorText = await revealResponse.text();
            console.error('[useGameSession] SPECIES_REVEAL failed:', errorText);
            return;
          }
          
          const revealResult = await revealResponse.json();
          
          if (!revealResult.ok) {
            console.error('[useGameSession] SPECIES_REVEAL rejected:', revealResult.rejected);
            return;
          }
          
          // Append events to tape
          appendEvents(revealResult.events || [], {
            label: `SPECIES_REVEAL (${selectedSpecies.toUpperCase()})`,
            turn: turnNumber,
            phaseKey,
          });
          
          // Mark reveal done for this phase instance
          setSpeciesRevealDoneByPhase(prev => ({
            ...prev,
            [phaseInstanceKey]: true,
          }));
          
          console.log('✅ [useGameSession] SPECIES_REVEAL succeeded');
          console.log('✅ [useGameSession] Species selection complete!');
          
          // Refresh game state immediately after species reveal
          await refreshGameStateOnce();
        }
        
      } catch (err: any) {
        console.error('[useGameSession] Species confirmation error:', err);
      }
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
      // CHUNK 6.1: GATED LOCAL BUILD PREVIEW
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
      
      // ========================================================================
      // CHUNK 7: PREVENT ADDING SHIPS AFTER BUILD SUBMISSION
      // ========================================================================
      
      // Gate 4: Prevent adding ships after build submission for this phase instance
      const buildDone = !!buildCommitDoneByPhase[phaseInstanceKey] && !!buildRevealDoneByPhase[phaseInstanceKey];
      if (buildDone) {
        return; // Silent no-op if build already submitted
      }
      
      // All gates passed - update preview buffer
      console.log('[useGameSession] onBuildShip:', shipDefId);
      setBuildPreviewCounts(prev => ({
        ...prev,
        [shipDefId]: (prev[shipDefId] || 0) + 1,
      }));
    },
  };
  
  return { vm, actions, loading, error };
}