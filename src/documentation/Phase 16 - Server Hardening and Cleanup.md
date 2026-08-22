# Phase 16 — Server Hardening and Cleanup

## Normative Planning and Pass-Decomposition Document

- **Status:** Planning
- **Primary scope:** Server persistence/concurrency hardening, small authoritative safeguards, high-value regression coverage, and confirmed dead-code cleanup
- **Architecture baseline:** Existing server-authoritative Shapeships architecture
- **Source:** Phase 16 is derived from the holistic codebase review following completion of Phases 14–15

---

# 1. Purpose

Phase 16 is a short technical-hardening phase before further major development.

Its purpose is to:

- close the identified stale-write risk around timeout maintenance;
- apply consistent concurrency protection to relevant mutations of existing game records;
- make game creation collision-safe;
- verify the bot internal-action safety-cap behavior;
- strengthen the client/server ship-definition parity safeguard;
- remove obsolete protocol surface only where current runtime usage is conclusively absent;
- perform a small amount of low-risk repository hygiene.

This is not a general refactor phase.

---

# 2. Architectural posture

Shapeships remains server-authoritative.

Existing boundaries remain unchanged:

- authoritative game state and rules remain under `src/supabase/functions/server/**`;
- client runtime remains the networking/session seam;
- display code remains non-authoritative;
- normal gameplay intents continue through the existing CAS-protected authoritative reducer path.

Phase 16 should strengthen existing architecture rather than create new persistence, networking, or rules layers. 
---

# 3. Explicit non-goals

Phase 16 must not become:

- a rewrite or decomposition of `IntentReducer.ts`;
- a broad `any` → `GameState` migration;
- a `useGameSession` refactor;
- an account-system implementation;
- a DTO redesign;
- a phase-machine redesign;
- a gameplay/balance pass;
- a general security project;
- a new rate-limiting infrastructure project unless a narrowly scoped audit proves it is immediately required;
- a cleanup of code merely because it is old or large.

Large files remain acceptable where their complexity reflects real game complexity.

---

# 4. Phase 16A — Timeout Persistence / Read-Path Hardening

**Pass type:** Server Pass

## Goal

Eliminate the stale unconditional write identified in game-state read maintenance when clock accrual causes a terminal timeout.

## Required audit

Inspect:

- `prepareGameStateRead`
- `applyGameStateMaintenance`
- clock accrual / timeout finalization
- `/game-state`
- `/game-state-head`
- existing `IntentPersistence` CAS/retry helpers

Confirm the exact current behavior before editing.

## Required outcome

A game-state read must not be capable of overwriting a newer authoritative revision with a stale snapshot.

If timeout finalization remains allowed to persist from the read-maintenance path, that persistence must use the same revision-safe principles as other authoritative mutations.

Do not simply substitute one persistence function without checking:

- retry semantics;
- battle-log/history finalization;
- terminal state side effects;
- revision increments;
- duplicate timeout processing.

## Validation

Add or extend a regression test that proves:

1. read maintenance loads revision N;
2. another authoritative mutation advances the game;
3. stale maintenance cannot overwrite the newer state.

Also validate ordinary timeout behavior still finishes games correctly.

## Review gate

This pass must establish whether GET-triggered timeout persistence is an intentional design or an implementation convenience.

Do not widen the pass into redesigning clock architecture unless required to remove the stale-write hazard.

---

# 5. Phase 16B — Existing Game Record Mutation Concurrency

**Pass type:** Server Pass

## Goal

Audit non-intent mutations of existing game records and apply revision-safe persistence where a realistic lost-update race exists.

## Primary targets

Inspect individually:

- `join-game`
- `switch-role`
- any reconnect/rejoin mutation path
- other `game_routes.ts` handlers that read an existing `game_${gameId}` record and later write it

Do not treat every `kvSet` call as automatically wrong.

## Locked distinction

Existing-record mutation and new-record creation are different problems.

This pass concerns **existing game records only**.

For each writer determine:

- can this route race with normal gameplay intents?
- can it race with another seat-management action?
- can a stale snapshot overwrite newer authoritative game state?

