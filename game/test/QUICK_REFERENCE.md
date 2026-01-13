# Intent Protocol - Quick Reference Card

## Client-Side Usage

### Import Helpers
```typescript
import { createSpeciesIntent, createBuildIntent } from '../utils/intentHelper';
import { authenticatedPostIntent } from '../utils/sessionManager';
```

### Species Selection Example
```typescript
// When player selects species
const handleSpeciesSubmit = async (species: 'human' | 'xenite' | 'centaur' | 'ancient') => {
  const intent = await createSpeciesIntent(species);
  
  // Commit
  await authenticatedPostIntent(
    gameId,
    'SPECIES_COMMIT',
    turnNumber,
    intent.commit
  );
  
  // Reveal (immediate for now)
  await authenticatedPostIntent(
    gameId,
    'SPECIES_REVEAL',
    turnNumber,
    intent.reveal
  );
};
```

### Build Ships Example
```typescript
// When player submits build
const handleBuildSubmit = async (builds: Array<{ shipDefId: string; count?: number }>) => {
  const intent = await createBuildIntent(builds);
  
  // Commit
  await authenticatedPostIntent(
    gameId,
    'BUILD_COMMIT',
    turnNumber,
    intent.commit
  );
  
  // Reveal
  await authenticatedPostIntent(
    gameId,
    'BUILD_REVEAL',
    turnNumber,
    intent.reveal
  );
};
```

### Declare Ready Example
```typescript
// When player clicks Ready button
const handleReady = async () => {
  await authenticatedPostIntent(
    gameId,
    'DECLARE_READY',
    turnNumber,
    {} // No payload for DECLARE_READY
  );
};
```

## Server Endpoints

### POST /intent
**Request:**
```json
{
  "gameId": "uuid",
  "intentType": "SPECIES_COMMIT" | "SPECIES_REVEAL" | "BUILD_COMMIT" | "BUILD_REVEAL" | "DECLARE_READY" | "ACTION" | "SURRENDER",
  "turnNumber": 1,
  
  // For COMMIT:
  "commitHash": "sha256_hash",
  
  // For REVEAL:
  "payload": { ... },
  "nonce": "uuid"
}
```

**Response:**
```json
{
  "ok": true,
  "state": { /* full game state */ },
  "events": [
    { "type": "SPECIES_COMMITTED", "playerId": "...", ... }
  ]
}
```

**Or rejected:**
```json
{
  "ok": false,
  "state": { /* current state */ },
  "events": [],
  "rejected": {
    "code": "HASH_MISMATCH",
    "message": "Reveal hash does not match committed hash"
  }
}
```

### GET /game-state/:gameId
**Response:** Filtered game state (opponent commits hidden)

## Intent Types

| Intent Type | Requires Commit | Resolution Trigger | Events Emitted |
|-------------|-----------------|-------------------|----------------|
| SPECIES_COMMIT | N/A | - | SPECIES_COMMITTED |
| SPECIES_REVEAL | Yes | Both reveals | SPECIES_REVEALED, SPECIES_RESOLVED |
| BUILD_COMMIT | N/A | - | BUILD_COMMITTED |
| BUILD_REVEAL | Yes | Both reveals | BUILD_REVEALED, BUILD_RESOLVED |
| DECLARE_READY | No | All ready | PLAYER_READY, PHASE_ADVANCED, (dice/lines events) |
| ACTION | No | Immediate | (action-specific) |
| SURRENDER | No | Immediate | GAME_ENDED |

## Payload Formats

### Species Payload
```json
{
  "species": "human" | "xenite" | "centaur" | "ancient"
}
```

### Build Payload
```json
{
  "builds": [
    { "shipDefId": "DEF", "count": 2 },
    { "shipDefId": "TAC" }
  ]
}
```

### Action Payload
```json
{
  "actionType": "string",
  "content": { /* action-specific */ }
}
```

## Rejection Codes

