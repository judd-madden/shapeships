# Phase 1: Type System Updates - COMPLETE ✅

**Date:** 2024-12-23  
**Status:** ✅ All type system updates complete

---

## ✅ Completed Updates

### **1. ShipTypes.tsx - Fully Aligned with Engine**

**Updated Enums:**
```typescript
enum ShipPowerPhase {
  // Build Phase Steps (aligned with engine)
  DICE_ROLL = 'dice_roll',
  LINE_GENERATION = 'line_generation',
  SHIPS_THAT_BUILD = 'ships_that_build',
  DRAWING = 'drawing',
  END_OF_BUILD = 'end_of_build',
  
  // Battle Phase Steps (aligned with engine)
  FIRST_STRIKE = 'first_strike',
  SIMULTANEOUS_DECLARATION = 'simultaneous_declaration',
  CONDITIONAL_RESPONSE = 'conditional_response',
  
  // End of Turn
  AUTOMATIC = 'automatic',
  
  // Special (event hooks, not phases!)
  DICE_MANIPULATION = 'dice_manipulation',
  UPON_DESTRUCTION = 'upon_destruction',  // ✅ Event hook, not a phase!
  PASSIVE = 'passive'  // ✅ Rule modifier, not effect generator
}
```

**New PowerTiming Enum:**
```typescript
enum PowerTiming {
  CONTINUOUS = 'continuous',  // Every turn (requires ship alive)
  ONCE_ONLY_AUTOMATIC = 'once_only_automatic',  // On completion (persists if destroyed)
  UPON_DESTRUCTION = 'upon_destruction',  // Event hook when ship destroyed
  PASSIVE = 'passive'  // Rule modifier (queried, not executed)
}
```

**Extended PowerEffectType:**
```typescript
enum PowerEffectType {
  // Core
  HEAL, DEAL_DAMAGE, GAIN_LINES, BUILD_SHIP,
  
  // Ancient
  GAIN_ENERGY,
  
  // Special
  DESTROY_SHIP, STEAL_SHIP, COPY_SHIP,
  SET_HEALTH_MAX, INCREASE_MAX_HEALTH,
  TAKE_DAMAGE_SELF, GAIN_JOINING_LINES,
  
  // Dice
  REROLL_DICE, FORCE_DICE_VALUE,
  
  // Complex
  CUSTOM
}
```

**Updated ShipPower Interface:**
```typescript
interface ShipPower {
  powerIndex: number;
  phase: ShipPowerPhase;
  timing: PowerTiming;  // ✅ NEW
  effectType: PowerEffectType;
  baseAmount?: number;
  description: string;
  specialLogic?: SpecialLogic;
  requiresCharge?: boolean;
  isOptional?: boolean;
  powerType?: 'Active' | 'Passive';  // ✅ NEW
  requiresPlayerChoice?: boolean;  // ✅ NEW
  choiceType?: 'trigger_number' | 'or_choice' | 'target_selection' | 'ship_selection';  // ✅ NEW
}
```

**Extended SpecialLogic:**
```typescript
interface SpecialLogic {
  // Existing
  countType, countTarget, countMultiplier, excludeShipsFrom,
  
  // ✅ NEW: Conditions
  conditionType?: 'dice_value' | 'dice_even' | 'dice_range' | 
                  'health_comparison' | 'ship_quantity' | 'turn_built';
  conditionValue?: number | number[];
  conditionComparison?: 'equals' | 'greater' | 'less' | 'in_range';
  
  // ✅ NEW: Energy (Ancient)
  energyCost?: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';
  };
  
  // ✅ NEW: Dice manipulation
  diceManipulation?: 'reroll' | 'reroll_twice' | 'force_value';
  forcedDiceValue?: number;
  
  // ✅ NEW: Quantity-based scaling
  scalingByQuantity?: {
    [quantity: number]: {
      effectType: PowerEffectType;
      value: number | 'dice_roll' | 'dice_roll_plus_4' | 'dice_roll_plus_5';
    };
  };
  
  // ✅ NEW: Choice-based effects
  orChoice?: {
    default: { effectType: PowerEffectType; value: number };
    conditional: {
      condition: 'health_lower' | 'dice_match' | 'custom';
      effectType: PowerEffectType;
      value: number;
    };
  };
  
  customLogicId?: string;
}
```

