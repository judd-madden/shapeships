# Simultaneous Hidden Declaration System - Implementation Summary

## 🎯 Overview

Implemented the new Battle Phase interaction model where both players simultaneously and secretly declare Charges and Solar Powers, replacing the previous turn-based model.

## ✅ What Was Changed

### 1. **BattlePhaseStep Enum** (`/game/engine/GamePhases.tsx`)

**OLD:**
```typescript
export enum BattlePhaseStep {
  FIRST_STRIKE = 'first_strike',
  INTERACTION_LOOP = 'interaction_loop'  // Turn-based back-and-forth
}
```

**NEW:**
```typescript
export enum BattlePhaseStep {
  FIRST_STRIKE = 'first_strike',
  SIMULTANEOUS_DECLARATION = 'simultaneous_declaration',  // Hidden simultaneous declarations
  CONDITIONAL_RESPONSE = 'conditional_response'           // Hidden simultaneous responses (conditional)
}
```

### 2. **TurnData Structure** (`/game/engine/GamePhases.tsx`)

**Added Fields:**
```typescript
export interface TurnData {
  // ... existing fields ...
  
  // NEW: Pending declarations (hidden from opponent until both players ready)
  pendingChargeDeclarations: { [playerId: string]: ChargeDeclaration[] };
  pendingSOLARPowerDeclarations: { [playerId: string]: SolarPowerDeclaration[] };
  
  // NEW: Track if any declarations were made in SIMULTANEOUS_DECLARATION step
  anyDeclarationsMade?: boolean;
}
```

### 3. **Phase Transition Logic** (`/game/engine/GamePhases.tsx`)

**State Machine Flow:**

```
FIRST_STRIKE
  ↓
SIMULTANEOUS_DECLARATION (both players choose in secret)
  ↓
  Both players ready → Reveal declarations
  ↓
  Check: Any declarations made?
  ├─ NO  → END_OF_TURN_RESOLUTION (skip response)
  └─ YES → CONDITIONAL_RESPONSE (both players respond in secret)
            ↓
            Both players ready → Reveal responses
            ↓
            END_OF_TURN_RESOLUTION
```

**Key Methods Added:**
- `checkIfAnyDeclarationsMade()` - Checks if declarations were made
- `revealDeclarationsAndPrepareResponse()` - Reveals and transitions to response
- `revealDeclarationsAndResolve()` - Reveals and proceeds to resolution

### 4. **Readiness System** (`/game/engine/GamePhases.tsx`)

Updated `getPlayersWhoNeedToConfirm()`:
```typescript
case BattlePhaseStep.SIMULTANEOUS_DECLARATION:
  return this.getPlayersActiveInChargeSolarLoop(gameState);  // All players

case BattlePhaseStep.CONDITIONAL_RESPONSE:
  return this.getPlayersActiveInChargeSolarLoop(gameState);  // All players
```

## ✅ Phase 1: Server-Side Logic (COMPLETED)

**File:** `/supabase/functions/server/index.tsx`

**Completed Actions:**

1. ✅ **Updated `send-action` endpoint** with new action handlers:
   - `declare_charge` - Stores charge in `pendingChargeDeclarations[playerId]` (hidden from opponent)
   - `use_solar_power` - Stores solar power in `pendingSOLARPowerDeclarations[playerId]` (hidden from opponent)
   - `pass` - Allows player to pass without making declarations
   - **Security:** Prevents modifications after player marks ready

2. ✅ **Updated `get-game-state` endpoint** with declaration filtering:
   - Accepts optional `?playerId=` query parameter
   - Filters `pendingChargeDeclarations` to only show requesting player's data
   - Filters `pendingSOLARPowerDeclarations` to only show requesting player's data
   - Opponent's pending declarations remain hidden (empty arrays)

3. ✅ **Added phase advancement logic** to ServerPhaseEngine:
   - `revealDeclarationsAndTransition()` - Checks if any declarations made, branches accordingly
   - `revealResponsesAndResolve()` - Merges responses and proceeds to End of Turn Resolution
   - Automatically transitions based on `anyDeclarationsMade` flag
   - Clears pending declarations after reveal

4. ✅ **Updated frontend hook** (`/game/hooks/useGameState.tsx`):
   - Now passes `playerId` as query parameter when fetching game state
   - Ensures proper filtering of hidden declarations

## 🚧 What Still Needs Implementation

### Phase 2: UI Components (CRITICAL - NOT YET IMPLEMENTED)

**Files:** 
- `/game/display/ActionPanel.tsx`
- `/game/display/GameScreen.tsx`
- New component: `/game/display/BattlePhasePanel.tsx` (recommended)

**Required Changes:**

1. **Hidden Declaration Interface:**
   ```tsx
   // Show player's OWN pending declarations
   // Show "Hidden" or "???" for opponent's pending declarations
   // Visual indicator: "Waiting for opponent..." vs "Opponent ready"
   ```

