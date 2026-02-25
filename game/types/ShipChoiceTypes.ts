/**
 * Ship Choice Types (Shared)
 * 
 * Centralized type definitions for Ship Choice panels.
 * Used by both display components and VM mapping.
 * 
 * ARCHITECTURAL NOTES:
 * - These types are UI-focused (no server logic)
 * - VM layer derives data conforming to these types
 * - Display layer consumes these types without further derivation
 */

import type { ShipDefId } from './ShipTypes.engine';

// ============================================================================
// BUTTON TYPES
// ============================================================================

export type ShipChoiceButtonSize = 'large' | 'small';

export interface ShipChoiceButtonSpec {
  size: ShipChoiceButtonSize;
  label: string;
  detail?: string; // only used for large button; ignore for small

  /**
   * Semantic choice identifier used for server power submission.
   * Examples: 'damage' | 'heal' | 'hold'
   * UI strings (label/detail) remain authoritative in ShipChoiceRegistry.
   */
  choiceId?: string;

  /**
   * Semantic flag (UI-only, no behavior yet).
   * Indicates this action will later require selecting a target
   * in the fleet area before Ready is allowed.
   */
  requiresTargeting?: boolean;

  /**
   * Visual instruction handling (purely visual).
   * If true AND this button is selected, show the instructions element.
   */
  showsInstructions?: boolean;

  /**
   * Red instruction text shown when showsInstructions === true
   * and this button is selected.
   */
  instructionText?: string;

  disabled?: boolean;
}

// ============================================================================
// GROUP TYPES
// ============================================================================

export interface ShipChoiceGroupSpec {
  shipDefId: ShipDefId;

  /**
   * Button configuration passed directly to ShipChoiceGroup
   */
  buttons: ShipChoiceButtonSpec[];

  /**
   * Optional charge hints (passed through to ShipChoiceGroup)
   */
  explicitCharges?: number;
  currentCharges?: number | null;

  /**
   * Server-derived actionable instance identity for ShipChoice phases.
   * Present for charge panels (battle.charge_*).
   */
  sourceInstanceId?: string;

  /**
   * Server action identifier (e.g. "INT#0")
   */
  actionId?: string;

  /**
   * Allowed semantic choices for this instance, from server availableActions.
   * Example: ['damage','heal','hold']
   */
  availableChoiceIds?: string[];
}

export interface ShipChoicesPanelGroup {
  /**
   * Group heading text (e.g. "3 Bug Breeders with charges available")
   */
  heading: string;

  /**
   * Individual ship instances (never stacked)
   */
  ships: ShipChoiceGroupSpec[];

  /**
   * Optional grey help text rendered to the right of ship choices.
   * When present, this group's layout becomes two columns:
   * - Left: ship choices (centered, wrapping)
   * - Right: grey help text block
   */
  groupHelpText?: string;
}