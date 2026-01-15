# Polling, Performance & Scaling Notes

> **Status:** Informational / Non-Normative  
> **Scope:** Alpha v3 implementation notes  
> **Audience:** Developers and maintainers  
>
> This document describes the **current polling-based architecture**, rough
> **capacity estimates**, and **scaling options**.  
> It is **not** a source of truth for architecture or rules.
>
> Canonical constraints live in:
> `/documentation/architecture/canonical-handoff.md`

---

## Purpose

This document exists to:
- Explain *why* polling is used today
- Capture current assumptions and trade-offs
- Provide a reference for when (and how) to scale
- Avoid re-litigating the same infrastructure questions repeatedly

All figures are **estimates** and must be re-measured before production decisions.

---

## Polling Architecture

### What is polling?
- The client periodically requests game state from the server
- Alternative to WebSockets or Server-Sent Events (SSE)
- Simpler to reason about and debug
- Reliable across browsers and network conditions

Trade-off:
- Slight delay in seeing updates
- Much lower implementation and operational complexity

---

### Current implementation

- **Polling interval:** 5 seconds (default)
- **Location:** `/game/hooks/useGameState.tsx`
- **Request:** `GET /game-state/:gameId`
- **Auth:** Authorization header
- **Refresh behavior:**
  - Immediate refetch after player actions
  - Interval polling during idle/wait states
  - Faster polling during active phases (configurable)

This is intentionally conservative and debug-friendly.

---

### Why 5 seconds?

- Turn-based gameplay: feels near-instant for players
- Battery efficient on mobile
- Lower bandwidth usage
- Easier to scale on limited infrastructure
- Supports multiple concurrent games without saturation

This value is not sacred and may change.

---

## Server Capacity Estimates (Supabase Free Tier)

### Per-game usage (approximate)

- 2 players polling every 5 seconds
- ~24 requests per minute
- Average game length: ~20 minutes
- ~480 requests per game
- ~4–5 MB bandwidth per game (uncompressed)

---

### Concurrent games

| Load level | Concurrent games | Notes |
|---|---:|---|
| Safe | 1–10 | No issues expected |
| Moderate | 10–30 | Monitor latency |
| At risk | 30+ | Possible rate limits |

---

### Monthly bandwidth (2 GB free tier)

- ~425 games/month (uncompressed)
- ~850 games/month (basic optimizations)
- ~1,700 games/month (with compression)

---

### Bottlenecks to watch

- Edge Function concurrency (≈50–100 per region)
- Database connection pooling
- Monthly bandwidth caps
- Response time >2s (warning), >3s (problematic)

---

## Bandwidth & Scaling Options

### Quick win #1 — Limit actions log (recommended first)

**Idea:** Only return the most recent N actions.

- Implementation: trivial
- Suggested cap: last 50 actions
- Bandwidth reduction: ~50% late-game
- Trade-offs: none for gameplay

Example (server-side logic):

    if (gameData.actions && gameData.actions.length > 50) {
      gameData.actions = gameData.actions.slice(-50);
    }

**When:** Before ~300 games/month

---

### Quick win #2 — Adaptive polling

**Idea:** Adjust polling rate by phase.

- Faster polling during active phases
- Slower polling while waiting
- 20–30% bandwidth reduction

**When:** ~20 concurrent games

---

### Quick win #3 — JSON compression

**Idea:** Gzip responses in Edge Functions.

- 75–80% bandwidth reduction
- +10–50ms processing overhead
- Harder to debug (binary payloads)

**When:**
- ~500 games/month
- Production deployment
- Need to support 50+ concurrent games

---

### Advanced — WebSockets / Supabase Realtime

**Idea:** Server pushes updates instead of polling.

- 90%+ bandwidth reduction
- Supports 1000+ concurrent games
- Much higher complexity

**Trade-offs:**
- Reconnection logic
- Harder debugging
- Higher operational burden

**When:**
- 100+ daily active games
- Sub-second responsiveness required
- Paid infrastructure tier

---

## Monitoring & Diagnostics

### Warning signs

- Average response time >2 seconds
- Edge Function timeouts
- Supabase bandwidth alerts
- Player reports of lag or delays

---

### Recommended monitoring

- Log response times during development
- Weekly Supabase dashboard checks
- Simulate concurrency with multiple browser tabs
- Monitor Edge Function execution time

---

## Scaling checklist

- ☐ <300 games/month → current setup fine
- ☐ 300–500 games/month → limit actions log
- ☐ 500–1000 games/month → add compression
- ☐ 1000+ games/month → evaluate realtime transport

---

## Current posture

**Prototype-optimized**

- Prioritize simplicity and debuggability
- Avoid premature optimization
- Maintain readable JSON during Alpha
- Focus on gameplay correctness first

Infrastructure will evolve when usage demands it.

---

## When to revisit this document

- Public beta launch
- Sustained >20 concurrent games
- Monthly usage approaching free tier limits
- Any major backend refactor

This document is expected to change.
