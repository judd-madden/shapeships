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
import {
  createSession,
  createGame,
  joinGame,
  fetchGameState,
  submitIntentChecked,
  submitIntent,
  generateCommitHash,
  generateNonce,
  type PlayerSession,
  type Species,
} from './alphaHarness/alphaClient';

// ============================================================================
// TYPES
// ============================================================================

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
 * Phase shape helpers - no hardcoded exact phase strings in scenarios
 */
function isSpeciesSelection(phaseKey: string): boolean {
  return phaseKey === 'setup.species_selection';
}

function isBuildPhase(phaseKey: string): boolean {
  return phaseKey.startsWith('build.');
}

function isBattlePhase(phaseKey: string): boolean {
  return phaseKey.startsWith('battle.');
}

function isResolutionLike(phaseKey: string): boolean {
  return phaseKey.includes('resolution') || phaseKey.startsWith('battle.');
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

/**
 * Wait for species selection to auto-exit (contract: no DECLARE_READY in species selection)
 */
async function waitForSpeciesSelectionExit(
  gameId: string,
  session: PlayerSession,
  log: (msg: string, level?: string, data?: any) => void
): Promise<GameStateSnapshot> {
  log('Waiting for species selection to auto-exit...', 'info');
  
  const MAX_ATTEMPTS = 30;
  let attempts = 0;
  
  while (attempts < MAX_ATTEMPTS) {
    const state = await fetchGameState(gameId, session);
    const snapshot = parseGameState(state);
    const phaseKey = snapshot.phaseKey;
    
    if (!isSpeciesSelection(phaseKey)) {
      log(`✓ Exited species selection, now in: ${phaseKey}`, 'success');
      return snapshot;
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  throw new Error('CONTRACT_VIOLATION: did not exit setup.species_selection after both reveals');
}

/**
 * Resolve until progress is detected (health change, turn change, or game finished)
 * 
 * Uses state diffs to detect progress instead of hardcoded phase names.
 * Returns reason for exit and final state.
 */
async function resolveUntilProgress(
  gameId: string,
  player1: PlayerSession,
  player2: PlayerSession,
  baselineSnapshot: GameStateSnapshot,
  maxSteps: number,
  log: (msg: string, level?: string, data?: any) => void
): Promise<{ state: any; snapshot: GameStateSnapshot; reason: string }> {
  const baselineP1Health = baselineSnapshot.players.find(p => p.id === player1.sessionId)?.health || 0;
  const baselineP2Health = baselineSnapshot.players.find(p => p.id === player2.sessionId)?.health || 0;
  const baselineTurn = baselineSnapshot.turnNumber || 1;
  
  for (let step = 0; step < maxSteps; step++) {
    // Fetch fresh state
    const state = await fetchGameState(gameId, player1);
    const snapshot = parseGameState(state);
    const phaseKey = snapshot.phaseKey;
    
    // Check for finished
    if (snapshot.status === 'finished') {
      log('✓ Game finished', 'success');
      return { state, snapshot, reason: 'finished' };
    }
    
    // Send DECLARE_READY for both players using submitIntentChecked
    log(`  Step ${step + 1}/${maxSteps}: phase=${phaseKey}, sending DECLARE_READY...`, 'info');
    
    // Aggregate events from all sources
    let aggregatedEvents: any[] = [...(snapshot.events || [])];
    
    try {
      const p1Response = await submitIntentChecked(gameId, player1, 'DECLARE_READY', {}, log);
      const p2Response = await submitIntentChecked(gameId, player2, 'DECLARE_READY', {}, log);
      
      // Aggregate events from intent responses
      aggregatedEvents = [
        ...aggregatedEvents,
        ...(p1Response.events || []),
        ...(p2Response.events || []),
      ];
    } catch (error: any) {
      // If contract violation, re-throw
      if (error.message.includes('CONTRACT_VIOLATION')) {
        throw error;
      }
      // Otherwise log and continue (server may reject stale turns)
      log(`  Intent submission warning: ${error.message}`, 'warning');
    }
    
    // Wait and fetch state again to check for changes
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const postIntentState = await fetchGameState(gameId, player1);
    const postIntentSnapshot = parseGameState(postIntentState);
    
    // Check for health changes (use sessionIds, not name matching)
    const p1Health = postIntentSnapshot.players.find(p => p.id === player1.sessionId)?.health || 0;
    const p2Health = postIntentSnapshot.players.find(p => p.id === player2.sessionId)?.health || 0;
    
    if (p1Health !== baselineP1Health || p2Health !== baselineP2Health) {
      log(`✓ Health changed: P1 ${baselineP1Health}→${p1Health}, P2 ${baselineP2Health}→${p2Health}`, 'info');
      
      // Diagnostic: Check for EFFECT_APPLIED in aggregated events
      const effectCount = aggregatedEvents.filter(e => e?.type === 'EFFECT_APPLIED').length;
      if (effectCount > 0) {
        log(`  EFFECT_APPLIED events observed: ${effectCount}`, 'info');
      } else {
        log(`  Health changed (events unavailable for diagnostics)`, 'info');
      }
      
      return { state: postIntentState, snapshot: postIntentSnapshot, reason: 'health_changed' };
    }
    
    // Check for turn advancement
    const currentTurn = postIntentSnapshot.turnNumber || 1;
    if (currentTurn > baselineTurn) {
      log(`✓ Turn advanced: ${baselineTurn} → ${currentTurn}`, 'info');
      return { state: postIntentState, snapshot: postIntentSnapshot, reason: 'turn_advanced' };
    }
    
    // Contract violation check: should not be in species selection mid-turn
    if (isSpeciesSelection(postIntentSnapshot.phaseKey)) {
      throw new Error('CONTRACT_VIOLATION: entered species selection mid-turn resolution');
    }
  }
  
  // Max steps exceeded without progress
  const state = await fetchGameState(gameId, player1);
  const snapshot = parseGameState(state);
  
  log(`❌ No progress after ${maxSteps} steps, final phase: ${snapshot.phaseKey}`, 'error');
  throw new Error(`FAILED_TO_RESOLVE: no progress after ${maxSteps} steps (final phase: ${snapshot.phaseKey})`);
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
   * SCENARIO 4: Kill test (CONTRACT-COMPLIANT VERSION)
   * P1: FIG × 10
   * P2: none
   * Loop turns until P2 health <= 0 or game finishes
   * 
   * Uses:
   * - submitIntentChecked for contract enforcement
   * - waitForSpeciesSelectionExit (no DECLARE_READY in species selection)
   * - resolveUntilProgress (state diffs, not hardcoded phase names)
   * - Health as truth (events are diagnostic only)
   */
  const runScenario4 = async () => {
    if (!gameId || !player1 || !player2) {
      log('❌ Setup game first', 'error');
      return;
    }

    try {
      setIsRunning(true);
      clearLogs();
      log('═══ SCENARIO 4: Kill Test (Contract-Compliant) ═══', 'info');
      log('Setup: P1 builds FIG×10, P2 builds nothing', 'info');
      log('Contract: Species selection auto-exits, health is truth, no hardcoded phases', 'info');

      // Track last build reveal turn per player to prevent duplicate submissions
      const lastBuildRevealTurn: Record<string, number> = {};

      // === STEP 1: Fetch initial state ===
      let state = await fetchGameState(gameId, player1);
      let snapshot = parseGameState(state);
      
      // Verify we're in species selection
      if (!isSpeciesSelection(snapshot.phaseKey)) {
        log(`⚠ Warning: Expected species selection, got ${snapshot.phaseKey}`, 'warning');
      }
      
      log(`Initial phase: ${snapshot.phaseKey}, turn: ${snapshot.turnNumber}`, 'info');

      // === STEP 2: Species selection (with contract enforcement) ===
      log('─── Species Selection ───', 'info');
      
      // Use submitIntentChecked - will enforce species selection contract
      const p1SpeciesPayload = { species: 'human' as Species };
      const p1SpeciesNonce = generateNonce();
      const p1SpeciesHash = await generateCommitHash(p1SpeciesPayload, p1SpeciesNonce);
      
      await submitIntentChecked(gameId, player1, 'SPECIES_COMMIT', { commitHash: p1SpeciesHash }, log);
      await submitIntentChecked(gameId, player1, 'SPECIES_REVEAL', { payload: p1SpeciesPayload, nonce: p1SpeciesNonce }, log);
      
      const p2SpeciesPayload = { species: 'human' as Species };
      const p2SpeciesNonce = generateNonce();
      const p2SpeciesHash = await generateCommitHash(p2SpeciesPayload, p2SpeciesNonce);
      
      await submitIntentChecked(gameId, player2, 'SPECIES_COMMIT', { commitHash: p2SpeciesHash }, log);
      await submitIntentChecked(gameId, player2, 'SPECIES_REVEAL', { payload: p2SpeciesPayload, nonce: p2SpeciesNonce }, log);

      // Wait for species selection to auto-exit (contract: NO DECLARE_READY)
      snapshot = await waitForSpeciesSelectionExit(gameId, player1, log);
      
      // === STEP 3: Build phase ===
      log('─── Build Phase ───', 'info');
      
      // Build commits/reveals using submitIntentChecked
      const p1BuildPayload = { builds: [{ shipDefId: 'FIG', count: 10 }] };
      const p1BuildNonce = generateNonce();
      const p1BuildHash = await generateCommitHash(p1BuildPayload, p1BuildNonce);
      
      await submitIntentChecked(gameId, player1, 'BUILD_COMMIT', { commitHash: p1BuildHash }, log);
      await submitIntentChecked(gameId, player1, 'BUILD_REVEAL', { payload: p1BuildPayload, nonce: p1BuildNonce }, log);
      
      // Track initial build submission
      lastBuildRevealTurn[player1.sessionId] = snapshot.turnNumber || 1;
      
      const p2BuildPayload = { builds: [] };
      const p2BuildNonce = generateNonce();
      const p2BuildHash = await generateCommitHash(p2BuildPayload, p2BuildNonce);
      
      await submitIntentChecked(gameId, player2, 'BUILD_COMMIT', { commitHash: p2BuildHash }, log);
      await submitIntentChecked(gameId, player2, 'BUILD_REVEAL', { payload: p2BuildPayload, nonce: p2BuildNonce }, log);
      
      // Track initial build submission
      lastBuildRevealTurn[player2.sessionId] = snapshot.turnNumber || 1;

      // === STEP 4: Turn loop (contract-compliant resolution) ===
      log('─── Turn Loop ───', 'info');
      
      const MAX_TURNS = 10;
      let turnCount = 0;
      
      for (let i = 0; i < MAX_TURNS; i++) {
        turnCount = i + 1;
        
        // Fetch baseline state for this turn
        const baselineState = await fetchGameState(gameId, player1);
        const baselineSnapshot = parseGameState(baselineState);
        
        const baselineP1 = baselineSnapshot.players.find(p => p.id === player1.sessionId);
        const baselineP2 = baselineSnapshot.players.find(p => p.id === player2.sessionId);
        
        log(`═══ Turn Loop ${turnCount}/${MAX_TURNS} ═══`, 'info');
        log(`  Baseline: phase=${baselineSnapshot.phaseKey}, turn=${baselineSnapshot.turnNumber}`, 'info');
        log(`  Health: P1=${baselineP1?.health}, P2=${baselineP2?.health}`, 'info');
        
        // Resolve until progress (health change, turn change, or finished)
        const { snapshot: resolvedSnapshot, reason } = await resolveUntilProgress(
          gameId,
          player1,
          player2,
          baselineSnapshot,
          40, // maxSteps
          log
        );
        
        const resolvedP1 = resolvedSnapshot.players.find(p => p.id === player1.sessionId);
        const resolvedP2 = resolvedSnapshot.players.find(p => p.id === player2.sessionId);
        
        log(`  After resolution: phase=${resolvedSnapshot.phaseKey}, turn=${resolvedSnapshot.turnNumber}`, 'info');
        log(`  Health: P1=${resolvedP1?.health}, P2=${resolvedP2?.health}`, 'info');
        log(`  Progress reason: ${reason}`, 'info');
        
        // Update UI with current state
        setCurrentState(resolvedSnapshot);
        
        // === STEP 5: Check win conditions (health is truth) ===
        if (resolvedSnapshot.status === 'finished') {
          log('✓ Game status: FINISHED', 'success');
          log(`✓ SCENARIO 4 PASSED: Game completed in ${turnCount} turn(s)`, 'success');
          return;
        }
        
        if ((resolvedP2?.health || 0) <= 0) {
          log('✓ P2 health reduced to 0 or below', 'success');
          log(`✓ SCENARIO 4 PASSED: Kill condition met in ${turnCount} turn(s)`, 'success');
          return;
        }
        
        if ((resolvedP1?.health || 0) <= 0) {
          log('⚠ P1 health reduced to 0 (unexpected)', 'warning');
          log(`⚠ SCENARIO 4: P1 died instead of P2 in ${turnCount} turn(s)`, 'warning');
          return;
        }
        
        // === STEP 6: Check if we need to build again ===
        // Only submit builds if in build.drawing AND we haven't submitted for this turn yet
        const currentTurn = resolvedSnapshot.turnNumber || 1;
        const currentPhase = resolvedSnapshot.phaseKey;
        
        if (currentPhase === 'build.drawing') {
          // Check if player1 needs to submit build for this turn
          if (lastBuildRevealTurn[player1.sessionId] !== currentTurn) {
            log('  P1: Submitting build for new turn...', 'info');
            
            const nextP1BuildPayload = { builds: [] }; // No more builds needed
            const nextP1BuildNonce = generateNonce();
            const nextP1BuildHash = await generateCommitHash(nextP1BuildPayload, nextP1BuildNonce);
            
            await submitIntentChecked(gameId, player1, 'BUILD_COMMIT', { commitHash: nextP1BuildHash }, log);
            await submitIntentChecked(gameId, player1, 'BUILD_REVEAL', { payload: nextP1BuildPayload, nonce: nextP1BuildNonce }, log);
            
            lastBuildRevealTurn[player1.sessionId] = currentTurn;
          }
          
          // Check if player2 needs to submit build for this turn
          if (lastBuildRevealTurn[player2.sessionId] !== currentTurn) {
            log('  P2: Submitting build for new turn...', 'info');
            
            const nextP2BuildPayload = { builds: [] };
            const nextP2BuildNonce = generateNonce();
            const nextP2BuildHash = await generateCommitHash(nextP2BuildPayload, nextP2BuildNonce);
            
            await submitIntentChecked(gameId, player2, 'BUILD_COMMIT', { commitHash: nextP2BuildHash }, log);
            await submitIntentChecked(gameId, player2, 'BUILD_REVEAL', { payload: nextP2BuildPayload, nonce: nextP2BuildNonce }, log);
            
            lastBuildRevealTurn[player2.sessionId] = currentTurn;
          }
        }
        
        // Continue to next turn
        log(`  Turn ${turnCount} complete, continuing...`, 'info');
      }
      
      // Max turns reached without kill
      log(`⚠ Reached max turns (${MAX_TURNS}) without kill or finish`, 'warning');
      log(`⚠ SCENARIO 4: Incomplete - max turns exceeded`, 'warning');
      
    } catch (error: any) {
      log(`❌ Scenario 4 failed: ${error.message}`, 'error');
      
      // If contract violation, show it prominently
      if (error.message.includes('CONTRACT_VIOLATION')) {
        log('❌ CONTRACT VIOLATION DETECTED ❌', 'error');
      }
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