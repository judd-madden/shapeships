/**
 * RUNTIME BUNDLE ANCHOR
 *
 * Purpose:
 * Prevent Supabase Edge tree-shaking from dropping critical engine / engine_shared modules
 * when imports are refactored, type-only, or optimized away.
 *
 * This file MUST be imported exactly once from the Edge entrypoint.
 *
 * ⚠️ DO NOT remove imports from this file unless you fully understand
 * Supabase bundling behavior and have an alternative safeguard.
 */

// ============================================================================
// engine — authoritative server logic
// ============================================================================

// intent
import './intent/IntentReducer.ts';
import './intent/CommitStore.ts';
import './intent/IntentTypes.ts';
import './intent/Hash.ts';

// phase
import './phase/onEnterPhase.ts';
import './phase/advancePhase.ts';
import './phase/syncPhaseFields.ts';
import './phase/fleetHasAvailablePowers.ts';
import './phase/PhaseTable.ts';

// lines
import './lines/computeLineBonusForPlayer.ts';

// state
import './state/GameStateTypes.ts';

// ============================================================================
// engine_shared — pure game engine (shared rules, effects, data)
// ============================================================================

// phase
import '../engine_shared/phase/PhaseTable.ts';

// resolve
import '../engine_shared/resolve/resolvePhase.ts';
import '../engine_shared/resolve/resolvePowerAction.ts';

// defs
import '../engine_shared/defs/ShipDefinitions.core.ts';
import '../engine_shared/defs/ShipDefinitions.json.ts';
import '../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import '../engine_shared/defs/StructuredPowers.overlays.ts';

// effects
import '../engine_shared/effects/Effect.ts';
import '../engine_shared/effects/applyEffects.ts';
import '../engine_shared/effects/translateShipPowers.ts';

// Side-effect only module
export {};
