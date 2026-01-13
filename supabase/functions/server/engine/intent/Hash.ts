/**
 * HASHING UTILITIES
 * 
 * Provides cryptographic hashing for commit/reveal protocol.
 * All hashing must be deterministic and reproducible.
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
 * Validate that a reveal matches the expected commit hash.
 * 
 * @param payload - The revealed payload
 * @param nonce - The revealed nonce
 * @param expectedHash - The previously committed hash
 * @returns true if hash matches, false otherwise
 */
export async function validateReveal(
  payload: unknown,
  nonce: string,
  expectedHash: string
): Promise<boolean> {
  const computedHash = await makeCommitHash(payload, nonce);
  return computedHash === expectedHash;
}