Where the answer is yes, use the existing concurrency-safe persistence seam or an equivalently narrow solution.

## Validation

Add focused route-level concurrency tests for the cases actually changed.

Reuse the patterns already established by the authoritative intent persistence concurrency tests where practical.

---

# 6. Phase 16C — Game ID Creation Hardening

**Pass type:** Server Pass

## Goal

Make game creation cryptographically generated and collision-safe.

## Required changes

Inspect all flows that allocate a new game ID, including:

- normal game creation;
- Play Computer creation;
- new-game / rematch style flows where a fresh ID is generated.

Required posture:

- use cryptographically secure randomness rather than `Math.random()` for game IDs;
- never overwrite an existing game merely because a generated code collided;
- creation should use insert-if-absent semantics or an equivalent existence-safe retry loop;
- keep the current short human-shareable game-code product model unless a separate product decision changes it.

## Security scope

Also inspect whether unknown-code probing / repeated join attempts are already mitigated by deployment infrastructure.

Do **not** add a generic limiter to normal `/game-state` polling in this pass.

If no meaningful enumeration protection exists, record that as a separate infrastructure/security recommendation rather than casually introducing polling restrictions.

## Validation

Test:

- successful normal allocation;
- forced collision retries safely;
- existing game data cannot be overwritten;
- resulting IDs remain compatible with current UI/link handling.

---

# 7. Phase 16D — Bot Safety-Cap Verification

**Pass type:** Server Audit Pass, followed by Server Pass only if required

## Goal

Resolve the uncertainty around `MAX_BOT_STEPS_PER_REQUEST`.

The holistic review suggested that a bot exceeding the internal action cap could resume "on the next poll." That conflicts with the intended architecture that GET polling remains read-only and bot execution is triggered by authoritative writes.

## Audit questions

Trace exactly what happens when:

1. the bot is still required to act;
2. the internal action loop reaches its safety cap;
3. no human action is currently possible.

Determine whether:

- reaching the cap is impossible under valid current flows;
- another authoritative transition reliably continues bot execution;
- the game can remain temporarily waiting until some unrelated write;
- the game can deadlock.

## Outcome

If the current behavior is safe, document the reason and add a regression test if useful.

If a real deadlock path exists, implement the smallest server-authoritative continuation mechanism that preserves:

- event-driven bot execution;
- bounded work per request;
- no bot mutation from GET polling;
- the existing internal authoritative intent path.

Do not increase the cap arbitrarily as a substitute for understanding the lifecycle.

---

# 8. Phase 16E — Ship Definition Mirror Safeguard

**Pass type:** Server/Test Pass

## Goal

Make the existing ship-definition parity test protect the full intended mirror rather than only selected metadata.

The client/server ship definitions are intentionally mirrored and were confirmed aligned during the review. The existing parity test currently protects only a subset such as tags and activation timing.

## Required outcome

Extend test coverage so accidental drift in meaningful mirrored definition data is caught.

At minimum inspect parity for:

- ship IDs;
- names;
- costs;
- component requirements;
- joining requirements;
- power definitions/text;
- tags;
- activation timing;
- other canonical mirrored ship-definition properties.

Ignore deliberate client-only validation/dev wrapper differences.

Prefer semantic parsed-record equality rather than brittle comparison of source-file formatting.

## Non-goal

Do not remove the client definition mirror or make client production code import server definitions.

---

# 9. Phase 16F — Legacy Intent Surface Audit and Cleanup

**Pass type:** Server Pass

## Goal

Remove obsolete external protocol handlers where current usage is conclusively absent, without deleting internal mechanisms that remain useful.

## Candidates

### Battle commit/reveal

Audit:

- `BATTLE_COMMIT`
- `BATTLE_REVEAL`
- associated handler stubs
- shared request/type unions
- tests and documentation references

If they are confirmed unused and explicitly superseded by current Charge Declaration/action submission flows, remove the obsolete protocol surface.

### Build commit/reveal

Audit separately:

- `BUILD_COMMIT`
- `BUILD_REVEAL`
- live client send sites;
- tests;
- bot usage;
- internal commitment storage;
- `BUILD_SUBMIT`.

