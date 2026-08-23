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
import { runBotsUntilSettled } from '../engine/bot/botRunner.ts';
import {
  appendBattleLogTurnSummaryIdempotently,
  buildBattleLogTurnSummaryFromScratch,
  clearBattleLogScratchAfterFinalization,
  createBattleLogScratchFromLegacyHistoryStore,
  foldBattleLogCaptureEventsIntoScratch,
  getBattleLogArchiveCheckpointFromState,
  getBattleLogScratchFromState,
  getBattleLogHistoryKey,
  normalizeBattleLogHistoryStore,
  normalizeBattleLogScratch,
  partitionBattleLogCaptureEventsByFinalizedTurn,
  selectBattleLogFinalizeTurnEvent,
  type BattleLogArchiveCheckpoint,
  type BattleLogHistoryStore,
} from '../engine/state/battleLogHistory.ts';
import { appendChatEntry, type ChatStore } from './chat_kv.ts';
import {
  ensureStateRevision,
  getPersistedHistoryRevisionToken,
  getPersistedStateRevisionToken,
  getStateRevisionBase,
  withStateRevisionFromBase,
} from './state_revision.ts';
import type { IntentPersistence } from './intent_persistence.ts';
import { debugLog } from '../utils/serverLogger.ts';
import {
  normalizeAncientGameState,
  sanitizeAncientStateForClient,
  type AncientCompatibilityRisk,
} from '../engine/state/ancientState.ts';
import {
  filterChargeDeclarationEventsForViewer,
} from '../engine/state/chargeDeclarationVisibility.ts';
import {
  filterDrawingPreludeEventsForViewer,
} from '../engine/state/drawingPreludeProjection.ts';
import { stripMissionChallengeAssignment } from '../engine/mission/MissionChallenge.ts';
import { projectCommitmentsForViewer } from '../engine/intent/CommitStore.ts';

function logAncientCompatibilityRisks(
  boundary: string,
  risks: AncientCompatibilityRisk[],
): void {
  if (risks.length === 0) return;
  const orderedRisks = [...new Map(
    risks.map((risk) => [
      `${risk.path}\u0000${risk.code}\u0000${risk.stableId ?? ''}`,
      risk,
    ]),
  ).values()].sort((a, b) =>
    a.path.localeCompare(b.path) ||
    a.code.localeCompare(b.code) ||
    (a.stableId ?? '').localeCompare(b.stableId ?? '')
  );
  console.warn('[AncientState] Canonical compatibility repair persisted', {
    boundary,
    risks: orderedRisks,
  });
}

const MAX_INTENT_CONFLICT_RETRIES = 2;
const MAX_HISTORY_CONFLICT_RETRIES = 2;

type ArchiveReconciliation =
  | { status: 'none' | 'archived' }
  | { status: 'unresolved'; reason: string }
  | { status: 'divergent' };

async function reconcileArchiveCheckpoint(args: {
  persistence: IntentPersistence;
  gameId: string;
  checkpoint: BattleLogArchiveCheckpoint | null;
}): Promise<ArchiveReconciliation> {
  if (!args.checkpoint) return { status: 'none' };
  const historyKey = getBattleLogHistoryKey(args.gameId);

  for (let attempt = 0; attempt <= MAX_HISTORY_CONFLICT_RETRIES; attempt += 1) {
    const loaded = await args.persistence.load(historyKey);
    if (loaded.status === 'error') {
      return { status: 'unresolved', reason: loaded.error.message };
    }

    const rawHistory = loaded.status === 'found' ? loaded.value : null;
    const historyStore = normalizeBattleLogHistoryStore(args.gameId, rawHistory);
    const appendResult = appendBattleLogTurnSummaryIdempotently(
      historyStore,
      args.checkpoint.summary,
    );

    if (appendResult.status === 'divergent') {
      return { status: 'divergent' };
    }
    if (appendResult.status === 'already_present') {
      return { status: 'archived' };
    }

    const writeResult = loaded.status === 'missing'
      ? await args.persistence.insertIfMissing(historyKey, appendResult.historyStore)
      : await (() => {
          const token = getPersistedHistoryRevisionToken(rawHistory);
          if (token.kind === 'invalid') {
            return Promise.resolve({
              status: 'error' as const,
              error: { message: 'INVALID_PERSISTED_HISTORY_REVISION' },
            });
          }
          return args.persistence.conditionalUpdate({
            key: historyKey,
            value: appendResult.historyStore,
            revisionField: 'revision',
            expected: token,
          });
        })();

    if (writeResult.status === 'updated') return { status: 'archived' };
    if (writeResult.status === 'error') {
      return { status: 'unresolved', reason: writeResult.error.message };
    }
  }

  return {
    status: 'unresolved',
    reason: 'History conditional-write retry budget exhausted',
  };
}

