# Shapeships Documentation Index

This directory contains the current documentation spine for the Shapeships codebase.

## Reading Order

1. [Current repository status](../VERSION.md)
2. [Canonical handoff](contracts/canonical-handoff.md)
3. [Code ownership map](contracts/code-ownership-map.md)
4. [Guidelines](Guidelines.md)
5. [Server/client turn-phase contract](contracts/ServerClientTurnPhaseContract.md)

For AI agents and implementation rules, also read:
- [../../AGENTS.md](../../AGENTS.md)

## Structure

### Current status

- [Current repository status](../VERSION.md) - primary snapshot for implementation completion, supported species, validation posture, and current testing work

### `contracts/`
Canonical architecture and integration rules.

- [canonical-handoff.md](contracts/canonical-handoff.md) - architectural invariants and ownership boundaries
- [code-ownership-map.md](contracts/code-ownership-map.md) - quick ownership map for where changes belong
- [ServerClientTurnPhaseContract.md](contracts/ServerClientTurnPhaseContract.md) - turn/phase integration contract

### `workflows/`
Operational templates and pass formats for implementation work.

- [CodexPassTemplate.md](workflows/CodexPassTemplate.md) - reusable template for implementation passes

### Planning records

Historical phase roadmaps and decision registers retained as implementation context. These records are not current-state authority; executable code and the current contracts above govern present behavior.

- [Phase 13 Ancient Species - GPT-5.6 Planning Record](<Phase 13 Ancient Species - GPT-5.6 Planning Record.md>) - historical Phase 13 planning and implementation record
- [Phase 14 Simplified Phases and Ship Tags](<Phase 14 Simplified Phases and Ship Tags.md>) - historical Phase 14 implementation roadmap
- [Phase 14 Rules v1.63 Alignment Addendum](<Phase 14 Rules v1.63 Alignment Addendum.md>) - historical Phase 14 rules-alignment and refinement record

Use [the current repository status](../VERSION.md) for current implementation posture, the canonical definitions and authoritative server implementation for current gameplay, and the contracts for stable architecture and ownership rules.

### `infrastructure/`
Non-normative operational and runtime notes.

- [polling-and-scaling.md](infrastructure/polling-and-scaling.md)

## Documentation policy
- Keep architecture docs current and concise.
- Keep current implementation status in [../VERSION.md](../VERSION.md).
- Prefer updating canonical docs over creating scattered one-off notes.
- Put workflow/process guidance in `workflows/`, not in architecture contracts.
- Put infrastructure and runtime posture notes under `infrastructure/`.
