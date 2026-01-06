// ============================================================================
// LEGACY RULES AND TEMPORARY GAME LOGIC
// ============================================================================
// ⚠️ TEMPORARY: These definitions and engine logic will be replaced
// when the shared game engine can be imported without React dependencies
//
// DO NOT ADD NEW RULES HERE
// See: /OPTION_B_FINAL_STATUS.md and /QUICK_REF_COMPLETE_DELEGATION.md
//
// Mechanical extraction from index.tsx lines 336-1434 - NO BEHAVIOR CHANGES
// ============================================================================

// ============================================================================
// SHIP DEFINITIONS MAP (Temporary - will be replaced with core imports)
// ============================================================================
export const SHIP_DEFINITIONS_MAP = {
  // HUMAN - Basic Ships
  'DEF': { id: 'DEF', name: 'Defender', species: 'human', type: 'basic', buildCost: 2, joiningCost: 0 },
  'FIG': { id: 'FIG', name: 'Fighter', species: 'human', type: 'basic', buildCost: 3, joiningCost: 0 },
  'CMD': { id: 'CMD', name: 'Commander', species: 'human', type: 'basic', buildCost: 4, joiningCost: 0 },
  'INT': { id: 'INT', name: 'Interceptor', species: 'human', type: 'basic', buildCost: 4, joiningCost: 0 },
  'ORB': { id: 'ORB', name: 'Orbital', species: 'human', type: 'basic', buildCost: 5, joiningCost: 0 },
  'CAR': { id: 'CAR', name: 'Carrier', species: 'human', type: 'basic', buildCost: 6, joiningCost: 0 },
  'STR': { id: 'STR', name: 'Starship', species: 'human', type: 'basic', buildCost: 6, joiningCost: 0 },
  'FRI': { id: 'FRI', name: 'Frigate', species: 'human', type: 'basic', buildCost: 7, joiningCost: 0 },
  
  // HUMAN - Upgraded Ships
  'TAC': { id: 'TAC', name: 'Tactical Cruiser', species: 'human', type: 'upgraded', buildCost: 0, joiningCost: 5, requiresSacrifice: ['FIG', 'CMD'] },
  'GRD': { id: 'GRD', name: 'Guardian', species: 'human', type: 'upgraded', buildCost: 0, joiningCost: 6, requiresSacrifice: ['DEF', 'DEF', 'DEF'] },
  'SCI': { id: 'SCI', name: 'Science Vessel', species: 'human', type: 'upgraded', buildCost: 0, joiningCost: 6, requiresSacrifice: ['CMD', 'CMD'] },
  'BCR': { id: 'BCR', name: 'Battlecruiser', species: 'human', type: 'upgraded', buildCost: 0, joiningCost: 7, requiresSacrifice: ['INT', 'FRI'] },
  'EAR': { id: 'EAR', name: 'Earth', species: 'human', type: 'upgraded', buildCost: 0, joiningCost: 9, requiresSacrifice: ['ORB', 'CAR'] },
  'DRE': { id: 'DRE', name: 'Dreadnought', species: 'human', type: 'upgraded', buildCost: 0, joiningCost: 10, requiresSacrifice: ['FRI', 'FRI'] },
  'LEV': { id: 'LEV', name: 'Leviathan', species: 'human', type: 'upgraded', buildCost: 0, joiningCost: 12, requiresSacrifice: ['STR', 'STR'] },
  
  // XENITE - Basic Ships
  'XEN': { id: 'XEN', name: 'Xenite', species: 'xenite', type: 'basic', buildCost: 1, joiningCost: 0 },
  'ANT': { id: 'ANT', name: 'Antlion', species: 'xenite', type: 'basic', buildCost: 2, joiningCost: 0 },
  'MAN': { id: 'MAN', name: 'Mantis', species: 'xenite', type: 'basic', buildCost: 3, joiningCost: 0 },
  'EVO': { id: 'EVO', name: 'Evolver', species: 'xenite', type: 'basic', buildCost: 4, joiningCost: 0 },
  'OXI': { id: 'OXI', name: 'Oxite', species: 'xenite', type: 'basic', buildCost: 0, joiningCost: 0 },
  'AST': { id: 'AST', name: 'Asterite', species: 'xenite', type: 'basic', buildCost: 0, joiningCost: 0 },
  'HEL': { id: 'HEL', name: 'Hell Hornet', species: 'xenite', type: 'basic', buildCost: 5, joiningCost: 0 },
  'BUG': { id: 'BUG', name: 'Bug Breeder', species: 'xenite', type: 'basic', buildCost: 6, joiningCost: 0 },
  'ZEN': { id: 'ZEN', name: 'Zenith', species: 'xenite', type: 'basic', buildCost: 7, joiningCost: 0 },
  
  // XENITE - Upgraded Ships
  'DSW': { id: 'DSW', name: 'Defense Swarm', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 4, requiresSacrifice: ['XEN', 'XEN'] },
  'ANA': { id: 'ANA', name: 'Antlion Array', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 5, requiresSacrifice: ['ANT', 'ANT'] },
  'OFA': { id: 'OFA', name: 'Oxite Face', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 6, requiresSacrifice: ['OXI', 'OXI', 'OXI'] },
  'AFA': { id: 'AFA', name: 'Asterite Face', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 6, requiresSacrifice: ['AST', 'AST', 'AST'] },
  'SAC': { id: 'SAC', name: 'Sacrificial Pool', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 7, requiresSacrifice: ['MAN', 'EVO'] },
  'QUE': { id: 'QUE', name: 'Queen', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 9, requiresSacrifice: ['HEL', 'BUG'] },
  'CHR': { id: 'CHR', name: 'Chronoswarm', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 11, requiresSacrifice: ['ZEN', 'ZEN'] },
  'HIV': { id: 'HIV', name: 'Hive', species: 'xenite', type: 'upgraded', buildCost: 0, joiningCost: 13, requiresSacrifice: ['QUE', 'SAC'] },
  
  // CENTAUR - Basic Ships  
  'FEA': { id: 'FEA', name: 'Ship of Fear', species: 'centaur', type: 'basic', buildCost: 2, joiningCost: 0 },
  'ANG': { id: 'ANG', name: 'Ship of Anger', species: 'centaur', type: 'basic', buildCost: 3, joiningCost: 0 },
  'EQU': { id: 'EQU', name: 'Ship of Equality', species: 'centaur', type: 'basic', buildCost: 4, joiningCost: 0 },
  'WIS': { id: 'WIS', name: 'Ship of Wisdom', species: 'centaur', type: 'basic', buildCost: 5, joiningCost: 0 },
  'VIG': { id: 'VIG', name: 'Ship of Vigor', species: 'centaur', type: 'basic', buildCost: 5, joiningCost: 0 },
  'FAM': { id: 'FAM', name: 'Ship of Family', species: 'centaur', type: 'basic', buildCost: 6, joiningCost: 0 },
  'LEG': { id: 'LEG', name: 'Ship of Legacy', species: 'centaur', type: 'basic', buildCost: 7, joiningCost: 0 },
  
  // CENTAUR - Upgraded Ships (Arks)
  'TER': { id: 'TER', name: 'Ark of Terror', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 5, requiresSacrifice: ['FEA', 'FEA'] },
  'FUR': { id: 'FUR', name: 'Ark of Fury', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 6, requiresSacrifice: ['ANG', 'ANG'] },
  'KNO': { id: 'KNO', name: 'Ark of Knowledge', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 7, requiresSacrifice: ['WIS', 'WIS'] },
  'ENT': { id: 'ENT', name: 'Ark of Entropy', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 8, requiresSacrifice: ['EQU', 'VIG'] },
  'RED': { id: 'RED', name: 'Ark of Redemption', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 9, requiresSacrifice: ['FAM', 'FAM'] },
  'POW': { id: 'POW', name: 'Ark of Power', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 10, requiresSacrifice: ['LEG', 'VIG'] },
  'DES': { id: 'DES', name: 'Ark of Destruction', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 11, requiresSacrifice: ['LEG', 'LEG'] },
  'DOM': { id: 'DOM', name: 'Ark of Domination', species: 'centaur', type: 'upgraded', buildCost: 0, joiningCost: 12, requiresSacrifice: ['RED', 'KNO'] },
  
  // ANCIENT - Basic Ships (Cores)
  'MER': { id: 'MER', name: 'Mercury Core', species: 'ancient', type: 'basic', buildCost: 1, joiningCost: 0 },
  'PLU': { id: 'PLU', name: 'Pluto Core', species: 'ancient', type: 'basic', buildCost: 2, joiningCost: 0 },
  'QUA': { id: 'QUA', name: 'Quantum Mystic', species: 'ancient', type: 'basic', buildCost: 3, joiningCost: 0 },
  'SPI': { id: 'SPI', name: 'Spiral', species: 'ancient', type: 'basic', buildCost: 3, joiningCost: 0 },
  'URA': { id: 'URA', name: 'Uranus Core', species: 'ancient', type: 'basic', buildCost: 4, joiningCost: 0 },
  'SOR': { id: 'SOR', name: 'Solar Reserve', species: 'ancient', type: 'basic', buildCost: 5, joiningCost: 0 },
  'NEP': { id: 'NEP', name: 'Neptune Core', species: 'ancient', type: 'basic', buildCost: 5, joiningCost: 0 },
  'VEN': { id: 'VEN', name: 'Venus Core', species: 'ancient', type: 'basic', buildCost: 6, joiningCost: 0 },
  
  // ANCIENT - Upgraded Ships
  'SAT': { id: 'SAT', name: 'Saturn Core', species: 'ancient', type: 'upgraded', buildCost: 0, joiningCost: 4, requiresSacrifice: ['MER', 'PLU'] },
  'PYR': { id: 'PYR', name: 'Pyramid', species: 'ancient', type: 'upgraded', buildCost: 0, joiningCost: 6, requiresSacrifice: ['QUA', 'SPI'] },
  'JUP': { id: 'JUP', name: 'Jupiter Core', species: 'ancient', type: 'upgraded', buildCost: 0, joiningCost: 7, requiresSacrifice: ['URA', 'NEP'] },
  'SUN': { id: 'SUN', name: 'The Sun', species: 'ancient', type: 'upgraded', buildCost: 0, joiningCost: 8, requiresSacrifice: ['VEN', 'SOR'] },
  'BLA': { id: 'BLA', name: 'Black Hole', species: 'ancient', type: 'upgraded', buildCost: 0, joiningCost: 12, requiresSacrifice: ['JUP', 'SUN'] },
  
  // Legacy test ships (backwards compatibility)
  'human_scout': { id: 'human_scout', name: 'Scout', species: 'human', type: 'basic', buildCost: 1, joiningCost: 0 },
  'human_fighter': { id: 'human_fighter', name: 'Fighter', species: 'human', type: 'basic', buildCost: 2, joiningCost: 0 },
  'human_destroyer': { id: 'human_destroyer', name: 'Destroyer', species: 'human', type: 'basic', buildCost: 3, joiningCost: 0 },
  'defender': { id: 'DEF', name: 'Defender', species: 'human', type: 'basic', buildCost: 2, joiningCost: 0 },
  'fighter': { id: 'FIG', name: 'Fighter', species: 'human', type: 'basic', buildCost: 3, joiningCost: 0 },
};

