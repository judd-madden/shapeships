/**
 * ROLL D6 - Cryptographically secure dice roller
 * 
 * Uses crypto.getRandomValues with rejection sampling
 * to ensure uniform distribution (1-6).
 */

/**
 * Roll a fair 6-sided die using rejection sampling
 * 
 * @returns A value from 1 to 6 (inclusive)
 */
export function rollD6(): 1 | 2 | 3 | 4 | 5 | 6 {
  const array = new Uint8Array(1);
  
  // Rejection sampling: reject values >= 252 to ensure uniform distribution
  // 252 is the largest multiple of 6 that fits in a byte (252 = 6 * 42)
  let byte: number;
  do {
    crypto.getRandomValues(array);
    byte = array[0];
  } while (byte >= 252);
  
  // Map [0..251] to [1..6]
  return ((byte % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}
