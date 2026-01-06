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
const SESSION_STORAGE = 'localStorage'; // or 'sessionStorage' for tab-only

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
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      throw new Error(errorMsg);
    }
  }
}

/**
 * Ensure a valid session token exists
 * If no token exists, creates one by calling POST /session/start
 * @returns {Promise<string>} The session token
 */
export async function ensureSession(): Promise<string> {
  // Check for existing token
  const existingToken = localStorage.getItem(SESSION_TOKEN_KEY);
  
  if (existingToken) {
    console.log('✅ Existing session token found');
    return existingToken;
  }

  // No token found - create new session
  console.log('⚠️ No session token found, creating new session...');
  
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab/session/start`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`, // Supabase anon key for edge function access
          'apikey': publicAnonKey,                    // Supabase anon key (alternative header)
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create session: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const { sessionToken } = data;

    if (!sessionToken) {
      throw new Error('Server did not return sessionToken');
    }

    // Store token
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    console.log('✅ New session created and stored');

    return sessionToken;
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
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

/**
 * Clear the current session token
 * Use when player explicitly logs out or session should be reset
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  console.log('🗑️ Session token cleared');
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
 * @param {RequestInit} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} The fetch response
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Ensure we have a valid session token
  const sessionToken = await ensureSession();

  // Build full URL
  const url = `https://${projectId}.supabase.co/functions/v1/make-server-825e19ab${endpoint}`;

  // Merge headers with both Supabase anon key AND session token
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    'Authorization': `Bearer ${publicAnonKey}`, // Supabase anon key (edge function access)
    'apikey': publicAnonKey,                    // Supabase anon key (alternative header)
    'X-Session-Token': sessionToken,            // Session token (application identity)
  };

  // Guard against misuse of session token in Authorization header
  guardAgainstSessionTokenMisuse(headers);

  console.log(`🔐 Authenticated request to ${endpoint}`);

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Helper: Create authenticated POST request
 */
export async function authenticatedPost(
  endpoint: string,
  body: any
): Promise<Response> {
  return authenticatedFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Helper: Create authenticated GET request
 */
export async function authenticatedGet(endpoint: string): Promise<Response> {
  return authenticatedFetch(endpoint, {
    method: 'GET',
  });
}