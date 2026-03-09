# Shapeships Development Guidelines

This document is a short guardrail layer for contributors and AI agents.

**Architecture source of truth:**
- [contracts/canonical-handoff.md](contracts/canonical-handoff.md)
- [contracts/code-ownership-map.md](contracts/code-ownership-map.md)

**Operational agent rules:**
- [../../AGENTS.md](../../AGENTS.md)

If anything here conflicts with the canonical architecture docs, the canonical docs win.

## Purpose
This file exists to:
- reinforce hard invariants during fast iteration
- keep AI-assisted changes inside architectural boundaries
- prevent accidental drift across server, client, and display layers

It is not a roadmap, changelog, or long-form architecture document.

## Hard Invariants

### Authority and data flow
- All gameplay interactions follow: **UI emits intent -> server validates/applies -> client/UI renders state**
- No player-facing UI becomes authoritative
- No gameplay rules are invented in display code
- The server is the final authority

### Separation of concerns
- authoritative rules belong on the server
- networking belongs in the client runtime layer
- display code renders state and gathers input
- shared graphics/primitives stay reusable and presentation-oriented

### No guessing
AI tools must not invent:
- ship behavior
- rule legality
- phase timing
- targeting legality
- hidden architecture changes

If information is missing, preserve the existing pattern and surface the uncertainty.

## Pass discipline
Preferred pass types:
- **Server Pass**
- **Client/UI Pass**
- **Tooling Pass**
- **Mixed Pass** only by explicit approval

Do not quietly expand the scope of a pass.

## Tailwind / Vite guardrails
- follow existing Tailwind patterns used nearby
- do not introduce alternate styling systems casually
- do not change Vite, Tailwind, tsconfig, or Deno config during ordinary feature work
- config changes belong in a dedicated tooling pass

## Documentation placement
- canonical architecture rules belong in `contracts/`
- workflow/process templates belong in `workflows/`
- infrastructure notes belong in `infrastructure/`

Keep this file short.
