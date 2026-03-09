# Shapeships AI Development Rules

This file defines the operational rules for AI agents working in the Shapeships repository.

Before editing code, read:

1. `src/documentation/contracts/canonical-handoff.md`
2. `src/documentation/contracts/code-ownership-map.md`
3. `src/documentation/Guidelines.md`

These documents define the architecture, ownership boundaries, and guarded workflow expectations.

## Core Principles

### Preserve Architecture
Shapeships is **server-authoritative**.

The server determines:
- rule legality
- combat outcomes
- state transitions
- effect application
- canonical game state

The client and UI render state, collect input, and project previews, but are never authoritative.

## Pass Execution Template

When executing implementation tasks in this repository, follow the standard pass template located at:

src/documentation/workflows/CodexPassTemplate.md

All Codex tasks should be framed as a scoped pass using that template.

The template defines:

- pass types (Server Pass, Client/UI Pass, Tooling Pass, Mixed Pass)
- scope boundaries
- validation expectations
- required output format
- the "plan before edit" workflow

Agents should read and follow this template before implementing changes.

Agents must propose a file plan before modifying code unless explicitly instructed otherwise.

### Inspect Before Editing
Before making changes:
1. inspect the relevant files
2. identify the ownership layer
3. confirm the current pass type
4. keep the change inside that scope

Do not edit blindly.

### Prefer Small, Surgical Changes
- edit the smallest reasonable set of files
- preserve existing structure
- avoid rewriting entire files when local edits will do
- avoid introducing new abstractions unless the pass explicitly requires them

Large refactors require explicit approval.

## Pass Types

### 1. Server Pass
Allowed:
- `src/supabase/functions/server/**`

Purpose:
- authoritative rules
- intent resolution
- phase handling
- effect application
- canonical state transitions

Not allowed by default:
- `src/game/client/**`
- `src/game/display/**`
- `src/components/**`
- `src/graphics/**`
- styling changes

### 2. Client / UI Pass
Allowed:
- `src/game/client/**`
- `src/game/display/**`
- `src/components/**`
- `src/graphics/**`

Purpose:
- view-model updates
- UI behavior
- panels and screens
- graphics and animations
- presentation-safe preview wiring

Not allowed by default:
- changing authoritative server rules
- moving networking out of the client runtime
- adding rule authority to display code

### 3. Tooling Pass
Only when explicitly requested.

May include:
- Vite config
- Tailwind config
- tsconfig
- package scripts
- Deno config
- build tooling

Tooling passes should remain isolated from gameplay changes.

### 4. Mixed Pass
Any pass that touches both authoritative server logic and client/UI code requires explicit approval.

Do not silently expand a pass into mixed scope.

## Ownership Rules

### Server Authority
The server is authoritative. If server and client disagree, the server wins.

### Client Runtime
Networking and session orchestration should remain centralized in the client runtime layer.

Do not move live server interaction into display components.

### Display Layer
Display components are presentation-oriented. They may:
- render state
- gather input
- call callbacks
- show previews

They must not:
- become authoritative
- directly own server communication
- invent gameplay rules

### Data Definitions
Canonical ship definitions live on the server.

The client keeps a mirrored local copy for rendering and preview purposes.
The mirror should stay aligned with the server definitions, but the server remains authoritative.

## Styling Rules

This project uses **Tailwind CSS** with a Vite-based local workflow.

Agents should:
- prefer existing Tailwind utility patterns already used nearby
- modify existing class strings before inventing new styling approaches
- avoid adding new CSS files unless explicitly requested
- avoid introducing alternate styling systems

Inline styles are allowed for one-off cases, but should not become the default styling approach.

If a visual bug may be related to Tailwind class pickup or build-pipeline behavior, call that out explicitly instead of pretending the class is guaranteed to work.

## Tooling Rules

The project uses:
- Vite for local development
- Tailwind CSS for styling
- TypeScript across the codebase
- Supabase Edge Functions for the authoritative server

Do not change build/config/tooling files during ordinary feature passes unless the pass is explicitly a tooling pass.

## Validation Expectations

After changes, run the relevant checks for the pass where practical.

Typical checks in this repo may include:
- `npm run typecheck`
- `npm run build`
- `deno check src/supabase/functions/server/index.tsx`
- `deno task check`

Report what was run, what passed, and any unresolved issues.

## Output Expectations

After completing a pass, summarize:
- files changed
- what changed
- why the change belongs in this layer
- what validation was run
- any remaining risks or assumptions

## Safety Rules

Do not:
- move large parts of the repo without approval
- rename folders casually
- create new architectural layers casually
- duplicate existing rule logic without justification
- modify config files unintentionally
- replace whole files when smaller edits are sufficient

## When Unsure
When uncertain:
1. preserve existing architecture
2. prefer the smallest change
3. consult the canonical docs above
4. avoid cleverness that increases blast radius


## Current UI Entry Posture

The repo currently has two intentional UI entry paths:

- `App.tsx` is the active development dashboard / launcher used during ongoing implementation and testing
- the shell/scaffolding area remains active project code and is intended to mature into the long-term primary player-facing entry path

Agents must not treat shell/scaffolding code as obsolete unless explicitly instructed.