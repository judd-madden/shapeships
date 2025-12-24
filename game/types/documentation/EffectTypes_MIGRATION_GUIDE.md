# EffectTypes Migration Guide

**Date:** 2024-12-23  
**Status:** 🚧 **MIGRATION IN PROGRESS**

---

## 🎯 Overview

We've created `/game/types/EffectTypes.ts` as the **SINGLE SOURCE OF TRUTH** for all effect-related types. This guide shows how to migrate each file to use the new canonical types.

---

## 📋 Migration Checklist

- [ ] **EffectTypes.ts** - ✅ Created (canonical module)
- [ ] **ShipTypes.tsx** - Update to import EffectKind
- [ ] **ActionTypes.tsx** - Replace EffectType with EffectKind  
- [ ] **BattleTypes.tsx** - Import TriggeredEffect/EvaluatedEffect
- [ ] **GameTypes.tsx** - Update TurnData to use TriggeredEffect[]
- [ ] **PowerExecutor.ts** - Enqueue effects instead of mutating pending maps
- [ ] **EndOfTurnResolver.tsx** - Use canonical effect types

---

## 1️⃣ ShipTypes.tsx Migration

### Current State (BEFORE)

```typescript
// PowerEffectType - Local enum
export enum PowerEffectType {
  HEAL = 'heal',
  DEAL_DAMAGE = 'deal_damage',
  GAIN_LINES = 'gain_lines',
  // ... many more
}

// QueuedEffect - Local interface
export interface QueuedEffect {
  id: string;
  type: ResolvedEffectType;  // Local type
  sourcePlayerId: PlayerId;
  sourceShipInstanceId?: ShipInstanceId;
  sourceShipDefId?: ShipDefId;
  targetPlayerId: PlayerId;
  value?: number;
  energyColor?: 'red' | 'green' | 'blue' | 'all';
  persistsIfSourceDestroyed: boolean;
  description: string;
  createdAt: string;
}
```

### Migration Steps

**Option A: Replace PowerEffectType with EffectKind (RECOMMENDED)**

```typescript
// At top of file
import type { EffectKind, QueuedEffect } from './EffectTypes';

// REMOVE: export enum PowerEffectType { ... }
// REMOVE: export type ResolvedEffectType = ...
// REMOVE: export interface QueuedEffect { ... }

// ADD: Export alias for backward compatibility
export { EffectKind as PowerEffectType };

// Update ShipPower interface
export interface ShipPower {
  powerIndex: number;
  description: string;
  phase: ShipPowerPhase;
  timing: PowerTiming;
  
  // ✅ NEW: Use EffectKind instead of PowerEffectType
  effectType: EffectKind;  
  
  baseAmount?: number;
  specialLogic?: SpecialLogic;
  // ... other fields
}
```

**Option B: Keep PowerEffectType as design-time enum, map to EffectKind (ALTERNATIVE)**

```typescript
import type { EffectKind } from './EffectTypes';

// Keep PowerEffectType for design-time classification
export enum PowerEffectType {
  HEAL = 'heal',
  DEAL_DAMAGE = 'deal_damage',
  // ...
}

// Add mapping function
export function powerEffectToEffectKind(powerEffect: PowerEffectType): EffectKind {
  switch (powerEffect) {
    case PowerEffectType.DEAL_DAMAGE: return EffectKind.DAMAGE;
    case PowerEffectType.HEAL: return EffectKind.HEAL;
    case PowerEffectType.GAIN_LINES: return EffectKind.GAIN_LINES;
    // ... complete mapping
    default: throw new Error(`Unknown PowerEffectType: ${powerEffect}`);
  }
}
```

**Recommendation:** Use **Option A** for simplicity. PowerEffectType and EffectKind serve the same purpose.

---

## 2️⃣ ActionTypes.tsx Migration

### Current State (BEFORE)