function summarizeBattleLogHistoryStore(historyStore: any) {
  return {
    revision: historyStore?.revision ?? null,
    completedTurnCount: historyStore?.completedTurnCount ?? null,
    legacyCurrentTurnCaptureTurnNumber:
      historyStore?.currentTurnCapture?.turnNumber ?? null,
  };
}

function sanitizeStateForResponse(
  state: any,
  requestingParticipantId?: string,
) {
  if (!state || typeof state !== 'object') {
    return state;
  }

  const ancientSafeState = sanitizeAncientStateForClient(
    state,
    requestingParticipantId,
  );
  const commitments = ancientSafeState?.gameData?.turnData?.commitments;
  const commitmentSafeState = commitments
    ? {
      ...ancientSafeState,
      gameData: {
        ...ancientSafeState.gameData,
        turnData: {
          ...ancientSafeState.gameData.turnData,
          commitments: projectCommitmentsForViewer(
            commitments,
            requestingParticipantId,
          ),
        },
      },
    }
    : ancientSafeState;
  const { battleLogScratch: _omitBattleLogScratch, ...responseState } = commitmentSafeState;
  return stripMissionChallengeAssignment(responseState);
}

function sanitizeEventsForResponse(
  state: any,
  events: readonly any[],
  requestingParticipantId?: string,
): any[] {
  return filterChargeDeclarationEventsForViewer(
    state,
    requestingParticipantId,
    filterDrawingPreludeEventsForViewer(
      state,
      requestingParticipantId,
      events,
    ),
  );
}

