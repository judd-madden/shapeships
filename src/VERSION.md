# Shapeships - Current Repo Status

**Snapshot date:** April 24, 2026  
**Status:** Active alpha codebase

## Current posture

This repo currently consists of:
- a Vite/React client with `App.tsx` as the top-level entry/container
- a session-backed player shell flow plus direct in-match game mode
- a Supabase Edge Function server that remains authoritative for rules and state transitions

## Runtime truth

- Live game reads are polling-based.
- The client runtime uses full `/game-state/:gameId` fetches for authoritative refresh, `/game-state-head/:gameId` for lightweight change detection and clock snapshots, separate `/chat-state/:gameId` polling, and `/game-history/:gameId` fetches for persisted battle-log history.
- Intents and actions are submitted to the server; the client renders returned state and server-projected surfaces such as `availableActions`.

## Notes

- The shell and menu flow are active project code, not obsolete scaffolding.
- The current server package includes pragmatic route, engine, and `engine_shared` seams rather than a fully cleaned-up final structure.
- If mirrored or shared client-side logic disagrees with the server, the server still wins.

## References

- `documentation/contracts/canonical-handoff.md`
- `documentation/contracts/ServerClientTurnPhaseContract.md`
- `documentation/INDEX.md`
- `documentation/Guidelines.md`
