import type { Hono } from "npm:hono";
import { accrueClocks } from "../engine/clock/clock.ts";
import { peekCommitRecord } from "../engine/intent/CommitStore.ts";
import { getBuildCommitKey } from "../engine/intent/IntentTypes.ts";
import type { BuildSubmitPayload } from "../engine/intent/IntentTypes.ts";
import { validateBuildSubmitPayload } from "../engine/intent/buildSubmitValidation.ts";
import {
  ChargeDeclarationConflictError,
  fingerprintChargeDeclaration,
  mergeRetainedOrdinaryChargeActions,
  normalizeChargeDeclarationPayload,
  type NormalizedChargeDeclaration,
} from "../engine/intent/chargeDeclarationResolution.ts";
import {
  getAcceptedDeclarationForCurrentBattle,
} from "../engine/intent/chargeDeclarationEligibility.ts";
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
    ownBuildCaptureIdentity?: string;
  };
  draft: BuildSubmitPayload;
  requestToken?: string;
};

type ChargePreviewRequest = {
  observed: {
    turnNumber: number;
    phaseKey: "battle.charge_declaration";
    sourceContextKey?: string;
  };
  declaration?: unknown;
  solarSelection?: unknown;
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

function toEstimateIdentityDto(
  identity: CurrentTurnEstimateIdentity,
  ownBuildCaptureIdentity?: string,
) {
  return {
    gameId: identity.gameId,
    turnNumber: identity.turnNumber,
    phaseKey: identity.sourcePhase,
    sourceContextKey: identity.sourceContextKey,
    draftKey: identity.draftKey,
    ...(identity.solarSelectionKey
      ? { solarSelectionKey: identity.solarSelectionKey }
      : {}),
    ...(identity.declarationFingerprint
      ? { declarationFingerprint: identity.declarationFingerprint }
      : {}),
    ...(ownBuildCaptureIdentity ? { ownBuildCaptureIdentity } : {}),
  };
}

function toBuildDto(result: CurrentTurnEstimateAvailableResult) {
  return {
    lines: [...result.build.lines],
    rows: result.build.rows.map((row) => ({ ...row })),
    skipped: result.build.skipped.map((fact) => ({ ...fact })),
    remainingOrdinaryLines: result.build.remainingOrdinaryLines,
    remainingJoiningLines: result.build.remainingJoiningLines,
  };
}

function toEstimateDto(
  result: CurrentTurnEstimateResult,
  includeBuild: boolean,
  ownBuildCaptureIdentity?: string,
  chargeDeclarationUncertain?: boolean,
) {
  if (result.status === "unavailable") {
    return {
      status: result.status,
      reason: result.reason,
      identity: {
        sourceContextKey: result.identity.sourceContextKey,
        draftKey: result.identity.draftKey,
        ...(result.identity.declarationFingerprint
          ? { declarationFingerprint: result.identity.declarationFingerprint }
          : {}),
        ...(ownBuildCaptureIdentity ? { ownBuildCaptureIdentity } : {}),
      },
    };
  }
  return {
    status: result.status,
    identity: {
      sourceContextKey: result.identity.sourceContextKey,
      draftKey: result.identity.draftKey,
      ...(result.identity.declarationFingerprint
        ? { declarationFingerprint: result.identity.declarationFingerprint }
        : {}),
      ...(ownBuildCaptureIdentity ? { ownBuildCaptureIdentity } : {}),
    },
    damage: {
      total: result.damage,
      rows: structuredClone(result.damageRows),
    },
    healing: {
      total: result.healing,
      rows: structuredClone(result.healingRows),
    },
    ...(typeof chargeDeclarationUncertain === "boolean"
      ? { chargeDeclarationUncertain }
      : {}),
    ...(includeBuild ? { build: toBuildDto(result) } : {}),
  };
}

function toRequesterEstimateDto(
  result: CurrentTurnEstimateResult,
  includeBuild: boolean,
  ownBuildCaptureIdentity?: string,
) {
  const base = toEstimateDto(
    result,
    includeBuild,
    ownBuildCaptureIdentity,
  );
  if (
    result.status === "unavailable" ||
    (!result.withAutocast && !result.withSolarSelection &&
      !result.withChargeDeclaration)
  ) return base;
  const withVariants: Record<string, unknown> = {
    ...base,
  };
  if (result.withAutocast) {
    withVariants.withAutocast = {
      damage: {
        total: result.withAutocast.damage.total,
        rows: structuredClone(result.withAutocast.damage.rows),
      },
      healing: {
        total: result.withAutocast.healing.total,
        rows: structuredClone(result.withAutocast.healing.rows),
      },
    };
  }
  if (result.withSolarSelection) {
    withVariants.withSolarSelection = {
      damage: {
        total: result.withSolarSelection.damage.total,
        rows: structuredClone(result.withSolarSelection.damage.rows),
      },
      healing: {
        total: result.withSolarSelection.healing.total,
        rows: structuredClone(result.withSolarSelection.healing.rows),
      },
      autocastEnabled: result.withSolarSelection.autocastEnabled,
    };
  }
  if (result.withChargeDeclaration) {
    withVariants.withChargeDeclaration = {
      damage: {
        total: result.withChargeDeclaration.damage.total,
        rows: structuredClone(result.withChargeDeclaration.damage.rows),
      },
      healing: {
        total: result.withChargeDeclaration.healing.total,
        rows: structuredClone(result.withChargeDeclaration.healing.rows),
      },
      autocastEnabled: result.withChargeDeclaration.autocastEnabled,
      declarationFingerprint: result.withChargeDeclaration.declarationFingerprint,
    };
  }
  return withVariants;
}

function isAncientPlayer(player: Readonly<any>): boolean {
  const species = player?.faction ?? player?.species;
  return typeof species === "string" && species.toLowerCase() === "ancient";
}

function getSupportedAcceptedSolarSelection(
  state: any,
  playerId: string,
) {
  const accepted = getAcceptedDeclarationForCurrentBattle(state, playerId);
  if (
    !accepted ||
    !Array.isArray(accepted.solarCasts) ||
    accepted.solarCasts.length === 0 ||
    typeof accepted.autocastEnabled !== "boolean" ||
    !isObject(accepted.context?.initialEnergy)
  ) {
    return undefined;
  }
  return {
    solarCasts: structuredClone(accepted.solarCasts),
    autocastEnabled: accepted.autocastEnabled,
    initialEnergy: structuredClone(accepted.context.initialEnergy),
  };
}

function getRecoveredChargeDeclaration(
  state: any,
  playerId: string,
): NormalizedChargeDeclaration | null {
  const turnNumber = getTurnNumber(state);
  const generic = state?.gameData?.turnData
    ?.acceptedChargeDeclarationsByPlayerId?.[playerId];
  if (generic?.battleTurnNumber === turnNumber) {
    return normalizeChargeDeclarationPayload({
      contractVersion: 1,
      declarationId: generic.declarationId,
      ordinaryChargeActions: generic.ordinaryChargeActions,
      solarCasts: generic.solarCasts,
      autocastEnabled: generic.autocastEnabled,
    });
  }
  const ancient = getAcceptedDeclarationForCurrentBattle(state, playerId);
  if (ancient) {
    return normalizeChargeDeclarationPayload({
      contractVersion: 1,
      declarationId: ancient.declarationId,
      ordinaryChargeActions: ancient.ordinaryChargeActions,
      solarCasts: ancient.solarCasts,
      autocastEnabled: ancient.autocastEnabled,
    });
  }
  const retained = state?.gameData?.turnData
    ?.chargeDeclarationAcceptedOrdinaryActionsByPlayerId?.[playerId];
  if (
    retained?.battleTurnNumber !== turnNumber ||
    !Array.isArray(retained.actions)
  ) {
    return null;
  }
  return normalizeChargeDeclarationPayload({
    contractVersion: 1,
    declarationId: `current-turn-recovery:${turnNumber}:${playerId}`,
    ordinaryChargeActions: retained.actions,
    solarCasts: [],
    autocastEnabled: false,
  });
}

function getChargeDeclarationUncertain(state: any, playerId: string): boolean {
  const eligible = state?.gameData?.turnData
    ?.chargeDeclarationEligibleSourceIdsByPlayerId?.[playerId];
  if (Array.isArray(eligible) && eligible.length > 0) return true;
  const player = state?.players?.find((candidate: any) => candidate?.id === playerId);
  if (!isAncientPlayer(player)) return false;
  const snapshot = state?.gameData?.turnData?.chargeDeclarationVisibilitySnapshot;
  if (snapshot?.battleTurnNumber !== getTurnNumber(state)) return false;
  const pool = snapshot?.ancientEnergyByPlayerId?.[playerId]?.pool;
  return [pool?.green, pool?.red, pool?.blue].some((value) =>
    typeof value === "number" && Number.isFinite(value) && value > 0
  );
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
      "ownBuildCaptureIdentity",
    ]) ||
    !hasOnlyKeys(value.draft, [
      "builds",
      "frigateTriggers",
      "quantumMysticSelections",
      "evolverChoices",
      "buildGroupOrder",
    ])
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    !Number.isInteger(value.observed.turnNumber) ||
    value.observed.phaseKey !== "build.drawing" ||
    (value.observed.sourceContextKey !== undefined &&
      typeof value.observed.sourceContextKey !== "string") ||
    (value.observed.ownBuildCaptureIdentity !== undefined &&
      typeof value.observed.ownBuildCaptureIdentity !== "string")
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
      )) ||
    (Array.isArray(draft.buildGroupOrder) &&
      draft.buildGroupOrder.some((entry: unknown) =>
        !isObject(entry) ||
        !hasOnlyKeys(entry, ["shipDefId", "afterCaptureSequence", "sourceShipDefId"])
      ))
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  const arrays = [
    draft.frigateTriggers,
    draft.quantumMysticSelections,
    draft.evolverChoices,
    draft.buildGroupOrder,
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

function validateChargePreviewEnvelope(value: unknown):
  | { ok: true; value: ChargePreviewRequest }
  | { ok: false; reason: string } {
  if (
    !isObject(value) ||
    !isObject(value.observed) ||
    ((value.declaration === undefined) === (value.solarSelection === undefined))
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    !hasOnlyKeys(value, ["observed", "declaration", "solarSelection", "requestToken"]) ||
    !hasOnlyKeys(value.observed, [
      "turnNumber",
      "phaseKey",
      "sourceContextKey",
    ])
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (
    !Number.isInteger(value.observed.turnNumber) ||
    value.observed.phaseKey !== "battle.charge_declaration" ||
    (value.observed.sourceContextKey !== undefined &&
      typeof value.observed.sourceContextKey !== "string") ||
    (value.declaration !== undefined && !isObject(value.declaration)) ||
    (value.solarSelection !== undefined && !isObject(value.solarSelection))
  ) {
    return { ok: false, reason: "invalid_payload" };
  }
  const candidate = (value.declaration ?? value.solarSelection) as Record<string, any>;
  if (!Array.isArray(candidate.solarCasts)) {
    return { ok: false, reason: "invalid_payload" };
  }
  const ordinaryActions = value.declaration === undefined
    ? []
    : candidate.ordinaryChargeActions;
  if (
    !Array.isArray(ordinaryActions) ||
    ordinaryActions.length > MAX_PREVIEW_SELECTION_ENTRIES ||
    candidate.solarCasts.length > MAX_PREVIEW_SELECTION_ENTRIES
  ) {
    return { ok: false, reason: "preview_bounds_exceeded" };
  }
  if (value.solarSelection !== undefined && candidate.solarCasts.length === 0) {
    return { ok: false, reason: "preview_bounds_exceeded" };
  }
  if (
    value.requestToken !== undefined &&
    (typeof value.requestToken !== "string" ||
      value.requestToken.length > MAX_PREVIEW_REQUEST_TOKEN_LENGTH)
  ) {
    return { ok: false, reason: "preview_bounds_exceeded" };
  }
  return { ok: true, value: value as ChargePreviewRequest };
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

      const requesterCapture = projectBattleLogCurrentTurnRequester(
        state,
        session.sessionId,
      );
      if (
        observed.ownBuildCaptureIdentity !== undefined &&
        observed.ownBuildCaptureIdentity !== requesterCapture?.ownBuildCaptureIdentity
      ) {
        return c.json({
          status: "obsolete",
          reason: "capture_context_changed",
          ...(requestToken !== undefined ? { requestToken } : {}),
          retry: { allowed: false },
        }, 409);
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
        const identity = toEstimateIdentityDto(
          result.identity,
          requesterCapture?.ownBuildCaptureIdentity,
        );
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
          identity: toEstimateIdentityDto(
            result.identity,
            requesterCapture?.ownBuildCaptureIdentity,
          ),
        }, 409);
      }
      return c.json({
        status: "estimated",
        ...(requestToken !== undefined ? { requestToken } : {}),
        identity: toEstimateIdentityDto(
          result.identity,
          requesterCapture?.ownBuildCaptureIdentity,
        ),
        playerId: session.sessionId,
        damage: {
          total: result.damage,
          rows: structuredClone(result.damageRows),
        },
        healing: {
          total: result.healing,
          rows: structuredClone(result.healingRows),
        },
        ...(result.withAutocast
          ? {
            withAutocast: {
              damage: {
                total: result.withAutocast.damage.total,
                rows: structuredClone(result.withAutocast.damage.rows),
              },
              healing: {
                total: result.withAutocast.healing.total,
                rows: structuredClone(result.withAutocast.healing.rows),
              },
            },
          }
          : {}),
        build: toBuildDto(result),
      });
    } catch (error) {
      console.error("Build preview error:", error);
      return unavailable(c, 500, "internal_error");
    }
  });

  args.app.post(
    "/make-server-825e19ab/charge-declaration-preview/:gameId",
    async (c) => {
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
        const envelope = validateChargePreviewEnvelope(parsed);
        if (!envelope.ok) return unavailable(c, 400, envelope.reason);
        const { observed, declaration, solarSelection, requestToken } = envelope.value;

        const gameId = c.req.param("gameId");
        const loadStartedAt = performance.now();
        const loaded = await args.persistence.load(`game_${gameId}`);
        const loadMs = performance.now() - loadStartedAt;
        if (loaded.status === "error") {
          console.error("Charge-preview persistence error:", loaded.error);
          return unavailable(c, 500, "persistence_error", requestToken);
        }
        if (loaded.status === "missing") {
          return unavailable(c, 404, "game_not_found", requestToken);
        }

        let state = syncPhaseFields(structuredClone(loaded.value));
        state = accrueClocks(state, Date.now());
        state = normalizeAncientGameState(state).state;
        const participant = state?.players?.find((candidate: any) =>
          candidate?.id === session.sessionId
        );
        if (!participant || participant.role !== "player") {
          return unavailable(c, 403, "player_role_required", requestToken);
        }
        if (solarSelection !== undefined && !isAncientPlayer(participant)) {
          return unavailable(c, 403, "ancient_player_required", requestToken);
        }
        if (state.status !== "active") {
          return unavailable(c, 409, "game_unavailable", requestToken);
        }

        const phaseKey = getPhaseKey(state);
        const turnNumber = getTurnNumber(state);
        if (
          observed.turnNumber !== turnNumber || observed.phaseKey !== phaseKey
        ) {
          return c.json({
            status: "obsolete",
            reason: "turn_or_phase_changed",
            ...(requestToken !== undefined ? { requestToken } : {}),
            retry: { allowed: false, turnNumber, phaseKey },
          }, 409);
        }
        if (
          solarSelection !== undefined &&
          getAcceptedDeclarationForCurrentBattle(state, session.sessionId)
        ) {
          return unavailable(c, 409, "already_submitted", requestToken);
        }
        let normalized: NormalizedChargeDeclaration;
        try {
          normalized = declaration !== undefined
            ? normalizeChargeDeclarationPayload(declaration)
            : normalizeChargeDeclarationPayload({
              contractVersion: 1,
              declarationId: "current-turn-preview",
              ordinaryChargeActions: [],
              solarCasts: (solarSelection as any).solarCasts,
              autocastEnabled: (solarSelection as any).autocastEnabled,
            });
        } catch {
          return unavailable(c, 400, "invalid_payload", requestToken);
        }

        const genericFinalized = state?.gameData?.turnData
          ?.acceptedChargeDeclarationsByPlayerId?.[session.sessionId];
        const finalized = genericFinalized?.battleTurnNumber === turnNumber
          ? genericFinalized
          : getAcceptedDeclarationForCurrentBattle(state, session.sessionId);
        try {
          normalized = {
            ...normalized,
            ordinaryChargeActions: mergeRetainedOrdinaryChargeActions({
              state,
              playerId: session.sessionId,
              draftActions: normalized.ordinaryChargeActions,
            }),
          };
          if (
            finalized &&
            finalized.declarationFingerprint !== fingerprintChargeDeclaration(normalized)
          ) {
            return unavailable(c, 409, "already_submitted", requestToken);
          }
        } catch (error) {
          if (finalized) {
            return unavailable(c, 409, "already_submitted", requestToken);
          }
          if (error instanceof ChargeDeclarationConflictError) {
            return unavailable(c, 409, "declaration_conflict", requestToken);
          }
          return unavailable(c, 400, "invalid_payload", requestToken);
        }

        const estimatorStartedAt = performance.now();
        let result: CurrentTurnEstimateResult;
        try {
          result = estimateCurrentTurnForPlayer({
            state,
            requestingParticipantId: session.sessionId,
            playerId: session.sessionId,
            draft: null,
            expectedSourceContextKey: observed.sourceContextKey,
            chargeDeclaration: normalized,
            ...(isAncientPlayer(participant)
              ? {
                solarSelection: {
                  solarCasts: normalized.solarCasts,
                  autocastEnabled: normalized.autocastEnabled,
                },
              }
              : {}),
          });
        } catch {
          return unavailable(c, 400, "invalid_charge_declaration", requestToken);
        }
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
        if (result.status === "unavailable" || !result.withChargeDeclaration) {
          return c.json({
            status: "unavailable",
            reason: result.status === "unavailable"
              ? result.reason
              : "invalid_charge_declaration",
            ...(requestToken !== undefined ? { requestToken } : {}),
            identity: toEstimateIdentityDto(result.identity),
          }, 409);
        }

        const requesterProjection = toRequesterEstimateDto(result, true);
        return c.json({
          ...requesterProjection,
          status: "estimated",
          ...(requestToken !== undefined ? { requestToken } : {}),
          identity: toEstimateIdentityDto(result.identity),
          playerId: session.sessionId,
        });
      } catch (error) {
        console.error("Charge declaration preview error:", error);
        return unavailable(c, 500, "internal_error");
      }
    },
  );
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
      estimatesByPlayerId[player.id] = toEstimateDto(
        estimate,
        false,
        undefined,
        phaseKey === "battle.charge_declaration"
          ? getChargeDeclarationUncertain(state, player.id)
          : undefined,
      );
    }
  }

  let requesterThisTurn: any = null;
  if (phaseKey === "build.drawing" && requester) {
    const captured = projectBattleLogCurrentTurnRequester(
      state,
      requester.id,
    );
    const requesterPrelude = getCurrentDrawingPreludePlayerState(
      state,
      requester.id,
    );
    let turnStartProjection: any = null;
    if (requesterPrelude?.status === "awaiting_actions") {
      const estimate = estimateCurrentTurnForPlayer({
        state,
        requestingParticipantId: requester.id,
        playerId: requester.id,
        draft: null,
        drawingMode: "turn_start_baseline",
      });
      estimateCount++;
      turnStartProjection = {
        ...toRequesterEstimateDto(estimate, false),
        identity: toEstimateIdentityDto(estimate.identity),
      };
    }
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
          ...toRequesterEstimateDto(
            estimate,
            true,
            captured?.ownBuildCaptureIdentity,
          ),
          identity: toEstimateIdentityDto(
            estimate.identity,
            captured?.ownBuildCaptureIdentity,
          ),
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
      capturedBuildRows: captured?.capturedBuildRows ?? [],
      captureSequence: captured?.captureSequence ?? 0,
      ownBuildCaptureIdentity: captured?.ownBuildCaptureIdentity ?? null,
      turnStartProjection,
      committedProjection,
    };
  } else if (requester && phaseKey === "battle.charge_declaration") {
    let recovered: NormalizedChargeDeclaration | null = null;
    try {
      recovered = getRecoveredChargeDeclaration(state, requester.id);
    } catch {
      recovered = null;
    }
    const estimate = estimateCurrentTurnForPlayer({
      state,
      requestingParticipantId: requester.id,
      playerId: requester.id,
      draft: null,
      ...(recovered ? { chargeDeclaration: recovered } : {}),
      ...(recovered && isAncientPlayer(requester)
        ? {
          solarSelection: {
            solarCasts: recovered.solarCasts,
            autocastEnabled: recovered.autocastEnabled,
          },
        }
        : {}),
    });
    estimateCount++;
    requesterThisTurn = {
      currentProjection: {
        ...toRequesterEstimateDto(estimate, false),
        identity: toEstimateIdentityDto(estimate.identity),
      },
    };
  } else if (
    requester &&
    isAncientPlayer(requester) &&
    (phaseKey === "battle.reveal" ||
      phaseKey === "battle.first_strike")
  ) {
    const acceptedSolarSelection = getSupportedAcceptedSolarSelection(
      state,
      requester.id,
    );
    const estimate = estimateCurrentTurnForPlayer({
      state,
      requestingParticipantId: requester.id,
      playerId: requester.id,
      draft: null,
      ...(acceptedSolarSelection
        ? { solarSelection: acceptedSolarSelection }
        : {}),
    });
    estimateCount++;
    requesterThisTurn = {
      currentProjection: {
        ...toRequesterEstimateDto(estimate, false),
        identity: toEstimateIdentityDto(estimate.identity),
      },
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
