# Shapeships Development Guidelines (Protected Pointer Doc)

> **This file is protected.**  
> It must remain short, strict, and non-duplicative.
>
> **Normative source of truth:**  
> `/documentation/architecture/canonical-handoff.md`
>
> If anything in this file conflicts with canonical-handoff, **canonical-handoff wins**.

---

## Purpose

This document exists to:
- Enforce **hard invariants** during rapid iteration
- Constrain **AI-assisted development tools** (especially Figma Make)
- Define **what must not be modified** without explicit instruction

This file is **not** an architecture spec, rules reference, roadmap, or performance plan.  
Those belong in `/documentation/**`.

---

## Hard Invariants (Do Not Break)

### Authority & Data Flow
- All interactions follow: **UI emits Intent → server validates/applies → UI renders state**
- **No gameplay rules in UI components**
- Client-side logic is **non-authoritative** (preview only)
- Server is the sole source of truth

### Separation of Concerns
- Engine code must be **pure TypeScript** (no React imports)
- Layer boundaries are strict:
  - `/game/engine/` → deterministic game logic only
  - `/game/display/` → rendering only (no rules)
  - `/server/` → validation, persistence, authority

### No Guessing
- AI tools must **not invent**:
  - game rules
  - ship behavior
  - phase timing
  - eligibility logic
- If information is missing, add a TODO and reference canonical-handoff.

---

## Figma Make (AI) Constraints — CRITICAL

### What Figma Make **MAY** do
Figma Make is allowed to create or modify UI **ONLY** in:

- Development-facing tools and screens, including:
  - Dev Dashboard
  - Test harnesses
  - Debug views
  - Build Kit / component showcases
  - Deployment or diagnostics screens

These are **DEV MODE ONLY** surfaces.

### What Figma Make **MUST NOT** do
Figma Make must **never**:
- Create or modify UI components in **player-facing screens**
- Alter layouts, panels, or flows in:
  - GameScreen
  - MenuShell
  - RulesShell
  - Login / Entry screens
- Introduce new player-facing UI without explicit instruction and Figma reference
- Add navigation, affordances, or UX logic to player UI
- Add gameplay logic, validation, or derived state

If a change affects **PLAYER MODE**, it requires explicit approval.

---

## Locked Components (Do Not Modify)

The following components are considered complete unless new Figma references are provided.

### Rules System
- `/components/panels/CoreRulesPanel.tsx`
- `/components/panels/SpeciesRulesPanel.tsx`
- `/components/panels/TimingsPanel.tsx`
- `/imports/RulesHeader.tsx`

### Protected Pattern
- ✅ Bug fixes and data wiring only
- ❌ No new UI, navigation, legends, or helper elements
- ❌ No styling changes without explicit request

---

## Graphics System Rules (Non-Negotiable)

- Ship graphics are **React SVG components**
- Location: `/graphics/{faction}/assets.tsx`
- **No external image hosting**
- **No runtime asset fetching**
- Graphics accept `className` for size/opacity only
- Import graphics via assets modules, never via direct paths

---

## Code Quality Rules

- TypeScript strictly enforced (avoid `any`)
- Keep files small and single-purpose
- Prefer explicitness over abstraction
- Log freely in dev harnesses, not in player UI

---

## Documentation Placement Rules

- No long documentation inside `/game/`
  - Exception: small README + active hard specs/contracts
- All documentation belongs under `/documentation/**`
- Historical, migration, and progress docs should be deleted or archived
- This file should remain a **pointer**, not a knowledge dump

---

## Where Things Live

- **Architecture & invariants:** `/documentation/architecture/canonical-handoff.md`
- **Engine specs:** `/documentation/engine/`
- **Testing & dev harness notes:** `/documentation/testing/`
- **Data docs:** `/documentation/data/`
- **Archive:** `/documentation/archive/`

---

## Notes

- Chronoswarm: **Pink Dice** (reminder only)
- Any implementation detail must live in canonical-handoff or a proper spec doc

---

## Infrastructure & Performance Notes

Details about polling, capacity estimates, and scaling strategies
are intentionally **not** defined here.

See:
- `/documentation/infrastructure/polling-and-scaling.md`

This file may change as the project evolves and is not normative.

---

**Guiding reminder:**  
If a change “seems reasonable” but is not explicitly allowed, **do not make it**.
