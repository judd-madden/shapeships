# End of Turn Resolution Specification

## 🔒 Core Invariant (Non-Negotiable)

**No damage or healing is applied until End of Turn Resolution.**

This is the **ONLY** place in the entire engine where health values change.

---

## Key Distinction: Triggered vs Evaluated Effects

### Triggered Effects

**Definition:** Effects that happen earlier in the turn but resolve later.

**Key property:** Once triggered, they **ALWAYS** resolve (even if source ship destroyed).

```typescript
type TriggeredEffect = {
  id: string;
  sourceShipId: string;
  sourcePlayerId: string;
  targetPlayerId: string;
  effectType: 'DAMAGE' | 'HEAL';
  value: number;
  persistsIfSourceDestroyed: boolean; // Usually true
  description: string;
  triggeredAt: string;
};
```

**Examples:**
- ✅ Once-only ship completion effects ("Upon Completion: 5 damage")
- ✅ Charges (activated during Battle Phase)
- ✅ Solar Powers (activated during Battle Phase)

**When created:**
- Build Phase (once-only effects when ship completes)
- Battle Phase (charges and solar powers declared)

**When resolved:**
- End of Turn Resolution

**Critical rule:**
```
If persistsIfSourceDestroyed = true:
  Effect resolves EVEN IF source ship is destroyed before End of Turn
```

---

### Evaluated Effects

**Definition:** Effects determined at resolution time, not earlier.

**Key property:** Require the ship to **STILL EXIST** at End of Turn Resolution.

```typescript
type EvaluatedEffect = {
  sourceShipId: string;
  sourcePlayerId: string;
  targetPlayerId: string;
  effectType: 'DAMAGE' | 'HEAL';
  value: number;
  requiresShipAlive: true;
  requiresOwnershipUnchanged?: boolean;
};
```

**Examples:**
- ✅ Continuous Automatic effects ("Each turn: 2 damage")
- ✅ "Each turn" effects

**When created:**
- Never "queued" - calculated fresh at End of Turn Resolution

**When resolved:**
- End of Turn Resolution (calculated at resolution time)

**Critical rule:**
```
At End of Turn Resolution:
  For each ship with Continuous Automatic power:
    IF ship.isDestroyed === false AND ship.isConsumedInUpgrade === false:
      Create EvaluatedEffect
      Apply it immediately
    ELSE:
      Skip (ship no longer qualifies)
```

---

## End of Turn Resolution Algorithm (Canonical)

### Step 1: Collect Triggered Effects

```typescript
const effects: Array<TriggeredEffect | EvaluatedEffect> = [];

// Get all triggered effects from turnData
for (const triggeredEffect of gameState.turnData.triggeredEffects) {
  if (triggeredEffect.persistsIfSourceDestroyed) {
    // Always apply (once-only, charges, solar powers)
    effects.push(triggeredEffect);
  } else {
    // Check if source ship still exists
    const ship = findShip(triggeredEffect.sourceShipId);
    if (ship && !ship.isDestroyed && !ship.isConsumedInUpgrade) {
      effects.push(triggeredEffect);
    }
    // Otherwise skip - ship destroyed
  }
}
```

### Step 2: Evaluate Continuous Automatic Effects

```typescript
// For each player
for (const player of players) {
  // For each ship
  for (const ship of player.ships) {
    // Skip destroyed or consumed ships
    if (ship.isDestroyed || ship.isConsumedInUpgrade) continue;
    
    // Find Continuous Automatic powers
    for (const power of ship.automaticPowers) {
      if (power.timing === 'Continuous') {
        // Create evaluated effect
        effects.push({
          sourceShipId: ship.id,
          sourcePlayerId: player.id,
          targetPlayerId: getTarget(power),
          effectType: power.effectType,
          value: power.value,
          requiresShipAlive: true
        });
      }
    }
  }
}
```

### Step 3: Apply All Effects Simultaneously

```typescript
// Tally health changes
const healthDeltas = {
  [player1Id]: { damage: 0, healing: 0 },
  [player2Id]: { damage: 0, healing: 0 }
};

for (const effect of effects) {
  if (effect.effectType === 'DAMAGE') {
    healthDeltas[effect.targetPlayerId].damage += effect.value;
  } else if (effect.effectType === 'HEAL') {
    healthDeltas[effect.targetPlayerId].healing += effect.value;
  }
}

// Apply changes
for (const playerId in healthDeltas) {
  const delta = healthDeltas[playerId];
  const netChange = delta.healing - delta.damage;
  player.health = player.health + netChange;
}
```

### Step 4: Cap Health and Check Win/Loss

```typescript
const MAX_HEALTH = 35;

for (const player of players) {
  // Cap health
  if (player.health > MAX_HEALTH) {
    player.health = MAX_HEALTH;
  } else if (player.health <= 0) {
    player.health = 0;
    player.isActive = false; // Player defeated
  }
}

// Check win condition
const alivePlayers = players.filter(p => p.health > 0);
if (alivePlayers.length === 1) {
  gameState.status = 'completed';
  gameState.winner = alivePlayers[0].id;
}
```

---

## Crucial Rules Enforced

### Rule 1: Once-Only Effects Ignore Destruction