// Get ship definition by ID
export const getShipDef = (shipDefId: string) => {
  return SHIP_DEFINITIONS_MAP[shipDefId] || SHIP_DEFINITIONS_MAP[shipDefId.toUpperCase()] || null;
};

// Get ship cost (build cost for basic, joining cost for upgraded)
export const getShipCost = (shipDefId: string) => {
  const def = getShipDef(shipDefId);
  if (!def) return 0;
  return def.type === 'basic' ? def.buildCost : def.joiningCost;
};

// ============================================================================
// TEMP_COMPAT: Placeholder Ship Stat Helpers
// ============================================================================
// ⚠️ TEMPORARY: Ad-hoc placeholder implementations
// These exist only for basic game functionality until real ship stats are integrated
// DO NOT EXPAND - These will be replaced with authoritative ship data
// ============================================================================

export const getShipName = (shipId: string) => {
  const def = getShipDef(shipId);
  return def?.name || shipId;
};

export const getShipHealth = (shipId: string) => {
  // Stub implementation - returns fixed value
  // TODO: Replace with real ship health stats from ship definitions
  return 1;
};

export const getShipDamage = (shipId: string) => {
  // Stub implementation - ad-hoc rules for basic testing
  // TODO: Replace with real ship damage stats from ship definitions
  const shipId_lower = shipId?.toLowerCase();
  if (shipId_lower === 'fighter' || shipId_lower === 'human_fighter') return 1;
  return 0;
};

