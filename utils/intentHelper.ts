/**
 * INTENT HELPER UTILITIES
 * 
 * Client-side helpers for commit/reveal protocol.
 * Provides hashing, nonce generation, and payload helpers.
 */

/**
 * Generate a random nonce for commit/reveal
 */
export function generateNonce(): string {
  return crypto.randomUUID();
}

/**
 * Compute SHA-256 hash (browser-compatible)
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
 * Create a commit hash from payload + nonce
 * Format: sha256(JSON.stringify(payload) + nonce)
 */
export async function makeCommitHash(payload: unknown, nonce: string): Promise<string> {
  const combined = JSON.stringify(payload) + nonce;
  return await sha256(combined);
}

/**
 * Helper: Create species commit/reveal pair
 * Returns both commit and reveal payloads ready to send
 */
export async function createSpeciesIntent(
  species: 'human' | 'xenite' | 'centaur' | 'ancient'
): Promise<{
  commit: { commitHash: string };
  reveal: { payload: { species: string }; nonce: string };
}> {
  const payload = { species };
  const nonce = generateNonce();
  const commitHash = await makeCommitHash(payload, nonce);
  
  return {
    commit: { commitHash },
    reveal: { payload, nonce }
  };
}

/**
 * Helper: Create build commit/reveal pair
 * Returns both commit and reveal payloads ready to send
 */
export async function createBuildIntent(
  builds: Array<{ shipDefId: string; count?: number }>
): Promise<{
  commit: { commitHash: string };
  reveal: { payload: { builds: Array<{ shipDefId: string; count?: number }> }; nonce: string };
}> {
  const payload = { builds };
  const nonce = generateNonce();
  const commitHash = await makeCommitHash(payload, nonce);
  
  return {
    commit: { commitHash },
    reveal: { payload, nonce }
  };
}
