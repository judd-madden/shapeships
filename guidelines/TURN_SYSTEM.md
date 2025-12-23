# Shapeships Turn System (Authoritative)

**Last Updated:** December 23, 2024  
**Status:** Authoritative - All code must follow this specification

---

## 🎯 Core Philosophy

The game uses a **Finite State Machine (FSM)** designed for UI implementation and clear player intent:

1. **Two interactive phases** and one non-interactive resolution step
2. **Health only changes at end of turn** - players can only lose at the end of the turn
3. **All damage/healing resolves together** at End of Turn Resolution
4. **No hidden states** - what you see is what exists

---

## 📊 Finite State Machine

```json
{
  "Turn": [
    "BuildPhase",
    "BattlePhase", 
    "EndOfTurnResolution"
  ],
  "BuildPhase": [
    "DiceRoll",
    "LineGeneration",
    "ShipsThatBuild",
    "Drawing",
    "EndOfBuild"
  ],
  "BattlePhase": [
    "FirstStrike",
    "InteractionLoop"
  ],
  "Transitions": {
    "DiceRoll -> LineGeneration": "Automatic",
    "LineGeneration -> ShipsThatBuild": "Automatic",
    "ShipsThatBuild -> Drawing": "BothPlayersReady",
    "Drawing -> EndOfBuild": "BothPlayersReady",
    "EndOfBuild -> FirstStrike": "AutomaticOrChronoswarmLoop",
    "FirstStrike -> InteractionLoop": "Automatic",
    "InteractionLoop -> EndOfTurnResolution": "BothPlayersPass",
    "EndOfTurnResolution -> DiceRoll": "NextTurnOrGameEnd"
  }
}
```

**No hidden states. No recursion except Chronoswarm looping BuildPhase.**

---

## 📋 Turn Structure Overview

Each turn consists of:

1. **Build Phase** (simultaneous, player-driven)
2. **Battle Phase** (interactive, back-and-forth)
3. **End of Turn Resolution** (system-only)

---

## 🏗️ Build Phase (Simultaneous, Ordered)

The Build Phase is simultaneous but ordered. Players act independently, but the system advances only when both are ready.

### Step 1: Dice Roll (Includes Dice Manipulation)

**Dice Roll** (automatic):
- Roll one shared d6
- All players see the same result

**Dice Manipulation** (conditional, happens during this step):
- If a player has dice manipulation powers (e.g., Ark of Knowledge), they may modify the result
- Only the owning player provides input
- Dice manipulation happens here, not in a separate step
- Once finalized, the dice value is locked and the step advances automatically

**No player readiness required** - advances automatically after dice manipulation (if any) is complete

---

### Step 2: Line Generation (System)

**Automatic calculation:**
- Dice result
- Saved lines
- Automatic line generation from ships
- Convert (Ancient), if used

**No player input required**

---

### Step 3: Ships That Build (Player Actions, Simultaneous)

Players may use any **Ships That Build** powers:
- Carrier: Make Defender/Fighter (uses charges)
- Bug Breeder: Make Xenite (uses charges)
- Queen: Make Xenite each turn
- Zenith: Make ships based on dice roll
- Sacrificial Pool: Destroy ship to make Xenites
- Etc.

**Ships created here:**
- Are immediately in play
- Are active for upgrades
- Will participate in Battle Phase
- Do NOT have their "Ships That Build" powers active until next turn

**Readiness requirement:**
- Each player must explicitly indicate "Done with Ships That Build"
- Even if they have no ships, they must pass

---

### Step 4: Drawing (Player Actions, Simultaneous)

Players may:
- Draw ships (spend lines)
- Save lines for future turns
- Use drawing phase powers (Frigate: choose trigger number, etc.)

**Drawing powers occur here:**
- Frigate: Choose trigger number
- Evolver: Turn Xenite into Oxite/Asterite
- Dreadnought: Make free Fighter when completing a ship

**Ships drawn during this step:**
- Are immediately added to the player's fleet
- **Their "Ships That Build" powers are NOT active until next Build Phase**
- May be destroyed in the upcoming Battle Phase
- May be upgraded (if another rule explicitly allows it)
- Do NOT retroactively affect any earlier Build Phase steps

**Readiness requirement:**
- Each player must explicitly indicate "Done Drawing"

---

### Step 5: End of Build Phase (System, Conditional)

**Non-interactive effects resolve here:**
- Ark of Redemption: Set health to maximum (not "healing")
- Other end-of-build-phase effects

**Chronoswarm check:**
- If any player has Chronoswarm, trigger extra Build Phase
- Repeat: Dice Roll → Ships That Build → Drawing → End of Build Phase
- **Faces (Oxite Face, Asterite Face) do NOT re-check during extra phases**
- When complete, proceed to Battle Phase

---

## ⚔️ Battle Phase (Interactive, Back-and-Forth)

### Step 1: First Strike (System)

**First Strike powers resolve:**
- Guardian: Destroy a basic enemy ship (uses charge, requires target selection)
- Ships destroyed here:
  - Do NOT activate Battle Phase powers
  - Are removed immediately
- Stolen ships immediately change ownership

**Player input:**
- Only if a First Strike effect requires a target choice
- Guardian player must select which enemy ship to destroy

---

### Step 2: Charge Declaration & Solar Powers (Interactive Loop)

This is a **shared interaction window**, not separate phases.

