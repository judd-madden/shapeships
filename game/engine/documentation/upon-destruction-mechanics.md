# Upon Destruction Mechanics - Canonical Implementation

**Date:** 2024-12-23  
**Status:** 🔒 LOCKED IN - Do not deviate from this pattern

---

## 🔑 The Critical Rule

**"Upon Destruction" is an EVENT HOOK that fires when a ship is destroyed, regardless of phase.**

### Key Facts:

1. ✅ Destruction can occur in **multiple phases**:
   - Build Phase (Sacrificial Pool)
   - First Strike (Guardian)
   - Simultaneous Declaration / Conditional Response (Ship of Equality, Black Hole)
   - End of Turn Resolution (0 health)

2. ✅ "Upon Destruction" powers **always trigger** when ship is destroyed:
   - Not optional
   - Not prevented by source ship dying (obviously)
   - Phase is irrelevant

3. ✅ Effects are **queued immediately, resolved later**:
   - Queued when `isDestroyed` flips `false → true`
   - Resolved during End of Turn Resolution
   - Prevents race conditions

---

## 🧠 Correct Mental Model

### **1. Destruction Can Occur in Multiple Phases**

Zenith may be destroyed during:
- Build-phase effects (Sacrificial Pool)
- Battle-phase effects (Guardian, Ship of Equality)
- End-of-turn mass resolution (0 health)

**This is fine and expected.**

### **2. Destruction Fires an Event Immediately**

When `isDestroyed` flips `false → true`:
```typescript
onShipDestroyed(shipInstance, gameState)
```

This is the **single canonical trigger point**.

### **3. Power Registers a Triggered Effect**

"Upon Destruction" power responds by queuing:
```typescript
TriggeredEffect {
  effectType: BUILD_SHIP
  shipId: 'XEN'
  quantity: 3
  persistsIfSourceDestroyed: true  // Already destroyed!
}
```

### **4. Resolution Happens Safely Later**

Effects are:
- ✅ Added during End of Turn Resolution
- ✅ After all destruction for that turn is known
- ✅ Without interfering with ongoing destruction chains

This avoids race conditions like:
- ❌ "Does the Xenite exist in time to be destroyed too?"
- ❌ "Does it count for the same power twice?"

---

## ✅ Canonical Implementation Pattern

### **Central Event Handler**

```typescript
// Location: /game/engine/resolvers/DestructionHandler.tsx
// Called whenever a ship is destroyed, regardless of phase

function handleShipDestroyed(
  ship: PlayerShip, 
  gameState: GameState,
  destructionContext: {
    phase: string;
    causedBy?: string;  // Ship or power that caused destruction
    reason: 'damage' | 'power' | 'sacrificed';
  }
): void {
  // Mark ship as destroyed
  ship.isDestroyed = true;
  
  // Get ship definition
  const shipDef = getShipById(ship.shipId);
  if (!shipDef) return;
  
  // Check for "Upon Destruction" powers
  for (const power of shipDef.powers) {
    if (power.timing === PowerTiming.UPON_DESTRUCTION) {
      // Queue triggered effect (does NOT execute immediately)
      gameState.turnData.triggeredEffects.push({
        id: generateId(),
        sourceShipId: ship.id,
        sourcePlayerId: ship.ownerId,
        targetPlayerId: ship.ownerId,  // Zenith makes ships for its owner
        effectType: power.effectType,  // BUILD_SHIP, etc.
        shipIdToBuild: power.specialLogic?.customLogicId === 'zenith' ? 'XEN' : undefined,
        quantity: power.baseAmount ?? 1,
        persistsIfSourceDestroyed: true,  // Critical: ship already destroyed!
        triggeredAt: new Date().toISOString(),
        destructionContext  // Track where/how ship was destroyed
      });
    }
  }
  
  // Log destruction event
  console.log(`[Destruction] ${shipDef.name} destroyed in ${destructionContext.phase} - ${gameState.turnData.triggeredEffects.length} effects queued`);
}
```

### **Where to Call This Handler**

Call `handleShipDestroyed()` in **every location where a ship can be destroyed**:

