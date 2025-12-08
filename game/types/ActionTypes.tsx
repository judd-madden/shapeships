// Action Resolution Layer types
// Defines the structure for managing player actions within phases

export type ActionType = 
  | 'CHARGE_USE'           // Use a charge power
  | 'SHIP_BUILD'           // Build a ship during Ships That Build or Drawing
  | 'SHIP_TRANSFORM'       // Evolver: Xenite → Oxite/Asterite
  | 'TRIGGER_SELECTION'    // Frigate: Choose dice number 1-6
  | 'DICE_REROLL'          // Ark of Knowledge: Reroll dice
  | 'SHIP_DESTROY'         // Sacrificial Pool: Destroy own ship
  | 'DECLARE_READY';       // Player has no more actions this phase

export type EffectType =
  | 'DAMAGE'
  | 'HEALING'
  | 'BUILD_SHIP'
  | 'TRANSFORM_SHIP'
  | 'DESTROY_SHIP'
  | 'GENERATE_LINES'
  | 'GENERATE_JOINING_LINES'
  | 'SET_HEALTH'
  | 'STEAL_SHIP'
  | 'DICE_REROLL';

export interface ActionEffect {
  type: EffectType;
  value?: number;
  targetShipType?: string;
  targetShipId?: string;
  targetPlayerId?: string;
  description?: string;
}

export interface ActionOption {
  id: string;                 // 'heal_5', 'damage_5', 'skip'
  label: string;              // "Heal 5"
  effect?: ActionEffect;      // What happens if chosen
  cost?: {                    // Cost to use this option
    charges?: number;
    lines?: number;
    joiningLines?: number;
  };
}

export interface PendingAction {
  actionId: string;           // Unique ID for this specific action
  playerId: string;
  type: ActionType;
  shipId?: string;            // Which ship enables this action
  mandatory: boolean;         // Must be resolved to advance?
  options: ActionOption[];    // What choices does player have?
  metadata?: {                // Context-specific data
    charges?: number;
    maxCharges?: number;
    maxUses?: number;
    description?: string;
    canUseMultiple?: boolean; // Can use multiple times in one phase
  };
}

export interface CompletedAction {
  actionId: string;
  playerId: string;
  chosenOption: string;
  timestamp: number;
  resolvedEffects?: ActionEffect[];
}

export type PlayerStatus = 
  | 'AWAITING_MANDATORY'   // Has mandatory actions that must be resolved
  | 'AWAITING_OPTIONAL'    // Has optional actions, can declare ready
  | 'READY';               // No pending actions, ready to advance

export interface PlayerActionState {
  playerId: string;
  status: PlayerStatus;
  pendingActions: PendingAction[];
  completedActions: CompletedAction[];
  canDeclareReady: boolean;   // Can they click "Ready" button?
  mustResolveFirst: string[]; // IDs of mandatory actions blocking ready
}

export interface PhaseActionState {
  phase: string;              // Current phase name
  phaseIndex: number;
  subPhase?: number;          // SubPhase enum value if applicable
  
  playerStates: { [playerId: string]: PlayerActionState };
  
  canAdvancePhase: boolean;
  blockingReason?: string;    // Why can't we advance? (for UI)
  
  phaseMetadata?: {           // Phase-specific info
    diceRoll?: number;
    isAutomatic?: boolean;    // Does this phase auto-resolve?
    requiresPlayerInput?: boolean;
  };
}

// Effects queued for Health Resolution phase
export interface QueuedEffect {
  id: string;
  type: EffectType;
  sourcePlayerId: string;
  sourceShipId?: string;
  targetPlayerId: string;
  value?: number;
  description: string;
  timestamp: number;
}

// Result of resolving a player action
export interface ActionResolutionResult {
  success: boolean;
  error?: string;
  effectsQueued: QueuedEffect[];
  stateChanges?: {
    shipsCreated?: string[];
    shipsDestroyed?: string[];
    chargesUsed?: { [shipId: string]: number };
    resourcesChanged?: { [resource: string]: number };
  };
}
