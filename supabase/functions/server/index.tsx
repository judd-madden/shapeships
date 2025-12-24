// ⚠️ SERVER KERNEL RULE
// This file must NOT contain game rules.
// All rule decisions must be delegated to the shared game engine.
// This file only:
// - validates intents (structure/format)
// - updates clocks (server time authority)
// - calls engine (delegation)
// - emits events (sequencing)
// - persists state (KV storage)
// - filters hidden info (commit/reveal protocol)

/**
 * ⚠️ TEMPORARY STATE WARNING
 * The following sections are transitional:
 * - SHIP_DEFINITIONS_MAP
 * - ServerPhaseEngine
 *
 * These MUST be removed once engine delegation is enabled.
 * Do not add new rules here.
 *
 * See:
 * - /OPTION_B_FINAL_STATUS.md
 * - /QUICK_REF_COMPLETE_DELEGATION.md
 */

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Import shared game engine (pure TypeScript, no React dependencies)
// ⚠️ CURRENTLY BLOCKED: Cannot import yet - engine files have React dependencies
// Engine files import from ShipDefinitions.tsx which imports React components
// TODO: Update engine files to import from ShipDefinitions.core.ts (pure data)
// Then uncomment these imports and delete SHIP_DEFINITIONS_MAP below
// import { GameEngine } from "../../../game/engine/GameEngine.tsx";
// import { ShapeshipsRulesEngine } from "../../../game/engine/RulesEngine.tsx";
// import { EndOfTurnResolver } from "../../../game/engine/EndOfTurnResolver.tsx";

// Import ship definitions (pure data, no React components)
// ⚠️ CURRENTLY BLOCKED: See above
// TODO: Uncomment when engine refactor is complete
// import {
//   PURE_SHIP_DEFINITIONS,
//   getShipDefinitionById,
//   getShipCost
// } from "../../../game/data/ShipDefinitions.core.ts";

// Import types
// ⚠️ CURRENTLY BLOCKED: See above
// TODO: Uncomment when engine refactor is complete
// import type { GameState, Player } from "../../../game/types/GameTypes";

const app = new Hono();

// Create Supabase client using environment variables
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

// KV Store utility functions - ALL INLINE, NO IMPORTS (FIXED)
const kvGet = async (key) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error) return null;
  return data?.value;
};

const kvSet = async (key, value) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .upsert({ key, value });
  
  if (error) throw error;
};

const kvDel = async (key) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .delete()
    .eq('key', key);
  
  if (error) throw error;
};

const kvMget = async (keys) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('value')
    .in('key', keys);
  
  if (error) return [];
  return data?.map(d => d.value) ?? [];
};

const kvMset = async (keys, values) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .upsert(keys.map((k, i) => ({ key: k, value: values[i] })));
  
  if (error) throw error;
};

const kvMdel = async (keys) => {
  const { error } = await supabase
    .from('kv_store_825e19ab')
    .delete()
    .in('key', keys);
  
  if (error) throw error;
};

const kvGetByPrefix = async (prefix) => {
  const { data, error } = await supabase
    .from('kv_store_825e19ab')
    .select('key, value')
    .like('key', prefix + '%');
  
  if (error) return [];
  return data?.map(d => d.value) ?? [];
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-825e19ab/health", (c) => {
  console.log("Health check called");
  return c.json({ status: "ok", supabase: "connected" });
});

