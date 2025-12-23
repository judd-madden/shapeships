# Action Resolution Layer

## Overview

The Action Resolution Layer sits between the Phase Engine and the UI, managing player actions within game phases and determining when phases can advance.

## Architecture

```
┌─────────────────────────────────────────────┐
│          UI Components (React)              │
│  - ActionPanel.tsx                          │
│  - Displays pending actions                 │
│  - Shows "Ready" button state               │
│  - Renders action choices                   │
└─────────────────┬───────────────────────────┘
                  │
                  ↓ useActionResolver hook
┌─────────────────────────────────────────────┐
│       Action Resolution Layer               │
│  - ActionResolver.tsx (engine logic)        │
│  - calculatePhaseActions()                  │
│  - resolvePlayerAction()                    │
│  - canAdvancePhase()                        │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│         Phase Engine (GamePhases)           │
│  - 3-phase system (Build, Battle, End)     │
│  - Phase skipping logic                     │
│  - Phase order/structure                    │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│        Game Engine (GameEngine)             │
│  - Pure game logic                          │
│  - Ship data, health, resources             │
│  - State mutations                          │
└─────────────────────────────────────────────┘
```

## Core Concepts

### 1. Phase vs Action State

**Phase State** (from GamePhases):
- What phase are we in?
- What's the order of phases?
- Which phases should be skipped?

**Action State** (from ActionResolver):
- What actions can/must each player take?
- Have mandatory actions been completed?
- Can we advance to the next phase?

### 2. Mandatory vs Optional Actions

**Mandatory Actions** (block phase advancement):
- Frigate: Choose trigger number (1-6)
- Any action where the ship power says "must" or is required

**Optional Actions** (can be skipped):
- All charge uses
- Evolver transformations
- Carrier/Bug Breeder ship building
- Dice rerolls

**Players can declare ready to forfeit optional actions.**

### 3. Action Resolution Flow

```
1. Enter Phase
   ↓
2. ActionResolver.calculatePhaseActions()
   → Determines what actions are available
   ↓
3. Player Takes Action
   ↓
4. ActionResolver.resolvePlayerAction()
   → Validates and processes action
   → Queues effects for Health Resolution
   ↓
5. Recalculate Phase Actions
   → Check if any new actions created
   → Update blocking status
   ↓
6. Both Players Ready?
   ↓
7. Advance to Next Phase
```

## API Reference

### ActionResolver Class

#### `calculatePhaseActions()`

Calculates what actions are needed for the current phase.

```typescript
calculatePhaseActions(
  gameState: GameState,
  currentPhase: string,
  phaseIndex: number,
  subPhase?: number,
  completedActions: CompletedAction[] = []
): PhaseActionState
```

**Returns:**
```typescript
{
  phase: "Charge Declaration",
  phaseIndex: 4,
  playerStates: {
    "player1": {
      status: "AWAITING_OPTIONAL",
      pendingActions: [...],
      canDeclareReady: true
    }
  },
  canAdvancePhase: false,
  blockingReason: "Waiting for Player 1"
}
```

#### `resolvePlayerAction()`

Validates and processes a player's action choice.

```typescript
resolvePlayerAction(
  gameState: GameState,
  phaseActionState: PhaseActionState,
  playerId: string,
  actionId: string,
  chosenOption: string
): ActionResolutionResult
```

**Returns:**
```typescript
{
  success: true,
  effectsQueued: [
    {
      type: "HEALING",
      sourcePlayerId: "player1",
      targetPlayerId: "player1",
      value: 5,
      description: "Interceptor: Heal 5"
    }
  ],
  stateChanges: {
    chargesUsed: { "INT-1": 1 }
  }
}
```

#### `declarePlayerReady()`

Marks player as ready, forfeiting remaining optional actions.

```typescript
declarePlayerReady(
  phaseActionState: PhaseActionState,
  playerId: string
): PhaseActionState
```

#### `autoResolvePhase()`

Automatically resolves phases with no player input (Automatic, etc.).

```typescript
autoResolvePhase(
  gameState: GameState,
  subPhase: number
): {
  effectsQueued: QueuedEffect[];
  autoAdvance: boolean;
}
```

### useActionResolver Hook

React hook for integrating with UI components.

```typescript
const {
  phaseActionState,
  isLoading,
  resolveAction,
  declareReady,
  canPlayerDeclareReady,
  getPlayerPendingActions,
  getPlayerStatus,
  canAdvancePhase
} = useActionResolver(
  gameState,
  currentPhase,
  phaseIndex,
  subPhase,
  onActionResolved,
  onPhaseReady
);
```

## Phase-Specific Implementation

### Charge Declaration Phase