**Players may declare:**
- Charges (Interceptor, Antlion, Ship of Wisdom, Ship of Family, etc.)
- Solar Powers (Ancient: Asteroid, Supernova, Life, Star Birth, Convert, Simulacrum, Siphon, Vortex, Black Hole)

**Back-and-forth interaction:**
- If one player declares, the opponent may respond
- Continue back-and-forth until both players pass
- No limit on number of declarations (limited by charges/energy available)

**Rules:**
- Destroyed charge ships still resolve already-declared charges
- Destroyed Automatic ships do NOT contribute continuous effects
- Cube can repeat a solar power (for free)

**If no declarations occur:**
- Skip directly to End of Turn Resolution

---

## 🎲 End of Turn Resolution (System-Only, Non-Interactive)

This step is **non-interactive** - players cannot take actions.

### Resolution Order (All Simultaneous):

1. **Calculate all damage sources:**
   - Continuous Automatic ship damage (Fighter, Hell Hornet, etc.)
   - Once-only Automatic damage (Starship "Upon Completion", Ship of Anger, etc.)
   - Charge damage (Interceptor, Antlion, Ship of Wisdom)
   - Solar Power damage (Asteroid, Supernova, Siphon, Vortex, Black Hole)

2. **Calculate all healing sources:**
   - Continuous Automatic ship healing (Defender, Mantis, etc.)
   - Once-only Automatic healing (Ship of Fear "Upon Completion", etc.)
   - Charge healing (Interceptor, Antlion, Ship of Wisdom)
   - Solar Power healing (Life, Star Birth, Siphon)

3. **Apply all effects simultaneously:**
   - Subtract total damage from each player's health
   - Add total healing to each player's health
   - Health is capped at maximum (100 default, customizable)

4. **Check win/loss/draw:**
   - If any player at 0 or below health, game ends
   - Otherwise, start new turn

### Critical Rules:

- **Once-only Automatic effects resolve even if the ship was destroyed later that turn**
  - Example: Build Starship → Starship deals 8 damage → Guardian destroys Starship → Starship still deals 8 damage at end of turn
  
- **Continuous Automatic effects only apply if the ship survived**
  - Example: Fighter deals 1 damage → Guardian destroys Fighter → Fighter does NOT deal 1 damage at end of turn

- **Health is updated once** - no mid-turn health changes

- **Players can only lose at end of turn** - not mid-turn

---

## 🔄 Player Readiness & Input Model

### Readiness Summary

| Step | Input Required | Who Confirms |
|------|----------------|--------------|
| **Build Phase** |  |  |
| Dice Roll (includes manipulation) | Sometimes | Relevant player(s) if dice manipulation available |
| Line Generation | No | None (automatic) |
| Ships That Build | Yes | Both players |
| Drawing | Yes | Both players |
| End of Build | No | None (automatic) |
| **Battle Phase** |  |  |
| First Strike | Sometimes | Player with choice |
| Interaction Loop | Yes | Acting player(s) |
| **End of Turn** |  |  |
| Resolution | No | None (automatic) |

### Core Readiness Rules:

1. **Build Phase only advances when both players confirm readiness**
2. **Battle Phase advances when both players pass**
3. **End of Turn Resolution cannot be interrupted**

---

## ⚠️ Core Invariant (MUST NOT VIOLATE)

**All damage and healing from Automatic ship powers (including once-only effects), Charges, and Solar Powers resolve together at End of Turn Resolution, after which health is updated once.**

**Violations of this invariant:**
- ❌ Health changing mid-turn
- ❌ Damage resolving before healing
- ❌ Separate phases for different damage types
- ❌ Automatic effects resolving before charges

**Correct implementation:**
- ✅ All damage calculated simultaneously
- ✅ All healing calculated simultaneously
- ✅ Health updated once at end of turn
- ✅ Once-only effects tracked and resolved at end of turn
- ✅ Continuous effects only count if ship survived

---

## 📊 Example Turn Flow

### Turn 1:

1. **Build Phase:**
   - **Dice Roll:** Roll d6 → 5
   - **Line Generation:** P1 gets 5 lines, P2 gets 5 lines
   - **Ships That Build:** P1 passes, P2 passes
   - **Drawing:** P1 builds Defender (2) + Fighter (3), P2 builds Xenite (2) + Antlion (3)
   - **End of Build Phase:** No effects triggered

2. **Battle Phase:**
   - **First Strike:** No ships with First Strike
   - **Charge/Solar Loop:** 
     - P1 passes
     - P2 passes
     - Loop ends

3. **End of Turn Resolution:**
   - **Damage:** P1's Fighter deals 1 damage to P2, P2 has no damage ships
   - **Healing:** P1's Defender heals 1, P2 has no healing ships
   - **Apply:** P1: 100→101 (capped at 100), P2: 100→99
   - **Check:** No winner, start Turn 2

---

## 🔗 Related Files

- `/game/engine/GamePhases.tsx` - Phase system implementation
- `/game/types/GameTypes.tsx` - Type definitions
- `/game/engine/RulesEngine.tsx` - Rules implementation
- `/guidelines/Guidelines.md` - Main development guidelines

---

## ❗ Implementation Notes for Claude

When implementing game logic:

1. **Always check current phase/step** before allowing actions
2. **Validate player readiness** before advancing
3. **Track once-only effects** separately from continuous effects
4. **Resolve everything at end of turn** - no mid-turn health changes
5. **Use SpeciesIntegration** for calculating ship damage/healing
6. **Test with multiplayer** to ensure synchronization

---

**This document is authoritative.** Any conflicts between this document and existing code should be resolved in favor of this document.