/**
 * ============================================================================
 * ⚠️ LEGACY FILE — DO NOT EXTEND ⚠️
 * ============================================================================
 *
 * This file is part of a PREVIOUS effects architecture.
 *
 * It is NOT the canonical Effects model.
 * It is NOT used by the current battle reducer.
 * It should NOT be extended, reused, or depended on for new features.
 *
 * The canonical Effects system now lives in:
 *   /game/engine/effects/
 *
 * This file is retained ONLY for:
 * - historical reference
 * - migration support
 * - UI-facing interpretation layers (if still in use)
 *
 * This was part of an EXPERIMENTAL effect interpretation layer that is NOT
 * part of the engine rules kernel.
 *
 * New logic MUST use the engine effects layer.
 * ============================================================================
 */

/**
 * Effect AST (Abstract Syntax Tree)
 * 
 * OPTIONAL structured interpretation layer for ship powers.
 * 
 * CRITICAL PRINCIPLES:
 * - Raw power text remains the authoritative source of truth
 * - AST is METADATA, not required
 * - Engine must NOT assume AST exists
 * - Gradual migration: Some powers have AST, others don't
 * 
 * PURPOSE:
 * - Enable future parsing/interpretation without changing existing logic
 * - Provide machine-readable effect structure for tooling
 * - Allow designer opt-in power-by-power
 * 
 * NON-GOALS:
 * - Replace human-readable text (never)
 * - Parse all powers automatically (not yet)
 * - Change engine behavior (not in this PR)
 */

// ============================================================================
// CORE AST TYPES
// ============================================================================

/**
 * EffectAst - Minimal composable AST for common power patterns
 * 
 * This is intentionally SMALL. "custom" is a valid escape hatch.
 */
export type EffectAst =
  // Simple direct effects
  | { kind: 'deal_damage'; amount: AmountExpression }
  | { kind: 'heal'; amount: AmountExpression }
  | { kind: 'generate_lines'; amount: AmountExpression }
  
  // Conditional effects
  | { kind: 'conditional'; condition: Condition; effect: EffectAst }
  
  // Scaling effects (count X, do Y for each)
  | { kind: 'count_and_apply'; count: CountExpression; apply: EffectAst }
  
  // Ship creation
  | { kind: 'build_ship'; shipId: string; free?: boolean; chargesCost?: number }
  
  // Charge usage
  | { kind: 'use_charge'; amount: number; effect: EffectAst }
  
  // Special/custom (escape hatch for complex powers)
  | { kind: 'custom'; note: string; metadata?: Record<string, unknown> }
  
  // Composite (multiple effects)
  | { kind: 'sequence'; effects: EffectAst[] };

// ============================================================================
// AMOUNT EXPRESSIONS
// ============================================================================

/**
 * AmountExpression - How to calculate an effect's magnitude
 */
export type AmountExpression =
  | { type: 'literal'; value: number }
  | { type: 'dice_roll' }
  | { type: 'count'; what: CountExpression }
  | { type: 'multiply'; base: AmountExpression; factor: number }
  | { type: 'add'; left: AmountExpression; right: AmountExpression };

// ============================================================================
// COUNT EXPRESSIONS
// ============================================================================

/**
 * CountExpression - How to count game entities
 */
export type CountExpression = {
  scope: 'player' | 'opponent' | 'both';
  entity: 'ships' | 'ship_types' | 'cores' | 'energy_spent';
  filter?: EntityFilter;
  divisor?: number;  // For "every THREE fighters" → divisor: 3
};

/**
 * EntityFilter - Narrow down what to count
 */
export type EntityFilter = {
  shipIds?: string[];           // Specific ship IDs: ['FIG', 'DEF']
  species?: string[];           // Specific species: ['Human']
  shipType?: 'Basic' | 'Upgraded';
  excludeSelf?: boolean;        // "other ships"
};

// ============================================================================
// CONDITIONS
// ============================================================================

/**
 * Condition - When an effect applies
 */
export type Condition =
  | { type: 'dice_matches'; value: number }
  | { type: 'dice_range'; min?: number; max?: number }
  | { type: 'health_compare'; compare: 'less_than' | 'greater_than'; target: 'opponent' }
  | { type: 'count'; what: CountExpression; compare: '==' | '<' | '>' | '<=' | '>='; value: number }
  | { type: 'once_per_turn' }
  | { type: 'once_on_build' };

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * PowerTrigger - When a power activates
 * (Informational, not enforced by AST)
 */
export type PowerTrigger =
  | 'automatic'
  | 'charge_declaration'
  | 'ships_that_build'
  | 'drawing'
  | 'first_strike'
  | 'dice_manipulation'
  | 'line_generation'
  | 'end_of_build_phase'
  | 'upon_destruction'
  | 'passive';

// ============================================================================
// EXAMPLES (DOCUMENTATION ONLY)
// ============================================================================

/**
 * Example AST interpretations:
 * 
 * "Deal 1 damage."
 * → { kind: 'deal_damage', amount: { type: 'literal', value: 1 } }
 * 
 * "Heal 2."
 * → { kind: 'heal', amount: { type: 'literal', value: 2 } }
 * 
 * "Deal 1 damage for every THREE of your Fighters."
 * → {
 *     kind: 'count_and_apply',
 *     count: {
 *       scope: 'player',
 *       entity: 'ships',
 *       filter: { shipIds: ['FIG'] },
 *       divisor: 3
 *     },
 *     apply: { kind: 'deal_damage', amount: { type: 'literal', value: 1 } }
 *   }
 * 
 * "Make a Defender (use 1 charge)."
 * → {
 *     kind: 'use_charge',
 *     amount: 1,
 *     effect: { kind: 'build_ship', shipId: 'DEF' }
 *   }
 * 
 * "Repeat the first Solar power you cast this turn."
 * → { kind: 'custom', note: 'Repeat first solar power (complex state tracking)' }
 */