# Polling, Performance & Scaling Notes

> **Status:** Informational / non-normative
>
> Canonical architecture rules live in:
> - [../contracts/canonical-handoff.md](../contracts/canonical-handoff.md)
> - [../contracts/code-ownership-map.md](../contracts/code-ownership-map.md)

This document describes the current polling-based runtime posture as implemented in the repo today. It is not the source of truth for gameplay architecture.

## Purpose

This file exists to:
- describe the current read and refresh seams in the client runtime
- capture the practical trade-offs of the current polling posture
- provide a factual baseline for future infrastructure discussions

## Current runtime seams

The current client runtime is centered on `src/game/client/useGameSession.ts` and extracted helper hooks under `src/game/client/gameSession/clienteffects/`.

The main live-read surfaces currently in use are:
- full authoritative reads from `/game-state/:gameId`
- lightweight head reads from `/game-state-head/:gameId`
- separate chat polling from `/chat-state/:gameId`
- separate battle-log history fetches from `/game-history/:gameId`

These seams are split on purpose in the current codebase:
- `useNetworkingEffects.ts` owns auto-join and live game-state polling behavior
- `useChatPolling.ts` owns separate chat polling and burst behavior
- `useGameSession.ts` triggers battle-log history fetches when a game loads, when the turn changes, and when a game finishes

## Game-state polling posture

Current repo posture:
- full `/game-state` reads remain the authoritative refresh path
- `/game-state-head` is used as a lighter snapshot for change detection and clock data
- when the head snapshot changes, finishes, or ages past the safety window, the runtime falls back to a full `/game-state` fetch
- important client actions can trigger immediate refreshes instead of waiting for the next polling interval

The polling code currently distinguishes between more active polling and slower untimed-idle polling. This is implemented in the runtime today, but it is still a pragmatic transport posture rather than a finalized scaling design.

## Chat and history reads

Chat is not bundled into the main game-state polling loop. The current runtime polls chat separately, including a short burst window after new chat activity.

Battle-log history is also kept separate from the main live-state path. The client fetches persisted history through `/game-history/:gameId` when it needs that archive data rather than treating it as part of every polling response.

## Server read behavior

The current server read path in `src/supabase/functions/server/routes/game_routes.ts` uses `prepareGameStateRead(...)` before serving both `/game-state/:gameId` and `/game-state-head/:gameId`.

That read-time maintenance currently includes:
- state revision normalization
- phase-field synchronization
- clock accrual for up-to-date clock views

The current implementation is careful not to use GET reads as a place to advance phases. Read maintenance updates presentation-safe derived state, but phase advancement remains elsewhere in the authoritative server flow.

## Why this posture exists

The current system favors:
- simple, inspectable HTTP flows
- clear authority boundaries
- targeted fetch surfaces instead of one oversized response
- correctness and debuggability before transport sophistication

## When to revisit

Revisit this document when:
- polling cadence becomes a user-facing latency problem
- the current split between full, head, chat, and history reads stops being sufficient
- deployment or concurrency patterns change enough to justify a different transport model