```typescript
// Local EffectType union
export type EffectType = 
  | 'DAMAGE'
  | 'HEAL'
  | 'GAIN_LINES'
  | 'SET_HEALTH_MAX'
  // ... more types;

// ActionEffect interface
export interface ActionEffect {
  type: EffectType;
  value?: number;
  targetPlayerId: string;
  description: string;
}
```

### Migration (AFTER)

```typescript
// At top of file
import type { 
  EffectKind, 
  QueuedEffect, 
  TriggeredEffect,
  EffectSource,
  EffectTarget 
} from './EffectTypes';

// REMOVE: export type EffectType = ...

// ✅ Use EffectKind directly
export { EffectKind };

// ✅ ActionEffect becomes a builder for TriggeredEffect
export interface ActionEffect {
  kind: EffectKind;
  value?: number;
  energyColor?: 'red' | 'green' | 'blue' | 'all';
  targetPlayerId: string;
  targetShipInstanceId?: string;
  description: string;
}

// ✅ Helper to convert ActionEffect to TriggeredEffect
export function actionEffectToTriggered(
  actionEffect: ActionEffect,
  source: EffectSource,
  id: string,
  persistsIfSourceDestroyed: boolean = true
): TriggeredEffect {
  return {
    id,
    kind: actionEffect.kind,
    value: actionEffect.value,
    energyColor: actionEffect.energyColor,
    source,
    target: {
      targetPlayerId: actionEffect.targetPlayerId,
      targetShipInstanceId: actionEffect.targetShipInstanceId
    },
    description: actionEffect.description,
    resolution: 'triggered',
    persistsIfSourceDestroyed,
    createdAt: Date.now()
  };
}
```

---

## 3️⃣ BattleTypes.tsx Migration

### Current State (BEFORE)

```typescript
/**
 * @deprecated Use QueuedEffect from ShipTypes
 */
export interface TriggeredEffect {
  id: string;
  sourcePlayerId: PlayerId;
  sourceShipInstanceId?: string;
  targetPlayerId: PlayerId;
  value?: number;
  description: string;
  createdAt: string;
}

/**
 * @deprecated Use EndOfTurnResolver continuous power evaluation instead
 */
export interface EvaluatedEffect {
  id: string;
  sourcePlayerId: PlayerId;
  sourceShipInstanceId?: string;
  targetPlayerId: PlayerId;
  value?: number;
  description: string;
  requiresShipAlive: boolean;
}
```

### Migration (AFTER)

```typescript
// At top of file
import type {
  TriggeredEffect,
  EvaluatedEffect,
  AnyEffect
} from './EffectTypes';

// REMOVE: Old TriggeredEffect interface
// REMOVE: Old EvaluatedEffect interface

// ✅ Re-export for convenience
export type { TriggeredEffect, EvaluatedEffect, AnyEffect };

// Keep battle-specific types as-is
export interface BattleCommitmentState {
  // ... existing battle commitment types
}
```

---

## 4️⃣ GameTypes.tsx Migration

### Current State (BEFORE)

```typescript
import type { QueuedEffect } from './ShipTypes';

export interface TurnData {
  turnNumber: number;
  currentMajorPhase: MajorPhase;
  currentStep: BuildPhaseStep | BattlePhaseStep | null;
  
  // Using QueuedEffect from ShipTypes
  triggeredEffects: QueuedEffect[];
  
  battleCommitments?: BattleCommitmentState;
  // ...
}
```

### Migration (AFTER)

```typescript
// Import from canonical EffectTypes
import type { TriggeredEffect } from './EffectTypes';

export interface TurnData {
  turnNumber: number;
  currentMajorPhase: MajorPhase;
  currentStep: BuildPhaseStep | BattlePhaseStep | null;
  
  // ✅ Use canonical TriggeredEffect
  triggeredEffects: TriggeredEffect[];
  
  battleCommitments?: BattleCommitmentState;
  // ...
}
```

**No other changes needed** - TriggeredEffect from EffectTypes is compatible with the old QueuedEffect.

