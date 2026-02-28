# Server-Client Turn & Phase Contract

**Purpose**: Define enforceable invariants between server state authority and client intent submission.

**Status**: Normative

---

## 1. State Authority

### 1.1 Phase Key Authority
- The server's `phaseKey` (or `currentPhase` + `currentSubPhase`) is the **sole authority** for UI gating.
- Clients **MUST NOT** assume phase transitions based on local computation.
- Phase keys follow the format: `{major}.{subphase}` (e.g., `setup.species_selection`, `build.drawing`, `battle.first_strike`).

### 1.2 Turn Number Authority
- The server's `turnNumber` from `gameData.turnNumber` is the **sole authority** for intent submission.
- Clients **MUST** fetch fresh state before submitting each intent to obtain the current server turn.
- Server **MAY** reject intents with stale turn numbers (rejection code: `BAD_TURN`).

### 1.3 State Synchronization
- Clients **MUST** re-fetch state after each phase transition to detect server-driven changes.
- Clients **MUST NOT** cache phase keys or turn numbers across intent submissions.

---

## 2. Intent Requirements

### 2.1 Turn Number Freshness
- All intents **MUST** be submitted with the current server `turnNumber`.
- If server rejects with `BAD_TURN`, client **MUST**:
  1. Refetch state
  2. Validate the user action is still appropriate for the new phase
  3. Resubmit ONLY if the action remains valid

### 2.2 Intent Type Validation
- Clients **MUST** enforce phase-appropriate intent types before submission.
- Server **SHALL** reject invalid intents with appropriate rejection codes.

---

## 3. Species Selection Invariants (Hard Requirement)

### 3.1 Phase Constraint
While `phaseKey === 'setup.species_selection'`:

**Allowed intents**:
- `SPECIES_COMMIT`
- `SPECIES_REVEAL`

**Disallowed intents**:
- `BUILD_COMMIT`
- `BUILD_REVEAL`
- `DECLARE_READY`
- `BATTLE_COMMIT`
- `BATTLE_REVEAL`
- All other intent types

### 3.2 Phase Exit Condition
- The `setup.species_selection` phase **MUST** exit automatically once both players have successfully revealed species.
- Clients **MUST NOT** send `DECLARE_READY` during species selection.
- Clients **SHALL** poll state until `phaseKey !== 'setup.species_selection'` after both reveals complete.

### 3.3 Contract Violation Detection
- Test harnesses **MUST** fail loudly with `CONTRACT_VIOLATION` error if:
  - Any intent other than `SPECIES_COMMIT` or `SPECIES_REVEAL` is attempted during `setup.species_selection`
  - The phase does not exit after both players reveal (within reasonable polling attempts)

---

## 4. Resolution Evidence

### 4.1 Primary Truth: State Diffs
- **Health** (`player.health`) is authoritative for win/loss conditions.
- **Ship state** (`gameData.ships`) is authoritative for fleet composition.
- **Game status** (`state.status === 'finished'`) is authoritative for game completion.

### 4.2 Events are Supplementary
Events (`EFFECT_APPLIED`, `PHASE_ADVANCED`, etc.) provide **diagnostic information** but are NOT required for correctness.

**Event Emission**:
- Server **SHOULD** emit `EFFECT_APPLIED` events for each effect applied during resolution.
- Events **MAY** appear in:
  - Intent response (`response.events`)
  - Fetched state (`state.events` or `state.lastEvents`)

**Client Requirements**:
- Clients **MUST NOT** require events to update health or ship state.
- Clients **MAY** log events for debugging and diagnostics.
- Clients **SHALL** treat missing events as a warning, not an error, if state changes are observed.

### 4.3 Health Change Contract Warning
- If `player.health` changes between fetches but **NO** `EFFECT_APPLIED` events are observed:
  - Log: `⚠ Contract warning: health changed but no EFFECT_APPLIED events observed`
  - **Do not fail** the test
  - Continue using health as truth

---

## 5. UI Wiring Implications

### 5.1 Panel Gating
- `GameScreen` **MUST** gate all panels and action buttons based on:
  - Current `phaseKey` from server
  - Player role and participation status
  - Server-provided eligibility data (e.g., available powers, ship build eligibility)

### 5.2 No Client-Side Rule Computation
- UI **MUST NOT** compute:
  - Whether a ship can be built
  - Whether a power can be activated
  - Phase advancement logic
  - Turn bump conditions

