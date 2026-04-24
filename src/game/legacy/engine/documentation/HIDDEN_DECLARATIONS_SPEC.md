# Legacy Hidden Declarations Specification

> Legacy reference only
> This document is retained for historical/reference purposes and does not define the current authoritative Shapeships architecture or runtime behavior. For current architectural truth, see `src/documentation/contracts/canonical-handoff.md` and `src/documentation/contracts/code-ownership-map.md`.

## 🎭 Core Concept

**Shapeships uses hidden declarations in BOTH Build Phase and Battle Phase.**

Players make simultaneous secret commitments, then reveal them together. This preserves the fog-of-war and strategic depth of tabletop play.

---

## Two Types of Hidden Declarations

### Type 1: Build Phase Hidden Declarations
**Steps:** Ships That Build + Drawing  
**Reveal Timing:** At the start of Battle Phase (FIRST_STRIKE step)  
**Why Hidden:** Players don't know what ships opponent built until Battle begins

### Type 2: Battle Phase Hidden Declarations
**Steps:** Simultaneous Declaration + Conditional Response  
**Reveal Timing:** Immediately when both players lock in  
**Why Hidden:** Preserves bluffing and simultaneous commitment mechanics

---

## Build Phase: Hidden Ship Building

### Workflow

```
1. SHIPS_THAT_BUILD step starts
   ├─ Player A secretly chooses which ships to use building powers from
   ├─ Player B secretly chooses which ships to use building powers from
   ├─ Both mark "Ready" when done
   └─ System advances to DRAWING (ships still hidden)

2. DRAWING step starts
   ├─ Player A secretly draws new ships and/or saves lines
   ├─ Player B secretly draws new ships and/or saves lines
   ├─ Both mark "Ready" when done
   └─ System advances to END_OF_BUILD (ships still hidden)

3. END_OF_BUILD step (automatic)
   └─ System resolves non-interactive effects

4. BATTLE_PHASE starts → FIRST_STRIKE step
   🎭 REVEAL: All ships built during Build Phase are now visible to both players
```

### What's Hidden During Build Phase

- Which ships were built
- Which ships used building powers
- How many lines were spent vs saved
- Total ship count (until revealed)

### When Build Declarations Reveal

**Timing:** At transition from `END_OF_BUILD` → `BATTLE_PHASE/FIRST_STRIKE`

**Implementation:**
```typescript
case BuildPhaseStep.END_OF_BUILD:
  return {
    fromMajorPhase: MajorPhase.BUILD_PHASE,
    fromStep: currentStep,
    toMajorPhase: MajorPhase.BATTLE_PHASE,
    toStep: BattlePhaseStep.FIRST_STRIKE,
    condition: () => true,
    onTransition: (state) => this.revealBuildPhaseShips(state) // ← Reveal here
  };
```

---

## Battle Phase: Hidden Charge/Solar Declarations

### Workflow

```
1. SIMULTANEOUS_DECLARATION step starts
   ├─ Player A secretly declares charges/solar powers to activate
   ├─ Player B secretly declares charges/solar powers to activate
   ├─ Both mark "Ready" when done
   └─ 🎭 REVEAL: Both declarations shown simultaneously

2. Check if any declarations were made
   ├─ If NO declarations → Skip to END_OF_TURN_RESOLUTION
   └─ If ANY declarations → Proceed to CONDITIONAL_RESPONSE

3. CONDITIONAL_RESPONSE step (only if declarations were made)
   ├─ Player A secretly declares response charges/solar powers
   ├─ Player B secretly declares response charges/solar powers
   ├─ Both mark "Ready" when done
   └─ 🎭 REVEAL: Both responses shown simultaneously

4. Proceed to END_OF_TURN_RESOLUTION
```

### What's Hidden During Battle Phase

- Which charges are being activated
- Which solar powers are being used
- Targets of abilities (if applicable)
- Whether passing or acting

### When Battle Declarations Reveal

**Timing:** Immediately when both players mark "Ready" for current step

**Implementation:**
```typescript
case BattlePhaseStep.SIMULTANEOUS_DECLARATION:
  // Wait for both players ready
  if (!areAllPlayersReady(gameState)) return null;
  
  // Reveal immediately
  return {
    onTransition: (state) => this.revealDeclarationsAndPrepareResponse(state)
  };
```

---

## Implementation Details

### Data Model

```typescript
interface TurnData {
  // Revealed declarations (visible to both players)
  chargeDeclarations: ChargeDeclaration[];
  solarPowerDeclarations: SolarPowerDeclaration[];
  
  // Pending declarations (hidden until reveal)
  pendingChargeDeclarations: { [playerId: string]: ChargeDeclaration[] };
  pendingSOLARPowerDeclarations: { [playerId: string]: SolarPowerDeclaration[] };
  
  // Track if any declarations were made
  anyDeclarationsMade?: boolean;
}
```