// ============================================================================
// TEMPORARY SERVER PHASE ENGINE
// ============================================================================
// Mechanical extraction from index.tsx lines 449-1434 - NO BEHAVIOR CHANGES
// ============================================================================

export class ServerPhaseEngine {
  
  // Phase and Step Enums (matching /game/engine/GamePhases.tsx)
  static MajorPhase = {
    SETUP: 'setup',
    BUILD_PHASE: 'build_phase',
    BATTLE_PHASE: 'battle_phase',
    END_OF_TURN_RESOLUTION: 'end_of_turn_resolution',
    END_OF_GAME: 'end_of_game'
  };
  
  static BuildPhaseStep = {
    DICE_ROLL: 'dice_roll',
    LINE_GENERATION: 'line_generation',
    SHIPS_THAT_BUILD: 'ships_that_build',
    DRAWING: 'drawing',
    END_OF_BUILD: 'end_of_build'
  };
  
  static BattlePhaseStep = {
    FIRST_STRIKE: 'first_strike',
    SIMULTANEOUS_DECLARATION: 'simultaneous_declaration',
    CONDITIONAL_RESPONSE: 'conditional_response'
  };
  
  // Check if all eligible players are ready for current step
  static areAllPlayersReady(gameData) {
    const currentStep = gameData.gameData?.turnData?.currentStep;
    const currentMajorPhase = gameData.gameData?.turnData?.currentMajorPhase;
    const simplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
    const phaseReadiness = gameData.gameData?.phaseReadiness || [];
    const activePlayers = gameData.players.filter(p => p.role === 'player');
    
    // Handle simplified game phases
    if (simplePhase && ['setup', 'ship_building'].includes(simplePhase)) {
      if (simplePhase === 'setup') {
        // For setup: need 2 players and both must have selected species
        if (activePlayers.length < 2) {
          return false;
        }
        // Check if all players have selected species and are ready
        return activePlayers.every(player => {
          const hasSpecies = !!player.faction;
          const readiness = phaseReadiness.find(r => r.playerId === player.id);
          const isReady = readiness?.isReady && readiness?.currentStep === simplePhase;
          return hasSpecies && isReady;
        });
      }
      
      if (simplePhase === 'ship_building') {
        // For ship building: need both players to declare ready
        if (activePlayers.length < 2) {
          return false;
        }
        return activePlayers.every(player => {
          const readiness = phaseReadiness.find(r => r.playerId === player.id);
          return readiness?.isReady && readiness?.currentStep === simplePhase;
        });
      }
    }
    
    // During setup, all active players (not spectators) need to be ready
    if (currentMajorPhase === this.MajorPhase.SETUP) {
      if (activePlayers.length < 2) {
        return false; // Need both players to have joined and selected species
      }
      
      // Check if all active players are ready
      return activePlayers.every(player => {
        const readiness = phaseReadiness.find(r => r.playerId === player.id);
        return readiness?.isReady && readiness?.currentStep === currentStep;
      });
    }
    
    // For complex game phases, check based on step requirements
    if (activePlayers.length < 2) {
      return false;
    }
    
    // Check if current step requires player readiness
    const playersWhoNeedToConfirm = this.getPlayersWhoNeedToConfirm(gameData, currentStep);
    
    // If no players need to confirm (automatic step), advance immediately
    if (playersWhoNeedToConfirm.length === 0) {
      return true;
    }
    
    return playersWhoNeedToConfirm.every(playerId => {
      const readiness = phaseReadiness.find(r => r.playerId === playerId);
      return readiness?.isReady && readiness?.currentStep === currentStep;
    });
  }
  
  // Get players who need to confirm readiness for a given step
  static getPlayersWhoNeedToConfirm(gameData, step) {
    if (!step) return [];
    
    const allPlayerIds = gameData.players.filter(p => p.role === 'player').map(p => p.id);
    
    // Build Phase steps
    if (step === this.BuildPhaseStep.DICE_ROLL || step === this.BuildPhaseStep.LINE_GENERATION || step === this.BuildPhaseStep.END_OF_BUILD) {
      // Automatic steps - no confirmation needed
      return [];
    }
    
    if (step === this.BuildPhaseStep.SHIPS_THAT_BUILD || step === this.BuildPhaseStep.DRAWING) {
      // Both players must confirm (even if they have no actions, they can pass)
      return allPlayerIds;
    }
    
    // Battle Phase steps
    if (step === this.BattlePhaseStep.FIRST_STRIKE) {
      // Automatic resolution (unless ships require target selection)
      return [];
    }
    
    if (step === this.BattlePhaseStep.SIMULTANEOUS_DECLARATION || step === this.BattlePhaseStep.CONDITIONAL_RESPONSE) {
      // Both players can act (passing is allowed)
      return allPlayerIds;
    }
    
    return [];
  }
  
