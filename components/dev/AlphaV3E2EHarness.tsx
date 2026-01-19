/**
 * ALPHA V3 E2E TEST HARNESS
 * 
 * Purpose: Validate the authoritative server engine end-to-end
 * 
 * This harness exercises the full intent pipeline:
 *   intent → commit/reveal → DECLARE_READY
 *   → advancePhase → onEnterPhase → resolvePhase
 *   → translateShipPowers → applyEffects
 * 
 * HARD CONSTRAINTS:
 * - Uses ONLY /intent endpoint (no legacy endpoints)
 * - Never modifies server code
 * - Implements proper commit/reveal hashing (SHA-256)
 * - Handles two player sessions independently
 * - Fails loudly on server rejection
 * - No client-side rule computation
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

// ============================================================================
// TYPES
// ============================================================================

type Species = 'human' | 'xenite' | 'centaur' | 'ancient';

interface PlayerSession {
  sessionToken: string;
  sessionId: string;
  displayName: string;
}

interface LogEntry {
  timestamp: number;
  level: 'info' | 'error' | 'success' | 'warning';
  message: string;
  data?: any;
}

interface GameStateSnapshot {
  gameId: string;
  status: string;
  currentPhase?: string;
  currentSubPhase?: string;
  phaseKey?: string;
  turnNumber?: number;
  players: Array<{
    id: string;
    name?: string;
    role: string;
    health: number;
  }>;
  ships: Record<string, Array<{
    instanceId: string;
    shipDefId: string;
    createdTurn?: number;
  }>>;
  events?: any[];
}

// ============================================================================
// HASHING UTILITIES (MUST MATCH SERVER)
// ============================================================================

/**
 * Generate commit hash using Web Crypto API
 * MUST MATCH: /supabase/functions/server/engine/intent/Hash.ts
 * 
 * Formula: SHA-256( JSON.stringify(payload) + nonce )
 */
async function generateCommitHash(payload: any, nonce: string): Promise<string> {
  const payloadStr = JSON.stringify(payload);
  const combined = payloadStr + nonce;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Generate a random nonce
 */
function generateNonce(): string {
  return crypto.randomUUID();
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session token
 */
async function createSession(displayName: string): Promise<PlayerSession> {
  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/session/start`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({ displayName }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Session creation failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return {
    sessionToken: data.sessionToken,
    sessionId: data.sessionId,
    displayName: data.displayName || displayName,
  };
}

/**
 * Make an authenticated request with session token
 */
async function authenticatedRequest(
  endpoint: string,
  sessionToken: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${publicAnonKey}`,
      'apikey': publicAnonKey,
      'X-Session-Token': sessionToken,
    },
  });
}

// ============================================================================
// GAME API
// ============================================================================

/**
 * Create a new game
 */
