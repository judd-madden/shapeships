// ============================================================================
// INTENT/EVENT CONTRACT - Canonical Wire Protocol
// ============================================================================
//
// This file defines the authoritative contract between:
// - Client → Server: GameIntent (what players attempt)
// - Server → Client: GameEvent (what server accepts/resolves)
//
// 🔒 HARD RULES:
// 1. Clients never send state — only Intents
// 2. Server never trusts time or derived data from clients
// 3. Health is NEVER applied outside EndOfTurnResolver
// 4. Hidden actions must use commit → reveal
// 5. All ordering is server-sequenced
// 6. UI must render purely from GameState + Events
//
// NO React imports. NO engine logic. Types only.
//
// ============================================================================

import type { GameState } from './GameTypes';
import type { TriggeredEffect } from './EffectTypes';
import type { 
  ShipInstanceId, 
  PlayerId 
} from './ShipTypes.engine';
import type { HiddenBattleActions } from './BattleTypes';
import type { ActionType } from './ActionTypes';

// ============================================================================
// INTENT MODEL (CLIENT → SERVER)
// ============================================================================

/**
 * Base structure for all player intents
 * Represents what a player ATTEMPTS to do
 */
export interface IntentBase {
  intentId: string;          // Client-generated unique ID
  gameId: string;
  playerId: string;

  // Client-side dedupe / UX only (server may ignore)
  clientSeq: number;
  clientCreatedAtMs?: number;

  // Server overwrites / sets these
  serverReceivedAtMs?: number;
}

// ============================================================================
// BUILD PHASE — Hidden Drawing (Commit → Reveal)
// ============================================================================

/**
 * Build Drawing Payload - atomic submission for hidden build actions
 * This replaces leaking per-ship build actions during drawing
 */
export interface BuildDrawingPayload {
  turnNumber: number;

  /**
   * Ships to build during this drawing phase
   */
  buildShips?: Array<{
    shipDefId: ShipDefId;
    consumeShipInstanceIds?: ShipInstanceId[];  // Upgraded ships requiring sacrifice
    lineCost?: number;
    joiningLineCost?: number;
  }>;

  /**
   * Lines to save for future turns
   */
  saveLines?: number;

  /**
   * Ship configurations (e.g., Centaur choosing damage value)
   */
  configureShips?: Array<{
    shipInstanceId: ShipInstanceId;
    key: string;
    value: number | string | boolean;
  }>;
}

/**
 * BUILD_COMMIT - Player commits hash of their build actions
 * Hidden until both players commit
 */
export type BuildCommitIntent = IntentBase & {
  type: 'BUILD_COMMIT';
  turnNumber: number;
  commitHash: string;  // sha256(payload + nonce)
};

/**
 * BUILD_REVEAL - Player reveals their committed build actions
 * Server validates hash matches commit
 */
export type BuildRevealIntent = IntentBase & {
  type: 'BUILD_REVEAL';
  turnNumber: number;
  payload: BuildDrawingPayload;
  nonce: string;
};

// ============================================================================
// BATTLE PHASE — Hidden Actions (Commit → Reveal)
// ============================================================================

/**
 * BATTLE_COMMIT - Player commits hash of battle actions
 * Used for both Simultaneous Declaration and Conditional Response
 */
export type BattleCommitIntent = IntentBase & {
  type: 'BATTLE_COMMIT';
  window: 'DECLARATION' | 'RESPONSE';
  turnNumber: number;
  commitHash: string;
};

/**
 * BATTLE_REVEAL - Player reveals their committed battle actions
 * Server validates hash matches commit
 */
export type BattleRevealIntent = IntentBase & {
  type: 'BATTLE_REVEAL';
  window: 'DECLARATION' | 'RESPONSE';
  turnNumber: number;
  payload: HiddenBattleActions;
  nonce: string;
};

// ============================================================================
// ATOMIC (Non-hidden) ACTIONS
// ============================================================================

/**
 * Atomic action data payloads
 * Used for dice manipulation, trigger selection, sacrifices, solar usage, etc.
 */