  // Set player ready for current step
  static setPlayerReady(gameData, playerId) {
    const currentStep = gameData.gameData?.turnData?.currentStep;
    const simplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
    const phaseReadiness = gameData.gameData?.phaseReadiness || [];
    
    // Use simple phase if available, otherwise complex step
    const phaseKey = simplePhase || currentStep;
    
    // Remove existing readiness for this player
    const updatedReadiness = phaseReadiness.filter(r => r.playerId !== playerId);
    
    // Add new readiness
    updatedReadiness.push({
      playerId,
      isReady: true,
      currentStep: phaseKey,
      declaredAt: new Date().toISOString()
    });
    
    // Also update the isReady field on the player object for frontend display
    const updatedPlayers = gameData.players.map(player => {
      if (player.id === playerId) {
        return {
          ...player,
          isReady: true
        };
      }
      return player;
    });
    
    return {
      ...gameData,
      players: updatedPlayers,
      gameData: {
        ...gameData.gameData,
        phaseReadiness: updatedReadiness
      }
    };
  }
  
  // Clear all player readiness (when advancing phases)
  static clearPlayerReadiness(gameData) {
    // Clear isReady field on all player objects
    const updatedPlayers = gameData.players.map(player => ({
      ...player,
      isReady: false
    }));
    
    return {
      ...gameData,
      players: updatedPlayers,
      gameData: {
        ...gameData.gameData,
        phaseReadiness: []
      }
    };
  }
  