**Extended ShipDefinition:**
```typescript
interface ShipDefinition {
  // ... existing fields
  
  // ✅ NEW: Solar power energy cost
  energyCost?: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';
  };
  
  // ✅ NEW: Maximum quantity allowed
  maxQuantity?: number;
}
```

---

### **2. SolarPowerTypes.tsx - NEW FILE** ✅

Separate type system for Solar Powers (not ships):

```typescript
interface SolarPowerDefinition {
  id: string;  // 'SAST', 'SLIF', 'SSIM'
  name: string;
  energyCost: {
    red?: number;
    green?: number;
    blue?: number;
    variable?: 'ship_line_cost';
  };
  effect: {
    type: PowerEffectType;
    value: number | 'dice_roll' | 'dice_roll_plus_4' | 'dice_roll_plus_5';
    description: string;
  };
  specialLogic?: SpecialLogic;
}
```

**Why separate?**
- Solar Powers are NOT ships (no health, no position, no destruction)
- Activated differently (cost energy, not lines)
- Simpler UI handling
- Cleaner type system

---

### **3. PassiveModifiers.tsx - NEW SYSTEM** ✅

**Location:** `/game/systems/PassiveModifiers.tsx`

**Purpose:** Passive powers don't execute - they register rule modifiers that get queried

**Class Structure:**
```typescript
class PassiveModifiers {
  // Scan alive ships and register passive powers
  updateModifiers(gameState: GameState): void
  
  // Query methods
  hasModifier(playerId: string, modifierId: string): boolean
  getModifierData(playerId: string, modifierId: string): any
  countModifier(playerId: string, modifierId: string): number
  
  // Specific queries
  canShipBeDestroyed(playerId: string): boolean  // Sacrificial Pool
  doShipsInUpgradesCount(playerId: string): boolean  // Hive
  hasExtraBuildPhase(playerId: string): boolean  // Chronoswarm
  getChronoswarmDiceCount(playerId: string): number  // 1, 2, or 3
  getMaxHealthIncrease(playerId: string): number  // Spiral (2+)
}

// Singleton instance
export const passiveModifiers = new PassiveModifiers();
```

**Usage:**
```typescript
// At start of each phase
passiveModifiers.updateModifiers(gameState);

// When checking if ship can be destroyed
if (!passiveModifiers.canShipBeDestroyed(targetPlayerId)) {
  return { success: false, error: 'Ship protected by Sacrificial Pool' };
}
```

**Registered Modifier IDs:**
- `ships_cannot_be_destroyed` - Sacrificial Pool
- `ships_in_upgrades_count` - Hive
- `chronoswarm_extra_build_phase` - Chronoswarm
- `spiral_increase_max_health` - Spiral

---

### **4. GameTypes.tsx - Player State Extended** ✅

**Updated Player Interface:**
```typescript
interface Player {
  // ... existing fields
  
  health?: number;  // Current health
  maxHealth?: number;  // ✅ NEW: Default 35, can increase to 50 (Spiral)
  
  joiningLines?: number;  // Centaur joining lines
  
  // ✅ NEW: Ancient energy system
  energy?: {
    red: number;
    green: number;
    blue: number;
  };
  
  // ✅ NEW: Ship-specific configurations
  shipConfigurations?: {
    [shipInstanceId: string]: {
      frigate_trigger?: number;  // 1-6
      [key: string]: number | string | boolean | undefined;
    };
  };
}
```

---

## 🎯 What This Enables

### **Now Possible:**