---

## 5️⃣ PowerExecutor.ts Migration

### Current State (BEFORE)

```typescript
// ❌ BAD: Mutating pending damage/healing maps
function executePower(power: ShipPower, ship: PlayerShip, gameState: GameState) {
  if (power.effectType === PowerEffectType.DEAL_DAMAGE) {
    const opponentId = getOpponentId(gameState, ship.ownerId);
    
    // ❌ Direct mutation
    if (!gameState.gameData.turnData.pendingDamage) {
      gameState.gameData.turnData.pendingDamage = {};
    }
    gameState.gameData.turnData.pendingDamage[opponentId] = 
      (gameState.gameData.turnData.pendingDamage[opponentId] || 0) + power.baseAmount;
  }
}
```

### Migration (AFTER)

```typescript
import type { TriggeredEffect, EffectKind, EffectSource, EffectTarget } from '../types/EffectTypes';
import { createTriggeredEffect, generateEffectId, createOpponentTarget } from '../types/EffectTypes';

// ✅ GOOD: Enqueue effects instead of mutating
function executePower(power: ShipPower, ship: PlayerShip, gameState: GameState) {
  // Map power effect type to EffectKind
  let effectKind: EffectKind;
  switch (power.effectType) {
    case PowerEffectType.DEAL_DAMAGE:
      effectKind = EffectKind.DAMAGE;
      break;
    case PowerEffectType.HEAL:
      effectKind = EffectKind.HEAL;
      break;
    // ... other mappings
    default:
      return; // Skip unknown effect types
  }
  
  // Create effect source
  const source: EffectSource = {
    sourcePlayerId: ship.ownerId,
    sourceShipInstanceId: ship.id,
    sourceShipDefId: ship.shipId,
    sourcePowerIndex: power.powerIndex,
    sourceType: 'ship_power'
  };
  
  // Create effect target
  const target: EffectTarget = effectKind === EffectKind.DAMAGE
    ? createOpponentTarget(ship.ownerId, gameState.players)
    : { targetPlayerId: ship.ownerId };
  
  // Create triggered effect
  const effect = createTriggeredEffect({
    id: generateEffectId(source, effectKind, gameState.roundNumber, 0),
    kind: effectKind,
    value: power.baseAmount || 0,
    source,
    target,
    description: `${ship.shipId}: ${power.description}`,
    persistsIfSourceDestroyed: true  // Charges/solars persist
  });
  
  // ✅ Enqueue to gameState
  enqueueTriggeredEffect(gameState, effect);
}

// Helper function to enqueue effects
function enqueueTriggeredEffect(gameState: GameState, effect: TriggeredEffect): void {
  if (!gameState.gameData.turnData) {
    throw new Error('Cannot enqueue effect: turnData is undefined');
  }
  
  if (!gameState.gameData.turnData.triggeredEffects) {
    gameState.gameData.turnData.triggeredEffects = [];
  }
  
  gameState.gameData.turnData.triggeredEffects.push(effect);
}
```

**Key Changes:**
1. ✅ Import from EffectTypes instead of local types
2. ✅ Create TriggeredEffect with proper structure
3. ✅ Use helper functions (createTriggeredEffect, generateEffectId)
4. ✅ Enqueue to gameState.gameData.turnData.triggeredEffects
5. ✅ Remove pendingDamage/pendingHealing mutations

---

## 6️⃣ EndOfTurnResolver.tsx Migration

### Current State (BEFORE)

```typescript
import type { PlayerShip } from '../types/GameTypes';
import type { QueuedEffect } from '../types/ShipTypes';

export class EndOfTurnResolver {
  resolveEndOfTurn(
    gameState: GameState,
    queuedEffects: QueuedEffect[],  // ❌ Local type
    passiveModifiers: PassiveModifiers
  ): EndOfTurnResult {
    // ...
  }
  
  private evaluateContinuousEffects(gameState: GameState): QueuedEffect[] {
    // ❌ Returns local QueuedEffect
  }
}
```

