# Human Species Engine Consistency & UI-Readiness Plan

**Date:** 2024-12-24  
**Status:** Planning Phase  
**Goal:** Make Human species fully correct, internally consistent, and UI-ready

---

## Executive Summary

**Core Decision: We will use DERIVED MODIFIERS (computed at resolution time)**

**Rationale:**
- Simpler mental model
- No caching/staleness issues
- Easier to debug
- Matches "effects resolve at EOT" philosophy
- PassiveModifiers already works this way

---

## 1. Passive / Stack-Based Modifiers (Science Vessel)

### CSV Specification
- **1 SCI:** Double Automatic healing
- **2 SCI:** Double Automatic damage  
- **3 SCI:** Line Generation: generate additional lines equal to dice roll

### Implementation Decision: DERIVED MODIFIERS

**Model:** Compute fleet composition when effects are evaluated/applied

**Location:** 
- `PassiveModifiers.tsx` for queries
- `EndOfTurnResolver.tsx` for applying multipliers
- `PowerResolver.ts` for line generation

**Implementation:**
```typescript
// In PassiveModifiers
countScienceVessels(playerId: string): number {
  return this.countShipsByDefId(playerId, 'SCI');
}

// In EndOfTurnResolver when applying effects
const sciCount = passiveModifiers.countScienceVessels(ownerId);
if (effect.kind === EffectKind.HEAL && sciCount >= 1) {
  effect.value *= 2; // Double healing
}
if (effect.kind === EffectKind.DAMAGE && sciCount >= 2) {
  effect.value *= 2; // Double damage
}

// In Line Generation phase
const sciCount = passiveModifiers.countScienceVessels(playerId);
if (sciCount >= 3) {
  bonusLines += diceRoll;
}
```

**Why NOT cached:**
- ❌ Must invalidate on ship build/destroy
- ❌ Timing complexity (when to recompute?)
- ❌ Stale data risk
- ❌ Extra state to manage

**Why DERIVED:**
- ✅ Always correct
- ✅ No invalidation needed
- ✅ Simple to reason about
- ✅ Matches PassiveModifiers pattern

---

## 2. Tactical Cruiser TYPE-Based Damage

### CSV Specification
> "Automatic: Deal 1 damage for each TYPE of ship you have"

### Definition: What is TYPE?

**TYPE = Unique Ship Definition ID**

Examples:
- Player has: TAC, TAC, DEF, DEF, FIG
- TYPEs: TAC, DEF, FIG = **3 types**
- Damage dealt: **3**

**Includes TAC itself:** Yes (TAC is a TYPE)

### Implementation

```typescript
// In ManualPowerOverrides.ts or PowerResolver
'TAC_0': (power, context) => {
  const { gameState, ownerId, opponentId } = context;
  
  // Count unique ship definition IDs
  const ships = gameState.gameData.ships[ownerId] || [];
  const aliveShips = ships.filter(s => !s.isDestroyed && !s.isConsumedInUpgrade);
  const uniqueTypes = new Set(aliveShips.map(s => s.shipId));
  const typeCount = uniqueTypes.size;
  
  return {
    effects: [
      createTriggeredEffect({
        kind: EffectKind.DAMAGE,
        value: typeCount,
        target: createOpponentTarget(opponentId),
        description: `Tactical Cruiser: ${typeCount} types`
      })
    ]
  };
}
```

**Edge Cases:**
- TAC destroyed mid-turn: Effect still resolves (already enqueued)
- Multiple TACs: Each counts types independently
- Zero ships: 0 damage (not an error)

---

## 3. Dice Roll Plumbing

### Requirements
- Single authoritative dice roll per turn
- Accessible in Line Generation
- Accessible in Automatic phase (Frigate, etc.)
- Accessible for dice manipulation powers (future)

### Current State
Dice stored in: `gameState.gameData.turnData.diceRoll`

### Implementation

**Ensure dice is set during Dice Roll subphase:**
```typescript
// In ActionResolver or phase transition
gameState.gameData.turnData = {
  ...gameState.gameData.turnData,
  diceRoll: Math.floor(Math.random() * 6) + 1
};
```