1. ✅ **"Upon Destruction" as event hook** - Clean implementation without ordering bugs
2. ✅ **Passive powers as rule modifiers** - Query-based, no phantom effects
3. ✅ **Ancient energy system** - Red/green/blue energy tracking
4. ✅ **Solar Powers as separate entities** - Cleaner type system
5. ✅ **Ship quantity limits** - Orbital (6 max), Ship of Vigor (3 max)
6. ✅ **Player choice flags** - UI knows when to show choice dialogs
7. ✅ **Conditional effects** - Dice-based, health-based, quantity-based
8. ✅ **Scaling by quantity** - Science Vessel (1/2/3), Ark of Knowledge (1/2/3)
9. ✅ **OR-choice effects** - Defense Swarm, Antlion Array
10. ✅ **Dice manipulation** - Ark of Knowledge (reroll), Leviathan (force 6)

---

## 📋 Implementation Notes

### **"Upon Destruction" Event Hook**

**Correct implementation:**
```typescript
// During End of Turn Resolution, when ship is destroyed:
if (!ship.isDestroyed && shouldBeDestroyed) {
  ship.isDestroyed = true;
  
  // ✅ Trigger event hook
  const shipDef = getShipById(ship.shipId);
  for (const power of shipDef.powers) {
    if (power.timing === PowerTiming.UPON_DESTRUCTION) {
      gameState.turnData.triggeredEffects.push({
        id: generateId(),
        sourceShipId: ship.id,
        effectType: 'BUILD_SHIP',
        shipIdToBuild: 'XEN',
        quantity: 2,
        persistsIfSourceDestroyed: true,  // Already destroyed!
        triggeredAt: new Date().toISOString()
      });
    }
  }
}
```

### **Passive Powers Usage**

**Call at phase transitions:**
```typescript
// At start of Build Phase
passiveModifiers.updateModifiers(gameState);

// Before destroying ship
if (!passiveModifiers.canShipBeDestroyed(targetPlayerId)) {
  // Skip destruction (Sacrificial Pool protection)
}

// When counting ships
if (passiveModifiers.doShipsInUpgradesCount(playerId)) {
  // Include ships consumed in upgrades (Hive)
}
```

---

## 🔜 Next Steps

### **Phase 2: CSV Parsing** (Ready to start)

With types complete, we can now:
1. Create CSV parser with automated rules
2. Add manual overrides for ~24 complex ships
3. Generate ShipDefinitions.tsx with all 79 ships
4. Create SolarPowerDefinitions.tsx with 9 solar powers

### **Phase 3: Engine Integration**

1. Implement "Upon Destruction" event hook in EndOfTurnResolver
2. Integrate PassiveModifiers into phase transitions
3. Add energy system to player initialization
4. Test with simple ships first

---

## ✅ Validation Checklist

- [x] ShipPowerPhase enum matches engine steps
- [x] PowerTiming enum includes all timing types
- [x] PowerEffectType includes all CSV effect types
- [x] SpecialLogic supports conditions, energy, scaling
- [x] Player state includes energy, maxHealth, configurations
- [x] SolarPowerDefinition created as separate type
- [x] PassiveModifiers system created with query methods
- [x] ShipDefinition includes maxQuantity and energyCost
- [x] "Upon Destruction" documented as event hook
- [x] Passive powers separated from ShipPowers.tsx
- [x] Canonical destruction handler pattern documented

**All type system updates complete! Ready for Phase 2: CSV Parsing.**

---

## 📖 Documentation Created

1. **`/game/types/ShipTypes.tsx`** - Core ship type system
2. **`/game/types/SolarPowerTypes.tsx`** - Solar power types
3. **`/game/systems/PassiveModifiers.tsx`** - Passive modifier system
4. **`/game/types/GameTypes.tsx`** - Updated Player interface
5. **`/game/engine/documentation/upon-destruction-mechanics.md`** - 🔒 Canonical pattern
6. **`/guidelines/ship-data-corrections.md`** - Critical corrections
7. **`/guidelines/phase1-type-updates-complete.md`** - This document

**Key Rule Locked In:** "Upon Destruction" is an event hook that fires when ANY ship is destroyed in ANY phase, queuing effects for End of Turn Resolution.
