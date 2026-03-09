# Polling, Performance & Scaling Notes

> **Status:** Informational / non-normative
>
> Canonical architecture rules live in:
> - [../contracts/canonical-handoff.md](../contracts/canonical-handoff.md)
> - [../contracts/code-ownership-map.md](../contracts/code-ownership-map.md)

This document describes the current polling-based posture, rough scaling assumptions, and likely future scaling options.

## Purpose
This file exists to:
- explain why polling is used today
- capture current assumptions and trade-offs
- provide a reference for future scaling conversations

It is not the source of truth for gameplay architecture.

## Current posture
The current system favors:
- simplicity
- debuggability
- readable state exchange
- gameplay correctness before infrastructure optimization

## Current implementation notes
- polling is the default sync model
- immediate refetches may follow important player actions
- more advanced transport may be considered later if usage demands it

## When to revisit
Revisit this document when:
- concurrency rises materially
- latency becomes a user-facing problem
- deployment architecture changes