Do not assume that unused external intents mean internal commit/reveal machinery is obsolete.

If the external two-step protocol has no present or planned consumer, remove only that public intent surface while preserving internal commitment/reveal mechanisms still used by `BUILD_SUBMIT`, hidden-information handling, or authoritative resolution.

## Secondary cleanup

If removing an obsolete path eliminates duplicated build legality validation naturally, prefer deletion over extracting a new abstraction merely to preserve dead code.

If both build paths remain valid, consolidate duplicated legality validation as a later part of this pass.

---

# 10. Phase 16G — Small Repository Hygiene

**Pass type:** Documentation / low-risk Client cleanup

## Goal

Batch only confirmed non-functional cleanup found during the holistic review.

Candidates:

- fix malformed escaped Markdown in `src/game/client/AGENTS.md`;
- remove stale README references to directories that no longer exist;
- fix isolated mojibake console-log strings;
- remove the redundant branch in `allCommittedPlayersRevealed`;
- update comments referring to protocol paths removed in Phase 16F.

No architecture or gameplay changes.

Do not expand this into general formatting, documentation rewriting, or dead-code hunting.

---

# 11. Deferred findings

The following review findings are deliberately **not Phase 16 projects**.

## `IntentReducer.ts` typing

The heavy use of `any` is legitimate technical debt, but there is no current justification for a broad reducer typing migration.

Posture:

- improve types incrementally when touching relevant rules;
- avoid introducing new unnecessary `any`;
- consider future narrow typing slices only where TypeScript can catch realistic bugs.

## `useGameSession.ts`

The hook remains a major complexity hotspot, but the existing subsystem-extraction posture is appropriate.

Continue extracting cohesive systems opportunistically when those areas are being changed.

Do not refactor for file size alone.

## Account networking

`CreateAccountPanel` currently bypasses the central networking seam, but account creation is disabled/scaffolding.

Correct this as part of the eventual Accounts phase rather than spending Phase 16 effort preserving old scaffolding.

## Generic rate limiting

Potential game-code enumeration deserves awareness, but normal game-state polling is legitimate high-frequency traffic.

Any rate-limit design should be a separate infrastructure/security decision based on actual deployment controls and abuse requirements.

---

# 12. Recommended implementation order

Execute Phase 16 in this order:

1. **16A — Timeout Persistence / Read-Path Hardening**
2. **16B — Existing Game Record Mutation Concurrency**
3. **16C — Game ID Creation Hardening**
4. **16D — Bot Safety-Cap Verification**
5. **16E — Ship Definition Mirror Safeguard**
6. **16F — Legacy Intent Surface Audit and Cleanup**
7. **16G — Small Repository Hygiene**

16A–16C are the primary correctness/hardening work.

16D is an explicit investigation gate: do not implement a fix unless the lifecycle trace proves one is required.

16E–16G are lower-risk cleanup/safeguard work and may be deferred if promotion work takes priority.

---

# 13. Completion criteria

Phase 16 is complete when:

- timeout maintenance cannot stale-write over a newer authoritative revision;
- relevant mutations of existing game records use concurrency-safe persistence;
- new game creation cannot overwrite an existing game on ID collision;
- game IDs use secure random generation;
- bot safety-cap exhaustion is understood and cannot silently deadlock valid games;
- the ship-definition mirror has comprehensive parity protection;
- obsolete commit/reveal external intent surface has either been removed or explicitly justified as still required;
- the small confirmed documentation/code hygiene issues have been resolved;
- no gameplay rules, balance, display behavior, or major architecture have been unintentionally changed.

---

# 14. Bottom line

Phase 16 is not a response to architectural failure.

The holistic review found the core Shapeships architecture to be largely sound, including:

- shared authoritative human/bot intent resolution;
- CAS-protected normal gameplay mutation;
- strong hidden-information projection;
- phase-entry idempotency;
- sensible live-state polling behavior.

Phase 16 therefore focuses only on the places where those protections are currently inconsistent or incomplete.

After these passes, further broad cleanup should not block product, gameplay, or promotion work.