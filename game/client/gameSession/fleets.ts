/**
 * FLEET DERIVATION
 * 
 * Extract ship ownership, apply visibility rules, and aggregate fleet summaries.
 */

interface BoardFleetSummary {
  shipDefId: string;
  count: number;
}

export function deriveFleets(args: {
  rawState: any;
  me: any;
  opponent: any;
  turnNumber: number;
  majorPhase: string;
}) {
  const { rawState, me, opponent, turnNumber, majorPhase } = args;
  
  // ============================================================================
  // SHIP OWNERSHIP (ME/OPPONENT)
  // ============================================================================
  
  // Extract ships from server state
  const shipsData = rawState?.gameData?.ships || rawState?.ships || {};
  
  // Map ships to me/opponent (not server array order)
  const myShips = me?.id ? (shipsData[me.id] || []) : [];
  const opponentShips = opponent?.id ? (shipsData[opponent.id] || []) : [];
  
  // Use majorPhase already defined earlier (line ~798)
  const isInBattlePhase = majorPhase === 'battle';
  
  // Opponent visibility rule:
  // - Always show opponent ships from prior turns
  // - Hide opponent ships created this turn until battle
  const opponentShipsVisible = opponentShips.filter((ship: any) => {
    const createdTurn = ship?.createdTurn;
    // If createdTurn is missing, treat as "old" (visible). This avoids accidental hiding due to incomplete data.
    if (typeof createdTurn !== 'number') return true;
    if (createdTurn < turnNumber) return true;
    // createdTurn === turnNumber -> visible only in battle
    return isInBattlePhase;
  });
  
  // Aggregate fleet summaries
  function aggregateFleet(ships: any[]): BoardFleetSummary[] {
    const counts: Record<string, number> = {};
    
    for (const ship of ships) {
      const defId = ship.shipDefId || 'UNKNOWN';
      counts[defId] = (counts[defId] || 0) + 1;
    }
    
    return Object.entries(counts).map(([shipDefId, count]) => ({ shipDefId, count }));
  }
  
  const myFleet = aggregateFleet(myShips);
  const opponentFleet = aggregateFleet(opponentShipsVisible);
  
  return {
    myShips,
    opponentShips,
    opponentShipsVisible,
    myFleet,
    opponentFleet,
  };
}