**Ships with charges:**
- Interceptor (1 charge): Heal 5 OR Deal 5 damage
- Ship of Wisdom (2 charges): Deal 3 damage OR Heal 4
- Antlion (1 charge): Heal 3 OR Deal 3 damage
- Carrier (6 charges): Special (Ships That Build phase)

**Action Flow:**
1. Calculate available charges for each ship
2. Present options (use charge OR skip)
3. Player chooses
4. Queue effect for Health Resolution
5. Deduct charge from ship

### Ships That Build Phase

**Ships that build:**
- Carrier: Make Defender (1 charge) or Fighter (2 charges)
- Bug Breeder: Make Xenite (1 charge)
- Queen: Make Xenite (automatic, no charge)

**Action Flow:**
1. Check ships with "Ships That Build" powers
2. Check available charges/resources
3. Present build options
4. Player chooses
5. Create ship instance
6. Deduct charges
7. **Check for cascades** (Dreadnought triggers)

### Drawing Phase

**Special actions:**
- Frigate: Choose trigger number (1-6) - **MANDATORY**
- Evolver: Transform Xenite → Oxite/Asterite - optional
- Regular ship building (via lines) - optional

**Action Flow:**
1. Check for Frigates without trigger numbers → mandatory action
2. Check for Evolvers with available Xenites → optional action
3. Display ship building UI (separate from ActionResolver)
4. Wait for all mandatory actions + ready declarations

### Dice Manipulation Phase

**Ships with dice manipulation:**
- Leviathan: All dice = 6 (automatic, no choice)
- Ark of Knowledge: Reroll dice (affects all players)

**Action Flow:**
1. Leviathan: Auto-apply (no player input)
2. Ark of Knowledge: Prompt for reroll choice
3. If reroll chosen, roll new dice for ALL players
4. Update game state with new dice value

### Automatic Phase

**No player input required.**

**Action Flow:**
1. Calculate all automatic effects from ships
2. Queue all effects for Health Resolution
3. Auto-advance to next phase

## Multiplayer Integration

### Server-Side

```typescript
// On phase start
const phaseActionState = actionResolver.calculatePhaseActions(
  gameState,
  currentPhase,
  phaseIndex,
  subPhase
);

// Broadcast to all clients
io.emit('phase-action-state', phaseActionState);

// On player action
socket.on('resolve-action', async ({ actionId, chosenOption }) => {
  const result = actionResolver.resolvePlayerAction(
    gameState,
    phaseActionState,
    playerId,
    actionId,
    chosenOption
  );
  
  if (result.success) {
    // Update game state
    // Queue effects
    // Recalculate phase actions
    // Broadcast updated state
  }
});

// On player ready
socket.on('declare-ready', () => {
  const updatedState = actionResolver.declarePlayerReady(
    phaseActionState,
    playerId
  );
  
  if (updatedState.canAdvancePhase) {
    // Advance to next phase
  }
  
  io.emit('phase-action-state', updatedState);
});
```

### Client-Side

```typescript
// Listen for phase action state
socket.on('phase-action-state', (state) => {
  setPhaseActionState(state);
});

// Send action to server
const handleAction = async (actionId, option) => {
  socket.emit('resolve-action', { actionId, chosenOption: option });
};

// Send ready to server
const handleReady = () => {
  socket.emit('declare-ready');
};
```

## Effect Queue System

Effects are queued during action resolution and applied during Health Resolution phase.

### Queued Effect Structure

```typescript
{
  id: "effect-charge-INT-1-1234567890",
  type: "HEALING",
  sourcePlayerId: "player1",
  sourceShipId: "INT-1",
  targetPlayerId: "player1",
  value: 5,
  description: "Interceptor: Heal 5",
  timestamp: 1234567890
}
```

### Effect Types

- **DAMAGE**: Deal damage to opponent
- **HEALING**: Heal player
- **BUILD_SHIP**: Create a new ship
- **TRANSFORM_SHIP**: Transform Xenite to Oxite/Asterite
- **DESTROY_SHIP**: Destroy a ship
- **GENERATE_LINES**: Generate additional lines
- **GENERATE_JOINING_LINES**: Generate joining lines
- **SET_HEALTH**: Set health to specific value (Ark of Redemption)
- **STEAL_SHIP**: Take control of opponent's ship

### Applying Effects (Health Resolution)

```typescript
// Collect all queued effects from the turn
const allEffects = [...chargeEffects, ...automaticEffects, ...uponCompletionEffects];

// Apply damage and healing
for (const effect of allEffects) {
  if (effect.type === 'DAMAGE') {
    players[effect.targetPlayerId].health -= effect.value;
  }
  if (effect.type === 'HEALING') {
    players[effect.targetPlayerId].health += effect.value;
  }
}

// Check for destroyed ships (health <= 0)
// Check for victory condition
```

