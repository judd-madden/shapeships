# Server / Client Turn-Phase Contract

> **Normative integration contract**
>
> Architecture and ownership context:
> - [canonical-handoff.md](canonical-handoff.md)
> - [code-ownership-map.md](code-ownership-map.md)

This document defines the integration contract between the authoritative server turn/phase model and the client/runtime and UI layers.

## 1. Core Contract

### 1.1 Phase authority
The server is authoritative for:
- current phase
- current turn number
- legality of submitted intents
- progression to the next phase or turn

The client must treat server phase and turn values as canonical.

### 1.2 Turn freshness
Clients and harnesses should always use fresh server state when preparing turn-sensitive submissions.

Do not rely on stale locally remembered turn values for authoritative submissions.

### 1.3 Species-selection guardrail
During `setup.species_selection`, only the species-selection intent flow should be used.
Do not force generic ready/advance behavior into that phase unless the server contract explicitly supports it.

## 2. Client Responsibilities
Client/runtime code may:
- render current phase and turn
- gate UI using authoritative server state
- provide previews and diagnostics
- submit intents based on current authoritative state

Client/runtime code must not:
- invent phase advancement
- assume turn bumps at hardcoded phase names
- compute authoritative legality

## 3. UI Responsibilities
UI code should:
- render phase/turn from server state
- hide or disable controls when current server state disallows them
- defer to server outcomes for final truth

UI code should not become a rules engine.

## 4. Diagnostics vs Truth
Events and logs are useful diagnostics, but canonical truth comes from authoritative state.

If an event stream is missing or incomplete but authoritative state changed correctly, authoritative state still wins.

## 5. Contract Use
This document should guide:
- client/runtime integration work
- test harnesses
- debugging of phase/turn progression issues

For implementation-pass structure, see:
- [../workflows/CodexPassTemplate.md](../workflows/CodexPassTemplate.md)

## 6. Condensed Turn-Phase Presentation

The presentation model compresses the canonical seven-phase runtime sequence without changing it:

| Canonical phase | Presented milestone |
| --- | --- |
| `build.dice_roll` | Dice Roll |
| `build.line_generation` | Dice Roll |
| `build.drawing` | Drawing |
| `battle.reveal` | Drawing |
| `battle.first_strike` | First Strike |
| `battle.charge_declaration` | Charges / Solar Powers |
| `battle.end_of_turn_resolution` | Turn Resolution |

The Bottom Rail and action surfaces continue to report the real canonical phase. The condensed milestone is presentation-only.

### 6.1 Optional-phase forecast ownership

The server owns the current-turn forecast for First Strike and Charges. It uses the same eligibility primitives as authoritative phase gating and publishes only this curated public DTO:

```ts
publicState.turnPhaseProgress?: {
  turnNumber: number;
  firstStrike: { expected: boolean; occurred: boolean };
  charges: { expected: boolean; occurred: boolean };
};
```

The projection is shared by both players and spectators. It is not exposed through requester data, legacy `gameData.turnData`, `/game-state-head`, or `/game-history`.

Forecast update boundaries are:

1. Dice Roll entry after queued Simulacrum materialization: public First Strike, ordinary Charges, and guaranteed Ancient Reveal Energy sources; QUA is excluded.
2. Line Generation entry after effective dice finalize: the same forecast with matching QUA included.
3. Drawing: frozen; private Drawing changes are not evaluated.
4. Reveal after Reveal powers and Ancient preparation: both forecasts refresh from the now-public authoritative state, with Charges using the live declaration gate.
5. Charge Declaration entry after the First Strike result and declaration snapshot: Charges refreshes from the live declaration gate.

An optional milestone is latched as occurred only when its authoritative entry gate finds work. That latch survives later source removal for the rest of the turn and resets at the next turn.

### 6.2 Client presentation ownership

The client runtime maps canonical phase keys and the curated public forecast into one shared five-milestone VM. Desktop and mobile consume the same VM and must not derive optional-phase eligibility from ship definitions, tags, power text, or private state.

Mandatory milestones are available during an ordinary turn. Optional milestones are presented as available when `expected || occurred`. A forecast with a mismatched turn number is ignored.

Setup has no current milestone. A finished game also has no current milestone after presentation completes; while the existing terminal Health Resolution presentation lifecycle is active, the runtime may continue presenting Turn Resolution using that lifecycle's display turn number. This adds no authoritative timing or new client timer.
