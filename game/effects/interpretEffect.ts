/**
 * Effect Interpretation Helper
 * 
 * FUTURE-FACING: Provides a single hook for engine to access structured AST.
 * CURRENT STATE: Intentionally trivial - just returns the AST if present.
 * 
 * PURPOSE:
 * - Central point for future interpretation logic
 * - Engine calls this instead of accessing effectAst directly
 * - Allows later enhancement without changing engine call sites
 * 
 * NON-GOALS:
 * - Parse English text (not yet)
 * - Auto-generate AST (not yet)
 * - Enforce AST existence (never)
 */

import type { ShipPowerCore } from '../types/ShipTypes.core';
import type { EffectAst } from './EffectAst';

/**
 * Get structured effect interpretation if available
 * 
 * @param power - Ship power with optional AST metadata
 * @returns Structured AST if present, null if not
 * 
 * CRITICAL: Engine must NOT assume this returns non-null.
 * Always fall back to existing logic when null.
 * 
 * Example usage in engine (future):
 * ```
 * const ast = interpretEffect(power);
 * if (ast && ast.kind === 'deal_damage' && ast.amount.type === 'literal') {
 *   // Use AST interpretation
 *   dealDamage(ast.amount.value);
 * } else {
 *   // Fall back to existing logic
 *   executePowerManually(power);
 * }
 * ```
 */
export function interpretEffect(power: ShipPowerCore): EffectAst | null {
  // Simply return the AST if present
  // In the future, this could:
  // - Validate AST structure
  // - Apply transformations
  // - Generate AST from text (if parser is added)
  // - Cache interpretations
  // For now: just pass through
  
  return power.effectAst ?? null;
}

/**
 * Check if a power has structured interpretation
 * 
 * @param power - Ship power to check
 * @returns true if effectAst is present
 * 
 * Convenience helper for conditional logic.
 */
export function hasInterpretation(power: ShipPowerCore): boolean {
  return power.effectAst !== undefined;
}

/**
 * Get interpretation or throw error
 * 
 * @param power - Ship power that MUST have AST
 * @returns The AST (guaranteed non-null)
 * @throws Error if AST is missing
 * 
 * Use only when you know the power has been annotated.
 * NOT for general engine use (engine must tolerate missing AST).
 */
export function requireInterpretation(power: ShipPowerCore): EffectAst {
  const ast = interpretEffect(power);
  if (!ast) {
    throw new Error(
      `Power "${power.text}" is missing required effectAst. ` +
      `This should never happen if validation passes.`
    );
  }
  return ast;
}

/**
 * FUTURE HOOK: Extract amount from AST (example)
 * 
 * This demonstrates how future helpers could work with AST.
 * NOT used by engine yet.
 */
export function extractLiteralAmount(ast: EffectAst): number | null {
  switch (ast.kind) {
    case 'deal_damage':
    case 'heal':
    case 'generate_lines':
      if (ast.amount.type === 'literal') {
        return ast.amount.value;
      }
      return null;
    
    default:
      return null;
  }
}