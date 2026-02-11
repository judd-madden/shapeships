/**
 * ShipChoiceRegistry - Maps ActionPanelId → ShipChoicePanelSpec
 * 
 * Finite set of ship choice panels with:
 * - Dynamic fleet counts derived from vm.board.myFleet
 * - Buttons/Large/Placeholder layouts
 * - UI-only (no server calls, no intent wiring yet)
 * 
 * ARCHITECTURAL NOTES:
 * - UI pass only (no charge eligibility computation yet)
 * - Counts are derived from fleet, not from charge availability
 * - Future: refine counts to eligible charges when charge-state wiring exists
 */

import type { ActionPanelId } from '../ActionPanelRegistry';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import type { ShipChoiceButtonSpec } from '../../../types/ShipChoiceTypes';

// ============================================================================
// TYPES
// ============================================================================

export type ShipChoicePanelSpec =
  | ShipChoiceButtonsPanelSpec
  | ShipChoiceLargePanelSpec
  | ShipChoicePlaceholderSpec;

export interface ShipChoiceButtonsPanelSpec {
  kind: 'buttons';

  groups: Array<
    | ShipChoiceCountedShipGroupSpec
    | ShipChoiceNamedShipGroupSpec
  >;

  /**
   * UI-only. When true, ShipChoicesPanel should show the OpponentAlsoHasCharges callout.
   * Condition wiring comes later; for now we can set true for charge declaration panels.
   */
  showOpponentAlsoHasCharges?: boolean;
}

export interface ShipChoiceCountedShipGroupSpec {
  kind: 'counted';

  /**
   * Ship type that determines the count and instances to render.
   * Example: BUG renders N instances where N = myFleet count for BUG.
   */
  shipDefId: ShipDefId;

  /**
   * Heading template using `{count}` replacement.
   * Example: "{count} Bug Breeders with charges available"
   */
  headingTemplate: string;

  /**
   * Buttons used by each instance of this ship type.
   */
  buttons: ShipChoiceButtonSpec[];

  /**
   * Optional grey help text rendered to the right of ship choices.
   * When present, the group layout becomes two columns.
   * Example: "If a charge-based ship is destroyed, its charge still occurs."
   */
  groupHelpText?: string;
}

export interface ShipChoiceNamedShipGroupSpec {
  kind: 'named';

  /**
   * Static heading (no count replacement).
   * Example: "Sacrificial Pool"
   */
  heading: string;

  /**
   * Explicit list of ships (each ship renders 1 instance).
   * Use this for singletons like Sacrificial Pool.
   */
  ships: Array<{
    shipDefId: ShipDefId;
    buttons: ShipChoiceButtonSpec[];
  }>;

  /**
   * Optional grey help text rendered to the right of ship choices.
   * When present, the group layout becomes two columns.
   * Example: "If a charge-based ship is destroyed, its charge still occurs."
   */
  groupHelpText?: string;
}

export interface ShipChoiceLargePanelSpec {
  kind: 'large';
  shipDefId: ShipDefId;
  title: string;
  instruction: string;
  helpText?: string;
}

export interface ShipChoicePlaceholderSpec {
  kind: 'placeholder';
  title: string;
  message: string;
}

// ============================================================================
// REGISTRY
// ============================================================================

