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
      // LOAD GAME STATE (using canonical KV key)
      // ========================================================================
      
      const gameKey = `game_${intentRequest.gameId}`;
      let gameState = await kvGet(gameKey);
      
      if (!gameState) {
        console.log(`[Intent] Game not found: ${gameKey}`);
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'GAME_NOT_FOUND',
            message: `Game ${intentRequest.gameId} not found`
          }
        }, 404);
      }
      
      // ========================================================================
      // CLOCK ACCRUAL (STEP E: Accrue before applying intent)
      // ========================================================================
      
      const nowMs = Date.now();
      gameState = accrueClocks(gameState, nowMs);
      
      // ========================================================================
      // APPLY INTENT (reducer handles all validation and logic)
      // ========================================================================
      
      const result = await applyIntent(gameState, sessionPlayerId, intentRequest, nowMs);
      
      // ========================================================================
      // SAVE STATE (if intent succeeded)
      // ========================================================================
      
      if (result.ok) {
        await kvSet(gameKey, result.state);
        console.log(`[Intent] Success: ${intentRequest.intentType}, Events: ${result.events.length}`);
      } else {
        console.log(`[Intent] Rejected: ${result.rejected?.code} - ${result.rejected?.message}`);
      }
      
      // ========================================================================
      // RETURN RESPONSE
      // ========================================================================
      
      return c.json({
        ok: result.ok,
        state: result.state,
        events: result.events,
        rejected: result.rejected
      }, result.ok ? 200 : 400);
      
    } catch (error) {
      console.error("[Intent] Internal error:", error);
      return c.json({
        ok: false,
        state: null,
        events: [],
        rejected: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Unknown error'
        }
      }, 500);
    }
  });
}