**Pass dice to all resolvers:**
```typescript
// PowerResolutionContext already has:
interface PowerResolutionContext {
  diceRoll?: number;  // ✅ Already exists
}

// EndOfTurnResolver gets it from turnData
const diceRoll = gameState.gameData.turnData?.diceRoll;
```

**Dice manipulation:**
```typescript
// Leviathan: Set dice to specific value
gameState.gameData.turnData.diceRoll = targetValue;

// Ark of Fury: Double dice value
gameState.gameData.turnData.diceRoll *= 2;
```

**Validation:** Add warning if dice accessed before rolled

---

## 4. Once-Only Effects

### Requirements
- First-class tracking (not ad hoc)
- Persists even if source ship destroyed
- "Turn built" constraint enforced

### Current State
Already tracked in `gameState.gameData.turnData.onceOnlyAutomaticEffects`

### Implementation

**Ship definition:**
```typescript
{
  timing: PowerTiming.ONCE_ONLY_AUTOMATIC,
  phase: ShipPowerPhase.AUTOMATIC,
  baseAmount: 8,
  kind: EffectKind.DAMAGE
}
```

**Engine enforcement (PowerExecutor):**
```typescript
if (power.timing === PowerTiming.ONCE_ONLY_AUTOMATIC) {
  // Check if already used
  const alreadyUsed = gameState.gameData.turnData?.onceOnlyAutomaticEffects?.some(
    e => e.shipId === ship.id && e.effectType === `power_${power.powerIndex}`
  );
  
  if (alreadyUsed) return { effects: [] };
  
  // Enqueue effect
  const effects = [/* ... */];
  
  // Mark as used
  gameState.gameData.turnData.onceOnlyAutomaticEffects.push({
    shipId: ship.id,
    effectType: `power_${power.powerIndex}`,
    turn: gameState.roundNumber
  });
  
  return { effects, persistsIfSourceDestroyed: true };
}
```

**"Turn built" constraint:**
```typescript
// Add createdOnTurn to PlayerShip
interface PlayerShip {
  createdOnTurn?: number;
}

// Check in shouldExecutePower
if (power.onlyOnTurnBuilt && ship.createdOnTurn !== gameState.roundNumber) {
  return false;
}
```

---

## 5. Charge Declaration & Legality Enforcement

### Requirements
- "One power per subphase" enforced
- Valid targets enforced
- Charge depletion tracked

### Implementation

**Track charges in PlayerShip:**
```typescript
interface PlayerShip {
  chargesRemaining?: number;
  maxCharges?: number;
  chargesDeclaredThisPhase?: string[];  // Power indices used this phase
}
```

**Enforce "one power per subphase" (Carrier):**
```typescript
// In PowerExecutor before executing
if (power.requiresCharge) {
  if (ship.chargesDeclaredThisPhase?.includes(power.powerIndex.toString())) {
    return {
      gameState,
      warnings: ['Power already used this subphase']
    };
  }
}

// After executing
ship.chargesDeclaredThisPhase = [
  ...(ship.chargesDeclaredThisPhase || []),
  power.powerIndex.toString()
];
```

**Enforce target restrictions (Guardian):**
```typescript
// In ManualPowerOverrides or choice validation
'GUA_1': (power, context, choice) => {
  if (choice?.targetShip) {
    const targetShip = getShipById(choice.targetShip.shipId);
    if (targetShip.shipType !== ShipType.BASIC) {
      return {
        effects: [],
        warnings: ['Guardian can only target basic ships']
      };
    }
  }
  // ...
}
```

**Reset charges at turn end:**
```typescript
// In turn transition
for (const ship of allShips) {
  ship.chargesDeclaredThisPhase = [];
  // Replenish charges if needed
  if (ship.maxCharges) {
    ship.chargesRemaining = ship.maxCharges;
  }
}
```

---

## 6. Line Generation & Persistence

### Requirements
- Generated lines persist across turns
- Caps enforced (e.g., max 3 Orbitals)
- UI can query line sources

### Implementation

**Line tracking:**
```typescript
interface Player {
  lines: number;              // Total lines available
  savedLines?: number;        // Orbital/persistent lines
  bonusLines?: number;        // This turn only (SCI, etc.)
  diceLines?: number;         // From dice roll
}
```