```typescript
// 1. Ships That Build Phase (Sacrificial Pool)
if (action.type === 'sacrifice_ship') {
  const ship = findShip(action.shipId);
  handleShipDestroyed(ship, gameState, {
    phase: 'ships_that_build',
    reason: 'sacrificed',
    causedBy: 'sacrificial_pool'
  });
}

// 2. First Strike (Guardian)
if (guardianPower.effectType === PowerEffectType.DESTROY_SHIP) {
  const targetShip = findShip(targetShipId);
  handleShipDestroyed(targetShip, gameState, {
    phase: 'first_strike',
    reason: 'power',
    causedBy: guardianShip.id
  });
}

// 3. Battle Phase (Ship of Equality, Black Hole)
if (shouldDestroy) {
  handleShipDestroyed(ship, gameState, {
    phase: 'simultaneous_declaration',
    reason: 'power',
    causedBy: sourceShipId
  });
}

// 4. End of Turn Resolution (0 health)
for (const ship of allShips) {
  if (ship.health <= 0) {
    handleShipDestroyed(ship, gameState, {
      phase: 'end_of_turn_resolution',
      reason: 'damage'
    });
  }
}
```

---

## 🛠️ What NOT to Do

### ❌ **Don't Build Ships Immediately**
```typescript
// ❌ WRONG - creates race conditions
if (zenith.isDestroyed) {
  buildShip('XEN', gameState);  // Too early!
}
```

### ❌ **Don't Tie to Specific Phase**
```typescript
// ❌ WRONG - won't work if destroyed in different phase
if (currentPhase === 'end_of_turn' && zenith.isDestroyed) {
  queueEffect(...);
}
```

### ❌ **Don't Create Separate Logic Per Phase**
```typescript
// ❌ WRONG - duplicates logic, causes bugs
function handleBuildPhaseDestruction() { ... }
function handleBattlePhaseDestruction() { ... }
function handleEndOfTurnDestruction() { ... }
```

---

## 🧪 Edge-Case Validation (Zenith)

### ✅ **Sacrificial Pool (Build Phase)**
```
1. Player sacrifices Zenith intentionally
2. handleShipDestroyed() called
3. 3 Xenites queued in triggeredEffects
4. Xenites appear at End of Turn Resolution
```
**Result:** ✅ Correct

### ✅ **Guardian (First Strike)**
```
1. Guardian destroys Zenith before battle declarations
2. handleShipDestroyed() called
3. 3 Xenites queued
4. Xenites NOT available for charges this turn (created at end of turn)
```
**Result:** ✅ Correct - they shouldn't be available yet

### ✅ **Ship of Equality / Black Hole (Battle Phase)**
```
1. Zenith destroyed as part of mass destruction
2. handleShipDestroyed() called
3. 3 Xenites queued
4. Xenites created after destruction is finalized
```
**Result:** ✅ Correct

### ✅ **Zero Health (End of Turn)**
```
1. Zenith reduced to 0 health
2. handleShipDestroyed() called during resolution
3. 3 Xenites queued
4. Xenites still created (same turn)
```
**Result:** ✅ Correct

---

## 🧩 Interaction with Passive Powers

### **Sacrificial Pool Protection**

```typescript
// BEFORE attempting destruction
if (!passiveModifiers.canShipBeDestroyed(targetPlayerId)) {
  // Skip destruction entirely
  return { success: false, error: 'Ship protected by Sacrificial Pool' };
}

// ONLY if protection check passes:
handleShipDestroyed(ship, gameState, context);
```

**Key Rule:**
- Passive protection checked **before** destruction
- If passive prevents destruction:
  - `handleShipDestroyed()` is **never called**
  - "Upon Destruction" does **not trigger**

**This is correct and intuitive.**

---

## 📋 Implementation Checklist

When implementing "Upon Destruction" powers:

- [ ] Create `/game/engine/resolvers/DestructionHandler.tsx`
- [ ] Implement `handleShipDestroyed()` function
- [ ] Call handler from **all** destruction locations:
  - [ ] Ships That Build (Sacrificial Pool)
  - [ ] First Strike (Guardian)
  - [ ] Simultaneous Declaration (Ship of Equality, Black Hole)
  - [ ] End of Turn Resolution (0 health)
- [ ] Check passive protection **before** calling handler
- [ ] Queue effects in `gameState.turnData.triggeredEffects`
- [ ] Resolve effects during End of Turn Resolution
- [ ] Test with Zenith in all destruction scenarios

---

## 🎯 Ships with "Upon Destruction" Powers

From CSV data:

1. **Zenith** (Xenite) - "When this ship is destroyed, make 3 Xenites"
2. *(Add others as discovered in CSV)*

---

## 🔒 Lock-In Statement

**This pattern is CANONICAL and must be followed for ALL "Upon Destruction" powers.**

- ✅ Single event handler for all phases
- ✅ Queue effects immediately, resolve later
- ✅ Prevents race conditions and ordering bugs
- ✅ Clean separation of concerns

**Do not deviate from this pattern without explicit approval.**

---

**Next:** Implement `DestructionHandler.tsx` during Phase 3 (Engine Integration)
