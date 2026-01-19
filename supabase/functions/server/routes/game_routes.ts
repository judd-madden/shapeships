// ============================================================================
// GAME ROUTES
// ============================================================================
// Core multiplayer game endpoints (create, join, state, actions)
// Mechanical extraction from index.tsx - NO BEHAVIOR CHANGES
//
// Extracted from lines 1439-2425 of original index.tsx
// ============================================================================

import type { Hono } from "npm:hono";
import { advancePhase } from '../engine/phase/advancePhase.ts';
import { syncPhaseFields } from '../engine/phase/syncPhaseFields.ts';

// ============================================================================
// HELPER: Get current phase key for readiness checking
// ============================================================================
function getPhaseKey(state: any) {
  syncPhaseFields(state);
  const major = state?.gameData?.currentPhase ?? 'setup';
  const sub = state?.gameData?.currentSubPhase ?? 'unknown';
  return `${major}.${sub}`;
}

export function registerGameRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
  requireSession: (c: any) => Promise<any>,
  generateGameId: () => string
) {
  
  // ============================================================================
  // CREATE GAME
  // ============================================================================
  // Lines 1439-1525 from index.tsx
  app.post("/make-server-825e19ab/create-game", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const { playerName } = await c.req.json();
      
      // Note: Client may send playerId for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const playerId = session.sessionId; // AUTHORITY: Server-minted identity
      
      if (!playerName) {
        return c.json({ error: "Player name is required" }, 400);
      }

      console.log(`Creating game - Session: ${session.sessionId}, Display name: ${playerName}`);

      const gameId = generateGameId();
      let gameData = {
        gameId,
        players: [
          {
            id: playerId, // Server-derived from sessionToken
            name: playerName, // Client-provided metadata
            faction: null, // Species to be selected
            isReady: false,
            isActive: true,
            role: 'player',
            joinedAt: new Date().toISOString(),
            health: 25,
            lines: 0, // FIXED: Players start with 0 lines
            joiningLines: 0,
            energy: 0
          }
        ],
        gameData: {
          ships: {
            [playerId]: []
          },
          // Simplified game state for test interface
          currentPhase: 'setup',
          currentSubPhase: 'species_selection',
          turnNumber: 1,
          diceRoll: null,
          // Enhanced phase management (kept for compatibility)
          turnData: {
            turnNumber: 1,
            currentMajorPhase: 'setup', // 'setup', 'build_phase', 'battle_phase', 'health_resolution'
            currentSubPhase: 'species_selection', // For setup phase
            requiredSubPhases: [],
            accumulatedDamage: {},
            accumulatedHealing: {},
            healthAtTurnStart: {},
            chargesDeclared: false,
            diceRoll: null,
            linesDistributed: false
          },
          phaseReadiness: [], // Player ready states for current subphase
          phaseStartTime: new Date().toISOString()
        },
        // Legacy fields for compatibility
        currentPhase: 'setup',
        currentSubPhase: 'species_selection', 
        turnNumber: 1,
        actions: [
          {
            playerId: "system",
            playerName: "System",
            actionType: "system",
            content: `${playerName} created the game`,
            timestamp: new Date().toISOString()
          }
        ],
        status: "waiting", // 'waiting', 'active', 'finished'
        createdAt: new Date().toISOString()
      };

      // Normalize phase fields before saving
      gameData = syncPhaseFields(gameData);

      await kvSet(`game_${gameId}`, gameData);
      
      console.log("Game created:", gameId);
      return c.json({ gameId, message: "Game created successfully" });

    } catch (error) {
      console.error("Create game error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // JOIN GAME
  // ============================================================================
  // Lines 1530-1622 from index.tsx
  app.post("/make-server-825e19ab/join-game/:gameId", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const gameId = c.req.param('gameId');
      const { playerName, role = 'player' } = await c.req.json();
      
      // Note: Client may send playerId for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const playerId = session.sessionId; // AUTHORITY: Server-minted identity
      
      if (!playerName) {
        return c.json({ error: "Player name is required" }, 400);
      }

      console.log(`Joining game ${gameId} - Session: ${session.sessionId}, Display name: ${playerName}`);

      let gameData = await kvGet(`game_${gameId}`);
      if (!gameData) {
        return c.json({ error: "Game not found" }, 404);
      }

      // Check if player already exists
      const existingPlayer = gameData.players.find(p => p.id === playerId);
      if (!existingPlayer) {
        // Count current active players (not spectators)
        const activePlayers = gameData.players.filter(p => p.role === 'player');
        
        // If user wants to be a player but game is full (2 players), force them to spectator
        const finalRole = (role === 'player' && activePlayers.length >= 2) ? 'spectator' : role;

        const newPlayer = {
          id: playerId, // Server-derived from sessionToken
          name: playerName, // Client-provided metadata
          faction: null, // Species to be selected
          isReady: false,
          isActive: finalRole === 'player' && activePlayers.length === 0, // First player is active
          role: finalRole,
          joinedAt: new Date().toISOString(),
          health: 25,
          lines: 0, // FIXED: Players start with 0 lines
          joiningLines: 0,
          energy: 0
        };

        gameData.players.push(newPlayer);

        // Initialize ship collection for players only (not spectators)
        if (finalRole === 'player') {
          if (!gameData.gameData) gameData.gameData = { ships: {} };
          if (!gameData.gameData.ships) gameData.gameData.ships = {};
          gameData.gameData.ships[playerId] = [];
        }

        // Add appropriate join message
        const joinMessage = finalRole === 'spectator' ? 
          `${playerName} joined as spectator` : 
          `${playerName} joined the game`;

        gameData.actions.push({
          playerId: "system",
          playerName: "System",
          actionType: "system",
          content: joinMessage,
          timestamp: new Date().toISOString()
        });

        // Start the game if we have 2 active players
        const newActivePlayerCount = gameData.players.filter(p => p.role === 'player').length;
        if (newActivePlayerCount >= 2 && gameData.status === 'waiting') {
          gameData.status = 'active';
          gameData.actions.push({
            playerId: "system",
            playerName: "System",
            actionType: "system",
            content: "Game started! Players select species.",
            timestamp: new Date().toISOString()
          });
        }
      }

      // Normalize phase fields before saving
      gameData = syncPhaseFields(gameData);

      await kvSet(`game_${gameId}`, gameData);
      
      console.log("Player joined game:", gameId, playerName);
      return c.json({ message: "Joined game successfully", gameData });

    } catch (error) {
      console.error("Join game error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // SWITCH ROLE
  // ============================================================================
  // Lines 1627-1731 from index.tsx
  app.post("/make-server-825e19ab/switch-role/:gameId", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const gameId = c.req.param('gameId');
      const { newRole } = await c.req.json();
      
      // Note: Client may send playerId for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const playerId = session.sessionId; // AUTHORITY: Server-minted identity
      
      if (!newRole) {
        return c.json({ error: "New role is required" }, 400);
      }

      if (!['player', 'spectator'].includes(newRole)) {
        return c.json({ error: "Role must be 'player' or 'spectator'" }, 400);
      }

      console.log(`Role switch from session ${session.sessionId}: ${newRole} in game ${gameId}`);

      let gameData = await kvGet(`game_${gameId}`);
      if (!gameData) {
        return c.json({ error: "Game not found" }, 404);
      }

      const player = gameData.players.find(p => p.id === playerId);
      if (!player) {
        return c.json({ error: "Player not in game (session not recognized)" }, 403);
      }

      // Check if switching to player but game already has 2 players
      const activePlayers = gameData.players.filter(p => p.role === 'player');
      if (newRole === 'player' && activePlayers.length >= 2 && player.role !== 'player') {
        return c.json({ error: "Game already has 2 active players" }, 400);
      }

      const oldRole = player.role;
      
      // Find player index to update the player properly
      const playerIndex = gameData.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) {
        return c.json({ error: "Player not found in game" }, 404);
      }
      
      // Update player resources based on new role - immutable update
      if (newRole === 'player') {
        // Initialize ship collection if needed
        if (!gameData.gameData) gameData.gameData = { ships: {} };
        if (!gameData.gameData.ships) gameData.gameData.ships = {};
        if (!gameData.gameData.ships[playerId]) {
          gameData.gameData.ships[playerId] = [];
        }
        
        gameData = {
          ...gameData,
          players: gameData.players.map((p, idx) => 
            idx === playerIndex 
              ? {
                  ...p,
                  role: newRole,
                  lines: p.lines || 5, // Give lines to new players
                  health: 25
                }
              : p
          )
        };
      } else {
        // Switching to spectator - keep current resources but don't give new ones
        gameData = {
          ...gameData,
          players: gameData.players.map((p, idx) => 
            idx === playerIndex 
              ? {
                  ...p,
                  role: newRole,
                  isReady: false // Reset ready status when becoming spectator
                }
              : p
          )
        };
      }

      // Add system message about role change
      const updatedPlayer = gameData.players[playerIndex];
      gameData.actions.push({
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `${updatedPlayer.name} switched from ${oldRole} to ${newRole}`,
        timestamp: new Date().toISOString()
      });

      // Normalize phase fields before saving
      gameData = syncPhaseFields(gameData);

      await kvSet(`game_${gameId}`, gameData);
      
      console.log("Player switched role:", gameId, player.name, oldRole, "->", newRole);
      return c.json({ message: "Role switched successfully", gameData });

    } catch (error) {
      console.error("Switch role error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // GET GAME STATE
  // ============================================================================
  // Lines 1736-1856 from index.tsx
  app.get("/make-server-825e19ab/game-state/:gameId", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const gameId = c.req.param('gameId');
      
      // Note: Client may send playerId query for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const requestingPlayerId = session.sessionId; // AUTHORITY: Server-minted identity
      
      let gameData = await kvGet(`game_${gameId}`);
      
      if (!gameData) {
        return c.json({ error: "Game not found" }, 404);
      }

      // Normalize phase fields immediately after load
      if (gameData) {
        gameData = syncPhaseFields(gameData);
      }

      // Verify session is a participant in this game (or spectator)
      const participant = gameData.players.find(p => p.id === requestingPlayerId);
      if (!participant) {
        return c.json({ error: "Not authorized to view this game" }, 403);
      }

      const phaseKey = getPhaseKey(gameData);
      const sub = gameData.gameData.currentSubPhase;
      const phaseReadiness = gameData.gameData?.phaseReadiness || [];

      gameData.players = gameData.players.map(player => {
        const readiness = phaseReadiness.find(r => r.playerId === player.id);

        // Support both new (major:sub) and older (sub only)
        const readyMatch =
          readiness?.currentStep === phaseKey ||
          readiness?.currentStep === sub;

        return {
          ...player,
          isReady: Boolean(readiness?.isReady && readyMatch)
        };
      });

      // SECURITY: Filter pending declarations to only show requesting player's own pending data
      if (requestingPlayerId && gameData.gameData?.turnData) {
        const turnData = gameData.gameData.turnData;
        
        // Filter pending charge declarations
        if (turnData.pendingChargeDeclarations) {
          const filteredChargeDeclarations = {};
          // Only include requesting player's pending declarations
          if (turnData.pendingChargeDeclarations[requestingPlayerId]) {
            filteredChargeDeclarations[requestingPlayerId] = turnData.pendingChargeDeclarations[requestingPlayerId];
          }
          // For opponent, just show that they have pending declarations (count only)
          for (const playerId in turnData.pendingChargeDeclarations) {
            if (playerId !== requestingPlayerId) {
              filteredChargeDeclarations[playerId] = []; // Don't reveal opponent's declarations
            }
          }
          
          gameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...turnData,
                pendingChargeDeclarations: filteredChargeDeclarations
              }
            }
          };
        }
        
        // Filter pending solar power declarations
        if (turnData.pendingSOLARPowerDeclarations) {
          const filteredSolarDeclarations = {};
          // Only include requesting player's pending declarations
          if (turnData.pendingSOLARPowerDeclarations[requestingPlayerId]) {
            filteredSolarDeclarations[requestingPlayerId] = turnData.pendingSOLARPowerDeclarations[requestingPlayerId];
          }
          // For opponent, just show that they have pending declarations (count only)
          for (const playerId in turnData.pendingSOLARPowerDeclarations) {
            if (playerId !== requestingPlayerId) {
              filteredSolarDeclarations[playerId] = []; // Don't reveal opponent's declarations
            }
          }
          
          gameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...gameData.gameData.turnData,
                pendingSOLARPowerDeclarations: filteredSolarDeclarations
              }
            }
          };
        }
        
        // Filter commit/reveal data (new commit/reveal protocol)
        if (turnData.commitments) {
          const filteredCommitments: any = {};
          
          // For each commitment key (e.g., SPECIES_1, BUILD_2, etc.)
          for (const commitKey in turnData.commitments) {
            const keyRecords = turnData.commitments[commitKey];
            filteredCommitments[commitKey] = {};
            
            // For each player in this commitment key
            for (const playerId in keyRecords) {
              const record = keyRecords[playerId];
              
              if (playerId === requestingPlayerId) {
                // Show requesting player's own commit/reveal data
                filteredCommitments[commitKey][playerId] = record;
              } else {
                // For opponent: hide reveal payload and nonce, but show status booleans
                filteredCommitments[commitKey][playerId] = {
                  hasCommitted: record.commitHash !== undefined,
                  hasRevealed: record.revealPayload !== undefined,
                  committedAt: record.committedAt,
                  revealedAt: record.revealedAt
                  // Do NOT include: commitHash, revealPayload, nonce
                };
              }
            }
          }
          
          gameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...gameData.gameData.turnData,
                commitments: filteredCommitments
              }
            }
          };
        }
      }

      return c.json(gameData);

    } catch (error) {
      console.error("Get game state error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });

  // ============================================================================
  // SEND ACTION
  // ============================================================================
  // ⚠️ LEGACY HARNESS ONLY - PlayerMode must NOT call this endpoint
  // Use /intent endpoint for commit/reveal protocol instead
  // This endpoint remains for development dashboard and testing
  // ============================================================================
  app.post("/make-server-825e19ab/send-action/:gameId", async (c) => {
    try {
      // Validate session token and get server-side identity
      const session = await requireSession(c);
      if (session instanceof Response) return session; // Return 401 if validation failed

      const gameId = c.req.param('gameId');
      const requestBody = await c.req.json();
      
      // Note: Client may send playerId for backward compat, but it's IGNORED
      // Server-side identity is derived from sessionToken only
      const playerId = session.sessionId; // AUTHORITY: Server-minted identity
      
      const actionType = requestBody.actionType;
      const content = requestBody.content;
      const timestamp = requestBody.timestamp;
      
      if (!actionType) {
        return c.json({ error: "Action type is required" }, 400);
      }

      console.log(`Action from session ${session.sessionId}: ${actionType} in game ${gameId}`);

      let gameData = await kvGet(`game_${gameId}`);
      if (!gameData) {
        return c.json({ error: "Game not found" }, 404);
      }

      const player = gameData.players.find(p => p.id === playerId);
      if (!player) {
        return c.json({ error: "Player not in game (session not recognized)" }, 403);
      }

      // Store player information that we'll need later (to avoid const reference issues)
      const originalPlayerName = player.name;
      const originalPlayerRole = player.role;

      // Restrict spectator actions (they can only send messages or select species if slots available)
      if (originalPlayerRole === 'spectator' && actionType !== 'message' && actionType !== 'select_species') {
        return c.json({ error: "Spectators can only send messages and select species (if slots available)" }, 403);
      }

      // Simple action validation - allowlist of known actions
      const ALLOWED_ACTIONS = new Set([
        'select_species',
        'set_ready',
        'build_ship',
        'save_lines',
        'phase_action',
        'roll_dice',
        'advance_phase',
        'message',
        'declare_charge',
        'use_solar_power',
        'pass'
      ]);

      if (!ALLOWED_ACTIONS.has(actionType)) {
        return c.json({ error: `Unknown actionType '${actionType}'` }, 400);
      }

      // Handle different action types
      let responseMessage = "Action processed successfully";
      let logContent = content;
      
      console.log("Processing action:", { 
        actionType, 
        playerId, 
        playerName: originalPlayerName, 
        playerRole: originalPlayerRole, 
        currentPhase: gameData.gameData?.turnData?.currentMajorPhase,
        currentStep: gameData.gameData?.turnData?.currentStep,
        content: content
      });

      try {
        switch (actionType) {
        case 'select_species':
          console.log("Processing select_species action:", { playerId, content, playerRole: originalPlayerRole });
          
          // Validate species content
          if (!content || !content.species) {
            console.error("Invalid species selection - missing content.species:", content);
            return c.json({ error: "Species selection requires valid species name" }, 400);
          }
          
          const selectedSpecies = content.species;
          const validSpecies = ['human', 'xenite', 'centaur', 'ancient'];
          
          if (!validSpecies.includes(selectedSpecies)) {
            console.error("Invalid species selected:", selectedSpecies);
            return c.json({ error: `Invalid species. Must be one of: ${validSpecies.join(', ')}` }, 400);
          }
          
          // Find player index once for all updates  
          let playerIndex = gameData.players.findIndex(p => p.id === playerId);
          
          // Handle spectator promotion to player
          if (originalPlayerRole === 'spectator') {
            const activePlayers = gameData.players.filter(p => p.role === 'player');
            console.log("Spectator trying to select species:", { activePlayerCount: activePlayers.length });
            
            if (activePlayers.length < 2) {
              // Promote spectator to player - update properly without mutating const reference
              if (playerIndex !== -1) {
                gameData.players[playerIndex] = {
                  ...gameData.players[playerIndex],
                  role: 'player',
                  health: 25,
                  lines: 0, // FIXED: Players start with 0 lines
                  isActive: activePlayers.length === 0 // First promoted becomes active
                };
              }
              
              // Initialize ship collection
              if (!gameData.gameData) {
                console.log("Initializing gameData object");
                gameData.gameData = { ships: {} };
              }
              if (!gameData.gameData.ships) {
                console.log("Initializing ships object");
                gameData.gameData.ships = {};
              }
              gameData.gameData.ships[playerId] = [];
              
              console.log("Promoted spectator to player:", playerId);
              
              gameData.actions.push({
                playerId: "system",
                playerName: "System",
                actionType: "system",
                content: `${originalPlayerName} became an active player by selecting ${selectedSpecies}`,
                timestamp: new Date().toISOString()
              });
              
              // Refresh playerIndex after promotion since array was modified
              playerIndex = gameData.players.findIndex(p => p.id === playerId);
            } else {
              console.error("Cannot promote spectator - game full:", activePlayers.length);
              return c.json({ error: "Cannot select species as spectator - game already has 2 active players" }, 400);
            }
          }
          
          // Set species for players (including newly promoted ones)
          // Get current player status after potential promotion
          if (playerIndex !== -1) {
            const currentPlayer = gameData.players[playerIndex];
            if (currentPlayer && currentPlayer.role === 'player') {
              console.log("Setting faction for player:", { playerId, selectedSpecies });
              
              // Update the faction immutably by creating a new players array
              gameData = {
                ...gameData,
                players: gameData.players.map((p, idx) => 
                  idx === playerIndex ? { ...p, faction: selectedSpecies } : p
                )
              };
            
              logContent = `selected ${selectedSpecies} species`;
              responseMessage = `Species ${selectedSpecies} selected`;
              
              // Manual readiness update for setup phase
              if (gameData.gameData?.turnData?.currentMajorPhase === 'setup') {
                console.log("Auto-setting player ready after species selection");
                // Ensure phaseReadiness array exists
                if (!gameData.gameData.phaseReadiness) {
                  gameData.gameData.phaseReadiness = [];
                }
                const phaseKey = getPhaseKey(gameData);
                // Upsert readiness entry
                const existingIndex = gameData.gameData.phaseReadiness.findIndex(r => r.playerId === playerId);
                if (existingIndex !== -1) {
                  gameData.gameData.phaseReadiness[existingIndex] = {
                    playerId,
                    isReady: true,
                    currentStep: phaseKey
                  };
                } else {
                  gameData.gameData.phaseReadiness.push({
                    playerId,
                    isReady: true,
                    currentStep: phaseKey
                  });
                }
              }
            } else {
              console.error("Player role not valid for species selection:", currentPlayer?.role);
              return c.json({ error: "Only players can select species" }, 403);
            }
          } else {
            console.error("Player not found after species selection:", playerId);
            return c.json({ error: "Player not found" }, 404);
          }
          
          console.log("Species selection completed successfully:", { playerId, selectedSpecies });
          break;

        case 'set_ready':
          // Only active players can set ready
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can set ready status" }, 403);
          }
          
          // Manual readiness update using stable phase key
          if (!gameData.gameData) gameData.gameData = {};
          if (!gameData.gameData.phaseReadiness) {
            gameData.gameData.phaseReadiness = [];
          }
          const phaseKey = getPhaseKey(gameData);
          // Upsert readiness entry
          const existingReadyIndex = gameData.gameData.phaseReadiness.findIndex(r => r.playerId === playerId);
          if (existingReadyIndex !== -1) {
            gameData.gameData.phaseReadiness[existingReadyIndex] = {
              playerId,
              isReady: true,
              currentStep: phaseKey
            };
          } else {
            gameData.gameData.phaseReadiness.push({
              playerId,
              isReady: true,
              currentStep: phaseKey
            });
          }
          
          logContent = 'is ready to advance';
          responseMessage = 'Marked as ready';
          break;

        case 'build_ship':
          // Only players can build ships  
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can build ships" }, 403);
          }
          
          // Simple ship building logic - UI-agnostic placeholders
          const shipData = {
            id: `ship_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: `Ship ${content.shipId}`,
            shipId: content.shipId,
            healthValue: 0,
            damageValue: 0,
            isDestroyed: false,
            ownerId: playerId
          };
          
          if (!gameData.gameData) gameData.gameData = { ships: {} };
          if (!gameData.gameData.ships) gameData.gameData.ships = {};
          if (!gameData.gameData.ships[playerId]) gameData.gameData.ships[playerId] = [];
          
          gameData.gameData.ships[playerId].push(shipData);
          
          // No cost deduction for now (UI-agnostic server)
          const lineCost = 0;
          
          logContent = `built ${shipData.name}`;
          responseMessage = `${shipData.name} built successfully`;
          break;

        case 'save_lines':
          // Only players can save lines during drawing phase
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can save lines" }, 403);
          }
          
          const amount = content.amount || 1;
          const savingPlayer = gameData.players.find(p => p.id === playerId);
          if ((savingPlayer?.lines || 0) < amount) {
            return c.json({ error: "Not enough lines to save" }, 400);
          }
          
          // For now, just deduct lines without implementing saved lines storage - immutable update
          const savePlayerIndex = gameData.players.findIndex(p => p.id === playerId);
          if (savePlayerIndex !== -1) {
            gameData = {
              ...gameData,
              players: gameData.players.map((p, idx) => 
                idx === savePlayerIndex 
                  ? { ...p, lines: Math.max(0, (p.lines || 0) - amount) }
                  : p
              )
            };
          }
          
          logContent = `saved ${amount} line${amount > 1 ? 's' : ''}`;
          responseMessage = `Saved ${amount} line${amount > 1 ? 's' : ''}`;
          break;

        case 'phase_action':
          // Only players can perform phase actions
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can perform phase actions" }, 403);
          }
          switch (content.action) {
            case 'roll_dice':
              // Simple dice roll simulation
              const diceRoll = Math.floor(Math.random() * 6) + 1;
              const rollPlayerIndex = gameData.players.findIndex(p => p.id === playerId);
              if (rollPlayerIndex !== -1) {
                gameData = {
                  ...gameData,
                  players: gameData.players.map((p, idx) => 
                    idx === rollPlayerIndex 
                      ? { ...p, lines: (p.lines || 0) + diceRoll }
                      : p
                  )
                };
              }
              logContent = `rolled ${diceRoll} and gained ${diceRoll} lines`;
              responseMessage = `Rolled ${diceRoll}! Gained ${diceRoll} lines`;
              break;
            case 'advance_phase':
              return c.json({
                error: "Invalid action. Use actionType 'advance_phase' to advance the phase."
              }, 400);
            case 'pass_turn':
              return c.json({
                error: "Invalid action. Use actionType 'set_ready' or 'pass' instead."
              }, 400);
            case 'end_turn':
              return c.json({
                error: "Invalid action. Use actionType 'advance_phase' to end the turn."
              }, 400);
            default:
              logContent = `performed ${content.action}`;
          }
          break;

        case 'roll_dice':
          // Only players can roll dice
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can roll dice" }, 403);
          }
          
          // Simple dice roll for simplified game - shared by both players
          const diceRoll = Math.floor(Math.random() * 6) + 1;
          
          if (!gameData.gameData) gameData.gameData = {};
          gameData.gameData.diceRoll = diceRoll;
          
          // Give lines to ALL active players (dice roll is shared)
          gameData.players = gameData.players.map(player => {
            if (player.role === 'player') {
              return {
                ...player,
                lines: (player.lines || 0) + diceRoll
              };
            }
            return player;
          });
          
          logContent = `rolled ${diceRoll} - all players gained ${diceRoll} lines`;
          responseMessage = `Rolled ${diceRoll}! All players gained ${diceRoll} lines`;
          break;

        case 'advance_phase':
          // Only players can advance phases
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can advance phases" }, 403);
          }
          
          // Use canonical phase engine for advancement
          const result = advancePhase(gameData);
          if (!result.ok) {
            console.log(`Phase advance blocked: ${result.error}`);
            return c.json({ error: result.error }, 400);
          }
          
          // Update game state with advanced phase
          gameData = result.state;
          
          // Normalize phase fields after advancement
          gameData = syncPhaseFields(gameData);
          
          console.log(`Phase advanced successfully: ${result.from} → ${result.to}`);
          
          logContent = `advanced phase from ${result.from} to ${result.to}`;
          responseMessage = 'Phase advanced';
          
          // Add action to log
          gameData.actions.push({
            playerId,
            playerName: originalPlayerName,
            actionType,
            content: logContent,
            timestamp: timestamp || new Date().toISOString()
          });
          
          // Save state before returning
          await kvSet(`game_${gameId}`, gameData);
          
          console.log("Phase advanced and saved successfully:", actionType, "by", originalPlayerName);
          
          // Include debug info in response
          return c.json({ 
            message: responseMessage,
            debug: { from: result.from, to: result.to },
            gameState: gameData 
          });
          break;

        case 'message':
          logContent = content.content || content;
          responseMessage = "Message sent";
          break;

        case 'declare_charge':
          // Only players can declare charges
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can declare charges" }, 403);
          }
          
          // Initialize pending declarations if needed
          if (!gameData.gameData) gameData.gameData = {};
          if (!gameData.gameData.turnData) gameData.gameData.turnData = {};
          if (!gameData.gameData.turnData.pendingChargeDeclarations) {
            gameData.gameData.turnData.pendingChargeDeclarations = {};
          }
          
          // Check if player is already ready for current step (cannot modify after ready)
          const currentStepCharge = gameData.gameData?.turnData?.currentStep;
          const chargeReadiness = (gameData.gameData?.phaseReadiness || []).find(r => r.playerId === playerId);
          if (chargeReadiness?.isReady && chargeReadiness?.currentStep === currentStepCharge) {
            return c.json({ error: "Cannot declare charges after marking ready" }, 400);
          }
          
          // Create charge declaration
          const chargeDeclaration = {
            playerId,
            shipId: content.shipId,
            powerIndex: content.powerIndex || 0,
            targetPlayerId: content.targetPlayerId,
            targetShipId: content.targetShipId,
            timestamp: new Date().toISOString()
          };
          
          // Add to player's pending declarations (hidden from opponent)
          if (!gameData.gameData.turnData.pendingChargeDeclarations[playerId]) {
            gameData.gameData.turnData.pendingChargeDeclarations[playerId] = [];
          }
          gameData.gameData.turnData.pendingChargeDeclarations[playerId].push(chargeDeclaration);
          
          logContent = `declared a charge (hidden)`;
          responseMessage = 'Charge declaration added (hidden from opponent)';
          break;

        case 'use_solar_power':
          // Only players can use solar powers
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can use solar powers" }, 403);
          }
          
          // Initialize pending declarations if needed
          if (!gameData.gameData) gameData.gameData = {};
          if (!gameData.gameData.turnData) gameData.gameData.turnData = {};
          if (!gameData.gameData.turnData.pendingSOLARPowerDeclarations) {
            gameData.gameData.turnData.pendingSOLARPowerDeclarations = {};
          }
          
          // Check if player is already ready for current step
          const currentStepSolar = gameData.gameData?.turnData?.currentStep;
          const solarReadiness = (gameData.gameData?.phaseReadiness || []).find(r => r.playerId === playerId);
          if (solarReadiness?.isReady && solarReadiness?.currentStep === currentStepSolar) {
            return c.json({ error: "Cannot use solar powers after marking ready" }, 400);
          }
          
          // Create solar power declaration
          const solarDeclaration = {
            playerId,
            powerType: content.powerType || 'unknown',
            energyCost: content.energyCost || {},
            targetPlayerId: content.targetPlayerId,
            targetShipId: content.targetShipId,
            cubeRepeated: content.cubeRepeated || false,
            timestamp: new Date().toISOString()
          };
          
          // Add to player's pending declarations (hidden from opponent)
          if (!gameData.gameData.turnData.pendingSOLARPowerDeclarations[playerId]) {
            gameData.gameData.turnData.pendingSOLARPowerDeclarations[playerId] = [];
          }
          gameData.gameData.turnData.pendingSOLARPowerDeclarations[playerId].push(solarDeclaration);
          
          logContent = `used a solar power (hidden)`;
          responseMessage = 'Solar power declaration added (hidden from opponent)';
          break;

        case 'pass':
          // Only players can pass
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can pass" }, 403);
          }
          
          // Pass means no declarations - just mark ready
          logContent = 'passed without declaring';
          responseMessage = 'Passed - no declarations made';
          // This will trigger setPlayerReady via set_ready action or explicit ready button
          break;

        default:
          console.log("Unhandled action type:", actionType);
          logContent = typeof content === 'string' ? content : JSON.stringify(content);
      }
      
      } catch (actionError) {
        console.error("Error processing action:", { actionType, error: actionError.message, stack: actionError.stack });
        return c.json({ error: `Failed to process ${actionType} action: ${actionError.message}` }, 500);
      }

      // Add action to log (use stored player name to avoid const reference issues)
      gameData.actions.push({
        playerId,
        playerName: originalPlayerName,
        actionType,
        content: logContent,
        timestamp: timestamp || new Date().toISOString()
      });

      // Normalize phase fields before saving
      const normalizedGameData = syncPhaseFields(gameData);

      await kvSet(`game_${gameId}`, normalizedGameData);
      
      console.log("Action processed successfully:", actionType, "by", originalPlayerName);
      return c.json({ message: responseMessage, gameState: gameData });

    } catch (error) {
      console.error("Send action error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });
}