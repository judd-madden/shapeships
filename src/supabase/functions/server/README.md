# Server Module Organization

This directory contains the Shapeships server code that runs inside the Supabase Edge Function.

The current package is practical rather than perfectly clean. Route handlers, `engine/`, and `engine_shared/` all participate in the live server, but server authority still lives under `src/supabase/functions/server/**`.

## Current top-level structure

- `index.tsx` - Edge Function entrypoint, middleware, Supabase client setup, and route registration
- `routes/` - Hono route families for session/auth, game lifecycle and state reads, intent submission, chat/history-related reads, and test/debug endpoints
- `engine/` - authoritative server-side stateful logic used by the routes
- `engine_shared/` - deterministic shared helpers, definitions, tables, and resolution code used heavily by both routes and `engine/`
- `tests/` - centralized Deno regression tree mirroring production ownership areas such as `engine/`, `engine_shared/`, and `routes/`; it is not production runtime code
- `legacy/` - older server-side code that remains in-repo but is not the preferred place for new work
- `kv_store.tsx` - local server storage helper

## Current route families

### Session and auth surfaces
The server currently exposes session-backed entry points through `routes/auth_routes.ts` and `index.tsx`.

These surfaces are responsible for:
- minting session tokens
- resolving session metadata
- supporting the current session-only alpha posture

### Game lifecycle and state-read surfaces
`routes/game_routes.ts` currently owns the main game lifecycle and read-model surfaces.

That includes:
- creating private and computer games
- joining games and switching roles
- creating follow-up games from finished games
- serving authoritative game-state reads
- serving lightweight head snapshots
- serving persisted game-history responses

This route family also shapes the read payload returned to the client, including filtered hidden information, state revision data, clock snapshots, and server-projected action surfaces such as `availableActions`.

### Intent submission
`routes/intent_routes.ts` owns the current intent submission path.

That route family is responsible for:
- validating session-backed intent requests
- applying authoritative intent reduction
- persisting updated state
- handling battle-log history persistence
- appending chat entries emitted from intent events

### Chat and history-related storage helpers
The current package includes route-adjacent helpers such as:
- `routes/chat_kv.ts`
- `routes/state_revision.ts`

These support the live request path, but they are still support code inside the server package rather than standalone services.

### Test and debug surfaces
`routes/test_routes.ts` provides the current health, connection-test, echo, endpoint-listing, and system-test surfaces used for development and diagnostics.
These routes are registered only when `ENABLE_TEST_ROUTES=true`; production alpha should leave `ENABLE_TEST_ROUTES` unset.

## Request/runtime shape

The current live request shape is:
1. `index.tsx` sets up the Edge runtime, CORS, logging, KV helpers, and route registration.
2. Session identity is resolved from `X-Session-Token`, not from client-supplied player IDs.
3. Route handlers load and persist state through the KV-backed store.
4. Routes call into `engine/` and `engine_shared/` as needed, then return filtered or projected payloads to the client runtime.

## Import posture

Server code in this package should stay inside `src/supabase/functions/server/**`.

In current repo posture:
- routes import from `engine/` and `engine_shared/`
- `engine/` imports from `engine_shared/`
- server authority should not move into client or display code

## Deployment constraints

Code in this directory must remain Edge-compatible:
- Deno runtime
- TypeScript with `npm:` or `jsr:` imports where needed
- no reliance on filesystem access outside the bundled function

## Testing

At the September 1, 2026 snapshot, the centralized server suite contains 53 TypeScript `_test.ts` files. `deno task check` completes successfully with the existing ignored-compiler-option warnings. A full run with the read permission required by current source-inspection tests reported 540 passed tests, 5 failed tests, and 1 ignored test across 16 steps. The remaining failures are expectation mismatches against current Ancient authored plan/chooser behavior and one Mission paragraph-format expectation, so this is not an all-passing suite claim.

The test suite is centralized under `src/supabase/functions/server/tests/**` and mirrors production ownership areas including:

- `engine/`
- `engine_shared/`
- `routes/`

Current server validation commands:

```bash
deno check src/supabase/functions/server/index.tsx
deno test --allow-env --allow-read src/supabase/functions/server/tests
```

The live-server endpoint smoke utility is located at `tests/integration/test_all_endpoints.sh`. It requires a running local server and is not part of the normal Deno test suite.

`routes/test_routes.ts` remains active conditional development-route code. Test routes are registered only when:

```text
ENABLE_TEST_ROUTES=true
```
