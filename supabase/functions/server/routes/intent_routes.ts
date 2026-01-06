// ============================================================================
// INTENT ROUTES
// ============================================================================
// Alpha v6 intent processing endpoint  
// Mechanical extraction from index.tsx lines 2691-3423
//
// ⚠️ COMPLETION STATUS: Skeleton created, needs full code pasted
// See COPY_PASTE_GUIDE.md for exact line numbers
// ============================================================================

import type { Hono } from "npm:hono";

export function registerIntentRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
  requireSession: (c: any) => Promise<any>,
  supabase: any
) {
  
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  const isValidIntentType = (type) => {
    const validTypes = [
      'BUILD_COMMIT',
      'BUILD_REVEAL', 
      'BATTLE_COMMIT',
      'BATTLE_REVEAL',
      'ACTION',
      'DECLARE_READY',
      'SURRENDER'
    ];
    return validTypes.includes(type);
  };
  
  // Full implementation from lines 2704-2754
  const validateIntentStructure = (intent) => {
    // All intents must have base fields
    if (!intent.intentId || !intent.gameId || !intent.playerId || !intent.type) {
      return { valid: false, error: 'Missing required intent fields' };
    }
    
    if (!isValidIntentType(intent.type)) {
      return { valid: false, error: `Invalid intent type: ${intent.type}` };
    }
    
    // Type-specific validation
    switch (intent.type) {
      case 'BUILD_COMMIT':
      case 'BATTLE_COMMIT':
        if (!intent.commitHash || !intent.turnNumber) {
          return { valid: false, error: 'Commit requires commitHash and turnNumber' };
        }
        if (intent.type === 'BATTLE_COMMIT' && !intent.window) {
          return { valid: false, error: 'Battle commit requires window (DECLARATION|RESPONSE)' };
        }
        break;
        
      case 'BUILD_REVEAL':
      case 'BATTLE_REVEAL':
        if (!intent.payload || !intent.nonce || !intent.turnNumber) {
          return { valid: false, error: 'Reveal requires payload, nonce, and turnNumber' };
        }
        if (intent.type === 'BATTLE_REVEAL' && !intent.window) {
          return { valid: false, error: 'Battle reveal requires window (DECLARATION|RESPONSE)' };
        }
        break;
        
      case 'ACTION':
        if (!intent.phase || !intent.actionType || !intent.data) {
          return { valid: false, error: 'Action requires phase, actionType, and data' };
        }
        break;
        
      case 'DECLARE_READY':
        if (!intent.phase) {
          return { valid: false, error: 'DeclareReady requires phase' };
        }
        break;
        
      case 'SURRENDER':
        // No additional fields required
        break;
    }
    
    return { valid: true };
  };
  
  // TODO: Paste full implementation from lines 2758-2816
  const updateChessClock = (gameState, nowMs) => {
    if (!gameState.gameData?.clock) {
      // Initialize clock if not present
      const p1 = gameState.players.find(p => p.role === 'player' && p.id !== gameState.players[1]?.id);
      const p2 = gameState.players.find(p => p.role === 'player' && p.id !== p1?.id);
      
      gameState.gameData.clock = {
        p1Id: p1?.id,
        p2Id: p2?.id,
        p1Ms: 600000, // 10 minutes default
        p2Ms: 600000,
        runningFor: 'none',
        startedAtMs: null
      };
      return gameState;
    }
    
    const clock = gameState.gameData.clock;
    
    // Calculate elapsed time if clock is running
    if (clock.runningFor !== 'none' && clock.startedAtMs) {
      const elapsedMs = nowMs - clock.startedAtMs;
      
      if (clock.runningFor === 'both') {
        // Both clocks running (simultaneous phases)
        clock.p1Ms = Math.max(0, clock.p1Ms - elapsedMs);
        clock.p2Ms = Math.max(0, clock.p2Ms - elapsedMs);
      } else if (clock.runningFor === 'p1') {
        clock.p1Ms = Math.max(0, clock.p1Ms - elapsedMs);
      } else if (clock.runningFor === 'p2') {
        clock.p2Ms = Math.max(0, clock.p2Ms - elapsedMs);
      }
    }
    
    // Update clock mode based on current phase/step
    const currentPhase = gameState.gameData?.turnData?.currentMajorPhase;
    const currentStep = gameState.gameData?.turnData?.currentStep;
    
    // Determine who should be on clock
    if (currentStep === 'dice_roll' || currentStep === 'line_generation' || currentStep === 'end_of_build' || currentStep === 'first_strike' || currentPhase === 'end_of_turn_resolution') {
      // Automatic steps - clock paused
      clock.runningFor = 'none';
      clock.startedAtMs = null;
    } else if (currentStep === 'ships_that_build' || currentStep === 'drawing' || currentStep === 'simultaneous_declaration' || currentStep === 'conditional_response') {
      // Simultaneous action steps - both clocks run
      clock.runningFor = 'both';
      clock.startedAtMs = nowMs;
    } else if (currentPhase === 'setup') {
      // Setup - both clocks run
      clock.runningFor = 'both';
      clock.startedAtMs = nowMs;
    } else {
      // Default: pause
      clock.runningFor = 'none';
      clock.startedAtMs = null;
    }
    
    return gameState;
  };
  
  const createClockEvent = (gameState, seq, nowMs) => {
    const clock = gameState.gameData?.clock;
    if (!clock) return null;
    
    return {
      eventId: crypto.randomUUID(),
      gameId: gameState.gameId,
      seq,
      atMs: nowMs,
      type: 'CLOCK_UPDATED',
      p1Ms: clock.p1Ms,
      p2Ms: clock.p2Ms,
      runningFor: clock.runningFor,
      startedAtMs: clock.startedAtMs
    };
  };
  
  const sha256 = async (message) => {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };
  
  const validateRevealHash = async (payload, nonce, expectedHash) => {
    const payloadStr = JSON.stringify(payload);
    const computedHash = await sha256(payloadStr + nonce);
    return computedHash === expectedHash;
  };
  
  const getCommitments = (gameState) => {
    if (!gameState.gameData.commitments) {
      gameState.gameData.commitments = {};
    }
    return gameState.gameData.commitments;
  };
  
  const storeCommitment = (gameState, playerId, turnNumber, kind, commitHash, window = null) => {
    const commitments = getCommitments(gameState);
    
    const key = window ? `${kind}_${window}_${turnNumber}` : `${kind}_${turnNumber}`;
    
    if (!commitments[playerId]) {
      commitments[playerId] = {};
    }
    
    commitments[playerId][key] = {
      hash: commitHash,
      committedAt: Date.now()
    };
  };
  
  const getCommitment = (gameState, playerId, turnNumber, kind, window = null) => {
    const commitments = getCommitments(gameState);
    const key = window ? `${kind}_${window}_${turnNumber}` : `${kind}_${turnNumber}`;
    return commitments[playerId]?.[key];
  };
  
  // ============================================================================
  // INTENT ENDPOINT
  // ============================================================================
  // ⚠️ NOTE: Alpha v6 feature for commit/reveal protocol
  // Current gameplay uses send-action endpoint, which is fully functional
  // This endpoint can be implemented when Alpha v6 features are needed
  // ============================================================================
  
  app.post("/make-server-825e19ab/intent", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session.error) return session; // Return 401 if validation failed

      // Parse request
      const requestBody = await c.req.json();
      const intent = requestBody.intent;
      
      if (!intent) {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'INVALID_REQUEST',
            message: 'Request must contain "intent" field'
          }
        }, 400);
      }
      
      // Override playerId with server-minted identity
      intent.playerId = session.sessionId;
      
      // Validate intent structure
      const validation = validateIntentStructure(intent);
      if (!validation.valid) {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'INVALID_INTENT_STRUCTURE',
            message: validation.error
          }
        }, 400);
      }
      
      console.log(`📥 Intent received: ${intent.type} from session ${session.sessionId} for game ${intent.gameId}`);
      
      // Load game state
      const gameStateKey = `game:${intent.gameId}:state`;
      let gameState = await kvGet(gameStateKey);
      
      if (!gameState) {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'GAME_NOT_FOUND',
            message: `Game ${intent.gameId} not found`
          }
        }, 404);
      }
      
      // Verify player is in game
      const player = gameState.players.find(p => p.id === intent.playerId);
      if (!player) {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'PLAYER_NOT_IN_GAME',
            message: `Player ${intent.playerId} is not in game ${intent.gameId}`
          }
        }, 403);
      }
      
      // Alpha v6 commit/reveal protocol not yet implemented
      // For now, return a helpful message
      return c.json({
        ok: false,
        state: gameState,
        events: [],
        rejected: {
          code: 'FEATURE_NOT_IMPLEMENTED',
          message: `Intent type '${intent.type}' is part of Alpha v6 commit/reveal protocol, not yet implemented. Use send-action endpoint for current gameplay.`
        }
      }, 501);
      
    } catch (error) {
      console.error("Intent processing error:", error);
      return c.json({
        ok: false,
        state: null,
        events: [],
        rejected: {
          code: 'INTERNAL_ERROR',
          message: error.message
        }
      }, 500);
    }
  });
}