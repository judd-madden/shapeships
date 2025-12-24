# ActionTypes Contract - Action Resolution Layer Semantics

**Date:** 2024-12-23  
**Purpose:** Define precise semantics for ActionTypes and action resolution patterns  
**Audience:** Future developers implementing action resolution and UI  

---

## 🎯 Core Principle

The Action Resolution Layer mediates between:
- **Game Rules** (what's possible)
- **Player Input** (what players choose)
- **Effect Queue** (what happens)

**CRITICAL:** Actions are player-driven choices, not automatic executions.

---

## 📋 ActionType Taxonomy

### Player-Initiated Actions

These require explicit player choice:

#### CHARGE_USE
**When:** First Strike or Simultaneous Declaration phases  
**Purpose:** Use a charge power (Guardian, Equality, Juggernaut, etc.)  
**Flow:**
1. Player selects ship with charges
2. System creates PendingAction with options (use charge(s) or skip)
3. Player chooses option
4. Effects queued for resolution

**Example:**
```typescript
{
  type: 'CHARGE_USE',
  shipId: 'guardian-1',
  mandatory: false, // Player can skip
  options: [
    { id: 'use_1', label: 'Destroy 1 enemy ship', cost: { charges: 1 } },
    { id: 'skip', label: 'Skip' }
  ]
}
```

#### CHARGE_RESPONSE
**When:** Conditional Response phase (after opponent uses charges)  
**Purpose:** Respond to opponent's charge use with conditional powers  
**Flow:**
1. Opponent uses charges in Simultaneous Declaration
2. System checks for response powers (Equality, Black Hole)
3. If present, creates CHARGE_RESPONSE PendingAction
4. Player chooses whether to respond
5. Response effects queued

**Example:**
```typescript
{
  type: 'CHARGE_RESPONSE',
  shipId: 'equality-1',
  mandatory: false, // Can choose not to respond
  options: [
    { id: 'respond', label: 'Use Equality charge in response', cost: { charges: 1 } },
    { id: 'skip', label: 'Do not respond' }
  ],
  metadata: {
    description: 'Opponent used Guardian charge'
  }
}
```

**CRITICAL:** CHARGE_RESPONSE only appears in response window phases.

#### SHIP_BUILD
**When:** Ships That Build or Drawing phases  
**Purpose:** Build a basic ship or upgrade ships  
**Flow:**
1. System checks available lines and joining lines
2. Creates PendingAction with buildable ships
3. Player selects ship to build
4. Ship added to battlefield, resources deducted

**Example:**
```typescript
{
  type: 'SHIP_BUILD',
  mandatory: false,
  options: [
    { id: 'build_xen', label: 'Build Xenite', cost: { lines: 1 } },
    { id: 'build_ant', label: 'Build Antlion', cost: { lines: 3 } },
    { id: 'upgrade_dsw', label: 'Upgrade Defense Swarm', cost: { lines: 9, joiningLines: 3 } },
    { id: 'done', label: 'Done building' }
  ]
}
```

#### SHIP_TRANSFORM
**When:** Drawing phase (with Evolver)  
**Purpose:** Transform Xenite into Oxite or Asterite  
**Flow:**
1. Evolver power triggers
2. System creates PendingAction for each Xenite
3. Player chooses transformation
4. Original ship replaced with transformed ship

**Example:**
```typescript
{
  type: 'SHIP_TRANSFORM',
  shipId: 'xenite-5',
  mandatory: true, // Evolver forces transformation
  options: [
    { id: 'to_oxite', label: 'Transform to Oxite' },
    { id: 'to_asterite', label: 'Transform to Asterite' }
  ]
}
```

#### TRIGGER_SELECTION
**When:** Drawing phase (with Frigate)  
**Purpose:** Choose which dice value triggers Frigate's power  
**Flow:**
1. Frigate built
2. System creates PendingAction with dice values 1-6
3. Player chooses trigger value
4. Frigate stores chosen value for future turns

**Example:**
```typescript
{
  type: 'TRIGGER_SELECTION',
  shipId: 'frigate-1',
  mandatory: true, // Must choose before advancing
  options: [
    { id: 'trigger_1', label: 'Trigger on dice roll 1' },
    { id: 'trigger_2', label: 'Trigger on dice roll 2' },
    // ... up to 6
  ]
}
```

#### DICE_REROLL
**When:** Dice Roll step (with Ark of Knowledge)  
**Purpose:** Reroll the dice  
**Flow:**
1. Dice rolled
2. Ark of Knowledge checks scaling (4× ship types built)
3. If scaling allows, creates PendingAction
4. Player chooses to reroll or keep
5. If reroll, new dice value replaces old

**Example:**
```typescript
{
  type: 'DICE_REROLL',
  shipId: 'ark-of-knowledge-1',
  mandatory: false, // Player can keep current roll
  options: [
    { id: 'reroll', label: 'Reroll dice (current: 2)' },
    { id: 'keep', label: 'Keep dice value 2' }
  ],
  metadata: {
    description: '4× ship types built = 12, allows 1 reroll'
  }
}
```

#### SHIP_DESTROY
**When:** Ships That Build phase (with Sacrificial Pool)  
**Purpose:** Destroy own ship to gain lines  
**Flow:**
1. Sacrificial Pool power triggers
2. System creates PendingAction with destroyable ships
3. Player chooses ship to destroy (or skip)
4. Ship destroyed, lines gained

**Example:**
```typescript
{
  type: 'SHIP_DESTROY',
  shipId: 'sacrificial-pool-1',
  mandatory: false, // Can choose not to destroy
  options: [
    { id: 'destroy_xen_1', label: 'Destroy Xenite #1 (gain 2 lines)' },
    { id: 'destroy_ant_2', label: 'Destroy Antlion #2 (gain 4 lines)' },
    { id: 'skip', label: 'Do not destroy any ships' }
  ]
}
```

#### DECLARE_READY
**When:** Any phase with player input  
**Purpose:** Signal no more actions this phase  
**Flow:**
1. Player has no mandatory actions remaining
2. Player clicks "Ready" button
3. System marks player as READY
4. When both players ready, phase advances

**Example:**
```typescript
{
  type: 'DECLARE_READY',
  mandatory: false, // Can continue taking optional actions
  options: [
    { id: 'ready', label: 'Ready (advance phase)' }
  ]
}
```

---

## 🔑 Key Semantic Rules

### Rule 1: mandatory = Must Resolve to Advance

**What it means:**
- Player MUST choose one of the options
- Phase CANNOT advance until resolved
- "Ready" button is disabled

**What it DOES NOT mean:**
- ❌ Forced to use a power (can have "skip" option)
- ❌ Automatic execution (player still chooses)
- ❌ Required to use resources (can choose free option)

**Examples:**

**Mandatory with choice:**
```typescript
{
  type: 'TRIGGER_SELECTION',
  mandatory: true, // Must choose before advancing
  options: [
    { id: 'trigger_1', label: '1' },
    { id: 'trigger_2', label: '2' },
    // ... player MUST pick one, but has choice
  ]
}
```

**Non-mandatory (optional use):**
```typescript
{
  type: 'CHARGE_USE',
  mandatory: false, // Can skip
  options: [
    { id: 'use', label: 'Use Guardian charge', cost: { charges: 1 } },
    { id: 'skip', label: 'Skip' } // This makes it optional
  ]
}
```

**Engine Contract:**
```typescript
function canPlayerDeclareReady(playerId: string, state: PhaseActionState): boolean {
  const playerState = state.playerStates[playerId];
  
  // Check for mandatory actions
  const hasMandatory = playerState.pendingActions.some(action => action.mandatory);
  
  return !hasMandatory; // Can only ready if no mandatory actions
}
```

### Rule 2: One Action Option Can Queue Multiple Effects

**Purpose:** Complex powers may have multi-effect resolution.

**Examples:**

**Simple (single effect):**
```typescript
{
  chosenOption: 'heal_5',
  resolvedEffects: [
    { type: 'HEALING', value: 5 }
  ]
}
```

**Complex (multiple effects):**
```typescript
{
  chosenOption: 'zenith_dice_3',
  resolvedEffects: [
    { type: 'BUILD_SHIP', targetShipType: 'ANT' },
    { type: 'GENERATE_LINES', value: 1 } // Bonus from another ship
  ]
}
```

**Conditional (based on game state):**
```typescript
{
  chosenOption: 'defense_swarm_conditional',
  resolvedEffects: [
    { type: 'HEALING', value: 7 }, // Health was lower, so 7 instead of 3
    { type: 'HEALING', value: 6 }  // Science Vessel doubled it
  ]
}
```

**Engine Contract:**
```typescript
function resolveAction(action: PendingAction, chosenOption: string): CompletedAction {
  const option = action.options.find(o => o.id === chosenOption);
  
  // Get base effect(s) from option
  const baseEffects = option.effect ? [option.effect] : [];
  
  // Apply modifiers (Science Vessel, Ark of Knowledge, etc.)
  const modifiedEffects = applyPassiveModifiers(baseEffects, gameState);
  
  // Check for additional triggered effects
  const triggeredEffects = checkTriggeredEffects(action, chosenOption, gameState);
  
  return {
    actionId: action.actionId,
    playerId: action.playerId,
    chosenOption: chosenOption,
    timestamp: Date.now(),
    resolvedEffects: [...modifiedEffects, ...triggeredEffects] // Can be multiple!
  };
}
```

### Rule 3: isResponseWindow = Conditional Response Phase

**Purpose:** Distinguish response phases from normal action phases.

**When true:**
- Only CHARGE_RESPONSE actions appear
- Only triggers if opponent used charges
- Player can choose not to respond (not mandatory)

**Example:**

**Simultaneous Declaration (not a response window):**
```typescript
{
  phase: 'simultaneous_declaration',
  phaseMetadata: {
    acceptsPlayerInput: true,
    isResponseWindow: false // Players declare simultaneously
  }
}
```

**Conditional Response (response window):**
```typescript
{
  phase: 'conditional_response',
  phaseMetadata: {
    acceptsPlayerInput: true,
    isResponseWindow: true // Players respond to opponent's charges
  }
}
```

**Engine Contract:**
```typescript
function generatePendingActions(phase: string, gameState: GameState): PendingAction[] {
  const metadata = gameState.phaseActionState.phaseMetadata;
  
  if (metadata?.isResponseWindow) {
    // Only generate CHARGE_RESPONSE actions
    return generateChargeResponseActions(gameState);
  } else {
    // Generate normal actions for this phase
    return generatePhaseActions(phase, gameState);
  }
}
```

**UI Implications:**
- Response windows show different UI ("Opponent used Guardian charge - respond?")
- Non-response phases show normal action UI
- Response windows may have time limits (future)

### Rule 4: CHARGE_RESPONSE vs CHARGE_USE

**CHARGE_USE:**
- Proactive charge usage
- First Strike or Simultaneous Declaration
- Player initiates

**CHARGE_RESPONSE:**
- Reactive charge usage
- Conditional Response phase only
- Triggered by opponent's action

**Example Sequence:**
```typescript
// Turn 1, Simultaneous Declaration
Player A: {
  type: 'CHARGE_USE',
  shipId: 'guardian-1',
  options: [
    { id: 'use', label: 'Use Guardian charge' },
    { id: 'skip', label: 'Skip' }
  ]
}

// Both players declare → reveal

// Turn 1, Conditional Response (if Player A used charge)
Player B: {
  type: 'CHARGE_RESPONSE', // Different type!
  shipId: 'equality-1',
  options: [
    { id: 'respond', label: 'Use Equality charge in response' },
    { id: 'skip', label: 'Do not respond' }
  ]
}
```

**CRITICAL:** Do not confuse these - they have different semantics.

---

## 🧪 Test Cases

### Test 1: Mandatory Action Blocks Ready
```typescript
// Setup: Frigate built, must choose trigger
// Action: Try to click "Ready"
// Expected: Ready button disabled
// Verification: canDeclareReady = false
```

### Test 2: Multiple Effects from Single Choice
```typescript
// Setup: Zenith + Science Vessel, dice roll 3
// Action: Zenith dice conditional triggers
// Expected: BUILD_SHIP (Antlion) + HEALING (Science Vessel bonus)
// Verification: resolvedEffects.length === 2
```

### Test 3: Response Window Only Shows CHARGE_RESPONSE
```typescript
// Setup: Opponent used Guardian charge
// Action: Enter Conditional Response phase
// Expected: Only CHARGE_RESPONSE actions appear (not CHARGE_USE)
// Verification: pendingActions.every(a => a.type === 'CHARGE_RESPONSE')
```

### Test 4: Non-Mandatory with Skip Option
```typescript
// Setup: Guardian has 1 charge
// Action: Simultaneous Declaration phase
// Expected: Can choose "use" or "skip", not forced
// Verification: mandatory === false, options includes skip
```

---

## 📐 Phase → ActionType Matrix

| Phase | CHARGE_USE | CHARGE_RESPONSE | SHIP_BUILD | SHIP_TRANSFORM | TRIGGER_SELECTION | DICE_REROLL | SHIP_DESTROY |
|-------|------------|-----------------|------------|----------------|-------------------|-------------|--------------|
| Dice Roll | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Ships That Build | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Drawing | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| First Strike | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Simultaneous Declaration | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Conditional Response | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📝 Implementation Checklist

### Action Generation
- [ ] Check phase before generating actions
- [ ] Respect isResponseWindow flag
- [ ] Mark actions as mandatory correctly
- [ ] Include "skip" option for optional actions
- [ ] Set metadata appropriately

### Action Resolution
- [ ] Validate player can take action
- [ ] Deduct costs before resolving
- [ ] Allow multiple effects per action
- [ ] Apply passive modifiers
- [ ] Queue effects for resolution phase

### Ready State Management
- [ ] Block ready if mandatory actions pending
- [ ] Allow ready if only optional actions
- [ ] Auto-ready if no actions (system-driven steps)
- [ ] Advance phase when both players ready

### UI Integration
- [ ] Disable actions player cannot afford
- [ ] Show "mandatory" indicator
- [ ] Display response window context
- [ ] Update ready button state
- [ ] Show queued effects

---

## 🎯 Summary

**ActionType** = What kind of player choice  
**mandatory** = Must resolve to advance (not "forced use")  
**resolvedEffects** = Can be multiple effects  
**isResponseWindow** = Conditional response phase  

**Critical Rules:**
1. mandatory ≠ forced use (can have skip option)
2. One action option can queue multiple effects
3. CHARGE_RESPONSE only in response windows
4. Ready blocked by mandatory actions only

---

**This document is normative - follow it exactly to prevent UI/action bugs.**
