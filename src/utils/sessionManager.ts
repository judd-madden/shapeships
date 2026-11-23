// ============================================================================
// ALPHA v3 SESSION MANAGEMENT
// ============================================================================
// Client-side session token management for server-minted identity
// The server derives player identity from sessionToken, not client-provided IDs
//
// ⚠️ CRITICAL SECURITY RULE:
// - Session tokens MUST use X-Session-Token header
// - Authorization header is ONLY for Supabase anon key
// - Never send session token in Authorization header
// ============================================================================

import { publicAnonKey } from './supabase/info';
import { gameFunctionBaseUrl } from './supabase/runtimeConfig';
import { getAccountStore } from '../game/client/account/accountStore';
import { isAccountAuthorityError } from '../game/client/account/preferenceSync';
import {
  getGameErrorCode, inviteGameIdForRequest, isNameAssignmentRefusal, isNameAssignmentRoute,
  readGameErrorCode, SessionRequestError,
} from '../game/client/gameSession/accountSessionWiring';

export { SessionRequestError } from '../game/client/gameSession/accountSessionWiring';

const SESSION_TOKEN_KEY = 'ss_sessionToken';
const SESSION_ID_KEY = 'ss_sessionId';
const DISPLAY_NAME_KEY = 'ss_displayName';
// Part A: Use sessionStorage for tab-isolated session tokens (prevents cross-tab clobbering)
const SESSION_STORAGE = 'sessionStorage'; // tab-isolated (not shared across tabs)

// Safe dev mode check (import.meta may be undefined in some environments)
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// Storage selector: honor SESSION_STORAGE setting
const storage = SESSION_STORAGE === 'sessionStorage' ? sessionStorage : localStorage;

let sessionGeneration = 0;
type SessionData = { sessionToken: string; sessionId: string; displayName: string | null };
let pendingSession: Promise<SessionData> | null = null;
let pendingResume: { sessionToken: string; promise: Promise<void> } | null = null;
export interface SessionEntryRequired { code: string; inviteGameId?: string }
const entryListeners = new Set<(event: SessionEntryRequired) => void>();

export function subscribeSessionEntryRequired(listener: (event: SessionEntryRequired) => void): () => void {
  entryListeners.add(listener);
  return () => { entryListeners.delete(listener); };
}

function requireEntry(event: SessionEntryRequired): void {
  clearSession();
  entryListeners.forEach((listener) => listener(event));
}

function assertCurrentSession(generation: number): void {
  if (generation !== sessionGeneration) throw new SessionRequestError('Session changed.', 'SESSION_CHANGED');
}

function resumeSessionAccount(session: SessionData): Promise<void> {
  if (pendingResume?.sessionToken === session.sessionToken) return pendingResume.promise;
  const promise = getAccountStore().resume(session.sessionToken);
  const pending = { sessionToken: session.sessionToken, promise };
  pendingResume = pending;
  const settled = () => { if (pendingResume === pending) pendingResume = null; };
  void promise.then(settled, settled);
  return promise;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  // If timeoutMs <= 0, behave like normal fetch
  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(id);
  }
}

/**
 * Fetch with timeout and single retry on AbortError or network failure
 * Used for session creation to handle edge function cold starts
 */
async function fetchWithTimeoutRetryOnce(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  try {
    return await fetchWithTimeout(input, init, timeoutMs);
  } catch (err: any) {
    const name = err?.name ?? '';
    const msg = String(err?.message ?? '');

    const isAbort = name === 'AbortError' || msg.includes('signal is aborted');
    const isNetwork = name === 'TypeError';

    if (!isAbort && !isNetwork) throw err;

    // Single retry only
    return await fetchWithTimeout(input, init, timeoutMs);
  }
}

/**
 * Guard against accidentally using session token in Authorization header
 * This would be a security issue and architectural violation
 */
function guardAgainstSessionTokenMisuse(headers: HeadersInit) {
    const h = new Headers(headers);
    const authHeader = h.get('Authorization');
    const expected = `Bearer ${publicAnonKey}`;

    if (authHeader && authHeader !== expected) {
        const errorMsg =
            '🚨 SECURITY ERROR: Authorization header must be exactly Supabase anon key bearer token (never session token).';
        console.error(errorMsg);
        console.error('Expected:', `${expected.substring(0, 30)}...`);
        console.error('Got:', authHeader);

        if (isDev) {
            throw new Error(errorMsg);
        }
    }
}