### Hidden Declaration Steps Detection

```typescript
function isHiddenDeclarationStep(currentStep: BuildPhaseStep | BattlePhaseStep | null): boolean {
  return currentStep === BuildPhaseStep.SHIPS_THAT_BUILD ||
         currentStep === BuildPhaseStep.DRAWING ||
         currentStep === BattlePhaseStep.SIMULTANEOUS_DECLARATION ||
         currentStep === BattlePhaseStep.CONDITIONAL_RESPONSE;
}
```

### UI Requirements

**During Hidden Declaration Steps:**
- Show local player's pending declarations (hidden from opponent)
- Show opponent ready state WITHOUT showing their declarations
- "Lock In" button to finalize declarations
- Waiting indicator when local player ready but opponent not ready
- Reveal animation when both players ready

**Visual States:**
```
┌─────────────────────────────────────┐
│ Your Declarations                   │
│ ✓ Interceptor Charge (3 damage)    │  ← Visible to you only
│ ✓ Nova Solar Power                 │
│                                     │
│ [Lock In Declarations] ← Button    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Opponent: Player 2                  │
│ 🔒 Declarations Hidden              │  ← Hidden from you
│ ⏳ Not Ready                        │  ← But you see ready state
└─────────────────────────────────────┘

↓ Both players lock in ↓

┌─────────────────────────────────────┐
│ 🎭 REVEALED DECLARATIONS            │
│                                     │
│ Player 1:                           │
│ • Interceptor Charge (3 damage)    │  ← Now visible to both
│ • Nova Solar Power                 │
│                                     │
│ Player 2:                           │
│ • Defender Healing (2 health)      │
│ • Pass (no actions)                │
└─────────────────────────────────────┘
```

---

## Key Differences Between Build and Battle Hidden Declarations

| Aspect | Build Phase | Battle Phase |
|--------|-------------|--------------|
| **Steps** | Ships That Build + Drawing | Simultaneous Declaration + Conditional Response |
| **Reveal Timing** | Delayed (at Battle Phase start) | Immediate (when both ready) |
| **What's Hidden** | Ships built, building powers used | Charges/Solar Powers activated |
| **Can Skip Response** | No (both steps always happen) | Yes (skip if no declarations) |
| **Reveal Trigger** | Phase transition | Both players ready |

---

## Testing Checklist

### Build Phase Hidden Declarations

- [ ] Ships built during SHIPS_THAT_BUILD are hidden from opponent
- [ ] Ships drawn during DRAWING are hidden from opponent
- [ ] Opponent can see ready state but not ship details
- [ ] Ships reveal at start of BATTLE_PHASE (FIRST_STRIKE step)
- [ ] Both players see same revealed ships

### Battle Phase Hidden Declarations

- [ ] Charges declared in SIMULTANEOUS_DECLARATION are hidden
- [ ] Solar Powers declared in SIMULTANEOUS_DECLARATION are hidden
- [ ] Opponent can see ready state but not action details
- [ ] Declarations reveal immediately when both ready
- [ ] If no declarations, CONDITIONAL_RESPONSE is skipped
- [ ] Response declarations also use hidden commitment model

---

## Common Mistakes to Avoid

### ❌ Mistake: "Build Phase is public, only Battle is hidden"
**✅ Correct:** Both phases use hidden declarations with different reveal timings

### ❌ Mistake: "Reveal Build ships as soon as both players ready"
**✅ Correct:** Build ships reveal at Battle Phase start, not at END_OF_BUILD

### ❌ Mistake: "Show opponent's declarations as they submit them"
**✅ Correct:** Always wait for BOTH players to lock in before revealing

### ❌ Mistake: "Different UI for Build vs Battle hidden declarations"
**✅ Correct:** Use same "Lock In" → "Waiting" → "Reveal" flow for both

---

## Why This Design?

### Strategic Depth
- **Bluffing:** Can you build defensively without opponent knowing?
- **Anticipation:** Must commit to charges without seeing opponent's response
- **Fog of War:** Tabletop feel where you don't see opponent's hand

### Simplicity
- **Consistent Model:** Same hidden→reveal pattern in both phases
- **No Priority System:** Both players act simultaneously, no "who goes first"
- **Clear Timing:** Reveal happens at well-defined moments

### Multiplayer Friendly
- **Fair Play:** Neither player has information advantage
- **Network Tolerant:** Can handle async submissions (wait for both)
- **Simple Sync:** Server just needs "are both ready?" check

---

## Summary

**All interactive steps in Shapeships are synchronous with hidden declarations:**

1. **Build Phase** (Ships That Build + Drawing) → Hidden until Battle starts
2. **Battle Phase** (Simultaneous Declaration + Response) → Hidden until both ready

**Key Rule:** Players NEVER see opponent's declarations until BOTH players have locked in their choices.

This preserves the core tabletop experience while working seamlessly in digital multiplayer.
