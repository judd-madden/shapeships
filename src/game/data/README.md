# /game/data

This directory holds client-consumable data definitions and adapters used for rendering, previewing, and UI-facing rule presentation.

For architecture context:
- [../../documentation/contracts/canonical-handoff.md](../../documentation/contracts/canonical-handoff.md)
- [../../documentation/contracts/code-ownership-map.md](../../documentation/contracts/code-ownership-map.md)

## Role
The client may keep a mirrored local representation of data such as ship definitions so that:
- rendering can be immediate
- previews can be computed without unnecessary server round-trips
- UI can display rules and metadata cleanly

## Important authority rule
Canonical ship definitions live on the server.

Client-side data in this directory is a mirror / consumer layer, not the final authority.

If the client mirror and server differ, the server wins.

## Constraints
- keep client data structured and readable
- avoid duplicating the same concept in multiple client-only formats without reason
- do not let UI convenience turn this layer into an authoritative rules engine
- preserve alignment with server definitions as implementation evolves

## Typical contents
- mirrored ship definitions
- UI adapters
- display-facing metadata
- type-safe lookup helpers for client/UI use