/**
 * Ensure a valid session token exists (IDEMPOTENT)
 * Returns cached session immediately if token exists in storage
 * Creates new session only if no token exists or token is invalid
 * @param {string} [displayName] - Optional display name to associate with session (used only when creating new session)
 * @returns {Promise<{ sessionToken: string, sessionId: string, displayName: string | null }>} The session data
 */
export function ensureSession(displayName?: string): Promise<SessionData> {
  if (pendingSession) return pendingSession;
  const status = getAccountStore().getSnapshot().status;
  // A name without A is a guest assignment. Accounts are linked separately by resume(S).
  const promise = ensureSessionUncached(status === 'signedIn' || status === 'resuming' ? undefined : displayName);
  pendingSession = promise;
  void promise.then(
    () => { if (pendingSession === promise) pendingSession = null; },
    () => { if (pendingSession === promise) pendingSession = null; },
  );
  return promise;
}

async function ensureSessionUncached(displayName?: string): Promise<SessionData> {
  let generation = sessionGeneration;
  // Step A: Check for cached session in storage
  const existingToken = storage.getItem(SESSION_TOKEN_KEY);
  const existingSessionId = storage.getItem(SESSION_ID_KEY);
  const existingDisplayName = storage.getItem(DISPLAY_NAME_KEY);
  
  // Step A: If we have cached token + sessionId, return immediately (idempotent)
  if (existingToken && existingSessionId) {
      if (isDev) {
          console.debug('[Session] reusing cached session', {
              sessionId: existingSessionId,
              displayName: existingDisplayName || displayName,
          });
      }
    return {
      sessionToken: existingToken,
      sessionId: existingSessionId,
      displayName: existingDisplayName || displayName || null
    };
  }
  
  // Step A: If we have token but no sessionId, try to resolve from server
  if (existingToken && !existingSessionId) {
    try {
      const response = await fetchWithTimeoutRetryOnce(
        `${gameFunctionBaseUrl}/session/me`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
            'X-Session-Token': existingToken,
          },
        },
        12000 // 12 seconds timeout (increased from 5s to handle edge function cold starts)
      );

      if (response.ok) {
        const data = await response.json();
        assertCurrentSession(generation);
        
        // Cache sessionId and displayName for future calls
        storage.setItem(SESSION_ID_KEY, data.sessionId);
        if (data.displayName) {
          storage.setItem(DISPLAY_NAME_KEY, data.displayName);
        }
        
        if (isDev) {
          console.log('[Session] resolved sessionId from server', {
            sessionId: data.sessionId,
            displayName: data.displayName
          });
        }
        
        return {
          sessionToken: existingToken,
          sessionId: data.sessionId,
          displayName: data.displayName
        };
      } else if (response.status === 401 || response.status === 403) {
        // Token is invalid or expired - clear and create new session
        if (isDev) {
          console.log('[Session] existing token invalid → cleared');
        }
        assertCurrentSession(generation);
        const creating = pendingSession;
        clearSession();
        pendingSession = creating;
        generation = sessionGeneration;
        // Fall through to create new session
      } else {
        // Server error (5xx) or other non-auth error - keep token, throw error
        const code = await readGameErrorCode(response);
        const errorText = await response.text().catch(() => 'Unknown error');
        if (isDev) {
          console.log(`[Session] failed to resolve session metadata (status ${response.status}) - keeping token`);
        }
        throw new SessionRequestError(`Session metadata resolution failed: ${response.status} ${errorText}`, code, response.status);
      }
    } catch (error) {
      // Network error or other exception - do NOT clear token, re-throw
      if (isDev) {
        console.log('[Session] network error while resolving token - keeping token');
      }
      throw error;
    }
  }

  // Step A: No token (or was cleared above) - create new session
  if (isDev) {
    console.log(`[Session] creating new session${displayName ? ` for ${displayName}` : ''}`);
  }
  
  try {
    const response = await fetchWithTimeoutRetryOnce(
      `${gameFunctionBaseUrl}/session/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`, // Supabase anon key for edge function access
          'apikey': publicAnonKey,                    // Supabase anon key (alternative header)
        },
        body: displayName ? JSON.stringify({ displayName }) : undefined,
      },
      12000 // 12 seconds timeout (increased from 5s to handle edge function cold starts)
    );

    if (!response.ok) {
      assertCurrentSession(generation);
      const code = await readGameErrorCode(response);
      const errorText = await response.text();
      assertCurrentSession(generation);
      if (isNameAssignmentRefusal(code)) requireEntry({ code: code! });
      throw new SessionRequestError(`Failed to create session: ${response.status} ${errorText}`, code, response.status);
    }

    const data = await response.json();
    const { sessionToken, sessionId, displayName: returnedDisplayName } = data;
    assertCurrentSession(generation);

    if (!sessionToken) {
      throw new SessionRequestError('Server did not return sessionToken');
    }

    // Step A: Store token, sessionId, and displayName in storage
    storage.setItem(SESSION_TOKEN_KEY, sessionToken);
    storage.setItem(SESSION_ID_KEY, sessionId);
    if (returnedDisplayName) {
      storage.setItem(DISPLAY_NAME_KEY, returnedDisplayName);
    }
    if (isDev) {
      console.log(`[Session] new session created and stored${returnedDisplayName ? ` (${returnedDisplayName})` : ''}`);
    }

    return { sessionToken, sessionId, displayName: returnedDisplayName };
  } catch (error) {
    console.error('❌ Session creation failed:', error);
    throw error;
  }
}

