# Shapeships Canonical Handoff

This document defines the architectural invariants of the Shapeships codebase.

It is intended for both human developers and AI agents.

Operational execution rules live in:
- [../../../AGENTS.md](../../../AGENTS.md)

Supporting ownership reference:
- [code-ownership-map.md](code-ownership-map.md)

## 1. Purpose
This file defines:
- architectural invariants
- responsibility boundaries
- non-negotiable constraints

It does **not** define day-to-day pass templates or detailed workflow instructions.

## 2. Core Architectural Invariants

### 2.1 Server Authority
The server is the authoritative source of game truth.

The server determines:
- rule legality
- turn resolution
- combat outcomes
- effect application
- canonical game state transitions

The client may render previews, but must not determine authoritative outcomes.

### 2.2 Client Is Non-Authoritative
Client responsibilities include:
- rendering game state
- player interaction
- UI state
- network requests
- preview projections

The client must never determine final legality or final state.

### 2.3 Display Layer Is Presentation Only
Directories such as:
- `src/game/display/**`
- `src/components/**`
- `src/graphics/**`

are presentation layers.

They may:
- render state
- present interaction controls
- display previews

They must not contain authoritative game logic.

### 2.4 Reuse Before Reinvention
If logic already exists elsewhere in the system, reuse it.

Duplicating rule logic increases the risk of server/client drift.

### 2.5 Determinism
Game logic must remain deterministic.

Identical authoritative inputs should produce identical authoritative outcomes.
Randomization must be explicit and controlled.

## 3. Code Ownership Boundaries

### 3.1 Server Engine
Primary authority lives under:
- `src/supabase/functions/server/**`

Responsibilities:
- authoritative rules
- intent resolution
- effect application
- canonical state transitions

### 3.2 Client Runtime
Primary client/runtime ownership lives under:
- `src/game/client/**`

Responsibilities:
- session lifecycle
- server communication
- view-model creation
- client-side orchestration

### 3.3 Display Layer
Primary display ownership lives under:
- `src/game/display/**`
- `src/components/**`
- `src/graphics/**`

Responsibilities:
- rendering
- layout
- animation
- visual feedback

Display layers consume view models but do not own authoritative rules.

### 3.4 Data Definitions
Canonical ship definitions live on the server.

The client maintains a mirrored local copy for rendering and preview purposes.

The mirror should remain aligned with the server definitions, but the server remains authoritative if discrepancies occur.

## 4. File Structure as a Signal
File structure is not the only source of architectural truth, but directory boundaries are strong ownership signals and should be respected.

Avoid moving files or creating new folders unless the pass explicitly includes structural refactoring.

## 5. UI Architecture Principles

### Shells
Shells define structural layout for major application states.

### Panels
Panels are interaction surfaces that gather user intent and hand it to the client/runtime layer.

### Primitives and Graphics
Reusable UI primitives and ship graphics should stay generic and presentation-oriented.

## 6. Tooling Environment
The project currently uses:
- Vite for local development
- Tailwind for styling
- TypeScript across the codebase
- Supabase Edge Functions for the server

Tooling configuration should remain stable during normal feature work.

## 7. AI-Assisted Development
AI agents should:
- inspect files before editing
- preserve ownership boundaries
- keep changes small and targeted
- avoid silent architectural drift

Detailed agent operating rules are in [../../../AGENTS.md](../../../AGENTS.md).

## 8. Architecture Evolution
Architecture may evolve, but structural changes should be deliberate, reviewed, and documented.

Avoid accidental drift caused by convenience edits.