async function prepareBattleLogPersistenceFromEvents(args: {
  gameId: string,
  nextState: any,
  events: any[],
  historyStore: BattleLogHistoryStore | null,
}) {
  const {
    nextState,
    events,
    historyStore,
  } = args;
  let usedLegacyHistorySeed = false;
  let scratch = getBattleLogScratchFromState(nextState);

  if (typeof nextState?.battleLogScratch === 'undefined') {
    if (!historyStore) {
      throw new Error('LEGACY_BATTLE_LOG_HISTORY_NOT_LOADED');
    }
    const legacyScratch = createBattleLogScratchFromLegacyHistoryStore(
      historyStore,
    );
    if (legacyScratch) {
      scratch = legacyScratch;
      usedLegacyHistorySeed = true;
    }
  }

  const scratchBeforeProcessing = normalizeBattleLogScratch(scratch);
  const finalizeSelection = selectBattleLogFinalizeTurnEvent(events);
  const finalizedTurnNumber = finalizeSelection.event?.finalizedTurnNumber ?? null;

  if (finalizeSelection.distinctTurnNumbers.length > 1) {
    console.error('[BattleLog][IntentRoute] Multiple explicit finalize turn numbers found in one request', {
      distinctTurnNumbers: finalizeSelection.distinctTurnNumbers,
      selectedFinalizedTurnNumber: finalizedTurnNumber,
      selectedEvent: finalizeSelection.event ?? null,
    });
  }

  if (finalizedTurnNumber === null) {
    const scratchAfterProcessing = foldBattleLogCaptureEventsIntoScratch(
      scratch,
      events,
    );
    nextState.battleLogScratch = scratchAfterProcessing;
    return {
      nextState,
      finalizedSummary: null,
      finalizedTurnNumber: null,
      archiveAppended: false,
      usedLegacyHistorySeed,
      scratchBeforeProcessing,
      scratchAfterProcessing,
      finalizeEventCount: finalizeSelection.candidates.length,
      finalizeEventDistinctTurnNumbers: finalizeSelection.distinctTurnNumbers,
      selectedFinalizeEvent: null,
      ignoredEarlierCaptureEventCount: 0,
      historyBeforeProcessing: historyStore
        ? summarizeBattleLogHistoryStore(historyStore)
        : null,
      historyAfterProcessing: null,
    };
  }

  const {
    finalizedTurnEvents,
    laterTurnEvents,
    earlierTurnEvents,
  } = partitionBattleLogCaptureEventsByFinalizedTurn(events, finalizedTurnNumber);
  if (earlierTurnEvents.length > 0) {
    console.warn('[BattleLog][IntentRoute] Ignoring stale earlier-turn capture events during explicit finalization', {
      finalizedTurnNumber,
      ignoredEarlierCaptureEventCount: earlierTurnEvents.length,
    });
  }

  const scratchSeedForFinalizedTurn =
    scratchBeforeProcessing.currentTurnCapture?.turnNumber === finalizedTurnNumber
      ? scratchBeforeProcessing
      : {
          currentTurnCapture: null,
          lastFinalizedTurnNumber:
            scratchBeforeProcessing.lastFinalizedTurnNumber ?? null,
          archiveCheckpoint: scratchBeforeProcessing.archiveCheckpoint ?? null,
        };
  const scratchForFinalizedTurn = foldBattleLogCaptureEventsIntoScratch(
    scratchSeedForFinalizedTurn,
    finalizedTurnEvents,
  );

  const historyBeforeProcessing = historyStore
    ? summarizeBattleLogHistoryStore(historyStore)
    : null;

  const finalizedSummary = buildBattleLogTurnSummaryFromScratch({
    scratch: scratchForFinalizedTurn,
    finalizedTurnNumber,
    finalizedState: nextState,
  });
  const currentScratchTurnNumber =
    scratchBeforeProcessing.currentTurnCapture?.turnNumber ?? null;
  let scratchAfterProcessing =
    currentScratchTurnNumber !== null &&
      currentScratchTurnNumber > finalizedTurnNumber
      ? {
          currentTurnCapture: scratchBeforeProcessing.currentTurnCapture,
          lastFinalizedTurnNumber:
            Math.max(
              scratchBeforeProcessing.lastFinalizedTurnNumber ?? finalizedTurnNumber,
              finalizedTurnNumber,
            ),
          archiveCheckpoint: scratchBeforeProcessing.archiveCheckpoint ?? null,
        }
      : clearBattleLogScratchAfterFinalization(
          scratchForFinalizedTurn,
          finalizedTurnNumber,
        );

  if (laterTurnEvents.length > 0) {
    scratchAfterProcessing = foldBattleLogCaptureEventsIntoScratch(
      scratchAfterProcessing,
      laterTurnEvents,
    );
  }
  nextState.battleLogScratch = scratchAfterProcessing;

  return {
    nextState,
    finalizedSummary,
    finalizedTurnNumber,
    usedLegacyHistorySeed,
    scratchBeforeProcessing,
    scratchAfterProcessing,
    finalizeEventCount: finalizeSelection.candidates.length,
    finalizeEventDistinctTurnNumbers: finalizeSelection.distinctTurnNumbers,
    selectedFinalizeEvent: finalizeSelection.event,
    ignoredEarlierCaptureEventCount: earlierTurnEvents.length,
    historyBeforeProcessing,
    historyAfterProcessing: null,
  };
}

