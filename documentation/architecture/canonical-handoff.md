# SHAPESHIPS
## Canonical Architecture & Implementation Handoff
(Normative / Enforced / AI-Safe)

---

## Purpose

This document defines the authoritative architectural, UI, data, graphics, and backend decisions for the Shapeships project.

It exists to prevent accidental reinvention, duplication, or structural drift, especially when using AI-assisted code generation tools (Figma Make, Claude, Copilot, etc.).

This document is normative, not descriptive.

If something conflicts with this document, this document wins.

---

## 0. Core Constraints & Philosophy

### What Shapeships is
- A 1v1 simultaneous-turn online strategy game
- Ruleset is stable (minor balance tweaks only)
- High UI complexity, very high logic complexity
- Multiplayer-first, anonymous-friendly, secure by default

### What Shapeships is not
- Not a single-player prototype
- Not a free-form rules sandbox
- Not a heavy animation or effects-driven game
- Not a traditional REST backend with client authority

---

## 1. File Structure vs Architectural Role

The filesystem layout is not authoritative.

Tools such as Figma Make may generate their own folder structures. This is acceptable and expected.

Folder location does NOT define architectural role.

Architectural role is defined by:
- What the component owns (layout, navigation, content, logic)
- How it is used (shell vs panel vs primitive)
- What it is allowed to contain

If a conflict arises, architectural role overrides folder location.

Filesystem refactors may occur later but are not required during active development.

---

## 2. Documentation Rules

- All markdown files except README.md live inside /documentation/
- Documentation is grouped by concern:
  - architecture
  - rules
  - backend
- No orphan markdown files at repo root

---

## 3. UI Architecture: Shell-First, Content-Driven

### Definition: Shell

A Shell is a top-level layout component that:
- Owns layout, navigation, and chrome
- Persists while content panels swap
- Contains no rules or game logic
- Is never duplicated per state

### Canonical Shells
- LoginShell
- MenuShell
- RulesShell
- GameShell

### Fundamental Rule

Shells own structure. Content panels swap inside them.

- Do not create new pages for state changes
- Do not duplicate layout per state
- Use panel swapping via local state or props

---

## 4. Routing Exception Rule (Strict)

Routes are permitted only for:
- Entering the app (root)
- Entering a game context (game by id)
- Leaving the app for rules (if routed)

All intra-screen state changes must occur via panel swaps, not routes.

---

## 5. Login & Entry UI

### Canonical Entry Flow (Alpha)

- App boots in PLAYER mode
- LoginShell renders EnterNamePanel
- Player enters a display name (session-only)
- On submit, PLAYER navigates to Main Menu (MenuShell)

No account creation or authentication panels are used in Alpha.

### Post-Alpha Panels (Defined but Disabled)
- LoginDefaultPanel
- CreateAccountPanel
- ForgotPasswordPanel

Rules:
- No separate routes for login flows
- No duplicated layout chrome
- Panel switching handled by local state

---

## 6. Menu Architecture

MenuShell is the post-entry hub.

MenuShell owns:
- Persistent navigation
- Main content panel swapping

Alpha-visible panels:
- Multiplayer (Private Only)
- Rules & Codex
- Back / Exit

Deferred panels (not implemented in Alpha):
- Public Lobby
- Game History
- Play Computer
- Campaign

---

## 7. Rules System (Critical)

### Decision: One RulesShell, Two Page Types

RulesShell owns navigation, tabs, and layout.

Tabs include:
- Core Rules
- Human
- Xenite
- Centaur
- Ancient
- Turn Timings

### Page Type A: Global Rules Pages
Component: RulesGlobalPage

Characteristics:
- Narrative text
- Section headers
- Callout blocks
- Optional ship references

### Page Type B: Species Rules Pages
Component: SpeciesRulesPage

Characteristics:
- Identical layout for all species
- Data-driven ship tables
- Two sections: Basic Ships and Upgraded Ships

Rules:
- No per-species layouts
- No hardcoded ship rows
- Species passed as a prop

---

## 8. Rules Data Sources

### Ship Rules
Authoritative source: ShipDefinitions

Used by:
- Rules pages
- Tooltips
- Action Panel
- Build validation
- Server logic

### CSV Clarification

CSV-backed ship data is a lossless source format, not a logic source.

CSV preserves wording, timing labels, and raw text.

Runtime logic must not be based on CSV string parsing.

### Global Rules Content
Location: rulesContent.ts

- Hand-authored
- Narrative
- Small
- Not forced into CSV

---

## 9. Graphics System

### Zero External Assets Policy
- No external image URLs
- No runtime asset fetching
- All graphics bundled with the app

### Implementation Rules
- Ship graphics are React components
- SVG code embedded directly in TSX
- No external SVG files
- No direct path imports
- Import only via assets modules

### Styling Rules
- SVGs accept className
- Opacity and scale only
- No animations, filters, or effects

---

## 10. UI Primitives

This project uses component primitives, not a global style system.

Rules:
- One React component per primitive
- Variants via props
- No near-duplicate forks
- No local recreation
- Add to library if missing

---

## 11. Game Screen Architecture

GameShell owns:
- Sidebar (chat, battle log, phase info)
- Main play area
- Action Panel

Action Panel rules:
- All victory and draw states render here
- No modals
- No route changes on game end

---

## 12. Backend & Identity (Conceptual)

- Server is authoritative
- Client is never trusted
- Identity is derived server-side
- Client never sends authoritative playerId

---

## 13. Server & Edge Functions

Server enforces:
- Turn order
- Phase legality
- Action legality
- Resolution

Explicitly forbidden:
- Client-side damage calculation
- Client-side turn resolution
- Client-sent authoritative IDs

---

## 14. Supabase Tables

Supabase is used for:
- Realtime state sync
- Persistence
- Auth post-Alpha

Expected tables:
- games
- players
- game_states
- actions_log (append-only)
- lobby_index

Server remains the source of truth.

---

## 15. AI Code Generation Rules

When starting any AI session:
- Import UI primitives first
- State that shells already exist
- Reuse components
- Build order: Shell, then Panels, then Data wiring

Generated output must comply with:
- Shell rules
- Rules system
- Graphics system
- Server authority

---

## 16. Application Modes

The application operates in exactly one global mode at a time.

PLAYER mode:
- Real player experience
- Boot entry: Enter Name screen
- Post-entry hub: Main Menu
- No debug affordances

DEV mode:
- Development-only
- Entry: Dev Dashboard
- Screen registry access

Mode is global and cannot be overridden by screens.

---

## 17. Dev Dashboard & Screen Registry

Dev Dashboard exists only in DEV mode.

It owns:
- App mode switching
- Screen registry navigation
- Development visibility

Screen Registry rules:
- All screens must be registered
- Each entry has name, key, status, and open action
- Unimplemented screens require stub components
- Registry navigation never switches to PLAYER mode

---

## 18. Alpha Scope Overrides (Temporary)

For Alpha v3 only:
- Authentication UI disabled
- No account creation
- Session-only player names
- No public lobby
- Private URL games only
- Human vs Human only
- MenuShell enabled to access Rules & Codex

These are scope cuts, not architectural changes.

Core invariants remain:
- Server owns truth
- Shell-first UI
- No client authority
- No external assets

---

## 19. Guiding Principle

Data drives UI.  
Shells own structure.  
Server owns truth.  
Reuse beats invention.

Any code violating this document is incorrect, even if functional.
