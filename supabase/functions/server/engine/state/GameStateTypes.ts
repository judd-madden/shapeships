/**
 * GAME STATE TYPES
 * 
 * Core type definitions for game state entities.
 * Ship instances replace placeholder ship objects.
 */

/**
 * Ship Instance - replaces placeholder ship objects
 * 
 * Ships are stored as instances with unique IDs, referencing
 * canonical ship definitions by shipDefId.
 */
export type ShipInstance = {
  /** Unique instance identifier (crypto.randomUUID()) */
  instanceId: string;
  
  /** Canonical ship definition ID (e.g., "DEF", "TAC", "CAR") */
  shipDefId: string;
  
  /** Current charge count (for charge-based ships) */
  chargesCurrent?: number;
  
  /** Turn number when ship was created */
  createdTurn?: number;
};