async function appendSuccessfulChatEvents(args: {
  gameId: string;
  events: readonly any[];
  kvGet: (key: string) => Promise<any>;
  kvSet: (key: string, value: any) => Promise<void>;
}): Promise<void> {
  for (const event of args.events) {
    if (event?.type !== 'CHAT_MESSAGE') continue;
    const chatEntryType = event.chatEntryType === 'system' ? 'system' : 'message';
    try {
      await appendChatEntry(
        args.gameId,
        chatEntryType === 'system'
          ? {
              type: 'system',
              content: event.content,
              timestamp: event.timestamp,
            }
          : {
              type: 'message',
              playerId: event.playerId,
              playerName: event.playerName ?? 'Unknown',
              content: event.content,
              timestamp: event.timestamp,
            },
        args.kvGet,
        args.kvSet,
      );
    } catch (error) {
      console.warn(`[Chat] Failed to append message for game ${args.gameId}:`, error);
    }
  }
}

function responseBody(args: {
  ok: boolean;
  state: any;
  events?: readonly any[];
  playerId: string;
  rejected?: { code: string; message: string } | null;
}) {
  return {
    ok: args.ok,
    state: sanitizeStateForResponse(args.state, args.playerId),
    events: sanitizeEventsForResponse(
      args.state,
      args.events ?? [],
      args.playerId,
    ),
    rejected: args.rejected ?? null,
  };
}

function setArchiveCheckpoint(
  state: any,
  checkpoint: BattleLogArchiveCheckpoint | null,
): any {
  state.battleLogScratch = {
    ...getBattleLogScratchFromState(state),
    archiveCheckpoint: checkpoint ? structuredClone(checkpoint) : null,
  };
  return state;
}

