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
