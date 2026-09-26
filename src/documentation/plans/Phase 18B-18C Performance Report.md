# Phase 18B–18C Current-Turn Projection Performance Report

## Status and conclusion

- **Environment:** Windows x86_64, Deno 2.7.14, 24 reported hardware threads.
- **Method:** 25 warm-up runs followed by 200 serial measured runs per fixture.
- **Adapter:** In-memory structured-clone persistence used by route tests. These numbers are not database latency and are not production-route measurements.
- **Gate:** **Incomplete for public rollout.** The calculation shape is provisionally inexpensive in this environment. The explicitly approved Phase 18D client-runtime implementation landed on 2026-09-26, but deployed-equivalent session validation and real canonical database reads are still required before public rollout.

The provisional recommendation is to retain the simple calculate-on-request/full-GET design for the next measurement. No cache, memoization, limiter, persistence change, or polling-cadence change is justified by the in-memory calculation results alone.

## Preview contract notes

The 16 KiB body limit, 64-entry build limit, 200-attempt limit, 200-entry selection-array limits, and 128-character request-token limit apply only to the optional preview route. Exceeding a preview limit makes that preview unavailable; it never changes whether the authoritative `BUILD_SUBMIT` is legal, which continues to use its existing validation and bounds.

The first eligible preview may omit `sourceContextKey`. When a later request supplies an obsolete key after a public estimator-context change, the route returns `source_context_changed` with `retry.allowed: true` and the new viewer-safe key. The client may immediately resend the same draft and request token/generation with that key, without waiting for another head change or full GET. A turn or phase change returns `retry.allowed: false`. Hidden-only canonical revision changes leave the viewer-safe key unchanged.

## Phase 18B estimator-only results

| Fixture | Shape | Median | p95 | Range |
| --- | --- | ---: | ---: | ---: |
| Empty established | 8 established ships, empty eligible draft | 0.214 ms | 0.366 ms | 0.149–1.127 ms |
| Four-species midgame | 14 mixed native/foreign ships | 0.249 ms | 0.397 ms | 0.176–0.796 ms |
| Complex late game | 28 mixed/foreign ships, multiple DRE/SCI/QUE/EVO/SOL, multi-build draft | 0.432 ms | 0.610 ms | 0.372–0.915 ms |

Repeat with:

```text
deno test --allow-env src/supabase/functions/server/tests/engine/state/currentTurnEstimator_performance_test.ts
```

## Phase 18C in-memory route results

Each row reports the number of estimator calls made by that route. Authentication and canonical-load columns measure only the in-memory test adapters. Total route includes Hono dispatch and response serialization.

| Fixture | Estimates | Auth median / p95 | Load median / p95 | Estimator median / p95 | Total median / p95 | Observed total range |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Representative preview POST | 1 | 0.0002 / 0.0002 ms | 0.028 / 0.044 ms | 0.221 / 0.373 ms | 0.370 / 0.568 ms | 0.285–1.275 ms |
| Representative submitted-waiting GET | 1 | 0.0003 / 0.0003 ms | 0.031 / 0.044 ms | 0.207 / 0.365 ms | 0.459 / 0.740 ms | 0.388–1.370 ms |
| Representative waiting-opponent GET | 0 | 0.0002 / 0.0002 ms | 0.025 / 0.036 ms | 0.001 / 0.003 ms | 0.163 / 0.325 ms | 0.142–0.684 ms |
| Representative revealed player GET | 2 | 0.0002 / 0.0003 ms | 0.028 / 0.037 ms | 0.291 / 0.508 ms | 0.552 / 0.858 ms | 0.449–1.430 ms |
| Representative revealed spectator GET | 2 | 0.0001 / 0.0002 ms | 0.028 / 0.037 ms | 0.263 / 0.442 ms | 0.498 / 0.727 ms | 0.431–0.997 ms |
| Complex preview POST | 1 | 0.0001 / 0.0002 ms | 0.046 / 0.060 ms | 0.312 / 0.526 ms | 0.485 / 0.765 ms | 0.417–1.268 ms |
| Complex submitted-waiting GET | 1 | 0.0001 / 0.0002 ms | 0.050 / 0.071 ms | 0.320 / 0.543 ms | 0.616 / 0.892 ms | 0.559–1.222 ms |
| Complex waiting-opponent GET | 0 | 0.0001 / 0.0002 ms | 0.044 / 0.069 ms | 0.001 / 0.002 ms | 0.226 / 0.349 ms | 0.202–0.463 ms |
| Complex revealed player GET | 2 | 0.0001 / 0.0002 ms | 0.042 / 0.068 ms | 0.086 / 0.143 ms | 0.314 / 0.547 ms | 0.281–0.833 ms |
| Complex revealed spectator GET | 2 | 0.0001 / 0.0002 ms | 0.041 / 0.058 ms | 0.082 / 0.110 ms | 0.304 / 0.505 ms | 0.277–0.693 ms |

The complex route fixture contains 27 mixed ships with Dreadnought, Science Vessel, Queen, Evolver, Solar Grid, and foreign effects. The representative fixture contains eight established ships and uses an empty eligible draft.

Repeat with:

```text
deno test --allow-env src/supabase/functions/server/tests/routes/current_turn_projection_performance_test.ts
```

## Measurement still required before Phase 18 public rollout

Run the same zero-, one-, and two-estimator requests in a safe deployed-equivalent environment using the real session-validation and persistence stack. Record separately:

- session/authentication latency;
- canonical game-row database latency;
- estimator calculation latency;
- response projection and serialization latency;
- total preview POST, submitted-waiting GET, revealed player GET, and revealed spectator GET latency;
- warm and cold behavior for representative and complex fixtures, with median, p95, and range.

Only that measurement can complete the 18B/18C load gate and authorize or reject the implemented request/full-GET posture for public rollout. The client implementation does not change polling cadence, add persistence, or add a cache/limiter as a substitute for this evidence.