async function handleIntentRequest(args: {
  c: any;
  kvGet: (key: string) => Promise<any>;
  kvSet: (key: string, value: any) => Promise<void>;
  requireSession: (c: any) => Promise<any>;
  persistence: IntentPersistence;
}) {
  const { c, kvGet, kvSet, requireSession, persistence } = args;
  let committedFallbackResponse: ReturnType<typeof responseBody> | null = null;
  try {
    const session = await requireSession(c);
    if (session instanceof Response) return session;
    const sessionPlayerId = session.sessionId;
    const body = await c.req.json();
    if (!body.gameId || !body.intentType || body.turnNumber === undefined) {
      return c.json({
        ok: false,
        state: null,
        events: [],
        rejected: {
          code: 'BAD_PAYLOAD',
          message: 'Missing required fields: gameId, intentType, turnNumber',
        },
      }, 400);
    }

    const intentRequest: IntentRequest = {
      gameId: body.gameId,
      intentType: body.intentType,
      turnNumber: body.turnNumber,
      commitHash: body.commitHash,
      payload: body.payload,
      nonce: body.nonce,
    };
    const gameKey = `game_${intentRequest.gameId}`;
    const nowMs = Date.now();

    for (let attempt = 0; attempt <= MAX_INTENT_CONFLICT_RETRIES; attempt += 1) {
      const loaded = await persistence.load(gameKey);
      if (loaded.status === 'error') {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: { code: 'PERSISTENCE_ERROR', message: loaded.error.message },
        }, 500);
      }
      if (loaded.status === 'missing') {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'GAME_NOT_FOUND',
            message: `Game ${intentRequest.gameId} not found`,
          },
        }, 404);
      }

      const rawState = structuredClone(loaded.value);
      const revisionToken = getPersistedStateRevisionToken(rawState);
      if (revisionToken.kind === 'invalid') {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'INVALID_PERSISTED_STATE_REVISION',
            message: 'Stored game stateRevision is invalid',
          },
        }, 500);
      }
      const persistedBaseRevision = getStateRevisionBase(revisionToken);
      const loadedCheckpoint = getBattleLogArchiveCheckpointFromState(rawState);
      const loadedCheckpointSerialized = loadedCheckpoint
        ? JSON.stringify(loadedCheckpoint)
        : null;
      const archiveResolution = await reconcileArchiveCheckpoint({
        persistence,
        gameId: intentRequest.gameId,
        checkpoint: loadedCheckpoint,
      });
      if (archiveResolution.status === 'divergent' && loadedCheckpoint) {
        console.error('[BattleLog] Archive checkpoint diverges from stored history', {
          gameId: intentRequest.gameId,
          finalizedTurnNumber: loadedCheckpoint.finalizedTurnNumber,
          acceptedStateRevision: loadedCheckpoint.acceptedStateRevision,
        });
      }

      const ensuredState = ensureStateRevision(structuredClone(rawState));
      const ingressNormalization = normalizeAncientGameState(ensuredState);
      let latestState = ingressNormalization.state;
      const ancientCompatibilityRisks = [
        ...ingressNormalization.compatibilityRisks,
      ];
      const compatibilityRepairRequired =
        JSON.stringify(rawState) !== JSON.stringify(latestState);
      if (loadedCheckpoint && archiveResolution.status === 'archived') {
        latestState = setArchiveCheckpoint(latestState, null);
      } else if (loadedCheckpoint) {
        latestState = setArchiveCheckpoint(latestState, loadedCheckpoint);
      }

      const previousStatus = latestState?.status;
      latestState = accrueClocks(latestState, nowMs);
      const applied = await applyIntent(
        latestState,
        sessionPlayerId,
        intentRequest,
        nowMs,
      );

      if (!applied.ok) {
        if (applied.rejected?.code !== 'DUPLICATE_COMMIT') {
          return c.json(responseBody({
            ok: false,
            state: applied.state,
            events: [],
            playerId: sessionPlayerId,
            rejected: applied.rejected,
          }), 400);
        }

        if (!compatibilityRepairRequired) {
          return c.json(responseBody({
            ok: true,
            state: applied.state,
            events: [],
            playerId: sessionPlayerId,
          }), 200);
        }

        const repairedState = withStateRevisionFromBase(
          applied.state,
          persistedBaseRevision,
        );
        const repairWrite = await persistence.conditionalUpdate({
          key: gameKey,
          value: repairedState,
          revisionField: 'stateRevision',
          expected: revisionToken,
        });
        if (repairWrite.status === 'conflict') continue;
        if (repairWrite.status === 'error') {
          return c.json({
            ok: false,
            state: null,
            events: [],
            rejected: {
              code: 'PERSISTENCE_ERROR',
              message: repairWrite.error.message,
            },
          }, 500);
        }
        logAncientCompatibilityRisks(
          'intent-duplicate-compatibility-repair',
          ancientCompatibilityRisks,
        );
        return c.json(responseBody({
          ok: true,
          state: repairedState,
          events: [],
          playerId: sessionPlayerId,
        }), 200);
      }

      const botRun = await runBotsUntilSettled({ state: applied.state, nowMs });
      const finalNormalization = normalizeAncientGameState(botRun.state);
      ancientCompatibilityRisks.push(...finalNormalization.compatibilityRisks);
      let candidateState = finalNormalization.state;
      const successfulEvents = [...applied.events, ...botRun.events];
      const terminalOccurred =
        previousStatus !== 'finished' && candidateState?.status === 'finished';
      if (
        terminalOccurred &&
        !successfulEvents.some((event) => event?.type === 'GAME_OVER')
      ) {
        successfulEvents.push({
          type: 'GAME_OVER',
          result: candidateState?.result ?? 'draw',
          resultReason: candidateState?.resultReason,
          winnerPlayerId: candidateState?.winnerPlayerId ?? null,
          atMs: nowMs,
        });
      }

      let historyStore: BattleLogHistoryStore | null = null;
      if (typeof candidateState?.battleLogScratch === 'undefined') {
        const historyLoad = await persistence.load(
          getBattleLogHistoryKey(intentRequest.gameId),
        );
        if (historyLoad.status === 'error') {
          return c.json({
            ok: false,
            state: sanitizeStateForResponse(rawState, sessionPlayerId),
            events: [],
            rejected: {
              code: 'PERSISTENCE_ERROR',
              message: historyLoad.error.message,
            },
          }, 500);
        }
        historyStore = normalizeBattleLogHistoryStore(
          intentRequest.gameId,
          historyLoad.status === 'found' ? historyLoad.value : null,
        );
      }
      const battleLogResult = await prepareBattleLogPersistenceFromEvents({
        gameId: intentRequest.gameId,
        nextState: candidateState,
        events: successfulEvents,
        historyStore,
      });
      candidateState = battleLogResult.nextState;
      const finalizedSummary = battleLogResult.finalizedSummary;

      if (
        finalizedSummary &&
        loadedCheckpoint &&
        archiveResolution.status !== 'archived'
      ) {
        const divergent = archiveResolution.status === 'divergent';
        console.error('[BattleLog] New finalization blocked by earlier checkpoint', {
          gameId: intentRequest.gameId,
          earlierFinalizedTurnNumber: loadedCheckpoint.finalizedTurnNumber,
          status: archiveResolution.status,
        });
        return c.json({
          ok: false,
          state: sanitizeStateForResponse(rawState, sessionPlayerId),
          events: [],
          rejected: {
            code: divergent
              ? 'HISTORY_ARCHIVE_DIVERGENCE'
              : 'HISTORY_ARCHIVE_FINALIZATION_BLOCKED',
            message: divergent
              ? 'Stored Battle Log content diverges from the pending archive checkpoint'
              : 'The previous completed turn could not yet be archived',
          },
        }, divergent ? 500 : 503);
      }

      const acceptedStateRevision = persistedBaseRevision + 1;
      let newCheckpoint: BattleLogArchiveCheckpoint | null = null;
      if (finalizedSummary) {
        newCheckpoint = {
          finalizedTurnNumber: battleLogResult.finalizedTurnNumber,
          acceptedStateRevision,
          summary: finalizedSummary,
        };
        candidateState = setArchiveCheckpoint(candidateState, newCheckpoint);
      } else if (
        loadedCheckpoint &&
        (archiveResolution.status === 'unresolved' ||
          archiveResolution.status === 'divergent')
      ) {
        candidateState = setArchiveCheckpoint(candidateState, loadedCheckpoint);
        const candidateCheckpointSerialized = JSON.stringify(
          getBattleLogArchiveCheckpointFromState(candidateState),
        );
        if (candidateCheckpointSerialized !== loadedCheckpointSerialized) {
          return c.json({
            ok: false,
            state: sanitizeStateForResponse(rawState, sessionPlayerId),
            events: [],
            rejected: {
              code: 'PERSISTENCE_INVARIANT_ERROR',
              message: 'Archive checkpoint changed during a non-finalizing mutation',
            },
          }, 500);
        }
      }

      candidateState = withStateRevisionFromBase(
        candidateState,
        persistedBaseRevision,
      );
      const committedResponse = responseBody({
        ok: true,
        state: candidateState,
        events: successfulEvents,
        playerId: sessionPlayerId,
      });
      const gameWrite = await persistence.conditionalUpdate({
        key: gameKey,
        value: candidateState,
        revisionField: 'stateRevision',
        expected: revisionToken,
      });
      if (gameWrite.status === 'conflict') continue;
      if (gameWrite.status === 'error') {
        return c.json({
          ok: false,
          state: null,
          events: [],
          rejected: {
            code: 'PERSISTENCE_ERROR',
            message: gameWrite.error.message,
          },
        }, 500);
      }
      committedFallbackResponse = committedResponse;

      // The game mutation is committed. Every operation below is isolated so it
      // can never convert this accepted request into an HTTP failure.
      try {
        await appendSuccessfulChatEvents({
          gameId: intentRequest.gameId,
          events: successfulEvents,
          kvGet,
          kvSet,
        });
      } catch (error) {
        console.warn('[Intent] Post-commit chat processing failed', error);
      }
      try {
        if (newCheckpoint) {
          const historyResult = await reconcileArchiveCheckpoint({
            persistence,
            gameId: intentRequest.gameId,
            checkpoint: newCheckpoint,
          });
          if (historyResult.status === 'unresolved') {
            console.error('[BattleLog] Archive checkpoint remains unresolved', {
              gameId: intentRequest.gameId,
              finalizedTurnNumber: newCheckpoint.finalizedTurnNumber,
              reason: historyResult.reason,
            });
          } else if (historyResult.status === 'divergent') {
            console.error('[BattleLog] Archive checkpoint diverges from history', {
              gameId: intentRequest.gameId,
              finalizedTurnNumber: newCheckpoint.finalizedTurnNumber,
            });
          }
        }
      } catch (error) {
        console.error('[BattleLog] Post-commit archive attempt failed', error);
      }
      try {
        logAncientCompatibilityRisks('intent-success', ancientCompatibilityRisks);
      } catch (error) {
        console.warn('[Intent] Post-commit compatibility logging failed', error);
      }

      return c.json(committedResponse, 200);
    }

    const latest = await persistence.load(gameKey);
    if (latest.status === 'error') {
      return c.json({
        ok: false,
        state: null,
        events: [],
        rejected: {
          code: 'PERSISTENCE_ERROR',
          message: latest.error.message,
        },
      }, 500);
    }
    const latestState = latest.status === 'found' ? latest.value : null;
    return c.json({
      ok: false,
      state: sanitizeStateForResponse(latestState, sessionPlayerId),
      events: [],
      rejected: {
        code: 'PERSISTENCE_CONFLICT_RETRY_EXHAUSTED',
        message: 'The game changed during all persistence attempts',
      },
    }, 409);
  } catch (error) {
    if (committedFallbackResponse) {
      console.error('[Intent] Post-commit operation failed; preserving accepted response:', error);
      return c.json(committedFallbackResponse, 200);
    }
    console.error('[Intent] Internal error before authoritative commit:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      ok: false,
      state: null,
      events: [],
      rejected: { code: 'INTERNAL_ERROR', message },
    }, 500);
  }
}

