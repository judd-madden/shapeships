/**
 * Action Panel Registry
 * Canonical IDs and display names for all action panels
 * Pass 1.25 - Type definitions and display names only
 */

// Canonical Action Panel IDs (authoritative)
export type ActionPanelId =
  // Catalog panels (non-phase)
  | 'ap.catalog.ships.human'
  | 'ap.catalog.ships.centaur'
  | 'ap.catalog.ships.xenite'
  | 'ap.catalog.ships.ancient'
  // Menu panels (non-phase)
  | 'ap.menu.root'
  // Build phase
  | 'ap.build.dice_roll.centaur'
  | 'ap.build.ships_that_build.human'
  | 'ap.build.ships_that_build.xenite'
  | 'ap.build.drawing.human'
  | 'ap.build.drawing.xenite'
  // Battle phase
  | 'ap.battle.first_strike.human'
  | 'ap.battle.first_strike.centaur'
  | 'ap.battle.charges.human'
  | 'ap.battle.charges.xenite'
  | 'ap.battle.charges.centaur'
  | 'ap.battle.charges.centaur.ship_of_equality'
  | 'ap.battle.charges.ancient.black_hole'
  | 'ap.battle.charges.ancient.simulacrum'
  // End of turn resolution
  | 'ap.end_of_turn_resolution.health'
  // End of game result (single panel, variants via props)
  | 'ap.end_of_game.result';

// Array of all canonical IDs (same order as type definition)
export const ACTION_PANEL_IDS: ActionPanelId[] = [
  'ap.catalog.ships.human',
  'ap.catalog.ships.centaur',
  'ap.catalog.ships.xenite',
  'ap.catalog.ships.ancient',
  'ap.menu.root',
  'ap.build.dice_roll.centaur',
  'ap.build.ships_that_build.human',
  'ap.build.ships_that_build.xenite',
  'ap.build.drawing.human',
  'ap.build.drawing.xenite',
  'ap.battle.first_strike.human',
  'ap.battle.first_strike.centaur',
  'ap.battle.charges.human',
  'ap.battle.charges.xenite',
  'ap.battle.charges.centaur',
  'ap.battle.charges.centaur.ship_of_equality',
  'ap.battle.charges.ancient.black_hole',
  'ap.battle.charges.ancient.simulacrum',
  'ap.end_of_turn_resolution.health',
  'ap.end_of_game.result',
] as const;

// Compile-time exhaustiveness check for ACTION_PANEL_IDS
type IdsFromArray = (typeof ACTION_PANEL_IDS)[number];
type MissingIds = Exclude<ActionPanelId, IdsFromArray>;
type ExtraIds = Exclude<IdsFromArray, ActionPanelId>;

// Compile-time guards (no runtime effect)
const _allActionPanelIdsPresent: MissingIds extends never ? true : never = true;
const _noExtraActionPanelIds: ExtraIds extends never ? true : never = true;

// Display names for debug (exact mapping)
export const ACTION_PANEL_DISPLAY_NAMES = {
  'ap.catalog.ships.human': 'AP - Human Ships',
  'ap.catalog.ships.centaur': 'AP - Centaur Ships',
  'ap.catalog.ships.xenite': 'AP - Xenite Ships',
  'ap.catalog.ships.ancient': 'AP - Ancient Ships',
  'ap.menu.root': 'AP - Menu',
  'ap.build.dice_roll.centaur': 'AP - Dice Manipulation - Centaur',
  'ap.build.ships_that_build.human': 'AP - Ships That Build - Human',
  'ap.build.ships_that_build.xenite': 'AP - Ships That Build - Xenite',
  'ap.build.drawing.human': 'AP - Drawing - Human',
  'ap.build.drawing.xenite': 'AP - Drawing - Xenite',
  'ap.battle.first_strike.human': 'AP - First Strike - Human',
  'ap.battle.first_strike.centaur': 'AP - First Strike - Centaur',
  'ap.battle.charges.human': 'AP - Charges - Human',
  'ap.battle.charges.xenite': 'AP - Charges - Xenite',
  'ap.battle.charges.centaur': 'AP - Charges - Centaur',
  'ap.battle.charges.centaur.ship_of_equality': 'AP - Charges - Centaur - Ship of Equality',
  'ap.battle.charges.ancient.black_hole': 'AP - Charges - Ancient - Black Hole',
  'ap.battle.charges.ancient.simulacrum': 'AP - Charges - Ancient - Simulacrum',
  'ap.end_of_turn_resolution.health': 'AP - Health Resolution',
  'ap.end_of_game.result': 'AP - Game Result',
} satisfies Record<ActionPanelId, string>;