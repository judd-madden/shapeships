# /engine

This directory is the shared pure-logic import surface used by non-authoritative consumers and shared code paths.

For architecture context:
- [../documentation/contracts/canonical-handoff.md](../documentation/contracts/canonical-handoff.md)
- [../documentation/contracts/code-ownership-map.md](../documentation/contracts/code-ownership-map.md)

## Role
`/engine` should contain or expose pure, deterministic logic that can be shared safely without introducing UI or network concerns.

## Constraints
- pure TypeScript only
- deterministic behavior
- no React
- no network calls
- no persistence concerns
- no display logic

## Authority note
Authoritative gameplay resolution still belongs to the server runtime and server-owned engine paths under `src/supabase/functions/server/**`.

If there is ever ambiguity between a shared mirror and the server-owned implementation, the server-owned implementation wins.

## Usage posture
Use this layer for:
- pure helpers
- shared tables
- deterministic logic that must be mirrored safely

Do not use this layer as an excuse to move authority out of the server.