/**
 * Get the current session token without creating a new one
 * @returns {string | null} The session token if it exists, null otherwise
 */
export function getSessionToken(): string | null {
  return storage.getItem(SESSION_TOKEN_KEY);
}

/** Lets a mounted game fence deferred work after its tab identity has been cleared. */
export function getSessionGeneration(): number {
  return sessionGeneration;
}

/**
 * Clear the current session token
 * Use when player explicitly logs out or session should be reset
 */
export function clearSession(): void {
  sessionGeneration++;
  pendingSession = null;
  pendingResume = null;
  storage.removeItem(SESSION_TOKEN_KEY);
  storage.removeItem(SESSION_ID_KEY);
  storage.removeItem(DISPLAY_NAME_KEY);
  if (isDev) {
    console.log('🗑️ [Session] token cleared');
  }
}

/**
 * Make an authenticated request to the game server
 * Automatically includes X-Session-Token header with session token
 * Ensures session exists before making the request
 * 
 * ⚠️ IMPORTANT: Session token goes in X-Session-Token header
 * Authorization header contains Supabase anon key (for edge function access)
 * 
 * @param {string} endpoint - The endpoint path (e.g., '/create-game')
 * @param {RequestInit} options - Fetch options (method, body, etc.)\\n * @returns {Promise<Response>} The fetch response
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs?: number
): Promise<Response> {
  // Ensure we have a valid session token
  const sessionData = await ensureSession();
  if (getSessionToken() !== sessionData.sessionToken) throw new SessionRequestError('Session changed.', 'SESSION_CHANGED');
  const generation = sessionGeneration;
  const accountStore = getAccountStore();
  if (pendingResume?.sessionToken === sessionData.sessionToken) await pendingResume.promise;
  let account = accountStore.getSnapshot();
  if (account.status === 'signedIn' && account.linkedSessionId !== sessionData.sessionId) {
    await resumeSessionAccount(sessionData);
    assertCurrentSession(generation);
    account = accountStore.getSnapshot();
    if (account.status !== 'signedIn' || account.linkedSessionId !== sessionData.sessionId) {
      accountStore.suspendForSessionFailure('GAME_SESSION_INVALID');
      if (generation === sessionGeneration) requireEntry({ code: account.lastError?.code ?? 'GAME_SESSION_INVALID' });
      throw new SessionRequestError('Account session could not be linked.', 'GAME_SESSION_INVALID');
    }
  }
  assertCurrentSession(generation);
  const wasSignedIn = account.status === 'signedIn';

  // Build full URL
  const url = `${gameFunctionBaseUrl}${endpoint}`;

  // Merge headers with both Supabase anon key AND session token
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Authorization', `Bearer ${publicAnonKey}`);
  headers.set('apikey', publicAnonKey);
  headers.set('X-Session-Token', sessionData.sessionToken);
  headers.delete('X-Account-Token');
  const accountToken = accountStore.getAccountTokenForSession(sessionData.sessionId);
  if (accountToken) headers.set('X-Account-Token', accountToken);
  const assertRequestIdentity = () => {
    assertCurrentSession(generation);
    // Claim/sign-in preserves S, so also fence responses from the previous account identity.
    if (accountStore.getSnapshot().status !== 'resuming'
      && accountStore.getAccountTokenForSession(sessionData.sessionId) !== accountToken) {
      throw new SessionRequestError('Account identity changed.', 'SESSION_CHANGED');
    }
  };

  // Guard against misuse of session token in Authorization header
  guardAgainstSessionTokenMisuse(headers);

  // Part B: Debug log to confirm which token/session is used
  if (isDev) {
    const tokenPrefix = sessionData.sessionToken.substring(0, 6);
    console.debug(`[sessionManager] request to ${endpoint} using sessionId=${sessionData.sessionId} token=${tokenPrefix}...`);
  }

  // Timed authenticated requests are single-attempt. Callers own any retry policy.
  const effectiveTimeout = timeoutMs ?? 0;

  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers,
    },
    effectiveTimeout > 0 ? effectiveTimeout : 0
  );
  assertRequestIdentity();
  // Successful reads keep their existing fast path; inspect failed responses and intent envelopes only.
  if (!response.ok || endpoint === '/intent') {
    const code = await readGameErrorCode(response);
    assertRequestIdentity();
    if (!wasSignedIn && isNameAssignmentRoute(endpoint) && isNameAssignmentRefusal(code)) {
      requireEntry({ code: code!, inviteGameId: inviteGameIdForRequest(endpoint) });
    } else if (code && isAccountAuthorityError(code)) {
      await resumeSessionAccount(sessionData);
      const revalidated = accountStore.getSnapshot();
      if (generation === sessionGeneration && revalidated.status === 'signedIn'
        && revalidated.linkedSessionId !== sessionData.sessionId) accountStore.suspendForSessionFailure('GAME_SESSION_INVALID');
      // A store subscriber may already have reset the tab. Never replay the rejected request.
      if (generation === sessionGeneration && accountStore.getSnapshot().status !== 'signedIn') {
        requireEntry({ code });
      }
    }
  }
  return response;
}

/**
 * Helper: Create authenticated POST request
 */