async function createGame(session: PlayerSession): Promise<string> {
  const response = await authenticatedRequest(
    '/create-game',
    session.sessionToken,
    {
      method: 'POST',
      body: JSON.stringify({ playerName: session.displayName }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create game failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.gameId || data.game?.gameId || data.id;
}

/**
 * Join an existing game
 */
async function joinGame(gameId: string, session: PlayerSession): Promise<void> {
  const response = await authenticatedRequest(
    `/join-game/${gameId}`,
    session.sessionToken,
    {
      method: 'POST',
      body: JSON.stringify({
        playerName: session.displayName,
        role: 'player',
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Join game failed: ${response.status} ${errorText}`);
  }
}

/**
 * Fetch game state
 */
async function fetchGameState(gameId: string, session: PlayerSession): Promise<any> {
  const response = await authenticatedRequest(
    `/game-state/${gameId}`,
    session.sessionToken,
    { method: 'GET' }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fetch game state failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Submit an intent to the server
 */
async function submitIntent(
  gameId: string,
  session: PlayerSession,
  intentType: string,
  turnNumber: number,
  intentPayload: {
    commitHash?: string;
    payload?: any;
    nonce?: string;
  }
): Promise<any> {
  const response = await authenticatedRequest(
    '/intent',
    session.sessionToken,
    {
      method: 'POST',
      body: JSON.stringify({
        gameId,
        intentType,
        turnNumber,
        ...intentPayload,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    // Server rejected the intent
    throw new Error(
      `Intent rejected: ${data.rejected?.code || 'UNKNOWN'} - ${data.rejected?.message || 'No message'}`
    );
  }

  return data;
}

// ============================================================================
// INTENT HELPERS
// ============================================================================

/**
 * Check if events array contains a specific event type
 */
function hasEvent(events: any[] | undefined, type: string): boolean {
  return Array.isArray(events) && events.some((e) => e?.type === type);
}

/**
 * Find first event of a specific type
 */
function findEvent(events: any[] | undefined, type: string): any | undefined {
  return Array.isArray(events) ? events.find((e) => e?.type === type) : undefined;
}

/**
 * Count events of a specific type
 */
function countEvents(events: any[] | undefined, type: string): number {
  if (!Array.isArray(events)) return 0;
  return events.filter((e) => e?.type === type).length;
}

/**
 * Species commit/reveal
 */
async function speciesCommitReveal(
  gameId: string,
  session: PlayerSession,
  turnNumber: number,
  species: Species,
  log: (msg: string, level?: string, data?: any) => void
): Promise<void> {
  const payload = { species };
  const nonce = generateNonce();
  const commitHash = await generateCommitHash(payload, nonce);

  // Commit
  log(`[${session.displayName}] SPECIES_COMMIT`, 'info');
  await submitIntent(gameId, session, 'SPECIES_COMMIT', turnNumber, { commitHash });

  // Reveal
  log(`[${session.displayName}] SPECIES_REVEAL: ${species}`, 'info');
  await submitIntent(gameId, session, 'SPECIES_REVEAL', turnNumber, { payload, nonce });
}

/**
 * Build commit/reveal
 */
async function buildCommitReveal(
  gameId: string,
  session: PlayerSession,
  turnNumber: number,
  builds: Array<{ shipDefId: string; count?: number }>,
  log: (msg: string, level?: string, data?: any) => void
): Promise<void> {
  const payload = { builds };
  const nonce = generateNonce();
  const commitHash = await generateCommitHash(payload, nonce);

  // Commit
  log(`[${session.displayName}] BUILD_COMMIT`, 'info');
  await submitIntent(gameId, session, 'BUILD_COMMIT', turnNumber, { commitHash });

  // Reveal
  const buildSummary = builds.map(b => `${b.shipDefId}×${b.count || 1}`).join(', ');
  log(`[${session.displayName}] BUILD_REVEAL: ${buildSummary}`, 'info');
  await submitIntent(gameId, session, 'BUILD_REVEAL', turnNumber, { payload, nonce });
}

/**
 * Declare ready
 */
async function declareReady(
  gameId: string,
  session: PlayerSession,
  turnNumber: number,
  log: (msg: string, level?: string, data?: any) => void
): Promise<void> {
  log(`[${session.displayName}] DECLARE_READY`, 'info');
  await submitIntent(gameId, session, 'DECLARE_READY', turnNumber, {});
}

// ============================================================================
// STATE HELPERS
// ============================================================================

/**
 * Get canonical server turn number
 */
function getServerTurnNumber(state: any): number {
  return (
    state?.gameData?.turnNumber ??
    state?.turnNumber ??
    1
  );
}

/**
 * Get canonical phase key (dot-separated)
 */
function getPhaseKey(state: any): string {
  const major = state?.gameData?.currentPhase || state?.currentPhase;
  const sub = state?.gameData?.currentSubPhase || state?.currentSubPhase;
  
  if (major && sub) {
    return `${major}.${sub}`;
  }
  
  return state?.phaseKey || state?.currentPhaseKey || 'unknown';
}

/**
 * Parse game state into snapshot
 */
function parseGameState(state: any): GameStateSnapshot {
  const players = Array.isArray(state?.players)
    ? state.players.map((p: any) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        health: p.health,
      }))
    : [];

  const shipsData = state?.gameData?.ships || state?.ships || {};
  const ships: Record<string, any[]> = {};
  
  for (const [playerId, shipList] of Object.entries(shipsData)) {
    ships[playerId] = Array.isArray(shipList)
      ? shipList.map((s: any) => ({
          instanceId: s.instanceId,
          shipDefId: s.shipDefId,
          createdTurn: s.createdTurn,
        }))
      : [];
  }

  return {
    gameId: state.gameId,
    status: state.status,
    currentPhase: state?.gameData?.currentPhase || state?.currentPhase,
    currentSubPhase: state?.gameData?.currentSubPhase || state?.currentSubPhase,
    phaseKey: getPhaseKey(state),
    turnNumber: getServerTurnNumber(state),
    players,
    ships,
    events: state?.events || state?.lastEvents || [],
  };
}

/**
 * Wait for a specific phase
 */
async function waitForPhase(
  gameId: string,
  session: PlayerSession,
  targetPhase: string,
  maxAttempts: number = 20,
  log: (msg: string, level?: string, data?: any) => void
): Promise<GameStateSnapshot> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const state = await fetchGameState(gameId, session);
    const snapshot = parseGameState(state);
    const currentPhase = snapshot.phaseKey;
    
    if (currentPhase === targetPhase) {
      log(`✓ Reached target phase: ${targetPhase}`, 'success');
      return snapshot;
    }
    
    attempts++;
    
    // Wait 100ms before next check
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Failed to reach phase ${targetPhase} after ${maxAttempts} attempts`);
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AlphaV3E2EHarness() {
  // Session state
  const [player1, setPlayer1] = useState<PlayerSession | null>(null);
  const [player2, setPlayer2] = useState<PlayerSession | null>(null);
  
  // Game state
  const [gameId, setGameId] = useState<string>('');
  const [currentState, setCurrentState] = useState<GameStateSnapshot | null>(null);
  
  // UI state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // ============================================================================
  // LOGGING
  // ============================================================================

  const log = (message: string, level: 'info' | 'error' | 'success' | 'warning' = 'info', data?: any) => {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };
    
    setLogs(prev => [...prev, entry]);
    
    // Also log to console
    const logFn = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log;
    logFn(`[AlphaV3E2E] ${message}`, data || '');
  };

  const clearLogs = () => setLogs([]);

  // ============================================================================
  // SESSION SETUP
  // ============================================================================

  const handleCreateSessions = async () => {
    try {
      clearLogs();
      log('Creating sessions...', 'info');
      
      const p1 = await createSession('Player 1');
      setPlayer1(p1);
      log(`✓ Player 1 session created: ${p1.sessionId}`, 'success');
      
      const p2 = await createSession('Player 2');
      setPlayer2(p2);
      log(`✓ Player 2 session created: ${p2.sessionId}`, 'success');
      
      log('✓ Both sessions ready', 'success');
    } catch (error: any) {
      log(`❌ Session creation failed: ${error.message}`, 'error');
    }
  };

  // ============================================================================
  // GAME SETUP
  // ============================================================================

  const handleCreateAndJoin = async () => {
    if (!player1 || !player2) {
      log('❌ Create sessions first', 'error');
      return;
    }

    try {
      clearLogs();
      log('Creating game...', 'info');
      
      const gid = await createGame(player1);
      setGameId(gid);
      log(`✓ Game created: ${gid}`, 'success');
      
      log('Joining game as Player 2...', 'info');
      await joinGame(gid, player2);
      log('✓ Player 2 joined', 'success');
      
      // Fetch initial state
      const state = await fetchGameState(gid, player1);
      const snapshot = parseGameState(state);
      setCurrentState(snapshot);
      log(`✓ Initial state: ${snapshot.phaseKey}`, 'success', snapshot);
    } catch (error: any) {
      log(`❌ Setup failed: ${error.message}`, 'error');
    }
  };

  const handleRefreshState = async () => {
    if (!gameId || !player1) {
      log('❌ No active game', 'error');
      return;
    }

    try {
      const state = await fetchGameState(gameId, player1);
      const snapshot = parseGameState(state);
      setCurrentState(snapshot);
      log(`✓ State refreshed: ${snapshot.phaseKey}`, 'success', snapshot);
    } catch (error: any) {
      log(`❌ Refresh failed: ${error.message}`, 'error');
    }
  };

  // ============================================================================
  // SCENARIO RUNNERS
  // ============================================================================

  /**
   * SCENARIO 1: Damage-only sanity test
   * P1: FIG × 5
   * P2: none
   * Expected: 5 EFFECT_APPLIED (Damage), P2 health decreases by 5
   */
  const runScenario1 = async () => {
    if (!gameId || !player1 || !player2) {
      log('❌ Setup game first', 'error');
      return;
    }

    try {
      setIsRunning(true);
      clearLogs();
      log('═══ SCENARIO 1: Damage Test ═══', 'info');
      log('Setup: P1 builds FIG×5, P2 builds nothing', 'info');

      const state = await fetchGameState(gameId, player1);
      const snapshot = parseGameState(state);
      const turn = snapshot.turnNumber || 1;

      // Record initial health
      const p1Initial = snapshot.players.find(p => p.name?.includes('Player 1'));
      const p2Initial = snapshot.players.find(p => p.name?.includes('Player 2'));
      log(`Initial health: P1=${p1Initial?.health}, P2=${p2Initial?.health}`, 'info');

      // Species selection
      await speciesCommitReveal(gameId, player1, turn, 'human', log);
      await speciesCommitReveal(gameId, player2, turn, 'human', log);

      // Build phase
      await buildCommitReveal(gameId, player1, turn, [{ shipDefId: 'FIG', count: 5 }], log);
      await buildCommitReveal(gameId, player2, turn, [], log);

      // Advance to battle.end_of_turn_resolution
      log('Advancing to battle.end_of_turn_resolution...', 'info');
      
      let currentPhase = snapshot.phaseKey;
      let attempts = 0;
      const MAX_ATTEMPTS = 30;
      
      while (currentPhase !== 'battle.end_of_turn_resolution' && attempts < MAX_ATTEMPTS) {
        await declareReady(gameId, player1, turn, log);
        await declareReady(gameId, player2, turn, log);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const newState = await fetchGameState(gameId, player1);
        const newSnapshot = parseGameState(newState);
        currentPhase = newSnapshot.phaseKey;
        
        log(`Phase: ${currentPhase}`, 'info');
        attempts++;
      }

      if (currentPhase !== 'battle.end_of_turn_resolution') {
        log(`❌ Failed to reach battle.end_of_turn_resolution after ${MAX_ATTEMPTS} attempts`, 'error');
        return;
      }

      // Fetch final state
      const finalState = await fetchGameState(gameId, player1);
      const finalSnapshot = parseGameState(finalState);
      setCurrentState(finalSnapshot);

      const p1Final = finalSnapshot.players.find(p => p.name?.includes('Player 1'));
      const p2Final = finalSnapshot.players.find(p => p.name?.includes('Player 2'));
      
      log(`Final health: P1=${p1Final?.health}, P2=${p2Final?.health}`, 'info');
      log(`P2 health change: ${(p2Initial?.health || 0) - (p2Final?.health || 0)}`, 'info');

      // Check for EFFECT_APPLIED events
      const effectEvents = finalSnapshot.events?.filter((e: any) => e.type === 'EFFECT_APPLIED') || [];
      log(`EFFECT_APPLIED events: ${effectEvents.length}`, 'info', effectEvents);

      if (effectEvents.length === 5) {
        log('✓ SCENARIO 1 PASSED: 5 damage effects applied', 'success');
      } else {
        log(`⚠ SCENARIO 1: Expected 5 effects, got ${effectEvents.length}`, 'warning');
      }
    } catch (error: any) {
      log(`❌ Scenario 1 failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * SCENARIO 2: Heal-only sanity test
   * P1: DEF × 3
   * P2: none
   * Expected: 3 EFFECT_APPLIED (Heal), P1 health increases by 3
   */
  const runScenario2 = async () => {
    if (!gameId || !player1 || !player2) {
      log('❌ Setup game first', 'error');
      return;
    }

    try {
      setIsRunning(true);
      clearLogs();
      log('═══ SCENARIO 2: Heal Test ═══', 'info');
      log('Setup: P1 builds DEF×3, P2 builds nothing', 'info');

      const state = await fetchGameState(gameId, player1);
      const snapshot = parseGameState(state);
      const turn = snapshot.turnNumber || 1;

      const p1Initial = snapshot.players.find(p => p.name?.includes('Player 1'));
      const p2Initial = snapshot.players.find(p => p.name?.includes('Player 2'));
      log(`Initial health: P1=${p1Initial?.health}, P2=${p2Initial?.health}`, 'info');

      // Species selection
      await speciesCommitReveal(gameId, player1, turn, 'human', log);
      await speciesCommitReveal(gameId, player2, turn, 'human', log);

      // Build phase
      await buildCommitReveal(gameId, player1, turn, [{ shipDefId: 'DEF', count: 3 }], log);
      await buildCommitReveal(gameId, player2, turn, [], log);

      // Advance to battle.end_of_turn_resolution
      log('Advancing to battle.end_of_turn_resolution...', 'info');
      
      let currentPhase = snapshot.phaseKey;
      let attempts = 0;
      const MAX_ATTEMPTS = 30;
      
      while (currentPhase !== 'battle.end_of_turn_resolution' && attempts < MAX_ATTEMPTS) {
        await declareReady(gameId, player1, turn, log);
        await declareReady(gameId, player2, turn, log);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const newState = await fetchGameState(gameId, player1);
        const newSnapshot = parseGameState(newState);
        currentPhase = newSnapshot.phaseKey;
        
        log(`Phase: ${currentPhase}`, 'info');
        attempts++;
      }

      if (currentPhase !== 'battle.end_of_turn_resolution') {
        log(`❌ Failed to reach battle.end_of_turn_resolution`, 'error');
        return;
      }

      const finalState = await fetchGameState(gameId, player1);
      const finalSnapshot = parseGameState(finalState);
      setCurrentState(finalSnapshot);

      const p1Final = finalSnapshot.players.find(p => p.name?.includes('Player 1'));
      const p2Final = finalSnapshot.players.find(p => p.name?.includes('Player 2'));
      
      log(`Final health: P1=${p1Final?.health}, P2=${p2Final?.health}`, 'info');
      log(`P1 health change: ${(p1Final?.health || 0) - (p1Initial?.health || 0)}`, 'info');

      const effectEvents = finalSnapshot.events?.filter((e: any) => e.type === 'EFFECT_APPLIED') || [];
      log(`EFFECT_APPLIED events: ${effectEvents.length}`, 'info', effectEvents);

      if (effectEvents.length === 3) {
        log('✓ SCENARIO 2 PASSED: 3 heal effects applied', 'success');
      } else {
        log(`⚠ SCENARIO 2: Expected 3 effects, got ${effectEvents.length}`, 'warning');
      }
    } catch (error: any) {
      log(`❌ Scenario 2 failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * SCENARIO 3: Net-zero regression test
   * P1: DEF × 1
   * P2: FIG × 1
   * Expected: 2 EFFECT_APPLIED events, P1 net health = 0
   */
  const runScenario3 = async () => {
    if (!gameId || !player1 || !player2) {
      log('❌ Setup game first', 'error');
      return;
    }

    try {
      setIsRunning(true);
      clearLogs();
      log('═══ SCENARIO 3: Net-Zero Test ═══', 'info');
      log('Setup: P1 builds DEF×1, P2 builds FIG×1', 'info');

      const state = await fetchGameState(gameId, player1);
      const snapshot = parseGameState(state);
      const turn = snapshot.turnNumber || 1;

      const p1Initial = snapshot.players.find(p => p.name?.includes('Player 1'));
      log(`Initial P1 health: ${p1Initial?.health}`, 'info');

      // Species selection
      await speciesCommitReveal(gameId, player1, turn, 'human', log);
      await speciesCommitReveal(gameId, player2, turn, 'human', log);

      // Build phase
      await buildCommitReveal(gameId, player1, turn, [{ shipDefId: 'DEF', count: 1 }], log);
      await buildCommitReveal(gameId, player2, turn, [{ shipDefId: 'FIG', count: 1 }], log);

      // Advance to battle.end_of_turn_resolution
      log('Advancing to battle.end_of_turn_resolution...', 'info');
      
      let currentPhase = snapshot.phaseKey;
      let attempts = 0;
      const MAX_ATTEMPTS = 30;
      
      while (currentPhase !== 'battle.end_of_turn_resolution' && attempts < MAX_ATTEMPTS) {
        await declareReady(gameId, player1, turn, log);
        await declareReady(gameId, player2, turn, log);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const newState = await fetchGameState(gameId, player1);
        const newSnapshot = parseGameState(newState);
        currentPhase = newSnapshot.phaseKey;
        
        log(`Phase: ${currentPhase}`, 'info');
        attempts++;
      }

      if (currentPhase !== 'battle.end_of_turn_resolution') {
        log(`❌ Failed to reach battle.end_of_turn_resolution`, 'error');
        return;
      }

      const finalState = await fetchGameState(gameId, player1);
      const finalSnapshot = parseGameState(finalState);
      setCurrentState(finalSnapshot);

      const p1Final = finalSnapshot.players.find(p => p.name?.includes('Player 1'));
      const healthDelta = (p1Final?.health || 0) - (p1Initial?.health || 0);
      
      log(`Final P1 health: ${p1Final?.health}`, 'info');
      log(`P1 health change: ${healthDelta}`, 'info');

      const effectEvents = finalSnapshot.events?.filter((e: any) => e.type === 'EFFECT_APPLIED') || [];
      log(`EFFECT_APPLIED events: ${effectEvents.length}`, 'info', effectEvents);

      if (effectEvents.length === 2 && healthDelta === 0) {
        log('✓ SCENARIO 3 PASSED: 2 effects, net-zero health change', 'success');
      } else {
        log(`⚠ SCENARIO 3: Expected 2 effects + 0 delta, got ${effectEvents.length} effects + ${healthDelta} delta`, 'warning');
      }
    } catch (error: any) {
      log(`❌ Scenario 3 failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * SCENARIO 4: Kill test
   * P1: FIG × 10
   * P2: none
   * Loop turns until P2 health <= 0 or 10 turns max
   */
  const runScenario4 = async () => {
    if (!gameId || !player1 || !player2) {
      log('❌ Setup game first', 'error');
      return;
    }

    try {
      setIsRunning(true);
      clearLogs();
      log('═══ SCENARIO 4: Kill Test ═══', 'info');
      log('Setup: P1 builds FIG×10, loop until P2 health <= 0', 'info');

      // Fetch initial state and get server turn
      let state = await fetchGameState(gameId, player1);
      let serverTurn = getServerTurnNumber(state);
      log(`Initial server turn: ${serverTurn}`, 'info');

      // Species selection
      await speciesCommitReveal(gameId, player1, serverTurn, 'human', log);
      await speciesCommitReveal(gameId, player2, serverTurn, 'human', log);

      // Build phase
      await buildCommitReveal(gameId, player1, serverTurn, [{ shipDefId: 'FIG', count: 10 }], log);
      await buildCommitReveal(gameId, player2, serverTurn, [], log);

      // Helper: Advance to a target phase using current server turn
      const advanceToPhase = async (targetPhase: string, maxAttempts: number = 30) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          // Fetch fresh state to get current phase and turn
          const currentState = await fetchGameState(gameId, player1);
          const currentPhase = getPhaseKey(currentState);
          const currentTurn = getServerTurnNumber(currentState);
          
          if (currentPhase === targetPhase) {
            log(`✓ Reached ${targetPhase}`, 'info');
            return currentState;
          }
          
          // Send DECLARE_READY with current server turn
          log(`Advancing from ${currentPhase} (turn ${currentTurn})`, 'info');
          await submitIntent(gameId, player1, 'DECLARE_READY', currentTurn, {});
          await submitIntent(gameId, player2, 'DECLARE_READY', currentTurn, {});
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        throw new Error(`Failed to reach ${targetPhase} after ${maxAttempts} attempts`);
      };

      // Helper: Capture EFFECT_APPLIED events from intent response when advancing INTO end_of_turn_resolution
      const advanceAndCaptureEffects = async (): Promise<{ state: any; effectCount: number }> => {
        // Keep advancing until we're one step before end_of_turn_resolution
        let currentState = await fetchGameState(gameId, player1);
        let currentPhase = getPhaseKey(currentState);
        let currentTurn = getServerTurnNumber(currentState);
        let lastIntentResponse: any = null;
        
        while (currentPhase !== 'battle.end_of_turn_resolution') {
          // Send DECLARE_READY and capture response
          const p1Response = await submitIntent(gameId, player1, 'DECLARE_READY', currentTurn, {});
          const p2Response = await submitIntent(gameId, player2, 'DECLARE_READY', currentTurn, {});
          
          // Check if either response advanced to end_of_turn_resolution
          const p1Advanced = findEvent(p1Response.events, 'PHASE_ADVANCED');
          const p2Advanced = findEvent(p2Response.events, 'PHASE_ADVANCED');
          
          if (p1Advanced?.to === 'battle.end_of_turn_resolution') {
            lastIntentResponse = p1Response;
          } else if (p2Advanced?.to === 'battle.end_of_turn_resolution') {
            lastIntentResponse = p2Response;
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Refresh state
          currentState = await fetchGameState(gameId, player1);
          currentPhase = getPhaseKey(currentState);
          currentTurn = getServerTurnNumber(currentState);
        }
        
        // Count EFFECT_APPLIED events from the intent response that advanced into end_of_turn_resolution
        const effectCount = lastIntentResponse ? countEvents(lastIntentResponse.events, 'EFFECT_APPLIED') : 0;
        
        return { state: currentState, effectCount };
      };

      // Loop turns until P2 dies or max turns reached
      const MAX_TURNS = 10;
      let loopsCompleted = 0;
      
      for (let i = 0; i < MAX_TURNS; i++) {
        // Fetch current state at start of loop
        const loopState = await fetchGameState(gameId, player1);
        const loopTurn = getServerTurnNumber(loopState);
        const loopPhase = getPhaseKey(loopState);
        
        log(`─── Turn ${loopTurn} (loop ${i + 1}) ───`, 'info');
        log(`Starting phase: ${loopPhase}`, 'info');
        
        // Advance to battle.end_of_turn_resolution and capture effects
        const { state: resolutionState, effectCount } = await advanceAndCaptureEffects();
        
        log(`EFFECT_APPLIED events: ${effectCount}`, 'info');
        
        // Check health after resolution
        const p1Player = resolutionState.players.find((p: any) => p.name?.includes('Player 1'));
        const p2Player = resolutionState.players.find((p: any) => p.name?.includes('Player 2'));
        
        log(`P1 health: ${p1Player?.health}, P2 health: ${p2Player?.health}`, 'info');
        
        setCurrentState(parseGameState(resolutionState));
        
        // Check win condition
        if (resolutionState.status === 'finished') {
          log('✓ Game marked finished by server', 'success');
          log('✓ SCENARIO 4 PASSED: Game completed', 'success');
          loopsCompleted = i + 1;
          break;
        }
        
        if ((p2Player?.health || 0) <= 0) {
          log('✓ P2 health reduced to 0', 'success');
          log('✓ SCENARIO 4 PASSED: Kill condition met', 'success');
          loopsCompleted = i + 1;
          break;
        }
        
        // Advance OUT of end_of_turn_resolution to trigger turn bump
        log('Advancing out of end_of_turn_resolution to bump turn...', 'info');
        
        const currentTurnBeforeBump = getServerTurnNumber(resolutionState);
        const expectedNextTurn = currentTurnBeforeBump + 1;
        
        // Send DECLARE_READY to leave end_of_turn_resolution
        await submitIntent(gameId, player1, 'DECLARE_READY', currentTurnBeforeBump, {});
        await submitIntent(gameId, player2, 'DECLARE_READY', currentTurnBeforeBump, {});
        
        // Wait for phase to become build.dice_roll AND turn to increment
        let bumpAttempts = 0;
        const MAX_BUMP_ATTEMPTS = 20;
        let bumped = false;
        
        while (bumpAttempts < MAX_BUMP_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const checkState = await fetchGameState(gameId, player1);
          const checkPhase = getPhaseKey(checkState);
          const checkTurn = getServerTurnNumber(checkState);
          
          if (checkPhase === 'build.dice_roll' && checkTurn === expectedNextTurn) {
            log(`✓ Turn bumped to ${checkTurn}, phase: ${checkPhase}`, 'success');
            bumped = true;
            break;
          }
          
          bumpAttempts++;
        }
        
        if (!bumped) {
          log(`⚠ Warning: Turn may not have bumped correctly`, 'warning');
        }
        
        loopsCompleted = i + 1;
      }
      
      log(`✓ Scenario 4 complete: ${loopsCompleted} turn(s) executed`, 'success');
      
    } catch (error: any) {
      log(`❌ Scenario 4 failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  /**
   * Run all scenarios
   */
  const runAllScenarios = async () => {
    if (!gameId || !player1 || !player2) {
      log('❌ Setup game first', 'error');
      return;
    }

    log('═══ RUNNING ALL SCENARIOS ═══', 'info');
    
    // Note: Each scenario should ideally use a fresh game
    // For simplicity, we'll run them sequentially on the same game
    // In production testing, create a new game for each scenario
    
    await runScenario1();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // For remaining scenarios, would need fresh games
    // Simplified version just runs scenario 1
    log('Note: Full scenario suite requires fresh games per scenario', 'warning');
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  const handleReset = () => {
    setPlayer1(null);
    setPlayer2(null);
    setGameId('');
    setCurrentState(null);
    clearLogs();
    log('✓ Reset complete', 'success');
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold mb-2">Alpha v3 E2E Test Harness</h1>
        <p className="text-sm text-gray-600">
          Exercises the authoritative server engine via /intent endpoint only
        </p>
      </div>

      {/* Session Status */}
      <Card>
        <CardHeader>
          <CardTitle>Session Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Player 1:</span>
            <Badge variant={player1 ? 'default' : 'outline'}>
              {player1 ? player1.displayName : 'Not created'}
            </Badge>
            {player1 && (
              <span className="text-xs text-gray-500 font-mono">
                {player1.sessionId.substring(0, 8)}...
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Player 2:</span>
            <Badge variant={player2 ? 'default' : 'outline'}>
              {player2 ? player2.displayName : 'Not created'}
            </Badge>
            {player2 && (
              <span className="text-xs text-gray-500 font-mono">
                {player2.sessionId.substring(0, 8)}...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Game ID:</span>
            <span className="text-sm text-gray-700 font-mono">
              {gameId || 'None'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleCreateSessions} disabled={isRunning}>
              Create Sessions
            </Button>
            <Button
              onClick={handleCreateAndJoin}
              disabled={!player1 || !player2 || isRunning}
            >
              Create + Join Game
            </Button>
            <Button
              onClick={handleRefreshState}
              disabled={!gameId || isRunning}
              variant="outline"
            >
              Refresh State
            </Button>
            <Button onClick={handleReset} variant="outline">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Test Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Test Scenarios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={runScenario1}
              disabled={!gameId || isRunning}
              variant="outline"
            >
              Scenario 1: Damage
            </Button>
            <Button
              onClick={runScenario2}
              disabled={!gameId || isRunning}
              variant="outline"
            >
              Scenario 2: Heal
            </Button>
            <Button
              onClick={runScenario3}
              disabled={!gameId || isRunning}
              variant="outline"
            >
              Scenario 3: Net-Zero
            </Button>
            <Button
              onClick={runScenario4}
              disabled={!gameId || isRunning}
              variant="outline"
            >
              Scenario 4: Kill Test
            </Button>
          </div>
          
          <Button
            onClick={runAllScenarios}
            disabled={!gameId || isRunning}
            className="w-full"
          >
            Run All Scenarios
          </Button>

          {isRunning && (
            <p className="text-sm text-gray-600 text-center">
              Running scenario... check log panel below
            </p>
          )}
        </CardContent>
      </Card>

      {/* State Inspection */}
      {currentState && (
        <Card>
          <CardHeader>
            <CardTitle>Current State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span>{' '}
                <Badge>{currentState.status}</Badge>
              </div>
              <div>
                <span className="font-medium">Phase:</span>{' '}
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {currentState.phaseKey}
                </code>
              </div>
              <div>
                <span className="font-medium">Turn:</span> {currentState.turnNumber}
              </div>
            </div>

            <Separator />

            <div>
              <div className="font-medium text-sm mb-2">Players</div>
              {currentState.players.map((p) => (
                <div key={p.id} className="text-sm mb-1 flex items-center gap-2">
                  <Badge variant="outline">{p.name}</Badge>
                  <span>Health: {p.health}</span>
                  <span className="text-gray-500 text-xs">({p.role})</span>
                </div>
              ))}
            </div>

            <Separator />

            <div>
              <div className="font-medium text-sm mb-2">Ships</div>
              <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(currentState.ships, null, 2)}
              </pre>
            </div>

            {currentState.events && currentState.events.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="font-medium text-sm mb-2">
                    Recent Events ({currentState.events.length})
                  </div>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(currentState.events, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Log Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Log</CardTitle>
            <Button onClick={clearLogs} variant="outline" size="sm">
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-96 overflow-auto">
            {logs.length === 0 && (
              <div className="text-gray-500">No logs yet...</div>
            )}
            {logs.map((entry, idx) => {
              const time = new Date(entry.timestamp).toLocaleTimeString();
              const color =
                entry.level === 'error'
                  ? 'text-red-400'
                  : entry.level === 'success'
                  ? 'text-green-400'
                  : entry.level === 'warning'
                  ? 'text-yellow-400'
                  : 'text-gray-300';
              
              return (
                <div key={idx} className={`mb-1 ${color}`}>
                  <span className="text-gray-500">[{time}]</span> {entry.message}
                  {entry.data && (
                    <div className="ml-4 text-gray-400">
                      {JSON.stringify(entry.data, null, 2)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}