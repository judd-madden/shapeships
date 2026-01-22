/**
 * Client-side hashing utilities for commit/reveal.
 *
 * STRICT SCOPE:
 * - Only used to generate commit hashes and nonces for client intents.
 * - Do NOT add validation helpers here (validation is server-authoritative).
 * - Do NOT expand into a general-purpose crypto module.
 *
 * MUST MATCH server Hash.ts behavior exactly:
 * sha256(JSON.stringify(payload) + nonce)
 */

/**
 * Compute SHA-256 hash of a text string.
 * Returns hex string.
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Create a commit hash from payload + nonce.
 * 
 * Format: sha256(JSON.stringify(payload) + nonce)
 * 
 * @param payload - The payload to commit (will be JSON.stringified)
 * @param nonce - Random nonce string
 * @returns Hex hash string
 */
export async function makeCommitHash(payload: unknown, nonce: string): Promise<string> {
  const combined = JSON.stringify(payload) + nonce;
  return await sha256(combined);
}

/**
 * Generate a cryptographically random nonce string
 * Returns 32 character hex string (128 bits of entropy)
 */
export function generateNonce(): string {
  const array = new Uint8Array(16); // 128 bits
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}