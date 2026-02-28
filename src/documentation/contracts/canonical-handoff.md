SHAPESHIPS
Canonical Architecture & Implementation Handoff

(Normative / Enforced / AI-Safe)

Purpose

This document defines the authoritative architectural, UI, data, graphics, and backend decisions for the Shapeships project.

It exists to prevent accidental reinvention, duplication, or structural drift—especially when using AI-assisted code generation tools (Figma Make, Claude, Copilot, etc.).

This document is normative, not descriptive.

If something conflicts with this document, this document wins.

0. Core Constraints & Philosophy
What Shapeships is

A 1v1 simultaneous-turn online strategy game

Ruleset is stable (minor balance tweaks only)

High UI complexity, very high logic complexity

Multiplayer-first, anonymous-friendly, secure by default

What Shapeships is not

Not a single-player prototype

Not a free-form rules sandbox

Not a heavy animation or effects-driven game

Not a traditional REST backend with client authority

1. File Structure vs Architectural Role

The filesystem layout is not authoritative.

Tools such as Figma Make may generate their own folder structures. This is acceptable and expected.

Folder location does not define architectural role.

Architectural role is defined by:

What the component owns (layout, navigation, content, logic)

How it is used (shell vs panel vs primitive)

What it is allowed to contain

If a conflict arises, architectural role overrides folder location.

Filesystem refactors may occur later but are not required during active development.

2. Documentation Rules

All project documentation lives under /documentation/

/documentation/INDEX.md is the sole canonical entry point

Documentation categories are:

contracts/ — normative, binding rules

howto/ — operational guidance

reference/ — lookup material

Status updates, plans, and migrations do not belong in documentation

Git history is the archive

3. UI Architecture: Shell-First, Content-Driven
Definition: Shell

A Shell is a top-level layout component that:

Owns layout, navigation, and chrome

Persists while content panels swap

Contains no rules or game logic

Is never duplicated per state

Canonical Shells

LoginShell

MenuShell

RulesShell

GameShell

Fundamental Rule

Shells own structure. Content panels swap inside them.

Do not create new pages for state changes

Do not duplicate layout per state

Use panel swapping via local state or props

4. Routing Exception Rule (Strict)

Routes are permitted only for:

Entering the app (root)

Entering a game context (game by id)

Leaving the app for rules (if routed)

All intra-screen state changes must occur via panel swaps, not routes.

5. Login & Entry UI
Canonical Entry Flow (Unauthenticated Mode)

When authentication is disabled:

App boots in PLAYER mode

LoginShell renders EnterNamePanel

Player enters a session-only display name

On submit, PLAYER navigates to MenuShell

No account creation or authentication UI is active in this mode.

Authentication Panels (Defined, Gated by Mode)

LoginDefaultPanel

CreateAccountPanel

ForgotPasswordPanel

Rules:

No separate routes for login flows

No duplicated layout chrome

Panel switching handled by local state

6. Menu Architecture

MenuShell is the post-entry hub.

MenuShell owns:

Persistent navigation

Main content panel swapping

Panels may include:

Multiplayer (private games)

Rules & Codex

Exit / Back

Other panels may exist but must follow the same architectural rules.

7. Rules System (Critical)
Decision: One RulesShell, Two Page Types

RulesShell owns navigation, tabs, and layout.

Tabs include:

Core Rules

Human

Xenite

Centaur

Ancient

Turn Timings

Page Type A: Global Rules Pages

Component: RulesGlobalPage

Characteristics:

Narrative text

Section headers

Callout blocks

Optional ship references

Page Type B: Species Rules Pages

Component: SpeciesRulesPage

Characteristics:

Identical layout for all species

Data-driven ship tables

Two sections: Basic Ships and Upgraded Ships

Rules:

No per-species layouts

No hardcoded ship rows

Species passed as a prop

8. Rules Data Sources
Ship Rules

Authoritative source: ShipDefinitions

Used by:

Rules pages

Tooltips

Action Panels

Build validation

Server logic

Historical Note (Non-Runtime)

CSV was previously used as a lossless authoring format.

CSV is not a runtime or authoritative source and must not be reintroduced without explicit architectural change.

Global Rules Content

Location: rulesContent.ts

Hand-authored

Narrative

Small

Not forced into tabular data formats

9. Graphics System
Zero External Assets Policy

No external image URLs

No runtime asset fetching

All graphics bundled with the app

Implementation Rules

Ship graphics are React components

SVG code embedded directly in TSX

No external SVG files

No direct path imports

Import only via assets modules

Styling Rules

SVGs accept className

Opacity and scale only

No animations, filters, or effects

10. UI Primitives

This project uses component primitives, not a global style system.

Rules:

One React component per primitive

Variants via props

No near-duplicate forks

No local recreation

Add to library if missing

11. Game Screen Architecture

GameShell owns:

Sidebar (chat, battle log, phase info)

Main play area

Action Panel

Action Panel rules:

All victory and draw states render here

No modals

No route changes on game end

12. Backend & Identity

Server is authoritative

Client is never trusted

Identity is derived server-side

Client never sends authoritative player identifiers

13. Server & Edge Functions

Server enforces:

Turn order

Phase legality

Action legality

Resolution

Explicitly forbidden:

Client-side damage calculation

Client-side turn resolution

Client-sent authoritative IDs

14. Persistence Responsibilities

Persistence supports:

Game records

Player identities

Game state snapshots

Append-only action logs

Lobby discovery indexing

The server remains the source of truth.

15. AI Code Generation Rules

When starting any AI session:

Import UI primitives first

State that shells already exist

Reuse components

Build order: Shell → Panels → Data wiring

Generated output must comply with:

Shell rules

Rules system

Graphics system

Server authority

16. Application Modes

The application operates in exactly one global mode at a time.

PLAYER mode

Real player experience

Boot entry: Enter Name screen

Post-entry hub: Main Menu

No debug affordances

DEV mode

Development-only

Entry: Dev Dashboard

Screen registry access

Mode is global and cannot be overridden by screens.

17. Dev Dashboard & Screen Registry

Dev Dashboard exists only in DEV mode.

It owns:

App mode switching

Screen registry navigation

Development visibility

Screen Registry rules:

All screens must be registered

Each entry has name, key, status, and open action

Unimplemented screens require stub components

Registry navigation never switches to PLAYER mode

18. Guiding Principle

Data drives UI.
Shells own structure.
Server owns truth.
Reuse beats invention.

Any code violating this document is incorrect, even if functional.
