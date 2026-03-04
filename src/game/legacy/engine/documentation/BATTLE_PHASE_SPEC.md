# Battle Phase Specification

## 🔒 Core Principle (Non-Negotiable)

**Battle Phase actions are simultaneous commitments, not turn-based actions.**

There are exactly **two commitment windows, max**:
1. **Declaration** (always)
2. **Response** (only if needed)

**No back-and-forth. No reacting to revealed info in the same step.**

---

## Data Model: Battle Commitments

### Type Definition

```typescript
type HiddenBattleActions = {
  charges: ChargeDeclaration[];
  solarPowers: SolarDeclaration[];
};

type BattleCommitmentState = {
  declaration?: {
    [playerId: string]: HiddenBattleActions;
  };
  response?: {
    [playerId: string]: HiddenBattleActions;
  };
  declarationRevealed: boolean;
  responseRevealed: boolean;
  anyDeclarationsMade: boolean;
};
```

### Important Properties

- **Hidden until both players are ready**
- **Stored per-player**
- **Immutable once revealed**

---

## Battle Phase Flow (Authoritative)

### Step 1: First Strike (System)

**Type:** Automatic (no player input)

**Actions:**
1. Resolve First Strike powers
2. Destroy ships immediately
3. No commitments yet

### Step 2: Simultaneous Declaration

**Type:** Simultaneous Hidden Commitment

**For each player (independently):**
1. Choose zero or more **Charges** to activate
2. Choose zero or more **Solar Powers** to use
3. Submit **hidden** declaration
4. Mark **"Ready"**

**System behavior:**
1. Wait until **both players are Ready**
2. **Reveal** both declarations simultaneously
3. Lock them permanently

**Branch logic:**
- If **neither player declared anything** → skip Response, go to End of Turn Resolution
- If **either player declared anything** → proceed to Response

### Step 3: Conditional Simultaneous Response

**Type:** Simultaneous Hidden Commitment (one time only)

**Same structure as Declaration:**

**For each player (independently):**
1. Choose zero or more **Charges**
2. Choose zero or more **Solar Powers**
3. Submit **hidden** response
4. Mark **"Ready"**

**System behavior:**
1. Wait until **both players are Ready**
2. **Reveal** both responses simultaneously
3. Lock them permanently

**Then proceed to End of Turn Resolution**

---

## Why This Model is Correct

✅ **Matches tabletop intent** - Simultaneous hidden commitments like tabletop card games

✅ **Preserves bluffing** - Players don't see opponent's actions before deciding

✅ **Requires explicit readiness** - Both players must confirm before revealing

✅ **No priority bugs** - Everything resolves simultaneously

✅ **No infinite loops** - Exactly 2 windows max, no recursion

✅ **UI is simple** - commit → ready → reveal

---

## What NOT to Do

❌ **No per-action resolution** - All actions revealed at once

❌ **No "waiting for opponent to respond"** - Both players submit simultaneously

❌ **No loops** - Response happens exactly once (if at all)

❌ **No mid-reveal decisions** - Once revealed, no more actions until next window

❌ **No priority systems** - No "faster ship goes first" logic

❌ **No reaction chains** - Can't react to a reaction in same window

---

## Implementation Checklist

### ActionResolver Requirements

- [ ] `initializeBattleCommitments()` - Create empty commitment state
- [ ] `submitBattleActions(player, actions, window)` - Store hidden actions
- [ ] `areBothPlayersReady(commitmentState, window)` - Check if can reveal
- [ ] `revealBattleActions(commitmentState, window)` - Mark actions as revealed
- [ ] `processBattleCommitment(gameState, player, actions, window)` - Create TriggeredEffects

### UI Requirements

- [ ] Hidden declaration panel for each player
- [ ] "Lock In" button to submit hidden actions
- [ ] Opponent ready indicator (without showing their actions)
- [ ] Reveal animation when both ready
- [ ] Revealed actions display panel

### Game State Requirements

- [ ] `gameData.turnData.battleCommitments` - BattleCommitmentState
- [ ] `gameData.turnData.triggeredEffects` - TriggeredEffect[]
- [ ] Track which window we're in (declaration vs response)
- [ ] Track if any declarations were made (determines if Response happens)

---

## Testing Scenarios

### Scenario 1: No Declarations
1. Both players submit empty declarations
2. System reveals (nothing to show)
3. Skip Response → End of Turn Resolution

### Scenario 2: One Player Declares
1. Player A declares 2 charges
2. Player B declares nothing
3. Both mark ready → Reveal
4. Proceed to Response window

### Scenario 3: Both Players Declare
1. Player A declares 1 charge
2. Player B declares 1 solar power
3. Both mark ready → Reveal
4. Proceed to Response window
5. Both respond or pass
6. Both mark ready → Reveal
7. End of Turn Resolution

### Scenario 4: Response with Nothing
1. Declaration window has actions
2. Response window both players submit empty
3. Both mark ready → Reveal (nothing to show)
4. End of Turn Resolution

---

## Common Mistakes to Avoid

### ❌ Mistake: "Player A acts, then Player B responds"
**✅ Correct:** Both players submit simultaneously, then reveal together

### ❌ Mistake: "Let Player A respond to Player B's response"
**✅ Correct:** Response window happens exactly once

### ❌ Mistake: "Reveal actions as they're submitted"
**✅ Correct:** Hide all actions until both players ready

### ❌ Mistake: "Allow changing actions after submission"
**✅ Correct:** Once locked in, actions are immutable

### ❌ Mistake: "Apply damage/healing during Battle Phase"
**✅ Correct:** Queue TriggeredEffects for End of Turn Resolution
