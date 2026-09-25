import type { Hono } from "npm:hono";
import { accrueClocks } from "../engine/clock/clock.ts";
import { peekCommitRecord } from "../engine/intent/CommitStore.ts";
import { getBuildCommitKey } from "../engine/intent/IntentTypes.ts";
import type { BuildSubmitPayload } from "../engine/intent/IntentTypes.ts";
import { validateBuildSubmitPayload } from "../engine/intent/buildSubmitValidation.ts";
import { syncPhaseFields } from "../engine/phase/syncPhaseFields.ts";
import { normalizeAncientGameState } from "../engine/state/ancientState.ts";
import {
  projectBattleLogCurrentTurnPublic,
  projectBattleLogCurrentTurnRequester,
} from "../engine/state/battleLogHistory.ts";
import {
  type CurrentTurnEstimateAvailableResult,
  type CurrentTurnEstimateIdentity,
  type CurrentTurnEstimateResult,
  estimateCurrentTurnForPlayer,
  getCurrentTurnDraftKey,
} from "../engine/state/currentTurnEstimator.ts";
import { getCurrentDrawingPreludePlayerState } from "../engine/state/drawingPreludeState.ts";
import type { IntentPersistence } from "./intent_persistence.ts";

const MAX_PREVIEW_BODY_BYTES = 16 * 1024;
const MAX_PREVIEW_BUILD_ENTRIES = 64;
const MAX_PREVIEW_ATTEMPTS = 200;
const MAX_PREVIEW_SELECTION_ENTRIES = 200;
const MAX_PREVIEW_REQUEST_TOKEN_LENGTH = 128;

type PreviewPersistence = Pick<IntentPersistence, "load">;

export type CurrentTurnRouteTiming = {
  route: "preview" | "full_get";
  authMs?: number;
  loadMs?: number;
  estimatorMs: number;
  estimateCount: number;
  totalMs?: number;
};

export type CurrentTurnRouteTimingObserver = (
  timing: CurrentTurnRouteTiming,
) => void;

type PreviewRequest = {
  observed: {
    turnNumber: number;
    phaseKey: "build.drawing";
    sourceContextKey?: string;
  };
  draft: BuildSubmitPayload;
  requestToken?: string;
};

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, any>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function getPhaseKey(state: any): string {
  const major = state?.gameData?.currentPhase ??
    state?.gameData?.turnData?.currentMajorPhase ?? state?.currentPhase;
  const sub = state?.gameData?.currentSubPhase ??
    state?.gameData?.turnData?.currentSubPhase ?? state?.currentSubPhase;
  return typeof major === "string" && typeof sub === "string"
    ? `${major}.${sub}`
    : "";
}