export const SHIP_CHOICE_PANEL_REGISTRY: Partial<Record<ActionPanelId, ShipChoicePanelSpec>> = {
  // ==========================================================================
  // BUILD PHASE
  // ==========================================================================

  'ap.build.dice_roll.centaur': {
    kind: 'buttons',
    groups: [
      {
        kind: 'named',
        heading: 'Ark of Knowledge',
        ships: [
          {
            shipDefId: 'KNO',
            buttons: [
              {
                size: 'large',
                label: 'Reroll Dice',
              },
              {
                size: 'small',
                label: 'Keep Dice Roll',
              },
            ],
          },
        ],
      },
    ],
  },

  'ap.build.ships_that_build.human': {
    kind: 'buttons',
    groups: [
      {
        kind: 'counted',
        shipDefId: 'CAR',
        headingTemplate: '{count} Carriers with charges available',
        buttons: [
          {
            size: 'large',
            label: 'Make Defender',
            detail: '(1 charge)',
          },
          {
            size: 'large',
            label: 'Make Fighter',
            detail: '(2 charges)',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
      },
    ],
  },

  'ap.build.ships_that_build.xenite': {
    kind: 'buttons',
    groups: [
      {
        kind: 'counted',
        shipDefId: 'BUG',
        headingTemplate: '{count} Bug Breeders with charges available',
        buttons: [
          {
            size: 'large',
            label: 'Make Xenite',
            detail: '(1 charge)',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
      },
      {
        kind: 'named',
        heading: 'Sacrificial Pool',
        ships: [
          {
            shipDefId: 'SAC',
            buttons: [
              {
                size: 'large',
                label: 'Destroy Own Ship',
                requiresTargeting: true,
                showsInstructions: true,
                instructionText: 'You must select a basic ship of yours.',
              },
              {
                size: 'small',
                label: 'Do Nothing',
              },
            ],
          },
        ],
      },
    ],
  },

  'ap.build.drawing.human': {
    kind: 'placeholder',
    title: 'Drawing',
    message: 'Frigate drawing panel should render via explicit routing.',
  },

  'ap.build.drawing.xenite': {
    kind: 'placeholder',
    title: 'Drawing',
    message: 'Evolver drawing panel should render via explicit routing.',
  },

  // ==========================================================================
  // BATTLE PHASE
  // ==========================================================================

  'ap.battle.first_strike.human': {
    kind: 'buttons',
    groups: [
      {
        kind: 'counted',
        shipDefId: 'GUA',
        headingTemplate: '{count} Guardians may destroy enemy basic ships.',
        buttons: [
          {
            size: 'large',
            label: 'Destroy',
            detail: '(1 charge)',
            requiresTargeting: true,
            showsInstructions: true,
            instructionText: 'You must select an enemy ship on the battlefield to destroy!',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
      },
    ],
  },

  'ap.battle.first_strike.centaur': {
    kind: 'large',
    shipDefId: 'DOM',
    title: 'Ark of Domination',
    instruction: 'You must select two basic enemy ships on the battlefield to steal!',
    helpText: 'Any stolen ship Battle Phase powers WILL be active for you this turn.',
  },

  'ap.battle.charges.human': {
    kind: 'buttons',
    showOpponentAlsoHasCharges: true,
    groups: [
      {
        kind: 'counted',
        shipDefId: 'INT',
        headingTemplate: '{count} Interceptors may use their charge.',
        buttons: [
          {
            size: 'large',
            label: 'Deal 5 Damage',
            detail: '(uses charge)',
          },
          {
            size: 'large',
            label: 'Heal 5',
            detail: '(uses charge)',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
      },
    ],
  },

  'ap.battle.charges.xenite': {
    kind: 'buttons',
    showOpponentAlsoHasCharges: true,
    groups: [
      {
        kind: 'counted',
        shipDefId: 'ANT',
        headingTemplate: '{count} Antlions may use their charge.',
        buttons: [
          {
            size: 'large',
            label: 'Deal 3 Damage',
            detail: '(uses charge)',
          },
          {
            size: 'large',
            label: 'Heal 4',
            detail: '(uses charge)',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
      },
    ],
  },

  'ap.battle.charges.centaur': {
    kind: 'buttons',
    showOpponentAlsoHasCharges: true,
    groups: [
      {
        kind: 'counted',
        shipDefId: 'WIS',
        headingTemplate: '{count} Ships of Wisdom may use a charge.',
        buttons: [
          {
            size: 'large',
            label: 'Deal 3 Damage',
            detail: '(uses 1 charge)',
          },
          {
            size: 'large',
            label: 'Heal 4',
            detail: '(uses 1 charge)',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
      },
      {
        kind: 'counted',
        shipDefId: 'FAM',
        headingTemplate: '{count} Ships of Family may use a charge.',
        buttons: [
          {
            size: 'large',
            label: 'Deal 6 Damage',
            detail: '(uses 1 charge)',
          },
          {
            size: 'large',
            label: 'Heal 6',
            detail: '(uses 1 charge)',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
      },
    ],
  },

  'ap.battle.charges.centaur.ship_of_equality': {
    kind: 'buttons',
    showOpponentAlsoHasCharges: true,
    groups: [
      {
        kind: 'counted',
        shipDefId: 'EQU',
        headingTemplate: '{count} Ships of Equality may destroy.',
        buttons: [
          {
            size: 'large',
            label: 'Destroy Both',
            detail: '(use 1 charge)',
            requiresTargeting: true,
            showsInstructions: true,
            instructionText: 'You must select a basic ship of yours. You must select a basic ship of your opponents with an EQUAL number of lines.',
          },
          {
            size: 'small',
            label: 'Hold Charge',
          },
        ],
        groupHelpText: 'If a charge-based ship is destroyed, it\'s charge still occurs.\n\nIf a ship with Automatic damage and healing is destroyed, it\'s power does NOT occur (except \'once only\' powers).',
      },
    ],
  },

  'ap.battle.charges.ancient.black_hole': {
    kind: 'large',
    shipDefId: 'SBLA',
    title: 'Black Hole',
    instruction: 'You must select two basic enemy ships on the battlefield.',
    helpText: 'Placeholder help text.',
  },

  'ap.battle.charges.ancient.simulacrum': {
    kind: 'large',
    shipDefId: 'SSIM',
    title: 'Simulacrum',
    instruction: 'You must select a basic enemy ship on the battlefield to copy.',
    helpText: 'Placeholder help text.',
  },
};

// ============================================================================
// LOOKUP
// ============================================================================

export function getShipChoicePanelSpec(id: ActionPanelId): ShipChoicePanelSpec | null {
  return SHIP_CHOICE_PANEL_REGISTRY[id] ?? null;
}