### Migration (AFTER)

```typescript
import type { PlayerShip } from '../types/GameTypes';
import type { 
  TriggeredEffect, 
  EvaluatedEffect, 
  AnyEffect,
  EffectKind,
  EffectSource,
  EffectTarget
} from '../types/EffectTypes';
import { 
  createEvaluatedEffect, 
  generateEffectId,
  createOpponentTarget,
  createSelfTarget
} from '../types/EffectTypes';

export class EndOfTurnResolver {
  // ✅ Use canonical types
  resolveEndOfTurn(
    gameState: GameState,
    triggeredEffects: TriggeredEffect[],  // ✅ Canonical type
    passiveModifiers: PassiveModifiers
  ): EndOfTurnResult {
    const allEffects: AnyEffect[] = [];
    
    // Step 1: Process triggered effects
    for (const effect of triggeredEffects) {
      if (effect.persistsIfSourceDestroyed) {
        allEffects.push(effect);
      } else {
        // Check if source ship survives
        const sourceShip = this.findShipByInstanceId(
          gameState, 
          effect.source.sourceShipInstanceId!
        );
        if (sourceShip && !sourceShip.isDestroyed) {
          allEffects.push(effect);
        }
      }
    }
    
    // Step 2: Evaluate continuous effects
    const evaluatedEffects = this.evaluateContinuousEffects(gameState);
    allEffects.push(...evaluatedEffects);
    
    // Step 3: Apply all effects simultaneously
    this.applyAllEffects(gameState, allEffects, result);
    
    // Step 4: Finalize health, check victory
    this.finalizeHealth(gameState, passiveModifiers, result);
    
    return result;
  }
  
  // ✅ Returns EvaluatedEffect[] (canonical type)
  private evaluateContinuousEffects(gameState: GameState): EvaluatedEffect[] {
    const effects: EvaluatedEffect[] = [];
    
    // Scan all surviving ships
    for (const playerId in gameState.gameData.ships || {}) {
      const playerShips = gameState.gameData.ships[playerId] || [];
      
      for (const ship of playerShips) {
        if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
        
        const shipDef = getShipById(ship.shipId);
        if (!shipDef) continue;
        
        // Filter continuous automatic powers
        const continuousPowers = shipDef.powers.filter(p => 
          p.phase === ShipPowerPhase.AUTOMATIC && 
          p.timing === PowerTiming.CONTINUOUS
        );
        
        for (const power of continuousPowers) {
          // Map power effect to EffectKind
          const effectKind = this.mapPowerEffectToEffectKind(power.effectType);
          if (!effectKind) continue;
          
          // Calculate value
          let value = power.baseAmount || 0;
          if (power.specialLogic) {
            value = this.evaluateSpecialLogic(power, ship, gameState, playerId);
          }
          
          // Create effect source
          const source: EffectSource = {
            sourcePlayerId: playerId,
            sourceShipInstanceId: ship.id,
            sourceShipDefId: ship.shipId,
            sourcePowerIndex: power.powerIndex,
            sourceType: 'ship_power'
          };
          
          // Determine target
          const target: EffectTarget = effectKind === EffectKind.DAMAGE
            ? createOpponentTarget(playerId, gameState.players)
            : createSelfTarget(playerId);
          
          // Create evaluated effect
          const effect = createEvaluatedEffect({
            id: generateEffectId(source, effectKind, gameState.roundNumber, effects.length),
            kind: effectKind,
            value,
            source,
            target,
            description: `${ship.shipId}: ${power.description}`,
            requiresOwnershipUnchanged: false
          });
          
          effects.push(effect);
        }
      }
    }
    
    return effects;
  }
  
  // ✅ Map PowerEffectType to EffectKind
  private mapPowerEffectToEffectKind(powerEffect: any): EffectKind | null {
    // If already using EffectKind, return as-is
    if (Object.values(EffectKind).includes(powerEffect)) {
      return powerEffect as EffectKind;
    }
    
    // Map old PowerEffectType values
    switch (powerEffect) {
      case 'deal_damage': return EffectKind.DAMAGE;
      case 'heal': return EffectKind.HEAL;
      case 'gain_lines': return EffectKind.GAIN_LINES;
      case 'gain_joining_lines': return EffectKind.GAIN_JOINING_LINES;
      case 'gain_energy': return EffectKind.GAIN_ENERGY;
      case 'build_ship': return EffectKind.BUILD_SHIP;
      case 'destroy_ship': return EffectKind.DESTROY_SHIP;
      case 'steal_ship': return EffectKind.STEAL_SHIP;
      case 'copy_ship': return EffectKind.COPY_SHIP;
      case 'reroll_dice': return EffectKind.DICE_REROLL;
      case 'force_dice_value': return EffectKind.FORCE_DICE_VALUE;
      case 'set_health_max': return EffectKind.SET_HEALTH_MAX;
      case 'increase_max_health': return EffectKind.INCREASE_MAX_HEALTH;
      case 'count_and_damage': return EffectKind.COUNT_AND_DAMAGE;
      case 'count_and_heal': return EffectKind.COUNT_AND_HEAL;
      default: return null;
    }
  }
  
  // ✅ Apply all effects (works with AnyEffect union)
  private applyAllEffects(
    gameState: GameState,
    effects: AnyEffect[],
    result: EndOfTurnResult
  ): void {
    // Initialize tracking
    const healthDeltas: HealthDeltas = {};
    
    // Tally all effects
    for (const effect of effects) {
      const value = Math.max(0, effect.value || 0);
      
      switch (effect.kind) {  // ✅ Use 'kind' field
        case EffectKind.DAMAGE:
          if (healthDeltas[effect.target.targetPlayerId]) {
            healthDeltas[effect.target.targetPlayerId].damage += value;
          }
          break;
        
        case EffectKind.HEAL:
          if (healthDeltas[effect.target.targetPlayerId]) {
            healthDeltas[effect.target.targetPlayerId].healing += value;
          }
          break;
        
        // ... other effect types
      }
    }
    
    // Apply health changes
    for (const player of gameState.players) {
      if (player.role !== 'player') continue;
      
      const delta = healthDeltas[player.id];
      if (delta) {
        player.health = (player.health ?? 25) + delta.netChange;
      }
    }
  }
}
```