function getTurnNumber(state: any): number {
  const value = state?.gameData?.turnNumber ??
    state?.gameData?.turnData?.turnNumber ?? state?.turnNumber;
  return Number.isInteger(value) ? value : 0;
}

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (isObject(value)) {
    const entries = Object.keys(value)
      .filter((key) => typeof value[key] !== "undefined")
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",");
    return `{${entries}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hashStableValue(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function toEstimateIdentityDto(identity: CurrentTurnEstimateIdentity) {
  return {
    gameId: identity.gameId,
    turnNumber: identity.turnNumber,
    phaseKey: identity.sourcePhase,
    sourceContextKey: identity.sourceContextKey,
    draftKey: identity.draftKey,
  };
}

function toBuildDto(result: CurrentTurnEstimateAvailableResult) {
  return {
    lines: [...result.build.lines],
    skipped: result.build.skipped.map((fact) => ({ ...fact })),
    remainingOrdinaryLines: result.build.remainingOrdinaryLines,
    remainingJoiningLines: result.build.remainingJoiningLines,
  };
}

function toEstimateDto(
  result: CurrentTurnEstimateResult,
  includeBuild: boolean,
) {
  if (result.status === "unavailable") {
    return {
      status: result.status,
      reason: result.reason,
      identity: {
        sourceContextKey: result.identity.sourceContextKey,
        draftKey: result.identity.draftKey,
      },
    };
  }
  return {
    status: result.status,
    identity: {
      sourceContextKey: result.identity.sourceContextKey,
      draftKey: result.identity.draftKey,
    },
    damage: {
      total: result.damage,
      rows: structuredClone(result.damageRows),
    },
    healing: {
      total: result.healing,
      rows: structuredClone(result.healingRows),
    },
    ...(includeBuild ? { build: toBuildDto(result) } : {}),
  };
}

function validatePreviewEnvelope(value: unknown):
  | { ok: true; value: PreviewRequest }
  | { ok: false; reason: string } {
  if (!isObject(value) || !isObject(value.observed) || !isObject(value.draft)) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    !hasOnlyKeys(value, ["observed", "draft", "requestToken"]) ||
    !hasOnlyKeys(value.observed, [
      "turnNumber",
      "phaseKey",
      "sourceContextKey",
    ]) ||
    !hasOnlyKeys(value.draft, [
      "builds",
      "frigateTriggers",
      "quantumMysticSelections",
      "evolverChoices",
    ])
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    !Number.isInteger(value.observed.turnNumber) ||
    value.observed.phaseKey !== "build.drawing" ||
    (value.observed.sourceContextKey !== undefined &&
      typeof value.observed.sourceContextKey !== "string")
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    value.requestToken !== undefined &&
    (typeof value.requestToken !== "string" ||
      value.requestToken.length > MAX_PREVIEW_REQUEST_TOKEN_LENGTH)
  ) {
    return { ok: false, reason: "preview_bounds_exceeded" };
  }
  const draft = value.draft as any;
  if (!Array.isArray(draft.builds)) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    draft.builds.some((build: unknown) =>
      !isObject(build) || !hasOnlyKeys(build, ["shipDefId", "count"])
    ) ||
    (Array.isArray(draft.evolverChoices) &&
      draft.evolverChoices.some((choice: unknown) =>
        !isObject(choice) || !hasOnlyKeys(choice, ["sourceKey", "choiceId"])
      ))
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  const arrays = [
    draft.frigateTriggers,
    draft.quantumMysticSelections,
    draft.evolverChoices,
  ].filter((entry) => entry !== undefined);
  if (
    draft.builds.length > MAX_PREVIEW_BUILD_ENTRIES ||
    arrays.some((entry) =>
      !Array.isArray(entry) || entry.length > MAX_PREVIEW_SELECTION_ENTRIES
    )
  ) {
    return { ok: false, reason: "preview_bounds_exceeded" };
  }
  const attempts = draft.builds.reduce(
    (total: number, build: any) =>
      total +
      (Number.isInteger(build?.count) && build.count > 0 ? build.count : 0),
    0,
  );
  if (attempts > MAX_PREVIEW_ATTEMPTS) {
    return { ok: false, reason: "preview_bounds_exceeded" };
  }
  return { ok: true, value: value as PreviewRequest };
}

function unavailable(
  c: any,
  status: number,
  reason: string,
  requestToken?: string,
) {
  return c.json({
    status: "unavailable",
    reason,
    ...(requestToken !== undefined ? { requestToken } : {}),
  }, status);
}

export function registerCurrentTurnProjectionRoutes(args: {
  app: Hono;
  requireSession: (c: any) => Promise<any>;
  persistence: PreviewPersistence;
  timingObserver?: CurrentTurnRouteTimingObserver;
}) {
  args.app.post("/make-server-825e19ab/build-preview/:gameId", async (c) => {
    const totalStartedAt = performance.now();
    try {
      const authStartedAt = performance.now();
      const session = await args.requireSession(c);
      const authMs = performance.now() - authStartedAt;
      if (session instanceof Response) return session;

      const rawBody = await c.req.text();
      if (
        new TextEncoder().encode(rawBody).byteLength > MAX_PREVIEW_BODY_BYTES
      ) {
        return unavailable(c, 400, "preview_bounds_exceeded");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return unavailable(c, 400, "invalid_payload");
      }
      const envelope = validatePreviewEnvelope(parsed);
      if (!envelope.ok) return unavailable(c, 400, envelope.reason);
      const { observed, draft, requestToken } = envelope.value;

      const gameId = c.req.param("gameId");
      const loadStartedAt = performance.now();
      const loaded = await args.persistence.load(`game_${gameId}`);
      const loadMs = performance.now() - loadStartedAt;
      if (loaded.status === "error") {
        console.error("Build-preview persistence error:", loaded.error);
        return unavailable(c, 500, "persistence_error", requestToken);
      }
      if (loaded.status === "missing") {
        return unavailable(c, 404, "game_not_found", requestToken);
      }

      const nowMs = Date.now();
      let state = syncPhaseFields(structuredClone(loaded.value));
      state = accrueClocks(state, nowMs);
      state = normalizeAncientGameState(state).state;
      const participant = state?.players?.find((candidate: any) =>
        candidate?.id === session.sessionId
      );
      if (!participant || participant.role !== "player") {
        return unavailable(c, 403, "player_role_required", requestToken);
      }
      if (state.status !== "active") {
        return unavailable(c, 409, "game_unavailable", requestToken);
      }

      const phaseKey = getPhaseKey(state);
      const turnNumber = getTurnNumber(state);
      if (
        observed.turnNumber !== turnNumber || observed.phaseKey !== phaseKey
      ) {
        const identity = {
          gameId,
          turnNumber,
          phaseKey,
          sourceContextKey: hashStableValue({ gameId, turnNumber, phaseKey }),
          draftKey: getCurrentTurnDraftKey(draft),
        };
        return c.json({
          status: "obsolete",
          reason: "turn_or_phase_changed",
          ...(requestToken !== undefined ? { requestToken } : {}),
          identity,
          retry: {
            allowed: false,
            turnNumber,
            phaseKey,
            sourceContextKey: identity.sourceContextKey,
          },
        }, 409);
      }

      const prelude = getCurrentDrawingPreludePlayerState(
        state,
        session.sessionId,
      );
      if (!prelude || prelude.status !== "complete") {
        return unavailable(c, 409, "drawing_prelude_incomplete", requestToken);
      }
      const commitRecord = peekCommitRecord(
        state,
        getBuildCommitKey(turnNumber),
        session.sessionId,
      );
      if (commitRecord?.revealPayload !== undefined) {
        return unavailable(c, 409, "already_submitted", requestToken);
      }

      const validation = validateBuildSubmitPayload({
        state,
        playerId: session.sessionId,
        payload: draft,
      });
      if (!validation.ok) {
        return c.json({
          status: "unavailable",
          reason: "invalid_payload",
          message: validation.message,
          ...(requestToken !== undefined ? { requestToken } : {}),
        }, 400);
      }

      const estimatorStartedAt = performance.now();
      const result = estimateCurrentTurnForPlayer({
        state,
        requestingParticipantId: session.sessionId,
        playerId: session.sessionId,
        draft: validation.payload,
        expectedSourceContextKey: observed.sourceContextKey,
      });
      const estimatorMs = performance.now() - estimatorStartedAt;
      args.timingObserver?.({
        route: "preview",
        authMs,
        loadMs,
        estimatorMs,
        estimateCount: 1,
        totalMs: performance.now() - totalStartedAt,
      });

      if (
        result.status === "unavailable" &&
        result.reason === "source_context_changed"
      ) {
        const identity = toEstimateIdentityDto(result.identity);
        return c.json({
          status: "obsolete",
          reason: "source_context_changed",
          ...(requestToken !== undefined ? { requestToken } : {}),
          identity,
          retry: {
            allowed: true,
            turnNumber: identity.turnNumber,
            phaseKey: identity.phaseKey,
            sourceContextKey: identity.sourceContextKey,
          },
        }, 409);
      }
      if (result.status === "unavailable") {
        return c.json({
          status: "unavailable",
          reason: result.reason,
          ...(requestToken !== undefined ? { requestToken } : {}),
          identity: toEstimateIdentityDto(result.identity),
        }, 409);
      }
      return c.json({
        status: "estimated",
        ...(requestToken !== undefined ? { requestToken } : {}),
        identity: toEstimateIdentityDto(result.identity),
        playerId: session.sessionId,
        damage: {
          total: result.damage,
          rows: structuredClone(result.damageRows),
        },
        healing: {
          total: result.healing,
          rows: structuredClone(result.healingRows),
        },
        build: toBuildDto(result),
      });
    } catch (error) {
      console.error("Build preview error:", error);
      return unavailable(c, 500, "internal_error");
    }
  });
}

export function projectCurrentTurnFieldsForFullState(args: {
  state: any;
  requestingParticipantId: string;
  timingObserver?: CurrentTurnRouteTimingObserver;
}) {
  const startedAt = performance.now();
  const state = args.state;
  const phaseKey = getPhaseKey(state);
  const turnNumber = getTurnNumber(state);
  const publicBattleLog = projectBattleLogCurrentTurnPublic(state);
  if (!publicBattleLog) {
    args.timingObserver?.({
      route: "full_get",
      estimatorMs: 0,
      estimateCount: 0,
    });
    return { publicThisTurn: null, requesterThisTurn: null };
  }

  const activePlayers = (state.players ?? []).filter((player: any) =>
    player?.role === "player" && typeof player?.id === "string"
  );
  const requester = activePlayers.find((player: any) =>
    player.id === args.requestingParticipantId
  );
  const estimatorStartedAt = performance.now();
  let estimateCount = 0;
  let estimatesByPlayerId: Record<string, any> | null = null;
  if (
    phaseKey === "battle.reveal" || phaseKey === "battle.first_strike" ||
    phaseKey === "battle.charge_declaration"
  ) {
    estimatesByPlayerId = {};
    for (const player of activePlayers) {
      const estimate = estimateCurrentTurnForPlayer({
        state,
        playerId: player.id,
        draft: null,
      });
      estimateCount++;
      estimatesByPlayerId[player.id] = toEstimateDto(estimate, false);
    }
  }

  let requesterThisTurn: any = null;
  if (phaseKey === "build.drawing" && requester) {
    const captured = projectBattleLogCurrentTurnRequester(
      state,
      requester.id,
    );
    let committedProjection: any = null;
    const stored = peekCommitRecord(
      state,
      getBuildCommitKey(turnNumber),
      requester.id,
    )?.revealPayload;
    if (stored !== undefined) {
      const validation = validateBuildSubmitPayload({
        state,
        playerId: requester.id,
        payload: stored,
      });
      if (validation.ok) {
        const estimate = estimateCurrentTurnForPlayer({
          state,
          requestingParticipantId: requester.id,
          playerId: requester.id,
          draft: validation.payload,
        });
        estimateCount++;
        committedProjection = {
          ...toEstimateDto(estimate, true),
          identity: toEstimateIdentityDto(estimate.identity),
        };
      } else {
        committedProjection = {
          status: "unavailable",
          reason: "stored_submission_invalid",
        };
      }
    }
    requesterThisTurn = {
      capturedBuildLines: captured?.capturedBuildLines ?? [],
      committedProjection,
    };
  }
  const estimatorMs = performance.now() - estimatorStartedAt;
  const publicIdentitySource = {
    gameId: state.gameId ?? "",
    turnNumber,
    phaseKey,
    battleLog: publicBattleLog,
    estimatesByPlayerId,
  };
  const publicThisTurn = {
    identity: {
      gameId: state.gameId ?? "",
      turnNumber,
      phaseKey,
      sourceContextKey: hashStableValue(publicIdentitySource),
    },
    battleLog: publicBattleLog,
    estimatesByPlayerId,
  };
  args.timingObserver?.({
    route: "full_get",
    estimatorMs,
    estimateCount,
    totalMs: performance.now() - startedAt,
  });
  return { publicThisTurn, requesterThisTurn };
}
