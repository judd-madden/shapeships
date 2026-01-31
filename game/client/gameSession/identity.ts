/**
 * IDENTITY DERIVATION
 * 
 * Extract "me" and "opponent" from server player list.
 * Uses sessionId for stable identity matching.
 */

export function deriveIdentity(rawState: any, mySessionId: string | null) {
  // Extract all players from server state
  const allPlayers = rawState?.players ?? [];
  
  // Filter to role='player' only
  const playerUsers = allPlayers.filter((p: any) => p.role === 'player');
  
  // Find "me" in the player list (using mySessionId for stable identity)
  // "me" is the player whose id === mySessionId
  const me = mySessionId ? allPlayers.find((p: any) => p.id === mySessionId) : null;
  
  // Find "opponent" (the other player, if I'm a player)
  // Opponent is ONLY valid if I'm a player myself
  const opponent = (me?.role === 'player' && mySessionId)
    ? playerUsers.find((p: any) => p.id !== mySessionId) || null
    : null;
  
  return { allPlayers, playerUsers, me, opponent };
}
