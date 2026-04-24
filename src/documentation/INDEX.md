# Shapeships Documentation Index

This directory contains the current documentation spine for the Shapeships codebase.

## Reading Order

1. [Canonical handoff](contracts/canonical-handoff.md)
2. [Code ownership map](contracts/code-ownership-map.md)
3. [Guidelines](Guidelines.md)
4. [Server/client turn-phase contract](contracts/ServerClientTurnPhaseContract.md)

For AI agents and implementation rules, also read:
- [../../AGENTS.md](../../AGENTS.md)

## Structure

### `contracts/`
Canonical architecture and integration rules.

- [canonical-handoff.md](contracts/canonical-handoff.md) - architectural invariants and ownership boundaries
- [code-ownership-map.md](contracts/code-ownership-map.md) - quick ownership map for where changes belong
- [ServerClientTurnPhaseContract.md](contracts/ServerClientTurnPhaseContract.md) - turn/phase integration contract

### `workflows/`
Operational templates and pass formats for implementation work.

- [CodexPassTemplate.md](workflows/CodexPassTemplate.md) - reusable template for implementation passes

### `infrastructure/`
Non-normative operational and runtime notes.

- [polling-and-scaling.md](infrastructure/polling-and-scaling.md)

## Documentation policy
- Keep architecture docs current and concise.
- Prefer updating canonical docs over creating scattered one-off notes.
- Put workflow/process guidance in `workflows/`, not in architecture contracts.
- Put infrastructure and runtime posture notes under `infrastructure/`.