## Charge Tracking

Charges are tracked on PlayerShip instances.

### Ship Creation with Charges

```typescript
const newShip: PlayerShip = {
  id: generateId(),
  shipId: 'CAR', // Carrier
  ownerId: playerId,
  originalSpecies: 'human',
  currentCharges: 6, // Start at max
  maxCharges: 6
};
```

### Using Charges

```typescript
// When player uses a charge
const ship = playerShips.find(s => s.id === shipId);
ship.currentCharges -= chargeCost;

// If charges reach 0, ship cannot use power
if (ship.currentCharges === 0) {
  // Ship is "depleted" - update stack caption
  // No longer appears in pending actions
}
```

### Charge Graphics

Ships with charges need multiple graphics (one per charge state):

- Carrier (6 charges): 7 graphics (6/6, 5/6, 4/6, 3/6, 2/6, 1/6, 0/6)
- Interceptor (1 charge): 2 graphics (1/1, 0/1)
- Guardian (2 charges): 3 graphics (2/2, 1/2, 0/2)

## Testing Checklist

### Unit Tests

- [ ] calculatePhaseActions returns correct pending actions
- [ ] Mandatory actions block ready state
- [ ] Optional actions allow ready declaration
- [ ] resolvePlayerAction queues correct effects
- [ ] Charge consumption updates ship state
- [ ] Invalid actions return error
- [ ] Both players ready triggers canAdvancePhase

### Integration Tests

- [ ] Charge Declaration phase works for all charge ships
- [ ] Ships That Build creates ships correctly
- [ ] Dreadnought cascade doesn't trigger (per rules)
- [ ] Frigate trigger selection is mandatory
- [ ] Evolver transformation works
- [ ] Dice reroll affects all players
- [ ] Automatic phase queues all effects
- [ ] Effects apply correctly in Health Resolution

### Multiplayer Tests

- [ ] Phase action state syncs between clients
- [ ] Player actions sync to all clients
- [ ] Ready state updates for all players
- [ ] Phase advances when both ready
- [ ] Network lag doesn't cause duplicate actions
- [ ] Reconnection restores action state

## Known Limitations & TODOs

### Current Implementation

✅ Charge Declaration phase
✅ Ships That Build phase (Carrier, Bug Breeder)
✅ Drawing phase (Frigate, Evolver)
✅ Dice Manipulation phase (Ark of Knowledge)
✅ Automatic phase
✅ Basic effect queueing

### Not Yet Implemented

⏸️ First Strike phase
⏸️ Upon Completion phase triggers
⏸️ End of Battle Phase actions
⏸️ Chronoswarm extra build phase
⏸️ Science Vessel copy counting
⏸️ Conditional scaling (Defense Swarm health check)
⏸️ Ship stealing (Ark of Domination)
⏸️ Sacrificial Pool ship destruction
⏸️ Advanced cascades (multiple triggers)

### Future Enhancements

- **Undo functionality**: Allow players to undo actions before declaring ready
- **Action history UI**: Show what actions have been taken this turn
- **Action suggestions**: AI-powered recommendations for optimal plays
- **Animation integration**: Smooth transitions when effects apply
- **Sound effects**: Audio feedback for actions
- **Tutorial mode**: Step-by-step guidance for new players

## FAQ

**Q: When does the ActionResolver recalculate?**
A: After every player action AND when entering a new phase.

**Q: Can players change their mind after choosing an action?**
A: Not in current implementation. Once an action is resolved, it's final. Future: add undo.

**Q: What happens if a player disconnects?**
A: Current state is saved in game state. On reconnect, calculatePhaseActions regenerates their pending actions.

**Q: How do cascading actions work (Dreadnought)?**
A: Per clarified rules, Dreadnought does NOT cascade from its own Fighters. Each ship build triggers once.

**Q: Are effects applied immediately or queued?**
A: **Queued.** All damage/healing is queued during Battle Phase and applied in Health Resolution.

**Q: How do mandatory actions prevent phase advancement?**
A: `canDeclareReady` is false when `mustResolveFirst` has items. Ready button is disabled.

**Q: Can I use multiple charges in one phase?**
A: Depends on ship. Carrier has "Can only use one power once per subphase" rule. Most others can use until depleted.

**Q: How does Leviathan "all dice = 6" work?**
A: Applied during Dice Manipulation phase BEFORE Line Generation. Affects that player's dice reading only.

## Version History

- **v1.0.0** (2025-01-18): Initial implementation
  - Core ActionResolver class
  - useActionResolver hook
  - ActionPanel UI component
  - Basic phase support (Charge Declaration, Ships That Build, Drawing, Dice Manipulation, Automatic)
  - Effect queueing system
  - Multiplayer integration structure