**Key Changes:**
1. ✅ Import TriggeredEffect/EvaluatedEffect from EffectTypes
2. ✅ Use `effect.kind` instead of `effect.type`
3. ✅ Use `effect.source` instead of flat source fields
4. ✅ Use `effect.target` instead of flat target fields
5. ✅ Use helper functions from EffectTypes
6. ✅ Return EvaluatedEffect[] from continuous effect evaluation

---

## 🔑 Key Naming Changes

### Field Naming
| Old Name | New Name | Reason |
|----------|----------|--------|
| `type` | `kind` | Avoid confusion with TypeScript `type` keyword |
| `sourcePlayerId` (flat) | `source.sourcePlayerId` | Nested for clarity |
| `sourceShipInstanceId` (flat) | `source.sourceShipInstanceId` | Nested for clarity |
| `sourceShipDefId` (flat) | `source.sourceShipDefId` | Nested for clarity |
| `targetPlayerId` (flat) | `target.targetPlayerId` | Nested for clarity |
| `persistsIfDestroyed` | `persistsIfSourceDestroyed` | More explicit |
| `triggeredAt` | `createdAt` | Consistent with standard naming |

### Type Naming
| Old Type | New Type | Module |
|----------|----------|--------|
| `PowerEffectType` | `EffectKind` | EffectTypes |
| `EffectType` | `EffectKind` | EffectTypes |
| `ResolvedEffectType` | `EffectKind` | EffectTypes |
| `QueuedEffect` (local) | `TriggeredEffect` | EffectTypes |