export type AtomicActionData =
  | { type: 'SHIP_POWER'; shipInstanceId: ShipInstanceId; powerIndex: number }
  | { type: 'TARGET_SHIPS'; shipInstanceId: ShipInstanceId; targetShipInstanceIds: ShipInstanceId[] }
  | { type: 'CHOOSE_NUMBER'; chosenNumber: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'EMPTY' };

/**
 * ACTION - Immediate, non-hidden action
 * Used for actions that don't require simultaneous hidden commitments
 */
export type AtomicActionIntent = IntentBase & {
  type: 'ACTION';
  phase: string;  // Major phase as string (e.g., 'build', 'battle')
  step: string | null;  // Subphase as string (e.g., 'dice_roll', 'first_strike')

  actionType: ActionType;
  data: AtomicActionData;
};

// ============================================================================
// READY / SURRENDER
// ============================================================================

/**
 * DECLARE_READY - Player signals completion of current phase/step
 */
export type DeclareReadyIntent = IntentBase & {
  type: 'DECLARE_READY';
  phase: string;  // Major phase as string
  step: string | null;  // Subphase as string
};

/**
 * SURRENDER - Player forfeits the game
 */
export type SurrenderIntent = IntentBase & {
  type: 'SURRENDER';
};

// ============================================================================
// FULL INTENT UNION
// ============================================================================

/**
 * Complete union of all possible player intents
 * This is what clients send to the server
 */
export type GameIntent =
  | BuildCommitIntent
  | BuildRevealIntent
  | BattleCommitIntent
  | BattleRevealIntent
  | AtomicActionIntent
  | DeclareReadyIntent
  | SurrenderIntent;

// ============================================================================
// EVENT MODEL (SERVER → CLIENT)
// ============================================================================

/**
 * Base structure for all server events
 * Represents what the server AUTHORITATIVELY accepts/resolves
 */
export interface EventBase {
  eventId: string;     // Server-generated unique ID
  gameId: string;
  seq: number;         // Strict server ordering (monotonically increasing)
  atMs: number;        // Server timestamp
}

// ============================================================================
// CORE LIFECYCLE EVENTS
// ============================================================================

/**
 * INTENT_ACCEPTED - Server accepted player's intent
 */
export type IntentAcceptedEvent = EventBase & {
  type: 'INTENT_ACCEPTED';
  intentId: string;
  playerId: string;
};

/**
 * INTENT_REJECTED - Server rejected player's intent
 */
export type IntentRejectedEvent = EventBase & {
  type: 'INTENT_REJECTED';
  intentId: string;
  playerId: string;
  code: string;        // Error code for programmatic handling
  message: string;     // Human-readable error message
};

/**
 * PHASE_ENTERED - Game transitioned to new phase/step
 */
export type PhaseEnteredEvent = EventBase & {
  type: 'PHASE_ENTERED';
  phase: string;  // Major phase as string
  step: string | null;  // Subphase as string
  turnNumber: number;
};

// ============================================================================
// CLOCK EVENTS (SERVER AUTHORITATIVE)
// ============================================================================

/**
 * CLOCK_UPDATED - Chess clock state update
 * Server is the ONLY source of truth for time
 */
export type ClockUpdatedEvent = EventBase & {
  type: 'CLOCK_UPDATED';
  p1Ms: number;                                  // Player 1 time remaining (milliseconds)
  p2Ms: number;                                  // Player 2 time remaining (milliseconds)
  runningFor: 'none' | 'p1' | 'p2' | 'both';    // Who is currently on clock
  startedAtMs?: number;                          // Server timestamp when current clock interval started
};

// ============================================================================
// COMMIT / REVEAL VISIBILITY EVENTS
// ============================================================================

/**
 * COMMIT_STORED - Server stored player's commitment hash
 * Does NOT reveal what the commitment contains
 */
export type CommitStoredEvent = EventBase & {
  type: 'COMMIT_STORED';
  kind: 'BUILD' | 'BATTLE';
  window?: 'DECLARATION' | 'RESPONSE';  // Only for BATTLE
  turnNumber: number;
  playerId: string;
};

