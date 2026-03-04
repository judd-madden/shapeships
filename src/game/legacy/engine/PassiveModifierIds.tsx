// Passive Modifier IDs - Central registry of all passive modifier identifiers
// This is the SINGLE SOURCE OF TRUTH for valid passive modifier IDs

/**
 * DEPRECATED — LEGACY CLIENT ENGINE
 *
 * This file is part of an old client-authoritative engine.
 * It must not be used for authoritative gameplay.
 *
 * Canonical shared engine code lives in /engine.
 * This file is retained for reference only.
 */

/**
 * Passive Modifier IDs
 */
export const PASSIVE_MODIFIER_IDS = {
  // Destruction protection
  SACRIFICIAL_POOL: 'ships_cannot_be_destroyed',
  GUARDIAN: 'guardian_protection',
  SHIP_OF_EQUALITY: 'equality_protection',
  
  // Counting rules
  HIVE: 'ships_in_upgrades_count',
  
  // Dice modifications
  LEVIATHAN: 'dice_read_as_6',
  ARK_KNOWLEDGE_REROLL: 'dice_reroll',
  
  // Health modifications
  SPIRAL_MAX_HEALTH: 'spiral_increase_max_health',
  
  // Damage/healing modifications
  ARK_KNOWLEDGE_EQUALIZE: 'equalize_damage_healing',
  SCIENCE_VESSEL_DOUBLE_DAMAGE: 'double_automatic_damage',
  SCIENCE_VESSEL_DOUBLE_HEALING: 'double_automatic_healing',
  
  // Phase structure
  CHRONOSWARM_BUILD_PHASE: 'chronoswarm_extra_build_phase',
  CHRONOSWARM_DICE_SCALING: 'chronoswarm_dice_scaling',
} as const;

/**
 * Set of valid modifier IDs for fast lookup during validation
 */
export const PASSIVE_MODIFIER_IDS_SET = new Set(Object.values(PASSIVE_MODIFIER_IDS));

/**
 * Type for passive modifier IDs
 */
export type PassiveModifierId = typeof PASSIVE_MODIFIER_IDS[keyof typeof PASSIVE_MODIFIER_IDS];