### 5.3 Authoritative Feedback
- All action eligibility **SHALL** be determined by server rejection or success.
- UI **MAY** provide optimistic feedback but **MUST** defer to server response.

---

## 6. Phase Shape Contracts

### 6.1 Phase Families
Test harnesses and UI code **SHOULD** use phase family helpers instead of hardcoded phase strings:

- **Species Selection**: `phaseKey === 'setup.species_selection'`
- **Build Phases**: `phaseKey.startsWith('build.')`
- **Battle Phases**: `phaseKey.startsWith('battle.')`
- **Resolution Phases**: `phaseKey.includes('resolution')`

### 6.2 Refactor Resilience
- Code **MUST NOT** hardcode exact phase names in scenario logic (e.g., `'battle.end_of_turn_resolution'` in loops).
- Use phase family checks for conditional logic.
- Use server state diffs (health, ships, turn number) to detect progress, not phase name matching.

---

## 7. Turn & Phase Advancement

### 7.1 Turn Bump Detection
- Turn advancement **SHALL** be detected by comparing:
  - `state.gameData.turnNumber` before and after advancement
- Clients **MUST NOT** assume turn bumps occur at specific phase transitions.

### 7.2 Phase Advancement Detection
- Phase changes **SHALL** be detected by comparing:
  - `phaseKey` before and after `DECLARE_READY` or auto-advancement
- Clients **MAY** observe `PHASE_ADVANCED` events for diagnostics.

---

## 8. Enforcement in Test Harnesses

### 8.1 Mandatory Checks
All E2E test harnesses **MUST** enforce:

1. **Fresh turn number** on every intent submission
2. **Phase-appropriate intent types** (especially during `setup.species_selection`)
3. **Species selection exit condition** (poll until phase changes after both reveals)
4. **State-based progress detection** (health/ship changes, not hardcoded phase names)

### 8.2 Failure Modes
Harnesses **SHALL** fail loudly with descriptive errors:

- `CONTRACT_VIOLATION: intent X attempted during setup.species_selection`
- `CONTRACT_VIOLATION: did not exit setup.species_selection after both reveals`
- `FAILED_TO_RESOLVE: no progress after N steps (log phase history)`

---

## 9. Examples

### 9.1 Correct Species Selection Flow
```typescript
// Fetch fresh state
const state = await fetchGameState(gameId, session);
assert(getPhaseKey(state) === 'setup.species_selection');

// Submit species intents (allowed)
await submitIntentChecked(gameId, p1, 'SPECIES_COMMIT', { commitHash }, log);
await submitIntentChecked(gameId, p1, 'SPECIES_REVEAL', { payload, nonce }, log);
await submitIntentChecked(gameId, p2, 'SPECIES_COMMIT', { commitHash }, log);
await submitIntentChecked(gameId, p2, 'SPECIES_REVEAL', { payload, nonce }, log);

// Poll until phase exits (NO DECLARE_READY)
let attempts = 0;
while (attempts < 30) {
  const freshState = await fetchGameState(gameId, session);
  const phaseKey = getPhaseKey(freshState);
  
  if (phaseKey !== 'setup.species_selection') {
    log(`✓ Exited species selection, now in: ${phaseKey}`);
    break;
  }
  
  await sleep(200);
  attempts++;
}

if (attempts >= 30) {
  throw new Error('CONTRACT_VIOLATION: did not exit setup.species_selection after both reveals');
}
```

### 9.2 Correct Intent Submission with Fresh Turn
```typescript
async function submitIntentChecked(
  gameId, session, intentType, payload, log
) {
  // Always fetch fresh state first
  const state = await fetchGameState(gameId, session);
  const phaseKey = getPhaseKey(state);
  const turnNumber = getServerTurnNumber(state);
  
  // Enforce phase contract
  if (phaseKey === 'setup.species_selection') {
    const allowed = ['SPECIES_COMMIT', 'SPECIES_REVEAL'];
    if (!allowed.includes(intentType)) {
      throw new Error(`CONTRACT_VIOLATION: ${intentType} not allowed in species selection`);
    }
  }
  
  // Submit with fresh turn
  return submitIntent(gameId, session, intentType, turnNumber, payload);
}
```

---

## 10. Non-Goals

This contract **does not** specify:
- UI styling or layout
- Polling intervals or frequency
- Client-side caching strategies
- Optimistic update behavior

---

**Version**: 1.0  
**Last Updated**: 2026-01-20  
**Authority**: This document is normative for all client-server interactions in Shapeships.
