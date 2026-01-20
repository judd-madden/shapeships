/**
 * ALPHA HARNESS CLIENT MODULE
 * 
 * All networking, hashing, and intent submission for the Alpha V3 E2E harness.
 * 
 * This module is framework-agnostic (no React dependencies).
 * It provides session management, game API, and intent submission utilities.
 */

import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// ============================================================================
// TYPES
// ============================================================================

export type Species = 'human' | 'xenite' | 'centaur' | 'ancient';

export interface PlayerSession {
  sessionToken: string;
  sessionId: string;
  displayName: string;
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
export async function generateCommitHash(payload: any, nonce: string): Promise<string> {
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
export function generateNonce(): string {
  return crypto.randomUUID();
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session token
 */
export async function createSession(displayName: string): Promise<PlayerSession> {
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
export async function createGame(session: PlayerSession): Promise<string> {
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
export async function joinGame(gameId: string, session: PlayerSession): Promise<void> {
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
export async function fetchGameState(gameId: string, session: PlayerSession): Promise<any> {
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
 * Returns the full response data for event aggregation
 */
export async function submitIntent(
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

/**
 * Submit an intent with fresh server turn and contract enforcement
 * 
 * Enforces allowed intents based on current phase:
 * - setup.species_selection: ONLY SPECIES_COMMIT, SPECIES_REVEAL
 * - All other phases: Allow BUILD_COMMIT, BUILD_REVEAL, DECLARE_READY
 * 
 * Returns: response data including any events emitted
 */
export async function submitIntentChecked(
  gameId: string,
  session: PlayerSession,
  intentType: string,
  intentPayload: {
    commitHash?: string;
    payload?: any;
    nonce?: string;
  },
  log?: (msg: string, level?: string, data?: any) => void
): Promise<{ data: any; events: any[] }> {
  // Fetch fresh state to get current phase and turn
  const state = await fetchGameState(gameId, session);
  const phaseKey = getPhaseKey(state);
  const turnNumber = getServerTurnNumber(state);
  
  // Enforce allowed intents by phase
  if (isSpeciesSelection(phaseKey)) {
    const allowedInSpeciesSelection = ['SPECIES_COMMIT', 'SPECIES_REVEAL'];
    
    if (!allowedInSpeciesSelection.includes(intentType)) {
      const error = `CONTRACT_VIOLATION: intent ${intentType} attempted during setup.species_selection (allowed: ${allowedInSpeciesSelection.join(', ')})`;
      if (log) log(error, 'error');
      throw new Error(error);
    }
  }
  
  // Log phase and turn for debugging
  if (log) {
    log(`[${session.displayName}] ${intentType} at phase=${phaseKey} turn=${turnNumber}`, 'info');
  }
  
  // Submit with fresh turn number
  const responseData = await submitIntent(gameId, session, intentType, turnNumber, intentPayload);
  
  // Extract events from possible locations in response
  const extractedEvents = 
    responseData?.events || 
    responseData?.lastEvents || 
    responseData?.state?.events || 
    responseData?.state?.lastEvents || 
    responseData?.data?.events ||
    responseData?.data?.lastEvents ||
    [];
  
  return { 
    data: responseData, 
    events: Array.isArray(extractedEvents) ? extractedEvents : [] 
  };
}

// ============================================================================
// STATE HELPERS (used internally by submitIntentChecked)
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
 * Check if in species selection phase
 */
function isSpeciesSelection(phaseKey: string): boolean {
  return phaseKey === 'setup.species_selection';
}