```typescript
// Build Phase: Ship completes with "Upon Completion: 5 damage"
const effect: TriggeredEffect = {
  effectType: 'DAMAGE',
  value: 5,
  persistsIfSourceDestroyed: true // ← KEY
};
gameState.turnData.triggeredEffects.push(effect);

// Battle Phase: Ship is destroyed by First Strike
ship.isDestroyed = true;

// End of Turn Resolution: Effect STILL applies
// The 5 damage resolves even though ship is gone
```

### Rule 2: Continuous Effects Require Survival

```typescript
// Ship has "Each turn: 2 damage" (Continuous Automatic)

// End of Turn Resolution:
if (ship.isDestroyed || ship.isConsumedInUpgrade) {
  // Skip - ship must be alive to generate Continuous effects
} else {
  // Apply the 2 damage
}
```

### Rule 3: Order Does Not Matter

```typescript
// These produce identical results:
effects = [damageA, healB, damageC];
effects = [healB, damageA, damageC];
effects = [damageC, damageA, healB];

// Because all effects are tallied first, then applied simultaneously
```

### Rule 4: Health Changes Are Atomic

```typescript
// Wrong approach:
for (const effect of effects) {
  applyEffect(effect); // ❌ Health changes mid-loop
}

// Correct approach:
const deltas = tallyEffects(effects);
applyDeltas(deltas); // ✅ All changes at once
```

### Rule 5: Win/Loss Only Checked Here

```typescript
// Wrong: Checking win condition during Battle Phase
if (estimatedDamage >= opponent.health) {
  endGame(); // ❌ Health hasn't changed yet!
}

// Correct: Only check after health finalized
function finalizeHealth() {
  // Apply all health changes
  // Cap health
  // THEN check win/loss
}
```

---

## Example Scenarios

### Scenario 1: Once-Only Effect Persists

**Setup:**
- Player builds Interceptor with "Upon Completion: 5 damage"
- Effect queued as TriggeredEffect (persistsIfSourceDestroyed = true)

**During Battle Phase:**
- Opponent uses First Strike to destroy Interceptor
- Interceptor.isDestroyed = true

**End of Turn Resolution:**
1. Collect triggered effects
2. Interceptor's "5 damage" effect is in the list
3. Check: persistsIfSourceDestroyed = true
4. **Apply the 5 damage** (even though Interceptor is destroyed)

**Result:** Opponent takes 5 damage

---

### Scenario 2: Continuous Effect Requires Survival

**Setup:**
- Player has Defender with "Each turn: 2 healing"
- This is a Continuous Automatic effect (not triggered)

**During Battle Phase:**
- Opponent destroys Defender
- Defender.isDestroyed = true

**End of Turn Resolution:**
1. Evaluate continuous effects
2. Check: Is Defender alive?
3. **No** - skip this effect
4. Player does NOT heal 2

**Result:** No healing occurs

---

### Scenario 3: Multiple Effects Simultaneous

**Setup:**
- Player A has 10 health
- Player B has 15 health

**Triggered Effects:**
- Player A will take 8 damage (from charges)
- Player A will heal 5 (from Solar Power)
- Player B will take 12 damage (from continuous effect)

**End of Turn Resolution:**
1. Tally:
   - Player A: -8 damage, +5 healing = -3 net
   - Player B: -12 damage = -12 net
2. Apply:
   - Player A: 10 + (-3) = 7 health
   - Player B: 15 + (-12) = 3 health
3. Cap health (no change needed)
4. Check win/loss: Both alive, game continues

---

## Common Mistakes to Avoid

### ❌ Mistake: Applying damage during Battle Phase
```typescript
// Battle Phase
const damage = charge.power.value;
opponent.health -= damage; // ❌ WRONG - health changes mid-turn
```

**✅ Correct:**
```typescript
// Battle Phase
const effect: TriggeredEffect = {
  effectType: 'DAMAGE',
  value: charge.power.value,
  persistsIfSourceDestroyed: true
};
gameState.turnData.triggeredEffects.push(effect);

// End of Turn Resolution
applyEffect(effect); // ✅ RIGHT - health changes only here
```

---

### ❌ Mistake: Skipping Once-Only if ship destroyed
```typescript
// End of Turn Resolution
if (!ship.isDestroyed) {
  applyEffect(onceOnlyEffect); // ❌ WRONG
}
```

**✅ Correct:**
```typescript
// End of Turn Resolution
if (effect.persistsIfSourceDestroyed || !ship.isDestroyed) {
  applyEffect(effect); // ✅ RIGHT
}
```

---

### ❌ Mistake: Applying effects in order
```typescript
// End of Turn Resolution
for (const effect of effects) {
  player.health += effect.value; // ❌ WRONG - order-dependent
}
```

**✅ Correct:**
```typescript
// End of Turn Resolution
const deltas = tallyEffects(effects); // Tally all first
applyDeltas(deltas); // Apply all at once
```

---

## Testing Checklist

- [ ] Once-only effect applies even if ship destroyed before End of Turn
- [ ] Continuous effect skipped if ship destroyed before End of Turn
- [ ] Health changes are atomic (all at once, not incremental)
- [ ] Win/loss only checked after health finalized
- [ ] Effect order doesn't matter (same result regardless of order)
- [ ] Health capped to [0, MAX_HEALTH] after all effects applied
- [ ] Multiple effects targeting same player tally correctly
- [ ] Empty effect list doesn't crash (graceful handling)