---

## ⚠️ Common Pitfalls

### 1. Nested vs Flat Fields

**❌ OLD:**
```typescript
effect.sourcePlayerId
effect.sourceShipInstanceId
effect.targetPlayerId
```

**✅ NEW:**
```typescript
effect.source.sourcePlayerId
effect.source.sourceShipInstanceId
effect.target.targetPlayerId
```

### 2. Type vs Kind

**❌ OLD:**
```typescript
effect.type === 'DAMAGE'
```

**✅ NEW:**
```typescript
effect.kind === EffectKind.DAMAGE
```

### 3. String vs Number Timestamp

**❌ OLD:**
```typescript
createdAt: new Date().toISOString()  // String
```

**✅ NEW:**
```typescript
createdAt: Date.now()  // Number
```

### 4. Resolution Field

**❌ MISSING:**
```typescript
interface Effect {
  // Missing resolution field
}
```

**✅ REQUIRED:**
```typescript
interface TriggeredEffect {
  resolution: 'triggered';  // Required discriminator
}

interface EvaluatedEffect {
  resolution: 'evaluated';  // Required discriminator
}
```

---

## 🧪 Testing Migration

### Unit Test Example

```typescript
import { 
  createTriggeredEffect, 
  EffectKind, 
  isTriggeredEffect 
} from '../types/EffectTypes';

describe('EffectTypes Migration', () => {
  it('should create triggered effect with correct structure', () => {
    const effect = createTriggeredEffect({
      id: 'test-effect-1',
      kind: EffectKind.DAMAGE,
      value: 5,
      source: {
        sourcePlayerId: 'player1',
        sourceShipInstanceId: 'ship_abc',
        sourceShipDefId: 'WED'
      },
      target: {
        targetPlayerId: 'player2'
      },
      description: 'Test damage effect',
      persistsIfSourceDestroyed: true
    });
    
    expect(effect.resolution).toBe('triggered');
    expect(effect.kind).toBe(EffectKind.DAMAGE);
    expect(effect.value).toBe(5);
    expect(isTriggeredEffect(effect)).toBe(true);
  });
});
```

---

## 📊 Migration Completion Status

| File | Status | Notes |
|------|--------|-------|
| EffectTypes.ts | ✅ Complete | Canonical module created |
| ShipTypes.tsx | 🚧 Pending | Need to replace PowerEffectType |
| ActionTypes.tsx | 🚧 Pending | Need to replace EffectType |
| BattleTypes.tsx | 🚧 Pending | Need to import canonical types |
| GameTypes.tsx | 🚧 Pending | Need to update TurnData |
| PowerExecutor.ts | 🚧 Pending | Need to enqueue effects |
| EndOfTurnResolver.tsx | 🚧 Pending | Need to use canonical types |

---

## ✅ Final Checklist

Before marking migration complete:

- [ ] All files import from EffectTypes (not local types)
- [ ] No duplicate effect type definitions
- [ ] PowerExecutor enqueues effects (no pendingDamage/pendingHealing)
- [ ] EndOfTurnResolver uses TriggeredEffect/EvaluatedEffect
- [ ] Field access updated (nested source/target)
- [ ] Type guards used (isTriggeredEffect, isEvaluatedEffect)
- [ ] Helper functions used (createTriggeredEffect, etc.)
- [ ] Unit tests updated
- [ ] No TypeScript errors
- [ ] Game still functions correctly

---

## 🚀 Next Steps

1. Update ShipTypes.tsx to use EffectKind
2. Update ActionTypes.tsx to use EffectKind
3. Update BattleTypes.tsx to import canonical types
4. Update GameTypes.tsx TurnData
5. Refactor PowerExecutor to enqueue effects
6. Update EndOfTurnResolver to use canonical types
7. Run tests and verify game functionality
8. Remove deprecated types and comments

---

**Status:** Migration guide complete. Ready to implement changes.