2. **Ready Confirmation UI:**
   ```tsx
   // "Lock In Declarations" button
   // Cannot change declarations after ready
   // Show both players' ready status (✓ or ⏳)
   ```

3. **Reveal Animation:**
   ```tsx
   // When both ready → Simultaneous reveal
   // Show all declarations from both players at once
   // Transition to Response step if declarations were made
   ```

4. **Response Interface:**
   ```tsx
   // Similar to Declaration interface
   // Show revealed opponent declarations (read-only)
   // Allow new hidden responses
   // Lock In Responses → Ready → Reveal
   ```

### Phase 3: Action Types & Validation (OPTIONAL - MAY NOT BE NEEDED)

**File:** `/game/types/GameTypes.tsx`

**Required Updates:**

1. **Add new action types:**
   ```typescript
   | 'declare_charge_hidden'      // Charge declaration (hidden)
   | 'declare_solar_hidden'       // Solar Power declaration (hidden)
   | 'pass_declaration'           // Pass without declaring
   | 'lock_in_declarations'       // Ready to reveal
   ```

2. **Update action data structures** to support hidden state

## 🔒 Critical Security Rules

### Server-Side (MUST ENFORCE):

1. **Never leak opponent's pending declarations**
   - Filter `pendingChargeDeclarations` by requesting player ID
   - Filter `pendingSOLARPowerDeclarations` by requesting player ID

2. **Prevent modification after ready**
   - Check if player already marked ready for current step
   - Reject new declarations if already ready

3. **Validate transition conditions**
   - Both players must be ready before revealing
   - Cannot skip response step if declarations were made
   - Cannot add declarations during reveal/resolution

### Client-Side (MUST IMPLEMENT):

1. **Hide opponent's pending state**
   - Only show "Opponent ready: Yes/No"
   - Never display opponent's pending declaration details

2. **Lock UI after ready**
   - Disable declaration buttons after ready
   - Show "Waiting for opponent..." message

## 📊 Testing Checklist

- [ ] Both players can simultaneously declare charges
- [ ] Neither player can see opponent's pending declarations
- [ ] Both players must ready up before reveal
- [ ] Declarations reveal simultaneously after both ready
- [ ] If no declarations, skip directly to End of Turn Resolution
- [ ] If declarations made, move to Conditional Response
- [ ] Response step works identically to declaration step
- [ ] Server properly filters pending declarations by player ID
- [ ] Cannot modify declarations after marking ready
- [ ] Phase transitions work correctly in all scenarios

## 🎮 Example Flow

**Scenario: Player 1 declares Charge, Player 2 passes**

1. **SIMULTANEOUS_DECLARATION step begins**
   - Both players see empty pending declaration lists
   - Both players can declare or pass

2. **Player 1 declares Charge (hidden)**
   - Server adds to `pendingChargeDeclarations[player1Id]`
   - Player 1 sees their pending charge
   - Player 2 sees "Player 1 status: Not Ready"
   - Player 2 CANNOT see what Player 1 declared

3. **Player 1 marks ready**
   - Player 1 UI locks
   - Player 2 sees "Player 1 status: Ready"
   - Player 1 sees "Waiting for Player 2..."

4. **Player 2 passes (no declarations)**
   - Player 2 marks ready without declaring
   - Server sets `anyDeclarationsMade = true` (Player 1 made declarations)

5. **Both ready → Reveal**
   - Server merges pending declarations into main arrays
   - Both players see Player 1's Charge declaration
   - Server transitions to CONDITIONAL_RESPONSE (because declarations were made)

6. **CONDITIONAL_RESPONSE step**
   - Process repeats for responses
   - After both ready → Reveal responses → END_OF_TURN_RESOLUTION

## 🚨 Current Status / Next Steps

### ✅ Completed:
1. ✅ **Game engine updates** - BattlePhaseStep enum, TurnData structure, transition logic
2. ✅ **Server endpoint updates** - Action handlers, game state filtering, reveal logic
3. ✅ **Frontend hook updates** - playerId query parameter for secure filtering

### ⚠️ Remaining Work:
1. **UI not yet updated** - Current UI assumes turn-based model (CRITICAL)
2. **Action types may need updates** - Current action types may be sufficient, but should verify
3. **No reveal animation** - Should add visual feedback for simultaneous reveal (NICE TO HAVE)
4. **Testing required** - Need comprehensive multiplayer testing with hidden states (CRITICAL)

## 📝 Implementation Priority

1. **HIGH** - Server endpoint updates (security critical)
2. **HIGH** - Game state filtering (prevent leaking opponent data)
3. **HIGH** - UI for hidden declarations (UX critical)
4. **MEDIUM** - Ready confirmation flow
5. **MEDIUM** - Reveal animations
6. **LOW** - Polish and edge case handling