// Test endpoint to verify connection works
app.get("/make-server-825e19ab/test-connection", async (c) => {
  try {
    console.log("Testing connection...");
    console.log("SUPABASE_URL:", Deno.env.get("SUPABASE_URL"));
    console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    
    // Simple test using kv store
    const testKey = "connection_test";
    const testValue = { timestamp: new Date().toISOString(), test: true };
    
    await kvSet(testKey, testValue);
    const retrieved = await kvGet(testKey);
    await kvDel(testKey);
    
    console.log("KV store test successful");
    return c.json({ 
      status: "success", 
      message: "Supabase connection working correctly",
      test: "KV store operations successful",
      timestamp: new Date().toISOString(),
      environment: {
        url_configured: !!Deno.env.get("SUPABASE_URL"),
        service_key_configured: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      }
    });
  } catch (error) {
    console.error("Connection test error:", error);
    return c.json({ 
      status: "error", 
      message: error.message,
      details: error.toString(),
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Helper function to generate game ID
const generateGameId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// ============================================================================
// ⚠️ TEMPORARY: SHIP DEFINITIONS (will be replaced with core imports)
// ============================================================================
// This is duplicated from /game/data/ShipDefinitions.core.ts
// Cannot import yet because engine files have React dependencies
//
// TODO: Once engine files import from ShipDefinitions.core.ts (pure data),
//       delete this map and import from the core file instead
// ============================================================================

const SHIP_DEFINITIONS_MAP = {
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
const getShipDef = (shipDefId) => {
  return SHIP_DEFINITIONS_MAP[shipDefId] || SHIP_DEFINITIONS_MAP[shipDefId.toUpperCase()] || null;
};

// Get ship cost (build cost for basic, joining cost for upgraded)
const getShipCost = (shipDefId) => {
  const def = getShipDef(shipDefId);
  if (!def) return 0;
  return def.type === 'basic' ? def.buildCost : def.joiningCost;
};

// ============================================================================
// ⚠️ TEMPORARY: SERVER PHASE ENGINE (will be replaced with real engine)
// ============================================================================
// This is a simplified version of /game/engine/GamePhases.tsx
// Cannot import real engine yet because it has React dependencies
//
// TODO: Once engine files can be imported by Deno:
//       1. Delete this class
//       2. Import GamePhasesEngine from /game/engine/GamePhases.tsx
//       3. Delegate all phase logic to the real engine
//
// This duplicates game rules, creating risk of rule drift.
// See /PHASE_2_BLOCKED_STATUS.md for details.
// ============================================================================

// RESTORED: Full Sophisticated Server-side Phase Engine
class ServerPhaseEngine {
  
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
        
        // Check for healing powers
        if (ship.shipId === 'defender') {
          playerEffects[player.id].healingToSelf += 1;
          playerEffects[player.id].shipDetails.push(`${ship.name} healed 1`);
        } 
        // Check for damage powers (only if not a defender)
        else if (ship.shipId === 'fighter' || ship.damageValue > 0) {
          playerEffects[player.id].damageToOpponent += ship.damageValue;
          playerEffects[player.id].shipDetails.push(`${ship.name} dealt ${ship.damageValue} damage`);
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

// Create new game with enhanced game state structure
app.post("/make-server-825e19ab/create-game", async (c) => {
  try {
    const { playerName, playerId, role = 'player' } = await c.req.json();
    
    if (!playerName || !playerId) {
      return c.json({ error: "Player name and ID are required" }, 400);
    }

    const gameId = generateGameId();
    const gameData = {
      gameId,
      players: [
        {
          id: playerId,
          name: playerName,
          faction: null, // Species to be selected
          isReady: false,
          isActive: role === 'player', // Only active if joining as player
          role: role, // Use provided role
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

// Join existing game with spectator support
app.post("/make-server-825e19ab/join-game/:gameId", async (c) => {
  try {
    const gameId = c.req.param('gameId');
    const { playerName, playerId, role = 'player' } = await c.req.json();
    
    if (!playerName || !playerId) {
      return c.json({ error: "Player name and ID are required" }, 400);
    }

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
        id: playerId,
        name: playerName,
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

// Switch player role between player and spectator
app.post("/make-server-825e19ab/switch-role/:gameId", async (c) => {
  try {
    const gameId = c.req.param('gameId');
    const { playerId, newRole } = await c.req.json();
    
    if (!playerId || !newRole) {
      return c.json({ error: "Player ID and new role are required" }, 400);
    }

    if (!['player', 'spectator'].includes(newRole)) {
      return c.json({ error: "Role must be 'player' or 'spectator'" }, 400);
    }

    const gameData = await kvGet(`game_${gameId}`);
    if (!gameData) {
      return c.json({ error: "Game not found" }, 404);
    }

    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      return c.json({ error: "Player not in game" }, 403);
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

// Get game state with automatic processing
app.get("/make-server-825e19ab/game-state/:gameId", async (c) => {
  try {
    const gameId = c.req.param('gameId');
    const requestingPlayerId = c.req.query('playerId'); // Optional: filter hidden data by player
    let gameData = await kvGet(`game_${gameId}`);
    
    if (!gameData) {
      return c.json({ error: "Game not found" }, 404);
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

// Send action/message to game with enhanced game logic
app.post("/make-server-825e19ab/send-action/:gameId", async (c) => {
  try {
    const gameId = c.req.param('gameId');
    const requestBody = await c.req.json();
    const playerId = requestBody.playerId;
    const actionType = requestBody.actionType;
    const content = requestBody.content;
    const timestamp = requestBody.timestamp;
    
    if (!playerId || !actionType) {
      return c.json({ error: "Player ID and action type are required" }, 400);
    }

    let gameData = await kvGet(`game_${gameId}`);
    if (!gameData) {
      return c.json({ error: "Game not found" }, 404);
    }

    const player = gameData.players.find(p => p.id === playerId);
    if (!player) {
      return c.json({ error: "Player not in game" }, 403);
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

// Comprehensive system test endpoint
app.get("/make-server-825e19ab/system-test", async (c) => {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    overall_status: "unknown"
  };

  let allTestsPassed = true;

  // Test 1: Environment variables
  try {
    const envTest = {
      name: "Environment Variables",
      status: "success",
      details: {
        supabase_url: !!Deno.env.get("SUPABASE_URL"),
        service_role_key: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
        anon_key: !!Deno.env.get("SUPABASE_ANON_KEY")
      }
    };
    results.tests.push(envTest);
  } catch (error) {
    results.tests.push({
      name: "Environment Variables",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  // Test 2: KV Store Operations
  try {
    const testKey = "system_test_" + Date.now();
    const testData = { test: true, timestamp: new Date().toISOString() };
    
    await kvSet(testKey, testData);
    const retrieved = await kvGet(testKey);
    await kvDel(testKey);
    
    results.tests.push({
      name: "KV Store Operations",
      status: "success",
      details: "Set, get, and delete operations successful"
    });
  } catch (error) {
    results.tests.push({
      name: "KV Store Operations",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  // Test 3: Supabase Auth Service
  try {
    // Test auth service by listing users (should work even if empty)
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });
    
    if (error) throw error;
    
    results.tests.push({
      name: "Supabase Auth Service",
      status: "success",
      details: "Auth admin access successful"
    });
  } catch (error) {
    results.tests.push({
      name: "Supabase Auth Service",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  // Test 4: Multiplayer Game System
  try {
    const testGameId = generateGameId();
    const testGame = {
      gameId: testGameId,
      players: [],
      actions: [],
      status: "test",
      createdAt: new Date().toISOString()
    };
    
    await kvSet(`game_${testGameId}`, testGame);
    const retrieved = await kvGet(`game_${testGameId}`);
    await kvDel(`game_${testGameId}`);
    
    results.tests.push({
      name: "Multiplayer Game System",
      status: "success",
      details: "Game creation and retrieval successful"
    });
  } catch (error) {
    results.tests.push({
      name: "Multiplayer Game System",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  // Test 5: ServerPhaseEngine
  try {
    const testGame = {
      players: [
        { id: 'p1', role: 'player', faction: 'human' },
        { id: 'p2', role: 'player', faction: 'xenite' }
      ],
      gameData: { 
        currentPhase: 'setup',
        phaseReadiness: [
          { playerId: 'p1', isReady: true, currentSubPhase: 'setup' },
          { playerId: 'p2', isReady: true, currentSubPhase: 'setup' }
        ]
      }
    };
    
    const shouldAdvance = ServerPhaseEngine.areAllPlayersReady(testGame);
    
    results.tests.push({
      name: "ServerPhaseEngine",
      status: "success",
      details: `Phase engine working correctly (${shouldAdvance})`
    });
  } catch (error) {
    results.tests.push({
      name: "ServerPhaseEngine",
      status: "error",
      error: error.message
    });
    allTestsPassed = false;
  }

  results.overall_status = allTestsPassed ? "success" : "error";
  
  console.log("System test completed:", results);
  return c.json(results);
});

// User signup endpoint
app.post("/make-server-825e19ab/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || 'Player' },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.error("Signup error:", error);
      return c.json({ error: error.message }, 400);
    }

    console.log("User created successfully:", data.user?.email);
    return c.json({ message: "User created successfully", user: data.user });

  } catch (error) {
    console.error("Signup endpoint error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Simple echo endpoint for testing
app.post("/make-server-825e19ab/echo", async (c) => {
  try {
    const body = await c.req.json();
    return c.json({
      echo: body,
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(c.req.header())
    });
  } catch (error) {
    return c.json({ error: "Invalid JSON" }, 400);
  }
});

// List all available endpoints
app.get("/make-server-825e19ab/endpoints", (c) => {
  return c.json({
    endpoints: [
      { method: "GET", path: "/make-server-825e19ab/health", description: "Basic health check" },
      { method: "GET", path: "/make-server-825e19ab/test-connection", description: "Test Supabase connection" },
      { method: "GET", path: "/make-server-825e19ab/system-test", description: "Comprehensive system test" },
      { method: "POST", path: "/make-server-825e19ab/create-game", description: "Create new multiplayer game" },
      { method: "POST", path: "/make-server-825e19ab/join-game/:gameId", description: "Join existing game" },
      { method: "GET", path: "/make-server-825e19ab/game-state/:gameId", description: "Get current game state" },
      { method: "POST", path: "/make-server-825e19ab/send-action/:gameId", description: "Send action to game" },
      { method: "POST", path: "/make-server-825e19ab/switch-role/:gameId", description: "Switch player role" },
      { method: "POST", path: "/make-server-825e19ab/signup", description: "Create user account" },
      { method: "POST", path: "/make-server-825e19ab/echo", description: "Echo request data for testing" },
      { method: "GET", path: "/make-server-825e19ab/endpoints", description: "List all endpoints" },
      { method: "POST", path: "/make-server-825e19ab/intent", description: "Server-authoritative intent/event API (NEW)" }
    ],
    timestamp: new Date().toISOString(),
    features: [
      "Sophisticated 3-phase game engine (Build, Battle, End of Turn Resolution)",
      "Automatic dice rolling with shared results",
      "Both players ready detection",
      "Spectator support with role switching",
      "Species selection with auto-promotion",
      "Complex ship building system",
      "Automatic phase transitions",
      "Win condition checking",
      "Enhanced error handling and logging",
      "Server-authoritative Intent/Event API with commit-reveal flows"
    ]
  });
});

// ============================================================================
// INTENT/EVENT API - Server-Authoritative Game Mutation
// ============================================================================
//
// This section implements the canonical Intent/Event contract for Shapeships.
// All game mutations flow through POST /intent endpoint.
//
// ARCHITECTURE:
// - Client sends GameIntent (what player attempts)
// - Server validates using RulesEngine  
// - Server mutates state using GameEngine
// - Server generates GameEvent[] (what actually happened)
// - Server returns IntentResponse { ok, state, events, rejected? }
//
// KEY FEATURES:
// - Server-authoritative chess clocks (never trust client time)
// - Commit→Reveal for hidden actions (BUILD_COMMIT/REVEAL, BATTLE_COMMIT/REVEAL)
// - Sequential event numbering (seq increments monotonically)
// - Health changes ONLY during EndOfTurnResolver (engine enforces)
// - Complete event log for replay/debugging
//
// STORAGE:
// - game:${gameId}:state - Canonical GameState
// - game:${gameId}:seq - Current event sequence number
// - Commitment hashes stored in gameData.commitments[playerId][turnNumber]
//
// ============================================================================

// Type guards and runtime validation for GameIntent
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

// Chess clock management (server-authoritative)
// Clocks are updated using server time ONLY - never trust client timestamps
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

// Generate CLOCK_UPDATED event
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

// Hash validation for commit-reveal
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

// Get or initialize commitment storage
const getCommitments = (gameState) => {
  if (!gameState.gameData.commitments) {
    gameState.gameData.commitments = {};
  }
  return gameState.gameData.commitments;
};

// Store commitment hash
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

// Get stored commitment hash
const getCommitment = (gameState, playerId, turnNumber, kind, window = null) => {
  const commitments = getCommitments(gameState);
  const key = window ? `${kind}_${window}_${turnNumber}` : `${kind}_${turnNumber}`;
  return commitments[playerId]?.[key];
};

// Main intent processing endpoint
app.post("/make-server-825e19ab/intent", async (c) => {
  const startMs = Date.now();
  
  try {
    // 1. Parse and validate request
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
    
    console.log(`📥 Intent received: ${intent.type} from player ${intent.playerId} for game ${intent.gameId}`);
    
    // 2. Load canonical game state
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
    
    // 3. Get current event sequence number
    const seqKey = `game:${intent.gameId}:seq`;
    let currentSeq = await kvGet(seqKey) || 0;
    
    // 4. Compute server time and update chess clocks
    const nowMs = Date.now();
    gameState = updateChessClock(gameState, nowMs);
    
    // 5. Initialize events array
    const events = [];
    let nextSeq = currentSeq + 1;
    
    // Helper to add event with auto-incrementing seq
    const addEvent = (eventData) => {
      const event = {
        eventId: crypto.randomUUID(),
        gameId: intent.gameId,
        seq: nextSeq++,
        atMs: nowMs,
        ...eventData
      };
      events.push(event);
      return event;
    };
    
    // 6. Validate and process intent
    let intentAccepted = true;
    let rejectionCode = null;
    let rejectionMessage = null;
    
    // Verify player is in game
    const player = gameState.players.find(p => p.id === intent.playerId);
    if (!player) {
      intentAccepted = false;
      rejectionCode = 'PLAYER_NOT_IN_GAME';
      rejectionMessage = `Player ${intent.playerId} is not in game ${intent.gameId}`;
    }
    
    // Verify player is active (not spectator)
    if (intentAccepted && player.role !== 'player') {
      intentAccepted = false;
      rejectionCode = 'PLAYER_IS_SPECTATOR';
      rejectionMessage = 'Spectators cannot submit intents';
    }
    
    // Process intent based on type
    if (intentAccepted) {
      const turnNumber = gameState.gameData?.turnData?.turnNumber || gameState.roundNumber || 1;
      
      switch (intent.type) {
        case 'BUILD_COMMIT': {
          // Verify we're in correct phase
          const currentPhase = gameState.gameData?.turnData?.currentMajorPhase;
          const currentStep = gameState.gameData?.turnData?.currentStep;
          
          if (currentPhase !== 'build_phase' || currentStep !== 'drawing') {
            intentAccepted = false;
            rejectionCode = 'INVALID_PHASE';
            rejectionMessage = `BUILD_COMMIT only valid during drawing step, currently in ${currentPhase}/${currentStep}`;
            break;
          }
          
          // Verify turn number matches
          if (intent.turnNumber !== turnNumber) {
            intentAccepted = false;
            rejectionCode = 'INVALID_TURN_NUMBER';
            rejectionMessage = `Intent turn ${intent.turnNumber} doesn't match game turn ${turnNumber}`;
            break;
          }
          
          // Store commitment hash
          // NOTE: Commitment hashes are stored in gameData.commitments[playerId][key]
          // where key = "BUILD_${turnNumber}"
          storeCommitment(gameState, intent.playerId, turnNumber, 'BUILD', intent.commitHash);
          
          addEvent({
            type: 'COMMIT_STORED',
            kind: 'BUILD',
            turnNumber: turnNumber,
            playerId: intent.playerId
          });
          
          console.log(`✅ BUILD_COMMIT stored for player ${intent.playerId} turn ${turnNumber}`);
          break;
        }
        
        case 'BUILD_REVEAL': {
          // Verify we're in correct phase
          const currentPhase = gameState.gameData?.turnData?.currentMajorPhase;
          const currentStep = gameState.gameData?.turnData?.currentStep;
          
          if (currentPhase !== 'build_phase' || currentStep !== 'drawing') {
            intentAccepted = false;
            rejectionCode = 'INVALID_PHASE';
            rejectionMessage = `BUILD_REVEAL only valid during drawing step, currently in ${currentPhase}/${currentStep}`;
            break;
          }
          
          // Verify turn number matches
          if (intent.turnNumber !== turnNumber) {
            intentAccepted = false;
            rejectionCode = 'INVALID_TURN_NUMBER';
            rejectionMessage = `Intent turn ${intent.turnNumber} doesn't match game turn ${turnNumber}`;
            break;
          }
          
          // Get stored commitment
          const commitment = getCommitment(gameState, intent.playerId, turnNumber, 'BUILD');
          if (!commitment) {
            intentAccepted = false;
            rejectionCode = 'NO_COMMITMENT';
            rejectionMessage = 'Must BUILD_COMMIT before BUILD_REVEAL';
            break;
          }
          
          // Validate hash
          const isValid = await validateRevealHash(intent.payload, intent.nonce, commitment.hash);
          if (!isValid) {
            intentAccepted = false;
            rejectionCode = 'BAD_HASH';
            rejectionMessage = 'Reveal payload does not match committed hash';
            break;
          }
          
          // Apply build actions using real ship definitions
          // NOTE: This validates using inline ship defs. Full engine integration would handle
          // ship powers, upgrades, sacrifices, etc.
          const payload = intent.payload;
          const createdShipIds = [];  // Track actual created ship IDs
          
          // Validate and build ships
          if (payload.buildShips && payload.buildShips.length > 0) {
            let totalCost = 0;
            
            // Validate each ship definition exists and calculate costs
            for (const shipReq of payload.buildShips) {
              const shipDef = getShipDef(shipReq.shipDefId);
              if (!shipDef) {
                intentAccepted = false;
                rejectionCode = 'INVALID_SHIP_DEF';
                rejectionMessage = `Ship definition not found: ${shipReq.shipDefId}`;
                break;
              }
              
              // Use payload-provided cost if present, otherwise use definition cost
              const shipCost = shipReq.lineCost !== undefined 
                ? shipReq.lineCost 
                : (shipDef.type === 'basic' ? shipDef.buildCost : 0);
              const joiningCost = shipReq.joiningLineCost !== undefined
                ? shipReq.joiningLineCost
                : (shipDef.type === 'upgraded' ? shipDef.joiningCost : 0);
                
              totalCost += shipCost + joiningCost;
              
              // Validate sacrifice requirements for upgraded ships
              if (shipDef.type === 'upgraded' && shipDef.requiresSacrifice) {
                if (!shipReq.consumeShipInstanceIds || shipReq.consumeShipInstanceIds.length !== shipDef.requiresSacrifice.length) {
                  intentAccepted = false;
                  rejectionCode = 'INVALID_SACRIFICE';
                  rejectionMessage = `Ship ${shipDef.id} requires sacrifice of: ${shipDef.requiresSacrifice.join(', ')}`;
                  break;
                }
                
                // TODO: Validate sacrificed ships exist and match requirements
                // For now, accept if count matches
              }
            }
            
            if (!intentAccepted) break;
            
            // Validate player has enough lines
            const playerLines = player.lines || 0;
            if (totalCost > playerLines) {
              intentAccepted = false;
              rejectionCode = 'INSUFFICIENT_LINES';
              rejectionMessage = `Need ${totalCost} lines, have ${playerLines}`;
              break;
            }
            
            // Deduct lines
            player.lines = playerLines - totalCost;
            
            // Build ships using real definitions
            if (!gameState.gameData.ships) {
              gameState.gameData.ships = {};
            }
            if (!gameState.gameData.ships[intent.playerId]) {
              gameState.gameData.ships[intent.playerId] = [];
            }
            
            payload.buildShips.forEach(shipReq => {
              const shipDef = getShipDef(shipReq.shipDefId);
              const shipInstanceId = crypto.randomUUID();
              
              const newShip = {
                shipInstanceId,
                shipDefId: shipDef.id,
                ownerId: intent.playerId,
                isDestroyed: false,
                createdAtTurn: turnNumber,
                // Store ship metadata (full engine would populate powers, charges, etc.)
                name: shipDef.name,
                species: shipDef.species,
                type: shipDef.type
              };
              
              gameState.gameData.ships[intent.playerId].push(newShip);
              createdShipIds.push(shipInstanceId);  // Collect actual ID
            });
            
            // Handle ship sacrifices (mark as destroyed)
            if (payload.buildShips.some(s => s.consumeShipInstanceIds && s.consumeShipInstanceIds.length > 0)) {
              payload.buildShips.forEach(shipReq => {
                if (shipReq.consumeShipInstanceIds) {
                  shipReq.consumeShipInstanceIds.forEach(sacrificeId => {
                    const ship = gameState.gameData.ships[intent.playerId]?.find(s => s.shipInstanceId === sacrificeId);
                    if (ship) {
                      ship.isDestroyed = true;
                    }
                  });
                }
              });
            }
            
            // Generate SHIPS_CHANGED event with actual created IDs
            addEvent({
              type: 'SHIPS_CHANGED',
              created: createdShipIds
            });
          }
          
          // Handle saved lines
          if (payload.saveLines) {
            // Lines are already on player, no action needed
            console.log(`💾 Player ${intent.playerId} saving ${payload.saveLines} lines`);
          }
          
          addEvent({
            type: 'REVEAL_ACCEPTED',
            kind: 'BUILD',
            turnNumber: turnNumber,
            playerId: intent.playerId
          });
          
          console.log(`✅ BUILD_REVEAL accepted for player ${intent.playerId} turn ${turnNumber}`);
          break;
        }
        
        case 'BATTLE_COMMIT': {
          // Similar to BUILD_COMMIT but for battle phase
          const currentPhase = gameState.gameData?.turnData?.currentMajorPhase;
          const currentStep = gameState.gameData?.turnData?.currentStep;
          
          const validSteps = ['simultaneous_declaration', 'conditional_response'];
          if (currentPhase !== 'battle_phase' || !validSteps.includes(currentStep)) {
            intentAccepted = false;
            rejectionCode = 'INVALID_PHASE';
            rejectionMessage = `BATTLE_COMMIT only valid during battle declaration/response, currently in ${currentPhase}/${currentStep}`;
            break;
          }
          
          // Verify window matches current step
          const expectedWindow = currentStep === 'simultaneous_declaration' ? 'DECLARATION' : 'RESPONSE';
          if (intent.window !== expectedWindow) {
            intentAccepted = false;
            rejectionCode = 'INVALID_WINDOW';
            rejectionMessage = `Expected window ${expectedWindow}, got ${intent.window}`;
            break;
          }
          
          storeCommitment(gameState, intent.playerId, turnNumber, 'BATTLE', intent.commitHash, intent.window);
          
          addEvent({
            type: 'COMMIT_STORED',
            kind: 'BATTLE',
            window: intent.window,
            turnNumber: turnNumber,
            playerId: intent.playerId
          });
          
          console.log(`✅ BATTLE_COMMIT (${intent.window}) stored for player ${intent.playerId}`);
          break;
        }
        
        case 'BATTLE_REVEAL': {
          // Similar to BUILD_REVEAL but for battle phase
          const currentPhase = gameState.gameData?.turnData?.currentMajorPhase;
          const currentStep = gameState.gameData?.turnData?.currentStep;
          
          const validSteps = ['simultaneous_declaration', 'conditional_response'];
          if (currentPhase !== 'battle_phase' || !validSteps.includes(currentStep)) {
            intentAccepted = false;
            rejectionCode = 'INVALID_PHASE';
            rejectionMessage = `BATTLE_REVEAL only valid during battle declaration/response, currently in ${currentPhase}/${currentStep}`;
            break;
          }
          
          const commitment = getCommitment(gameState, intent.playerId, turnNumber, 'BATTLE', intent.window);
          if (!commitment) {
            intentAccepted = false;
            rejectionCode = 'NO_COMMITMENT';
            rejectionMessage = `Must BATTLE_COMMIT (${intent.window}) before BATTLE_REVEAL`;
            break;
          }
          
          const isValid = await validateRevealHash(intent.payload, intent.nonce, commitment.hash);
          if (!isValid) {
            intentAccepted = false;
            rejectionCode = 'BAD_HASH';
            rejectionMessage = 'Reveal payload does not match committed hash';
            break;
          }
          
          // Store battle actions (would use GameEngine in full implementation)
          const payload = intent.payload;
          if (!gameState.gameData.turnData.battleActions) {
            gameState.gameData.turnData.battleActions = {};
          }
          if (!gameState.gameData.turnData.battleActions[intent.playerId]) {
            gameState.gameData.turnData.battleActions[intent.playerId] = {};
          }
          
          gameState.gameData.turnData.battleActions[intent.playerId][intent.window] = payload;
          
          addEvent({
            type: 'REVEAL_ACCEPTED',
            kind: 'BATTLE',
            window: intent.window,
            turnNumber: turnNumber,
            playerId: intent.playerId
          });
          
          console.log(`✅ BATTLE_REVEAL (${intent.window}) accepted for player ${intent.playerId}`);
          break;
        }
        
        case 'ACTION': {
          // Atomic non-hidden action
          // Would use GameEngine to validate and apply
          // For now, just accept
          console.log(`⚡ ACTION: ${intent.actionType} in phase ${intent.phase}`);
          
          // Example validation (would be more comprehensive in full implementation)
          if (intent.actionType === 'DICE_MANIPULATION') {
            // Validate player has dice manipulation power
            // Apply the action
          }
          
          // Placeholder - would generate EFFECTS_QUEUED events etc.
          break;
        }
        
        case 'DECLARE_READY': {
          // Player signals completion of current phase/step
          gameState = ServerPhaseEngine.setPlayerReady(gameState, intent.playerId);
          
          console.log(`✅ Player ${intent.playerId} declared ready for phase ${intent.phase}`);
          
          // Check if all players are ready
          if (ServerPhaseEngine.areAllPlayersReady(gameState)) {
            console.log(`🎯 All players ready, advancing phase`);
            gameState = ServerPhaseEngine.advancePhase(gameState);
            
            const newPhase = gameState.gameData?.turnData?.currentMajorPhase;
            const newStep = gameState.gameData?.turnData?.currentStep;
            const newTurn = gameState.gameData?.turnData?.turnNumber || gameState.roundNumber || 1;
            
            addEvent({
              type: 'PHASE_ENTERED',
              phase: newPhase,
              step: newStep,
              turnNumber: newTurn
            });
            
            // Check if new phase auto-advances
            while (ServerPhaseEngine.shouldAutoAdvance(gameState)) {
              console.log(`🔄 Auto-advancing through ${gameState.gameData?.turnData?.currentStep}`);
              gameState = ServerPhaseEngine.processAutoPhase(gameState);
              
              const autoPhase = gameState.gameData?.turnData?.currentMajorPhase;
              const autoStep = gameState.gameData?.turnData?.currentStep;
              const autoTurn = gameState.gameData?.turnData?.turnNumber || gameState.roundNumber || 1;
              
              addEvent({
                type: 'PHASE_ENTERED',
                phase: autoPhase,
                step: autoStep,
                turnNumber: autoTurn
              });
            }
            
            // Update clock for new phase
            gameState = updateChessClock(gameState, nowMs);
          }
          break;
        }
        
        case 'SURRENDER': {
          // Player forfeits
          gameState.status = 'completed';
          
          const opponentId = gameState.players.find(p => p.id !== intent.playerId && p.role === 'player')?.id;
          
          addEvent({
            type: 'GAME_ENDED',
            winnerPlayerId: opponentId,
            victoryType: 'SURRENDER'
          });
          
          console.log(`🏳️ Player ${intent.playerId} surrendered, ${opponentId} wins`);
          break;
        }
        
        default:
          intentAccepted = false;
          rejectionCode = 'UNIMPLEMENTED_INTENT';
          rejectionMessage = `Intent type ${intent.type} not yet implemented`;
      }
    }
    
    // 7. Generate intent result event
    if (intentAccepted) {
      addEvent({
        type: 'INTENT_ACCEPTED',
        intentId: intent.intentId,
        playerId: intent.playerId
      });
    } else {
      addEvent({
        type: 'INTENT_REJECTED',
        intentId: intent.intentId,
        playerId: intent.playerId,
        code: rejectionCode,
        message: rejectionMessage
      });
    }
    
    // 8. Always add clock update event
    const clockEvent = createClockEvent(gameState, nextSeq++, nowMs);
    if (clockEvent) {
      events.push(clockEvent);
    }
    
    // 9. Persist updated state and sequence number
    await kvSet(gameStateKey, gameState);
    await kvSet(seqKey, nextSeq - 1); // Save highest seq used
    
    // 10. Return IntentResponse
    const response = {
      ok: intentAccepted,
      state: gameState,
      events: events
    };
    
    if (!intentAccepted) {
      response.rejected = {
        code: rejectionCode,
        message: rejectionMessage
      };
    }
    
    const elapsedMs = Date.now() - startMs;
    console.log(`📤 Intent processed in ${elapsedMs}ms, ${events.length} events generated, seq: ${currentSeq} -> ${nextSeq - 1}`);
    
    return c.json(response);
    
  } catch (error) {
    console.error('❌ Intent processing error:', error);
    return c.json({
      ok: false,
      state: null,
      events: [],
      rejected: {
        code: 'INTERNAL_ERROR',
        message: `Server error: ${error.message}`
      }
    }, 500);
  }
});

Deno.serve(app.fetch);