**Orbital persistence:**
```typescript
// When Orbital built
player.savedLines = (player.savedLines || 0) + 1;

// Cap at 3 Orbitals
const orbitalCount = ships.filter(s => s.shipId === 'ORB').length;
if (orbitalCount > 3) {
  // Prevent building more than 3
  return { valid: false, reason: 'Maximum 3 Orbitals' };
}
```

**Line sources for UI:**
```typescript
function getLineBreakdown(player: Player, gameState: GameState): LineBreakdown {
  return {
    saved: player.savedLines || 0,
    bonus: calculateBonusLines(player, gameState),  // SCI, etc.
    dice: gameState.gameData.turnData?.diceRoll || 0,
    total: player.lines
  };
}
```

---

## 7. Phase & Subphase Canonical Mapping

### Problem
- CSV uses string subphases
- Engine uses enums
- UI uses step names
- Risk of drift

### Solution: Single Source of Truth

**File:** `/game/types/PhaseMapping.ts` (create)

```typescript
export const CANONICAL_PHASES = {
  // Build Phase
  DICE_ROLL: {
    csv: 'Dice Roll',
    engine: ShipPowerPhase.BUILD,
    uiStep: BuildPhaseStep.DICE_ROLL,
    systemDriven: true
  },
  LINE_GENERATION: {
    csv: 'Line Generation',
    engine: ShipPowerPhase.BUILD,
    uiStep: BuildPhaseStep.LINE_GENERATION,
    systemDriven: true
  },
  SHIPS_THAT_BUILD: {
    csv: 'Ships That Build',
    engine: ShipPowerPhase.BUILD,
    uiStep: BuildPhaseStep.SHIPS_THAT_BUILD,
    systemDriven: false,
    hidden: true
  },
  DRAWING: {
    csv: 'Drawing',
    engine: ShipPowerPhase.BUILD,
    uiStep: BuildPhaseStep.DRAWING,
    systemDriven: false,
    hidden: true
  },
  
  // Battle Phase
  FIRST_STRIKE: {
    csv: 'First Strike',
    engine: ShipPowerPhase.BATTLE,
    uiStep: BattlePhaseStep.FIRST_STRIKE,
    systemDriven: true
  },
  SIMULTANEOUS_DECLARATION: {
    csv: 'Simultaneous Declaration',
    engine: ShipPowerPhase.BATTLE,
    uiStep: BattlePhaseStep.SIMULTANEOUS_DECLARATION,
    systemDriven: false,
    hidden: true
  },
  CONDITIONAL_RESPONSE: {
    csv: 'Conditional Response',
    engine: ShipPowerPhase.BATTLE,
    uiStep: BattlePhaseStep.CONDITIONAL_RESPONSE,
    systemDriven: false,
    hidden: true
  },
  
  // Automatic (EOT)
  AUTOMATIC: {
    csv: 'Automatic',
    engine: ShipPowerPhase.AUTOMATIC,
    uiStep: null,  // Part of EOT Resolution
    systemDriven: true
  }
} as const;

// Helper functions
export function csvToEngine(csvSubphase: string): ShipPowerPhase | null {
  for (const phase of Object.values(CANONICAL_PHASES)) {
    if (phase.csv === csvSubphase) return phase.engine;
  }
  return null;
}
```

---

## 8. Human-First Golden Scenarios

### Test Suite: `HumanSpeciesTests.ts`

