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

import { projectId, publicAnonKey } from './supabase/info';

const SESSION_TOKEN_KEY = 'ss_sessionToken';
const SESSION_ID_KEY = 'ss_sessionId';
const DISPLAY_NAME_KEY = 'ss_displayName';
// Part A: Use sessionStorage for tab-isolated session tokens (prevents cross-tab clobbering)
const SESSION_STORAGE = 'sessionStorage'; // tab-isolated (not shared across tabs)

// Safe dev mode check (import.meta may be undefined in some environments)
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// Storage selector: honor SESSION_STORAGE setting
const storage = SESSION_STORAGE === 'sessionStorage' ? sessionStorage : localStorage;

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
 * Guard against accidentally using session token in Authorization header
 * This would be a security issue and architectural violation
 */
function guardAgainstSessionTokenMisuse(headers: Record<string, string>) {
  const authHeader = headers['Authorization'];
  if (authHeader && !authHeader.includes(publicAnonKey)) {
    const errorMsg = '🚨 SECURITY ERROR: Authorization header must contain Supabase anon key, not session token!';
    console.error(errorMsg);
    console.error('Expected:', `Bearer ${publicAnonKey.substring(0, 20)}...`);
    console.error('Got:', authHeader);
    
    // In development, throw error to catch bugs immediately
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
export async function ensureSession(displayName?: string): Promise<{ sessionToken: string, sessionId: string, displayName: string | null }> {
  // Step A: Check for cached session in storage
  const existingToken = storage.getItem(SESSION_TOKEN_KEY);
  const existingSessionId = storage.getItem(SESSION_ID_KEY);
  const existingDisplayName = storage.getItem(DISPLAY_NAME_KEY);
  
  // Step A: If we have cached token + sessionId, return immediately (idempotent)
  if (existingToken && existingSessionId) {
    if (isDev) {
      console.log('[Session] reusing cached session', {
        sessionId: existingSessionId,
        displayName: existingDisplayName || displayName
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
      const response = await fetchWithTimeout(
        `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/session/me`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'apikey': publicAnonKey,
            'X-Session-Token': existingToken,
          },
        },
        5000 // 5 seconds timeout
      );

      if (response.ok) {
        const data = await response.json();
        
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
        clearSession();
        // Fall through to create new session
      } else {
        // Server error (5xx) or other non-auth error - keep token, throw error
        const errorText = await response.text().catch(() => 'Unknown error');
        if (isDev) {
          console.log(`[Session] failed to resolve session metadata (status ${response.status}) - keeping token`);
        }
        throw new Error(`Session metadata resolution failed: ${response.status} ${errorText}`);
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
    const response = await fetchWithTimeout(
      `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/session/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`, // Supabase anon key for edge function access
          'apikey': publicAnonKey,                    // Supabase anon key (alternative header)
        },
        body: displayName ? JSON.stringify({ displayName }) : undefined,
      },
      5000 // 5 seconds timeout
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create session: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const { sessionToken, sessionId, displayName: returnedDisplayName } = data;

    if (!sessionToken) {
      throw new Error('Server did not return sessionToken');
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

/**
 * Clear the current session token
 * Use when player explicitly logs out or session should be reset
 */
export function clearSession(): void {
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

  // Build full URL
  const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab${endpoint}`;

  // Merge headers with both Supabase anon key AND session token
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    'Authorization': `Bearer ${publicAnonKey}`, // Supabase anon key (edge function access)
    'apikey': publicAnonKey,                    // Supabase anon key (alternative header)
    'X-Session-Token': sessionData.sessionToken, // Session token (application identity)
  };

  // Guard against misuse of session token in Authorization header
  guardAgainstSessionTokenMisuse(headers);

  // Part B: Debug log to confirm which token/session is used
  if (isDev) {
    const tokenPrefix = sessionData.sessionToken.substring(0, 6);
    console.log(`[sessionManager] request to ${endpoint} using sessionId=${sessionData.sessionId} token=${tokenPrefix}...`);
  }

  return fetchWithTimeout(url, {
    ...options,
    headers,
  }, timeoutMs ?? 0);
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