| Code | Meaning | Fix |
|------|---------|-----|
| WRONG_TURN | Not your turn | Wait for correct turn |
| DUPLICATE_COMMIT | Already committed | Can only commit once per key |
| NO_COMMIT | Reveal before commit | Must commit first |
| HASH_MISMATCH | Payload doesn't match hash | Check nonce and payload |
| BAD_PAYLOAD | Invalid payload structure | Check payload format |
| INVALID_SPECIES | Invalid species name | Use: human, xenite, centaur, ancient |
| INVALID_SHIP | Invalid shipDefId | Check ShipDefinitions.json.ts |
| SPECTATOR_RESTRICTED | Spectators can't act | Only players can commit/reveal |
| NOT_PLAYER | Not in this game | Must be game participant |
| WRONG_PHASE | Action not allowed in phase | Check current phase |

## Game State Structure

```typescript
{
  gameId: string;
  players: Array<{
    id: string;
    name: string;
    faction: 'human' | 'xenite' | 'centaur' | 'ancient' | null;
    health: number;
    lines: number;
    // ... other fields
  }>;
  gameData: {
    ships: {
      [playerId]: Array<{
        instanceId: string;
        shipDefId: string;
        chargesCurrent?: number;
        createdTurn?: number;
      }>
    };
    currentPhase: string;
    currentSubPhase: string;
    turnNumber: number;
    diceRoll: number | null;
    // ... other fields
  };
  localPlayerId: string; // Filtered per player
}
```

## Phase Keys (from PhaseTable)

```typescript
'setup.species_selection'
'build.dice_roll'
'build.line_generation'
'build.ships_that_build'
'build.drawing'
'build.end_of_build'
'battle.first_strike'
'battle.charge_declaration'
'battle.charge_response'
'battle.end_of_turn_resolution'
```

## On-Enter Hooks

| Phase | Hook Effect | Event |
|-------|-------------|-------|
| build.dice_roll | Roll dice (1-6) | DICE_ROLLED |
| build.line_generation | Grant lines to players | LINES_GRANTED |

## Testing Tools

### Automated Test
```
Dev Dashboard → Intent Verification → Run Verification
```

### Manual Test
See `/game/test/INTENT_VERIFICATION_MANUAL.md` for curl commands

### Browser Console
```javascript
// Quick test in console
const intent = await createSpeciesIntent('human');
console.log('Commit:', intent.commit);
console.log('Reveal:', intent.reveal);
```

## Common Patterns

### Commit Then Reveal Pattern
```typescript
// 1. Create intent pair
const intent = await createSpeciesIntent(species);

// 2. Commit (store hash)
const commitRes = await authenticatedPostIntent(
  gameId, 'SPECIES_COMMIT', turn, intent.commit
);

// 3. Reveal (prove commitment)
const revealRes = await authenticatedPostIntent(
  gameId, 'SPECIES_REVEAL', turn, intent.reveal
);
```

### Wait for Opponent Pattern
```typescript
// Use polling (useGameState hook)
const { gameState, isLoading } = useGameState(gameId);

// Check commit status
const opponentCommitted = gameState?.gameData?.commitments?.[commitKey]?.[opponentId];

// Check if resolved
const hasResolved = gameState?.players?.find(p => p.id === opponentId)?.faction !== null;
```

### Error Handling Pattern
```typescript
try {
  const response = await authenticatedPostIntent(...);
  const data = await response.json();
  
  if (!data.ok) {
    // Handle rejection
    console.error('Intent rejected:', data.rejected);
    showError(data.rejected.message);
    return;
  }
  
  // Success
  console.log('Events:', data.events);
} catch (error) {
  // Network error
  console.error('Request failed:', error);
}
```

## Security Notes

✅ **Safe:**
- Commitments hidden until reveal
- Server validates all hashes
- Player identity from session token

⚠️ **Not Safe (Yet):**
- No rate limiting
- No cost validation
- No turn timer

## Performance Tips

- Commit/reveal immediately (no need to wait)
- Use existing useGameState hook (5s polling)
- Events in response show what changed
- Full state always returned (no deltas yet)

## Next Steps

1. Wire GameShell to use these helpers
2. Add species selection UI
3. Add build selection UI
4. Add ready button
5. Display game state
6. Show event feedback (toasts)

---

**Quick Links:**
- Full Summary: `/game/test/INTENT_PROTOCOL_SUMMARY.md`
- Manual Testing: `/game/test/INTENT_VERIFICATION_MANUAL.md`
- Test Component: `/game/test/IntentVerification.tsx`