export function registerIntentRoutes(
  app: Hono,
  kvGet: (key: string) => Promise<any>,
  kvSet: (key: string, value: any) => Promise<void>,
  requireSession: (c: any) => Promise<any>,
  persistence: IntentPersistence,
) {
  app.post("/make-server-825e19ab/intent", (c) =>
    handleIntentRequest({
      c,
      kvGet,
      kvSet,
      requireSession,
      persistence,
    })
  );

  
  // ============================================================================
  // GET /chat-state/:gameId - Fetch Chat Messages
  // ============================================================================
  
  app.get("/make-server-825e19ab/chat-state/:gameId", async (c) => {
    try {
      // Validate session
      const session = await requireSession(c);
      if (session instanceof Response) return session;
      
      const gameId = c.req.param('gameId');
      
      if (!gameId) {
        return c.json({ ok: false, entries: [], error: 'Missing gameId' }, 400);
      }
      
      debugLog(`[Chat] Fetch request for game: ${gameId}`);
      
      const chatKey = `game_${gameId}_chat`;
      let chatStore: ChatStore = await kvGet(chatKey);
      
      // Default to empty if missing or malformed
      if (!chatStore || !Array.isArray(chatStore.entries)) {
        chatStore = { entries: [] };
      }
      
      return c.json({
        ok: true,
        entries: chatStore.entries
      }, 200);
      
    } catch (error) {
      console.error("[Chat] Error fetching chat:", error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return c.json({
        ok: false,
        entries: [],
        error: message
      }, 500);
    }
  });
}
