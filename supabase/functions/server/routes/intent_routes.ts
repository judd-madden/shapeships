/**
 * INTENT ROUTES
 * 
 * Commit/reveal protocol endpoint using deterministic reducer.
 * 
 * Key principles:
 * - Use game_${gameId} KV key (matches game_routes.ts)
 * - Use requireSession pattern (matches game_routes.ts)
 * - Call IntentReducer for all logic
 * - Return ok/state/events or rejection
 */

import type { Hono } from "npm:hono";
import { applyIntent, type IntentRequest } from '../engine/intent/IntentReducer.ts';
import { accrueClocks } from '../engine/clock/clock.ts';

export function registerIntentRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
  requireSession: (c: any) => Promise<any>,
  supabase: any
) {
  
  // ============================================================================
  // POST /intent - Commit/Reveal Protocol Endpoint
  // ============================================================================
  
  app.post("/make-server-825e19ab/intent", async (c) => {
    try {
      // ========================================================================
      // AUTH: Validate session (matches game_routes.ts pattern)
      // ========================================================================
      
      const session = await requireSession(c);
      if (session instanceof Response) return session;
      
      const sessionPlayerId = session.sessionId;
      
      console.log(`[Intent] Request from session: ${sessionPlayerId}`);
      
      // ========================================================================
      // PARSE REQUEST
      // ========================================================================
      
      const body = await c.req.json();
      
      if (!body.gameId || !body.intentType || body.turnNumber === undefined) {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'BAD_PAYLOAD',
            message: 'Missing required fields: gameId, intentType, turnNumber'
          }
        }, 400);
      }
      
      const intentRequest: IntentRequest = {
        gameId: body.gameId,
        intentType: body.intentType,
        turnNumber: body.turnNumber,
        commitHash: body.commitHash,
        payload: body.payload,
        nonce: body.nonce
      };
      
      console.log(`[Intent] Type: ${intentRequest.intentType}, Game: ${intentRequest.gameId}, Turn: ${intentRequest.turnNumber}`);
      
      // ========================================================================
      // LOAD / APPLY with lost-update protection (merge-safe)
      // ========================================================================
      
      const gameKey = `game_${intentRequest.gameId}`;
      const nowMs = Date.now();

      // 1) Load initial snapshot
      let baseState = await kvGet(gameKey);

      if (!baseState) {
        console.log(`[Intent] Game not found: ${gameKey}`);
        return c.json(
          {
            ok: false,
            state: null,
            events: [],
            rejected: { code: 'GAME_NOT_FOUND', message: `Game ${intentRequest.gameId} not found` },
          },
          404
        );
      }

      // 2) Apply against snapshot (no clock accrue here; clocks accrue on latestState only)
      let result = await applyIntent(baseState, sessionPlayerId, intentRequest, nowMs);

      if (!result.ok) {
        console.log(`[Intent] Rejected: ${result.rejected?.code} - ${result.rejected?.message}`);
        return c.json(
          {
            ok: result.ok,
            state: result.state,
            events: result.events,
            rejected: result.rejected,
          },
          400
        );
      }

      // 3) Reload latest to avoid overwriting concurrent writer
      let latestState = await kvGet(gameKey);
      if (!latestState) latestState = result.state;

      // Accrue clocks on latest using SAME nowMs (deterministic for this request)
      latestState = accrueClocks(latestState, nowMs);

      // 4) Re-apply intent on latest
      const retry = await applyIntent(latestState, sessionPlayerId, intentRequest, nowMs);

      if (retry.ok) {
        // Save the merged/latest-applied state
        await kvSet(gameKey, retry.state);
        console.log(`[Intent] Success (merged): ${intentRequest.intentType}, Events: ${retry.events.length}`);

        return c.json(
          {
            ok: true,
            state: retry.state,
            events: retry.events,
            rejected: null,
          },
          200
        );
      }

      // If the retry failed ONLY because our commit is already present, treat as success.
      // This is the expected outcome if another request already persisted our submission.
      if (retry.rejected?.code === 'DUPLICATE_COMMIT') {
        await kvSet(gameKey, latestState);
        console.log(`[Intent] Success (idempotent duplicate): ${intentRequest.intentType}`);

        return c.json(
          {
            ok: true,
            state: latestState,
            events: result.events, // keep original events from first apply (best-effort)
            rejected: null,
          },
          200
        );
      }

      // Any other failure: return the retry rejection (it reflects latest truth)
      console.log(`[Intent] Rejected on merge-retry: ${retry.rejected?.code} - ${retry.rejected?.message}`);
      return c.json(
        {
          ok: false,
          state: retry.state,
          events: [],
          rejected: retry.rejected,
        },
        400
      );
      
    } catch (error) {
      console.error("[Intent] Internal error:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({
        ok: false,
        state: null,
        events: [],
        rejected: {
          code: 'INTERNAL_ERROR',
          message
        }
      }, 500);
    }
  });
}