// ============================================================================
// GAME ROUTES
// ============================================================================
// Core multiplayer game endpoints (create, join, state, actions)
// Mechanical extraction from index.tsx - NO BEHAVIOR CHANGES
//
// Extracted from lines 1439-2425 of original index.tsx
// ============================================================================

import type { Hono } from "npm:hono";

export function registerGameRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
  requireSession: (c: any) => Promise<any>,
  generateGameId: () => string,
  ServerPhaseEngine: any,
  getShipDef: (shipDefId: string) => any,
  getShipCost: (shipDefId: string) => number,
  getShipName: (shipId: string) => string,
  getShipHealth: (shipId: string) => number,
  getShipDamage: (shipId: string) => number
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
      const gameData = {
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

      const gameData = await kvGet(`game_${gameId}`);
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

      // Verify session is a participant in this game (or spectator)
      const participant = gameData.players.find(p => p.id === requestingPlayerId);
      if (!participant) {
        return c.json({ error: "Not authorized to view this game" }, 403);
      }

      // Process automatic phases if needed
      const currentPhase = gameData.gameData?.currentPhase || gameData.currentPhase;
      const diceRoll = gameData.gameData?.diceRoll;
      
      console.log(`Game state fetch - Phase: ${currentPhase}, DiceRoll: ${diceRoll}, ShouldAutoAdvance: ${ServerPhaseEngine.shouldAutoAdvance(gameData)}`);
      
      if (ServerPhaseEngine.shouldAutoAdvance(gameData)) {
        console.log("🎲 Auto-advancing phase during game state fetch");
        gameData = ServerPhaseEngine.processAutoPhase(gameData);
        await kvSet(`game_${gameId}`, gameData);
        
        // Log the result
        const newPhase = gameData.gameData?.currentPhase || gameData.currentPhase;
        const newDiceRoll = gameData.gameData?.diceRoll;
        console.log(`After auto-advance - Phase: ${newPhase}, DiceRoll: ${newDiceRoll}`);
      }

      // FIXED: Populate player.isReady from phaseReadiness array for frontend display
      const currentSimplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
      const currentStep = gameData.gameData?.turnData?.currentStep;
      const phaseReadiness = gameData.gameData?.phaseReadiness || [];
      
      gameData.players = gameData.players.map(player => {
        const readiness = phaseReadiness.find(r => r.playerId === player.id);
        const isReadyForCurrentPhase = readiness?.isReady && 
          (readiness?.currentStep === currentSimplePhase || readiness?.currentStep === currentStep);
        
        return {
          ...player,
          isReady: isReadyForCurrentPhase || false
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
  // Lines 1861-2425 from index.tsx
  // NOTE: This is a massive endpoint (~564 lines) - extracted verbatim
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

      // Validate action is allowed for current step
      const validActions = ServerPhaseEngine.getValidActionsForCurrentStep(gameData, playerId);
      
      // Debug logging for phase validation issues
      const currentSimplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
      const currentMajorPhase = gameData.gameData?.turnData?.currentMajorPhase;
      const currentStep = gameData.gameData?.turnData?.currentStep;
      
      console.log("Phase validation debug:", {
        actionType,
        currentSimplePhase,
        currentMajorPhase, 
        currentStep,
        validActions,
        playerRole: originalPlayerRole,
        gameDataPhase: gameData.gameData?.currentPhase,
        legacyPhase: gameData.currentPhase
      });
      
      // More permissive validation for key game actions
      const isKeyGameAction = ['build_ship', 'save_lines', 'select_species', 'roll_dice'].includes(actionType);
      const isValidAction = validActions.includes(actionType);
      
      // Allow key game actions if they make contextual sense, even if not in valid actions list
      if (!isValidAction && isKeyGameAction) {
        if (actionType === 'build_ship' && (currentSimplePhase === 'ship_building' || gameData.gameData?.currentPhase === 'ship_building')) {
          console.log("Allowing build_ship action due to ship_building phase override");
        } else if (actionType === 'select_species' && (currentSimplePhase === 'setup' || currentMajorPhase === 'setup')) {
          console.log("Allowing select_species action due to setup phase override");
        } else if (actionType === 'roll_dice' && (currentSimplePhase === 'dice_roll')) {
          console.log("Allowing roll_dice action due to dice_roll phase override");
        } else {
          return c.json({ 
            error: `Action '${actionType}' not allowed in current subphase. Valid actions: ${validActions.join(', ')}. Current phase: ${currentSimplePhase || currentMajorPhase}. Debug: simplePhase=${currentSimplePhase}, gameData.currentPhase=${gameData.gameData?.currentPhase}` 
          }, 400);
        }
      } else if (!isValidAction) {
        return c.json({ 
          error: `Action '${actionType}' not allowed in current subphase. Valid actions: ${validActions.join(', ')}. Current phase: ${currentSimplePhase || currentMajorPhase}. Debug: simplePhase=${currentSimplePhase}, gameData.currentPhase=${gameData.gameData?.currentPhase}` 
        }, 400);
      }

      // Handle different action types
      let responseMessage = "Action processed successfully";
      let logContent = content;
      let shouldCheckPhaseAdvancement = false;
      
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
              
              // Auto-set ready after species selection during setup
              if (gameData.gameData?.turnData?.currentMajorPhase === 'setup') {
                console.log("Auto-setting player ready after species selection");
                gameData = ServerPhaseEngine.setPlayerReady(gameData, playerId);
                shouldCheckPhaseAdvancement = true;
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
          
          gameData = ServerPhaseEngine.setPlayerReady(gameData, playerId);
          logContent = 'is ready to advance';
          responseMessage = 'Marked as ready';
          shouldCheckPhaseAdvancement = true;
          break;

        case 'build_ship':
          // Only players can build ships  
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can build ships" }, 403);
          }
          
          // Simple ship building logic
          const shipData = {
            id: `ship_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: getShipName(content.shipId),
            shipId: content.shipId,
            healthValue: getShipHealth(content.shipId),
            damageValue: getShipDamage(content.shipId),
            isDestroyed: false,
            ownerId: playerId
          };
          
          if (!gameData.gameData) gameData.gameData = { ships: {} };
          if (!gameData.gameData.ships) gameData.gameData.ships = {};
          if (!gameData.gameData.ships[playerId]) gameData.gameData.ships[playerId] = [];
          
          gameData.gameData.ships[playerId].push(shipData);
          
          // Deduct lines cost (simple implementation) - immutable update
          const lineCost = getShipCost(content.shipId);
          const buildPlayerIndex = gameData.players.findIndex(p => p.id === playerId);
          if (buildPlayerIndex !== -1) {
            gameData = {
              ...gameData,
              players: gameData.players.map((p, idx) => 
                idx === buildPlayerIndex 
                  ? { ...p, lines: Math.max(0, (p.lines || 0) - lineCost) }
                  : p
              )
            };
          }
          
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
          shouldCheckPhaseAdvancement = true;
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
              logContent = 'advanced the phase';
              responseMessage = 'Phase advanced';
              break;
            case 'pass_turn':
              logContent = 'passed their turn';
              responseMessage = 'Turn passed';
              break;
            case 'end_turn':
              logContent = 'ended their turn';
              responseMessage = 'Turn ended';
              break;
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
          shouldCheckPhaseAdvancement = true; // This should trigger auto-advance to ship building
          break;

        case 'advance_phase':
          // Only players can advance phases
          if (originalPlayerRole !== 'player') {
            return c.json({ error: "Only active players can advance phases" }, 403);
          }
          
          // Simple phase advancement for simplified game
          const currentPhase = gameData.gameData?.currentPhase || 'setup';
          const currentTurnNumber = gameData.gameData?.turnNumber || 1;
          let newPhase = currentPhase;
          let newTurnNumber = currentTurnNumber;
          
          switch (currentPhase) {
            case 'setup':
              // Setup only happens once, then start turn 1
              newPhase = 'dice_roll';
              newTurnNumber = 1;
              break;
            case 'dice_roll':
              newPhase = 'ship_building';
              break;
            case 'ship_building':
              newPhase = 'automatic_powers';
              break;
            case 'automatic_powers':
              newPhase = 'health_resolution';
              break;
            case 'health_resolution':
              // Check for game end conditions first
              const playersAlive = gameData.players.filter(p => p.role === 'player' && (p.health || 25) > 0);
              if (playersAlive.length < 2) {
                newPhase = 'end_of_game';
                // Determine winner
                if (playersAlive.length === 1) {
                  gameData.winner = playersAlive[0];
                }
              } else {
                // Continue to next turn cycle
                newPhase = 'dice_roll';
                newTurnNumber = currentTurnNumber + 1;
              }
              break;
            case 'end_of_game':
              // Game is over, no advancement
              logContent = 'attempted to advance from final phase';
              responseMessage = 'Game is over';
              break;
          }
          
          if (!gameData.gameData) gameData.gameData = {};
          gameData.gameData.currentPhase = newPhase;
          gameData.gameData.turnNumber = newTurnNumber;
          gameData.currentPhase = newPhase; // Legacy field
          gameData.turnNumber = newTurnNumber; // Legacy field
          
          if (currentPhase !== 'end_of_game') {
            logContent = `advanced from ${currentPhase} to ${newPhase}${newTurnNumber !== currentTurnNumber ? ` (Turn ${newTurnNumber})` : ''}`;
            responseMessage = `Phase advanced to ${newPhase}${newTurnNumber !== currentTurnNumber ? ` (Turn ${newTurnNumber})` : ''}`;
          }
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

      // Check for automatic phase advancement
      try {
        if (ServerPhaseEngine.shouldAutoAdvance(gameData)) {
          console.log("Processing automatic phase advancement...");
          gameData = ServerPhaseEngine.processAutoPhase(gameData);
        }
        
        // FIXED: Check for player readiness phase advancement after EVERY action
        // This ensures that when the second player becomes ready, the phase auto-advances
        if (ServerPhaseEngine.areAllPlayersReady(gameData)) {
          console.log("All players ready - auto-advancing phase...");
          gameData = ServerPhaseEngine.advancePhase(gameData);
          
          // Check again for auto-advance after manual advancement
          if (ServerPhaseEngine.shouldAutoAdvance(gameData)) {
            console.log("Processing secondary automatic phase advancement...");
            gameData = ServerPhaseEngine.processAutoPhase(gameData);
          }
        }
      } catch (phaseError) {
        console.error("Error in phase advancement:", { error: phaseError.message, stack: phaseError.stack });
        // Continue execution - don't fail the entire action due to phase advancement errors
      }

      await kvSet(`game_${gameId}`, gameData);
      
      console.log("Action processed successfully:", actionType, "by", originalPlayerName);
      return c.json({ message: responseMessage });

    } catch (error) {
      console.error("Send action error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  });
}