  // Advance to next phase/step
  static advancePhase(gameData) {
    const currentMajorPhase = gameData.gameData?.turnData?.currentMajorPhase;
    const currentStep = gameData.gameData?.turnData?.currentStep;
    const simplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
    
    let newGameData = gameData;
    
    // Handle simplified game phase advancement
    if (simplePhase) {
      switch (simplePhase) {
        case 'setup':
          // Advance from setup to dice roll (first turn)
          newGameData = {
            ...gameData,
            status: 'active',
            gameData: {
              ...gameData.gameData,
              currentPhase: 'dice_roll',
              turnNumber: 1
            },
            currentPhase: 'dice_roll',
            turnNumber: 1
          };
          break;
        case 'ship_building':
          // Advance from ship building to automatic powers
          newGameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              currentPhase: 'automatic_powers'
            },
            currentPhase: 'automatic_powers'
          };
          break;
        default:
          // For dice_roll, automatic_powers, health_resolution - handled by auto-advance
          break;
      }
    }
    
    // Handle complex phase system - Build Phase
    if (currentMajorPhase === this.MajorPhase.SETUP) {
      // Both players selected species, start the game
      newGameData = this.startGamePhase(gameData);
    } else if (currentMajorPhase === this.MajorPhase.BUILD_PHASE) {
      // Build Phase step transitions
      switch (currentStep) {
        case this.BuildPhaseStep.SHIPS_THAT_BUILD:
          // Both players ready → Advance to DRAWING
          newGameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...gameData.gameData.turnData,
                currentStep: this.BuildPhaseStep.DRAWING
              }
            }
          };
          break;
        case this.BuildPhaseStep.DRAWING:
          // Both players ready → Advance to END_OF_BUILD (auto-processes)
          newGameData = {
            ...gameData,
            gameData: {
              ...gameData.gameData,
              turnData: {
                ...gameData.gameData.turnData,
                currentStep: this.BuildPhaseStep.END_OF_BUILD
              }
            }
          };
          break;
        default:
          // Other Build Phase steps auto-advance
          break;
      }
    } else if (currentMajorPhase === this.MajorPhase.BATTLE_PHASE) {
      // Battle Phase simultaneous declaration transitions
      if (currentStep === this.BattlePhaseStep.SIMULTANEOUS_DECLARATION) {
        // Both players ready → Reveal declarations → Check if any were made
        newGameData = this.revealDeclarationsAndTransition(gameData);
      } else if (currentStep === this.BattlePhaseStep.CONDITIONAL_RESPONSE) {
        // Both players ready → Reveal responses → Move to End of Turn Resolution
        newGameData = this.revealResponsesAndResolve(gameData);
      }
    }
    
    // Clear readiness when advancing
    newGameData = this.clearPlayerReadiness(newGameData);
    
    return newGameData;
  }
  
  // Reveal simultaneous declarations and transition appropriately
  static revealDeclarationsAndTransition(gameData) {
    const turnData = gameData.gameData?.turnData;
    if (!turnData) return gameData;
    
    // Check if any declarations were made
    const pendingCharges = turnData.pendingChargeDeclarations || {};
    const pendingSolar = turnData.pendingSOLARPowerDeclarations || {};
    
    let anyDeclarations = false;
    for (const playerId in pendingCharges) {
      if (pendingCharges[playerId] && pendingCharges[playerId].length > 0) {
        anyDeclarations = true;
        break;
      }
    }
    if (!anyDeclarations) {
      for (const playerId in pendingSolar) {
        if (pendingSolar[playerId] && pendingSolar[playerId].length > 0) {
          anyDeclarations = true;
          break;
        }
      }
    }
    
    // Merge pending declarations into main arrays
    const chargeDeclarations = turnData.chargeDeclarations || [];
    const solarPowerDeclarations = turnData.solarPowerDeclarations || [];
    
    for (const playerId in pendingCharges) {
      if (pendingCharges[playerId]) {
        chargeDeclarations.push(...pendingCharges[playerId]);
      }
    }
    
    for (const playerId in pendingSolar) {
      if (pendingSolar[playerId]) {
        solarPowerDeclarations.push(...pendingSolar[playerId]);
      }
    }
    
    if (!anyDeclarations) {
      // No declarations → Skip to End of Turn Resolution
      return {
        ...gameData,
        gameData: {
          ...gameData.gameData,
          turnData: {
            ...turnData,
            currentMajorPhase: this.MajorPhase.END_OF_TURN_RESOLUTION,
            currentStep: null,
            chargeDeclarations,
            solarPowerDeclarations,
            pendingChargeDeclarations: {},
            pendingSOLARPowerDeclarations: {},
            anyDeclarationsMade: false
          }
        }
      };
    } else {
      // Declarations made → Move to Conditional Response
      return {
        ...gameData,
        gameData: {
          ...gameData.gameData,
          turnData: {
            ...turnData,
            currentMajorPhase: this.MajorPhase.BATTLE_PHASE,
            currentStep: this.BattlePhaseStep.CONDITIONAL_RESPONSE,
            chargeDeclarations,
            solarPowerDeclarations,
            pendingChargeDeclarations: {}, // Clear for response step
            pendingSOLARPowerDeclarations: {}, // Clear for response step
            anyDeclarationsMade: true
          }
        }
      };
    }
  }
  
  // Reveal responses and move to End of Turn Resolution
  static revealResponsesAndResolve(gameData) {
    const turnData = gameData.gameData?.turnData;
    if (!turnData) return gameData;
    
    // Merge pending responses into main arrays
    const pendingCharges = turnData.pendingChargeDeclarations || {};
    const pendingSolar = turnData.pendingSOLARPowerDeclarations || {};
    
    const chargeDeclarations = turnData.chargeDeclarations || [];
    const solarPowerDeclarations = turnData.solarPowerDeclarations || [];
    
    for (const playerId in pendingCharges) {
      if (pendingCharges[playerId]) {
        chargeDeclarations.push(...pendingCharges[playerId]);
      }
    }
    
    for (const playerId in pendingSolar) {
      if (pendingSolar[playerId]) {
        solarPowerDeclarations.push(...pendingSolar[playerId]);
      }
    }
    
    return {
      ...gameData,
      gameData: {
        ...gameData.gameData,
        turnData: {
          ...turnData,
          currentMajorPhase: this.MajorPhase.END_OF_TURN_RESOLUTION,
          currentStep: null,
          chargeDeclarations,
          solarPowerDeclarations,
          pendingChargeDeclarations: {},
          pendingSOLARPowerDeclarations: {}
        }
      }
    };
  }
  
  // Start the actual game after setup
  static startGamePhase(gameData) {
    const turnNumber = 1;
    
    // Store health at start of turn
    const healthAtTurnStart = {};
    gameData.players.forEach(player => {
      if (player.role === 'player') {
        healthAtTurnStart[player.id] = player.health || 25;
      }
    });
    
    return {
      ...gameData,
      status: 'active',
      gameData: {
        ...gameData.gameData,
        turnData: {
          ...gameData.gameData.turnData,
          turnNumber,
          currentMajorPhase: this.MajorPhase.BUILD_PHASE,
          currentStep: this.BuildPhaseStep.DICE_ROLL,
          accumulatedDamage: {},
          accumulatedHealing: {},
          healthAtTurnStart,
          diceRoll: null,
          linesDistributed: false,
          // Battle Phase declarations (hidden until revealed)
          chargeDeclarations: [],
          solarPowerDeclarations: [],
          pendingChargeDeclarations: {},
          pendingSOLARPowerDeclarations: {},
          anyDeclarationsMade: false,
          // Build Phase hidden declarations (revealed at Battle start)
          pendingBuildPhaseShips: {} // { playerId: [shipIds] }
        },
        phaseStartTime: new Date().toISOString()
      },
      // Update legacy fields
      currentPhase: 'build_phase',
      currentStep: this.BuildPhaseStep.DICE_ROLL
    };
  }
  
  // Roll dice for all players (DICE_ROLL step)
  static rollDice(gameData) {
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    
    return {
      ...gameData,
      gameData: {
        ...gameData.gameData,
        turnData: {
          ...gameData.gameData.turnData,
          diceRoll,
          currentStep: this.BuildPhaseStep.LINE_GENERATION
        }
      },
      currentStep: this.BuildPhaseStep.LINE_GENERATION
    };
  }
  
  // Distribute lines to players (LINE_GENERATION step)
  static distributeLines(gameData) {
    const diceRoll = gameData.gameData?.turnData?.diceRoll || 0;
    
    // Give dice roll lines to all active players
    const updatedPlayers = gameData.players.map(player => {
      if (player.role === 'player') {
        return {
          ...player,
          lines: (player.lines || 0) + diceRoll
        };
      }
      return player;
    });
    
    return {
      ...gameData,
      players: updatedPlayers,
      gameData: {
        ...gameData.gameData,
        turnData: {
          ...gameData.gameData.turnData,
          linesDistributed: true,
          currentStep: this.BuildPhaseStep.SHIPS_THAT_BUILD
        }
      },
      currentStep: this.BuildPhaseStep.SHIPS_THAT_BUILD
    };
  }
  
  // Get valid actions for current step
  static getValidActionsForCurrentStep(gameData, playerId) {
    const currentMajorPhase = gameData.gameData?.turnData?.currentMajorPhase;
    const currentStep = gameData.gameData?.turnData?.currentStep;
    const player = gameData.players.find(p => p.id === playerId);
    
    // Check for simplified game phase system first
    const simplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
    
    if (!player || player.role === 'spectator') {
      return ['message']; // Spectators can only send messages
    }
    
    // Handle simplified game phases (for Game Test Interface)
    if (simplePhase && ['setup', 'dice_roll', 'ship_building', 'automatic_powers', 'health_resolution', 'end_of_game'].includes(simplePhase)) {
      switch (simplePhase) {
        case 'setup':
          return player.faction ? ['advance_phase', 'set_ready', 'message'] : ['select_species', 'advance_phase', 'message'];
        case 'dice_roll':
          return ['roll_dice', 'advance_phase', 'set_ready', 'message'];
        case 'ship_building':
          return ['build_ship', 'save_lines', 'advance_phase', 'set_ready', 'message'];
        case 'automatic_powers':
          return ['advance_phase', 'set_ready', 'message'];
        case 'health_resolution':
          return ['advance_phase', 'set_ready', 'message'];
        case 'end_of_game':
          return ['message']; // Game is over
        default:
          return ['advance_phase', 'set_ready', 'message'];
      }
    }
    
    // Handle complex phase system (for full game)
    if (currentMajorPhase === this.MajorPhase.SETUP) {
      return player.faction ? ['set_ready', 'message'] : ['select_species', 'message'];
    }
    
    if (currentMajorPhase === this.MajorPhase.BUILD_PHASE) {
      switch (currentStep) {
        case this.BuildPhaseStep.DICE_ROLL:
        case this.BuildPhaseStep.LINE_GENERATION:
        case this.BuildPhaseStep.END_OF_BUILD:
          // Automatic steps
          return ['message'];
        case this.BuildPhaseStep.SHIPS_THAT_BUILD:
          // Use ship building powers (hidden until Battle)
          return ['use_ship_building_power', 'set_ready', 'message'];
        case this.BuildPhaseStep.DRAWING:
          // Build ships, save lines (hidden until Battle)
          return ['build_ship', 'save_lines', 'set_ready', 'message'];
        default:
          return ['set_ready', 'message'];
      }
    }
    
    if (currentMajorPhase === this.MajorPhase.BATTLE_PHASE) {
      switch (currentStep) {
        case this.BattlePhaseStep.FIRST_STRIKE:
          // Automatic (unless target selection needed)
          return ['message'];
        case this.BattlePhaseStep.SIMULTANEOUS_DECLARATION:
        case this.BattlePhaseStep.CONDITIONAL_RESPONSE:
          // Declare charges/solar powers (hidden until both ready)
          return ['declare_charge', 'use_solar_power', 'set_ready', 'message'];
        default:
          return ['set_ready', 'message'];
      }
    }
    
    return ['set_ready', 'message'];
  }
  
  // Backwards compatibility alias
  static getValidActionsForCurrentSubPhase(gameData, playerId) {
    return this.getValidActionsForCurrentStep(gameData, playerId);
  }
  
  // Check if step should advance automatically
  static shouldAutoAdvance(gameData) {
    const currentMajorPhase = gameData.gameData?.turnData?.currentMajorPhase;
    const currentStep = gameData.gameData?.turnData?.currentStep;
    const simplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
    
    // Handle simplified game phases with automatic transitions
    if (simplePhase && ['dice_roll', 'automatic_powers', 'health_resolution'].includes(simplePhase)) {
      switch (simplePhase) {
        case 'dice_roll':
          // Auto-advance when dice needs to be rolled (dice is null/missing)
          return !gameData.gameData?.diceRoll;
        case 'automatic_powers':
          // Always auto-advance automatic powers
          return true;
        case 'health_resolution':
          // Always auto-advance health resolution
          return true;
        default:
          return false;
      }
    }
    
    // Handle complex phase system (for full game)
    if (currentMajorPhase === this.MajorPhase.BUILD_PHASE) {
      switch (currentStep) {
        case this.BuildPhaseStep.DICE_ROLL:
          // Auto advance when dice needs to be rolled
          return !gameData.gameData?.turnData?.diceRoll;
        case this.BuildPhaseStep.LINE_GENERATION:
          // Auto advance when lines need to be distributed
          return !gameData.gameData?.turnData?.linesDistributed;
        case this.BuildPhaseStep.END_OF_BUILD:
          // Auto advance (always processes automatically)
          return true;
        default:
          return false;
      }
    }
    
    if (currentMajorPhase === this.MajorPhase.BATTLE_PHASE) {
      if (currentStep === this.BattlePhaseStep.FIRST_STRIKE) {
        // Auto advance (unless target selection needed - not implemented yet)
        return true;
      }
    }
    
    if (currentMajorPhase === this.MajorPhase.END_OF_TURN_RESOLUTION) {
      // Always auto advance
      return true;
    }
    
    return false;
  }
  
  // Process automatic steps
  static processAutoPhase(gameData) {
    const currentMajorPhase = gameData.gameData?.turnData?.currentMajorPhase;
    const currentStep = gameData.gameData?.turnData?.currentStep;
    const simplePhase = gameData.gameData?.currentPhase || gameData.currentPhase;
    
    // Handle simplified game phases with automatic processing
    if (simplePhase && ['dice_roll', 'automatic_powers', 'health_resolution'].includes(simplePhase)) {
      switch (simplePhase) {
        case 'dice_roll':
          return this.processSimpleDiceRoll(gameData);
        case 'automatic_powers':
          return this.processAutomaticPowers(gameData);
        case 'health_resolution':
          return this.processHealthResolution(gameData);
        default:
          return gameData;
      }
    }
    
    // Handle complex phase system (for full game)
    if (currentMajorPhase === this.MajorPhase.BUILD_PHASE) {
      switch (currentStep) {
        case this.BuildPhaseStep.DICE_ROLL:
          return this.rollDice(gameData);
        case this.BuildPhaseStep.LINE_GENERATION:
          return this.distributeLines(gameData);
        case this.BuildPhaseStep.END_OF_BUILD:
          return this.processEndOfBuild(gameData);
        default:
          return gameData;
      }
    }
    
    if (currentMajorPhase === this.MajorPhase.BATTLE_PHASE) {
      if (currentStep === this.BattlePhaseStep.FIRST_STRIKE) {
        return this.processFirstStrike(gameData);
      }
    }
    
    if (currentMajorPhase === this.MajorPhase.END_OF_TURN_RESOLUTION) {
      return this.processEndOfTurnResolution(gameData);
    }
    
    return gameData;
  }
  
  // Process END_OF_BUILD step (checks Chronoswarm, reveals ships at Battle start)
  static processEndOfBuild(gameData) {
    console.log("⚙️ Processing END_OF_BUILD step");
    
    // TODO: Check for Chronoswarm trigger (extra build phase)
    // For now, always advance to Battle Phase
    
    return {
      ...gameData,
      gameData: {
        ...gameData.gameData,
        turnData: {
          ...gameData.gameData.turnData,
          currentMajorPhase: this.MajorPhase.BATTLE_PHASE,
          currentStep: this.BattlePhaseStep.FIRST_STRIKE
        }
      }
    };
  }
  
  // Process FIRST_STRIKE step (automatic unless target selection needed)
  static processFirstStrike(gameData) {
    console.log("⚔️ Processing FIRST_STRIKE step");
    
    // 🎭 REVEAL: Build Phase ships are now visible!
    // (pendingBuildPhaseShips would be merged into main ships array here)
    
    // TODO: Process First Strike powers (e.g., Guardian)
    // For now, auto-advance to Simultaneous Declaration
    
    return {
      ...gameData,
      gameData: {
        ...gameData.gameData,
        turnData: {
          ...gameData.gameData.turnData,
          currentStep: this.BattlePhaseStep.SIMULTANEOUS_DECLARATION,
          // Clear pending build phase ships (now revealed)
          pendingBuildPhaseShips: {}
        }
      }
    };
  }
  
  // Process END_OF_TURN_RESOLUTION (apply all damage/healing, check win conditions)
  static processEndOfTurnResolution(gameData) {
    console.log("❤️ Processing END_OF_TURN_RESOLUTION");
    
    const turnData = gameData.gameData?.turnData;
    const currentTurn = turnData?.turnNumber || 1;
    
    // TODO: Apply all queued triggered effects
    // TODO: Apply continuous automatic effects
    // TODO: Update player health
    // TODO: Check win conditions
    
    // For now, just start a new turn
    const newTurnNumber = currentTurn + 1;
    
    return {
      ...gameData,
      gameData: {
        ...gameData.gameData,
        turnData: {
          turnNumber: newTurnNumber,
          currentMajorPhase: this.MajorPhase.BUILD_PHASE,
          currentStep: this.BuildPhaseStep.DICE_ROLL,
          accumulatedDamage: {},
          accumulatedHealing: {},
          healthAtTurnStart: {},
          diceRoll: null,
          linesDistributed: false,
          chargeDeclarations: [],
          solarPowerDeclarations: [],
          pendingChargeDeclarations: {},
          pendingSOLARPowerDeclarations: {},
          anyDeclarationsMade: false,
          pendingBuildPhaseShips: {}
        }
      }
    };
  }

  // Process simplified dice roll for both players automatically
  static processSimpleDiceRoll(gameData) {
    const diceRoll = Math.floor(Math.random() * 6) + 1;
    console.log("🎲 Processing automatic dice roll for all players:", diceRoll);
    
    // Give lines to ALL active players
    const updatedPlayers = gameData.players.map(player => {
      if (player.role === 'player') {
        return {
          ...player,
          lines: (player.lines || 0) + diceRoll
        };
      }
      return player;
    });
    
    const updatedGameData = {
      ...gameData,
      players: updatedPlayers,
      gameData: {
        ...gameData.gameData,
        diceRoll,
        currentPhase: 'ship_building'
      },
      currentPhase: 'ship_building'
    };

    // Add system message about dice roll
    updatedGameData.actions.push({
      playerId: "system",
      playerName: "System",
      actionType: "system",
      content: `🎲 Dice rolled: ${diceRoll}! All players gained ${diceRoll} lines.`,
      timestamp: new Date().toISOString()
    });

    return this.clearPlayerReadiness(updatedGameData);
  }

  // Process automatic powers (ship effects, damage, healing)
  static processAutomaticPowers(gameData) {
    console.log("⚔️ Processing automatic powers phase");
    
    const activePlayers = gameData.players.filter(p => p.role === 'player');
    
    // Track damage and healing per player
    const playerEffects = {};
    activePlayers.forEach(player => {
      playerEffects[player.id] = { 
        damageToOpponent: 0, 
        healingToSelf: 0,
        shipDetails: []
      };
    });
    
    // Calculate effects from each player's ships
    activePlayers.forEach(player => {
      const playerShips = gameData.gameData?.ships?.[player.id] || [];
      const activeShips = playerShips.filter(ship => !ship.isDestroyed);
      
      activeShips.forEach(ship => {
        // Process ship powers properly
        // Defender: heals owner by 1
        // Fighter: deals 1 damage to opponent
        
        // Normalize ship ID for consistent checking (support both canonical and legacy IDs)
        const shipIdNormalized = (ship.shipId || '').toUpperCase();
        const shipIdLower = (ship.shipId || '').toLowerCase();
        
        // Check for healing powers (Defender = 'DEF' or legacy 'defender')
        if (shipIdNormalized === 'DEF' || shipIdLower === 'defender') {
          playerEffects[player.id].healingToSelf += 1;
          playerEffects[player.id].shipDetails.push(`${ship.name} healed 1`);
        } 
        // Check for damage powers (Fighter = 'FIG' or legacy 'fighter'/'human_fighter')
        else if (shipIdNormalized === 'FIG' || shipIdLower === 'fighter' || shipIdLower === 'human_fighter' || ship.damageValue > 0) {
          const damage = ship.damageValue || 1; // Default to 1 for legacy fighters without damageValue
          playerEffects[player.id].damageToOpponent += damage;
          playerEffects[player.id].shipDetails.push(`${ship.name} dealt ${damage} damage`);
        }
      });
    });

    const updatedGameData = {
      ...gameData,
      gameData: {
        ...gameData.gameData,
        currentPhase: 'health_resolution',
        powerResults: playerEffects,
        processedAt: new Date().toISOString()
      },
      currentPhase: 'health_resolution'
    };

    // Add system message about power effects
    const messages = [];
    activePlayers.forEach(player => {
      const effects = playerEffects[player.id];
      if (effects.damageToOpponent > 0 || effects.healingToSelf > 0) {
        const parts = [];
        if (effects.damageToOpponent > 0) parts.push(`dealt ${effects.damageToOpponent} damage`);
        if (effects.healingToSelf > 0) parts.push(`healed ${effects.healingToSelf}`);
        messages.push(`${player.name}: ${parts.join(', ')}`);
      }
    });
    
    if (messages.length > 0) {
      updatedGameData.actions.push({
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `⚡ Automatic Powers - ${messages.join(' | ')}`,
        timestamp: new Date().toISOString()
      });
    }

    return this.clearPlayerReadiness(updatedGameData);
  }

  // Process health resolution and advance to next turn
  static processHealthResolution(gameData) {
    console.log("❤️ Processing health resolution phase");
    
    const currentTurn = gameData.gameData?.turnNumber || 1;
    const activePlayers = gameData.players.filter(p => p.role === 'player');
    const powerResults = gameData.gameData?.powerResults || {};
    
    // Apply damage and healing to player health
    const updatedPlayers = gameData.players.map(player => {
      if (player.role !== 'player') return player;
      
      const effects = powerResults[player.id];
      if (!effects) return player;
      
      let newHealth = player.health || 25;
      
      // Apply healing to self
      if (effects.healingToSelf > 0) {
        newHealth = Math.min(35, newHealth + effects.healingToSelf);
      }
      
      // Apply damage from ALL opponents
      activePlayers.forEach(opponent => {
        if (opponent.id !== player.id) {
          const opponentEffects = powerResults[opponent.id];
          if (opponentEffects && opponentEffects.damageToOpponent > 0) {
            newHealth = Math.max(0, newHealth - opponentEffects.damageToOpponent);
          }
        }
      });
      
      return {
        ...player,
        health: newHealth
      };
    });
    
    // Check for win conditions
    let gameOverMessage = null;
    let winner = null;
    const playersAlive = updatedPlayers.filter(p => p.role === 'player' && (p.health || 0) > 0);
    
    let nextPhase = 'dice_roll';
    let nextTurn = currentTurn + 1;
    
    if (playersAlive.length <= 1 && activePlayers.length >= 2) {
      // Game over condition
      nextPhase = 'end_of_game';
      nextTurn = currentTurn;
      winner = playersAlive[0] || null;
      gameOverMessage = winner ? `${winner.name} wins!` : "Game ended in a draw!";
    }

    const updatedGameData = {
      ...gameData,
      players: updatedPlayers,
      gameData: {
        ...gameData.gameData,
        currentPhase: nextPhase,
        turnNumber: nextTurn,
        // Clear dice roll and power results for new turn
        diceRoll: nextPhase === 'dice_roll' ? null : gameData.gameData.diceRoll,
        powerResults: nextPhase === 'dice_roll' ? null : powerResults
      },
      currentPhase: nextPhase,
      turnNumber: nextTurn,
      winner
    };

    // Add system message about health changes and turn advancement
    const healthMessages = [];
    updatedPlayers.filter(p => p.role === 'player').forEach(player => {
      const oldPlayer = gameData.players.find(p => p.id === player.id);
      const oldHealth = oldPlayer?.health || 25;
      const newHealth = player.health || 25;
      if (oldHealth !== newHealth) {
        const change = newHealth - oldHealth;
        const changeStr = change > 0 ? `+${change}` : `${change}`;
        healthMessages.push(`${player.name}: ${oldHealth} → ${newHealth} (${changeStr})`);
      }
    });
    
    if (healthMessages.length > 0) {
      updatedGameData.actions.push({
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `❤️ Health Resolution - ${healthMessages.join(' | ')}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Add system message about turn advancement or game end
    if (gameOverMessage) {
      updatedGameData.actions.push({
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `🏁 Game Over! ${gameOverMessage}`,
        timestamp: new Date().toISOString()
      });
    } else {
      updatedGameData.actions.push({
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `✅ Turn ${currentTurn} completed. Starting Turn ${nextTurn}...`,
        timestamp: new Date().toISOString()
      });
      
      console.log(`🔄 Turn advancement: ${currentTurn} → ${nextTurn}, Phase: ${nextPhase}, DiceRoll cleared: ${updatedGameData.gameData.diceRoll === null}`);
    }

    return this.clearPlayerReadiness(updatedGameData);
  }
}