export async function authenticatedPost(
  endpoint: string,
  body: any,
  timeoutMs?: number
): Promise<Response> {
  return authenticatedFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  }, timeoutMs);
}

const EXPIRED_SESSION_MESSAGE = 'Invalid or expired session token';
const SESSION_RECOVERY_FAILED_MESSAGE =
  'Your session expired and could not be refreshed. Select Change Name to start a new session.';

async function isExpiredSessionResponse(response: Response): Promise<boolean> {
  if (response.status !== 401) {
    return false;
  }

  try {
    const body: unknown = await response.clone().json();
    const code = getGameErrorCode(body);
    if (code && isAccountAuthorityError(code)) return false;
    return (
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      body.message === EXPIRED_SESSION_MESSAGE
    );
  } catch {
    return false;
  }
}

/**
 * Authenticated POST with opt-in expired-session recovery.
 * Replacing identity is safe for new-game creation, but unsafe during an existing match.
 */
export async function authenticatedPostWithSessionRecovery(
  endpoint: string,
  body: unknown,
  displayName: string,
  timeoutMs?: number
): Promise<Response> {
  const generation = sessionGeneration;
  const response = await authenticatedPost(endpoint, body, timeoutMs);

  if (!(await isExpiredSessionResponse(response))) {
    return response;
  }

  assertCurrentSession(generation);

  clearSession();

  try {
    await ensureSession(displayName);
  } catch (error) {
    if (error instanceof SessionRequestError) throw error;
    throw new SessionRequestError(SESSION_RECOVERY_FAILED_MESSAGE);
  }

  const retryResponse = await authenticatedPost(endpoint, body, timeoutMs);

  if (await isExpiredSessionResponse(retryResponse)) {
    throw new SessionRequestError(SESSION_RECOVERY_FAILED_MESSAGE);
  }

  return retryResponse;
}

/**
 * Helper: Create authenticated POST request to /intent endpoint
 * Handles commit/reveal protocol payloads.
 */
export async function authenticatedPostIntent(
  gameId: string,
  intentType: string,
  turnNumber: number,
  intentPayload: {
    commitHash?: string;
    payload?: any;
    nonce?: string;
  },
  timeoutMs?: number
): Promise<Response> {
  return authenticatedFetch('/intent', {
    method: 'POST',
    body: JSON.stringify({
      gameId,
      intentType,
      turnNumber,
      ...intentPayload
    }),
  }, timeoutMs);
}

/**
 * Helper: Create authenticated GET request
 */
export async function authenticatedGet(endpoint: string, timeoutMs?: number): Promise<Response> {
  return authenticatedFetch(endpoint, {
    method: 'GET',
  }, timeoutMs);
}
