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
  // Match on either p.id === mySessionId OR p.sessionId === mySessionId (defensive)
  const me = mySessionId 
    ? allPlayers.find((p: any) => p.id === mySessionId || p.sessionId === mySessionId) 
    : null;
  
  // Find "opponent" (the other player, if I'm a player)
  // Opponent is ONLY valid if I'm a player myself
  const opponent = (me?.role === 'player' && mySessionId)
    ? playerUsers.find((p: any) => p.id !== mySessionId && p.sessionId !== mySessionId) || null
    : null;
  
  // Compute ready keys that align with phaseReadiness[].playerId
  // Prefer playerId if present, otherwise fall back to id
  const meReadyKey = me?.playerId ?? me?.id ?? null;
  const opponentReadyKey = opponent?.playerId ?? opponent?.id ?? null;
  
  return { allPlayers, playerUsers, me, opponent, meReadyKey, opponentReadyKey };
}