```typescript
describe('Human Species - Golden Scenarios', () => {
  
  test('Tactical Cruiser TYPE damage', () => {
    // Given: TAC, DEF, DEF, FIG (3 types)
    // When: EOT Resolution
    // Then: 3 damage dealt
  });
  
  test('Science Vessel: 1 SCI doubles healing', () => {
    // Given: 1 SCI, 1 DEF (heals 1)
    // When: EOT Resolution
    // Then: Opponent healed by 2 (doubled)
  });
  
  test('Science Vessel: 2 SCI doubles damage', () => {
    // Given: 2 SCI, 1 FIG (deals 1)
    // When: EOT Resolution
    // Then: Opponent takes 2 damage (doubled)
  });
  
  test('Science Vessel: 3 SCI adds dice lines', () => {
    // Given: 3 SCI, dice = 4
    // When: Line Generation
    // Then: +4 bonus lines
  });
  
  test('Starship once-only on turn built', () => {
    // Turn 1: Build Starship -> 8 damage enqueued
    // Turn 2: Starship still alive -> 0 damage
  });
  
  test('Carrier: one power per subphase', () => {
    // Attempt to use 2 powers in Ships That Build
    // Should fail on second attempt
  });
  
  test('Orbital: line saving + cap', () => {
    // Build 3 Orbitals -> +3 saved lines
    // Attempt to build 4th -> prevented
  });
  
  test('Frigate: trigger number logic', () => {
    // Set trigger = 4
    // Dice roll = 4 -> 6 damage
    // Dice roll = 3 -> 0 damage
  });
  
  test('Guardian: basic-only target', () => {
    // Attempt to destroy upgraded ship -> invalid
    // Destroy basic ship -> valid
  });
  
  test('Dreadnought: free Fighter on trigger', () => {
    // When Dreadnought destroyed
    // Free Fighter added to fleet
  });
  
  test('Leviathan: dice override + upgrade precondition', () => {
    // Set dice to 6
    // Verify dice is 6 for rest of turn
    // Verify upgrade requires 2 ORB or 2 BAT
  });
});
```

---

## Implementation Priority

### Phase 1: Foundation (Critical)
1. ✅ Move documentation files
2. ⬜ Implement DERIVED modifiers for Science Vessel
3. ⬜ Implement Tactical Cruiser TYPE counting
4. ⬜ Validate dice roll plumbing

### Phase 2: Power Features (High Priority)
5. ⬜ Once-only effect tracking (add createdOnTurn)
6. ⬜ Charge declaration tracking
7. ⬜ Line persistence (savedLines field)
8. ⬜ Target legality validation

### Phase 3: Polish (Medium Priority)
9. ⬜ Create PhaseMapping.ts
10. ⬜ Implement golden scenario tests
11. ⬜ Add UI query helpers

### Phase 4: Documentation (Low Priority)
12. ⬜ Document Human ship behaviors
13. ⬜ Create UI integration guide
14. ⬜ Update architecture docs

---

## Remaining Ambiguities

### ⚠️ Must Resolve Before UI

1. **Charge Replenishment Timing**
   - Q: When do charges replenish?
   - Options: (A) Start of turn, (B) End of turn, (C) Never (one-time)
   - **Decision needed:** Likely start of turn

2. **Orbital Cap Enforcement**
   - Q: What happens if Orbital destroyed then rebuilt?
   - A: Count current Orbitals, not historical builds

3. **Science Vessel Doubling: Additive or Multiplicative?**
   - Q: With 2 healers (1 each), does 1 SCI give 2+2=4 or 2*2=4?
   - A: Should be 2+2=4 (each healer's 1 doubled individually)
   - Confirm with game design

4. **TYPE Definition Edge Cases**
   - Q: Do upgrades change TYPE?
   - A: No - Leviathan II is still TYPE "LEV"
   - Q: Do stolen ships count?
   - A: Yes - they're in your fleet

5. **Frigate Trigger Number Persistence**
   - Q: Does trigger number persist across turns?
   - A: Yes - set once on build, lasts until destroyed
   - Store in: `ship.customState.frigateTargetNumber`

---

## Files to Modify

### Engine Core
- `/game/engine/PowerResolver.ts` - Add SCI, TAC logic
- `/game/engine/ManualPowerOverrides.ts` - Add Human ship overrides
- `/game/engine/PassiveModifiers.tsx` - Add SCI counting
- `/game/engine/EndOfTurnResolver.tsx` - Apply SCI multipliers
- `/game/engine/PowerExecutor.tsx` - Charge tracking

### Types
- `/game/types/GameTypes.ts` - Add PlayerShip fields (createdOnTurn, chargesDeclaredThisPhase)
- `/game/types/PhaseMapping.ts` - CREATE (canonical phase mapping)

### Data
- `/game/data/ShipDefinitions.engine.ts` - Add kind/overrides for Human ships

### Tests
- `/game/test/HumanSpeciesTests.ts` - CREATE (golden scenarios)

---

**Status:** Plan Complete - Ready for Implementation  
**Next Step:** Begin Phase 1 implementation