/**
 * REVEAL_ACCEPTED - Server validated and accepted player's reveal
 * Game state now contains the revealed actions
 */
export type RevealAcceptedEvent = EventBase & {
  type: 'REVEAL_ACCEPTED';
  kind: 'BUILD' | 'BATTLE';
  window?: 'DECLARATION' | 'RESPONSE';  // Only for BATTLE
  turnNumber: number;
  playerId: string;
};

// ============================================================================
// EFFECTS & RESOLUTION
// ============================================================================

/**
 * EFFECTS_QUEUED - Server queued triggered effects for end-of-turn resolution
 * Effects are NOT applied yet (health unchanged)
 */
export type EffectsQueuedEvent = EventBase & {
  type: 'EFFECTS_QUEUED';
  sourceIntentId: string;   // Which intent triggered these effects
  effects: TriggeredEffect[];
};

/**
 * SHIPS_CHANGED - Ships were created, destroyed, or updated
 */
export type ShipsChangedEvent = EventBase & {
  type: 'SHIPS_CHANGED';
  created?: ShipInstanceId[];
  destroyed?: ShipInstanceId[];
  updated?: ShipInstanceId[];
};

/**
 * HEALTH_APPLIED - Health change applied during End of Turn Resolution
 * This is the ONLY event where health changes
 */
export type HealthAppliedEvent = EventBase & {
  type: 'HEALTH_APPLIED';
  playerId: string;
  damage: number;      // Damage received this turn
  healing: number;     // Healing received this turn
  net: number;         // Net change (healing - damage)
};

/**
 * GAME_ENDED - Game reached terminal state
 */
export type GameEndedEvent = EventBase & {
  type: 'GAME_ENDED';
  winnerPlayerId?: string;  // undefined = draw
  victoryType: 'HEALTH' | 'SURRENDER' | 'TIMEOUT' | 'OTHER';
};

// ============================================================================
// FULL EVENT UNION
// ============================================================================

/**
 * Complete union of all possible server events
 * This is what server sends to clients
 */
export type GameEvent =
  | IntentAcceptedEvent
  | IntentRejectedEvent
  | PhaseEnteredEvent
  | ClockUpdatedEvent
  | CommitStoredEvent
  | RevealAcceptedEvent
  | EffectsQueuedEvent
  | ShipsChangedEvent
  | HealthAppliedEvent
  | GameEndedEvent;

// ============================================================================
// SERVER RESPONSE SHAPE (MANDATORY)
// ============================================================================

/**
 * Standard response for all mutation endpoints
 * Every endpoint that accepts GameIntent MUST return this shape
 */
export interface IntentResponse {
  ok: boolean;                    // Was intent accepted?
  state: GameState;               // Current authoritative game state
  events: GameEvent[];            // Events generated by this intent
  rejected?: {                    // Only present if ok = false
    code: string;
    message: string;
  };
}

// ============================================================================
// INTEGRATION NOTES
// ============================================================================

/**
 * EXISTING TYPES TO REUSE:
 * - ActionType (from ActionTypes.tsx)
 * - BattleTypes (HiddenBattleActions, ChargeDeclaration, etc.)
 * - EffectTypes (TriggeredEffect, EvaluatedEffect, etc.)
 * - GameTypes (GameState, PlayerShip, TurnData, etc.)
 * 
 * DEPRECATION PLAN:
 * - GameAction may remain temporarily for backward compatibility
 * - GameIntent is now authoritative for all client→server communication
 * 
 * SERVER VALIDATION FLOW:
 * 1. Client emits GameIntent
 * 2. Server validates via RulesEngine
 * 3. Server mutates state via GameEngine
 * 4. Server logs GameEvent[]
 * 5. Server returns IntentResponse
 * 
 * UI RENDERING:
 * - UI renders from GameState (authoritative state)
 * - UI enhances with GameEvent[] (optimistic updates, animations, logs)
 * - UI never computes game logic (only displays server state)
 * 
 * FILES THAT MUST REFERENCE THIS:
 * - /supabase/functions/server/index.tsx (server endpoints)
 * - /game/hooks/useGameState.tsx (client state management)
 * - Any replay/logging system
 */