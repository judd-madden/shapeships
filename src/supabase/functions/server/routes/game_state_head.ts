import { accrueClocks, clocksAreLive } from "../engine/clock/clock.ts";
import { syncPhaseFields } from "../engine/phase/syncPhaseFields.ts";
import {
  buildPhaseKey,
  isValidPhaseKey,
} from "../engine_shared/phase/PhaseTable.ts";

export const PERSISTED_GAME_STATE_HEAD_SCHEMA_VERSION = 1 as const;

export type PersistedGameStateHeadParticipant = {
  id: string;
  role: "player" | "spectator";
  faction?: string | null;
  species?: string | null;
};

export type PersistedGameStateHeadClockInputs = {
  remainingMsByPlayerId: Record<string, number>;
  lastUpdateAtMs: number | null;
  clockTurnNumber: number;
  phaseReadiness: Array<{ playerId: string; isReady: boolean }>;
  phaseHold: { phaseKey: string; holdReason: string } | null;
  missionIntroPending: boolean;
};

export type PersistedGameStateHeadV1 = {
  schemaVersion: typeof PERSISTED_GAME_STATE_HEAD_SCHEMA_VERSION;
  gameId: string;
  stateRevision: number;
  status: string;
  turnNumber: number;
  phaseKey: string;
  participants: PersistedGameStateHeadParticipant[];
  clockInputs: PersistedGameStateHeadClockInputs | null;
};

export type GameStateHeadResponse = {
  gameId: string;
  stateRevision: number;
  status: string;
  turnNumber: number;
  phaseKey: string;
  clock: {
    remainingMsByPlayerId: Record<string, number>;
    clocksAreLive: boolean;
    serverNowMs: number;
  } | null;
};

export type GameStateHeadProjectionResult =
  | { ok: true; head: PersistedGameStateHeadV1 }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function copyOptionalSpeciesField(
  participant: Record<string, unknown>,
  field: "faction" | "species",
  projected: PersistedGameStateHeadParticipant,
): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(participant, field)) {
    return undefined;
  }

  const value = participant[field];
  if (value !== null && typeof value !== "string") {
    throw new Error(`Participant ${field} must be a string or null`);
  }
  projected[field] = value;
  return value;
}

function projectParticipants(
  value: unknown,
): PersistedGameStateHeadParticipant[] {
  if (!Array.isArray(value)) {
    throw new Error("Canonical game state players must be an array");
  }

  return value.map((participant) => {
    if (
      !isRecord(participant) || typeof participant.id !== "string" ||
      participant.id.length === 0
    ) {
      throw new Error("Canonical game participant must have a non-empty ID");
    }
    if (participant.role !== "player" && participant.role !== "spectator") {
      throw new Error("Canonical game participant has an unsupported role");
    }

    const projected: PersistedGameStateHeadParticipant = {
      id: participant.id,
      role: participant.role,
    };
    copyOptionalSpeciesField(participant, "faction", projected);
    copyOptionalSpeciesField(participant, "species", projected);
    return projected;
  });
}

function projectRemainingMsByPlayerId(
  value: unknown,
): Record<string, number> {
  if (!isRecord(value)) {
    throw new Error("Canonical game clock remaining time must be a record");
  }

  const projected: Record<string, number> = {};
  for (const [playerId, remainingMs] of Object.entries(value)) {
    if (!isFiniteNumber(remainingMs) || remainingMs < 0) {
      throw new Error(
        "Canonical game clock remaining time must be non-negative",
      );
    }
    projected[playerId] = remainingMs;
  }
  return projected;
}

function projectPhaseReadiness(
  value: unknown,
): Array<{ playerId: string; isReady: boolean }> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error("Canonical game phase readiness must be an array");
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) || typeof entry.playerId !== "string" ||
      entry.playerId.length === 0 || typeof entry.isReady !== "boolean"
    ) {
      throw new Error("Canonical game phase readiness entry is invalid");
    }
    return { playerId: entry.playerId, isReady: entry.isReady };
  });
}

function projectPhaseHold(
  value: unknown,
): { phaseKey: string; holdReason: string } | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.phaseKey !== "string" ||
    typeof value.holdReason !== "string"
  ) {
    return null;
  }
  return { phaseKey: value.phaseKey, holdReason: value.holdReason };
}

function projectEffectivePhaseKey(state: Record<string, unknown>): string {
  const synchronized = syncPhaseFields(state);
  const gameData = isRecord(synchronized.gameData)
    ? synchronized.gameData
    : null;
  const major = gameData?.currentPhase;
  const sub = gameData?.currentSubPhase;
  if (typeof major !== "string" || typeof sub !== "string") {
    return "unknown";
  }
  return buildPhaseKey(major, sub) ?? "unknown";
}

export function projectGameStateHead(
  state: unknown,
): GameStateHeadProjectionResult {
  try {
    if (!isRecord(state)) {
      throw new Error("Canonical game state must be an object");
    }
    if (typeof state.gameId !== "string" || state.gameId.length === 0) {
      throw new Error("Canonical game state must have a non-empty gameId");
    }
    if (
      !Number.isInteger(state.stateRevision) ||
      !isFiniteNumber(state.stateRevision) || state.stateRevision <= 0
    ) {
      throw new Error(
        "Canonical game state must have a positive stateRevision",
      );
    }
    if (typeof state.status !== "string") {
      throw new Error("Canonical game state must have a string status");
    }

    const gameData = isRecord(state.gameData) ? state.gameData : {};
    const rawTurnNumber = gameData.turnNumber ?? state.turnNumber ?? 0;
    if (
      !Number.isInteger(rawTurnNumber) || !isFiniteNumber(rawTurnNumber) ||
      rawTurnNumber < 0
    ) {
      throw new Error(
        "Canonical game state must have a non-negative turnNumber",
      );
    }

    const rawClock = gameData.clock;
    let clockInputs: PersistedGameStateHeadClockInputs | null = null;
    if (rawClock !== undefined && rawClock !== null) {
      if (!isRecord(rawClock)) {
        throw new Error("Canonical game clock must be an object or null");
      }
      const rawLastUpdateAtMs = rawClock.lastUpdateAtMs;
      if (
        rawLastUpdateAtMs !== undefined && rawLastUpdateAtMs !== null &&
        !isFiniteNumber(rawLastUpdateAtMs)
      ) {
        throw new Error("Canonical game clock lastUpdateAtMs must be numeric");
      }
      const turnData = isRecord(gameData.turnData) ? gameData.turnData : {};
      const missionAssignment = isRecord(state.missionChallengeAssignment)
        ? state.missionChallengeAssignment
        : null;
      const rawClockTurnNumber = state.turnNumber ?? gameData.turnNumber ?? 0;
      if (
        !Number.isInteger(rawClockTurnNumber) ||
        !isFiniteNumber(rawClockTurnNumber) || rawClockTurnNumber < 0
      ) {
        throw new Error(
          "Canonical game clock turnNumber must be non-negative",
        );
      }
      clockInputs = {
        remainingMsByPlayerId: projectRemainingMsByPlayerId(
          rawClock.remainingMsByPlayerId,
        ),
        lastUpdateAtMs: isFiniteNumber(rawLastUpdateAtMs)
          ? rawLastUpdateAtMs
          : null,
        clockTurnNumber: rawClockTurnNumber,
        phaseReadiness: projectPhaseReadiness(gameData.phaseReadiness),
        phaseHold: projectPhaseHold(turnData.phaseHold),
        missionIntroPending: missionAssignment?.introPending === true,
      };
    }

    const head: PersistedGameStateHeadV1 = {
      schemaVersion: PERSISTED_GAME_STATE_HEAD_SCHEMA_VERSION,
      gameId: state.gameId,
      stateRevision: state.stateRevision,
      status: state.status,
      turnNumber: rawTurnNumber,
      phaseKey: projectEffectivePhaseKey(state),
      participants: projectParticipants(state.players),
      clockInputs,
    };
    return { ok: true, head };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function parsePersistedGameStateHead(
  value: unknown,
  expectedGameId?: string,
): PersistedGameStateHeadV1 | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== PERSISTED_GAME_STATE_HEAD_SCHEMA_VERSION ||
    typeof value.gameId !== "string" || value.gameId.length === 0 ||
    (expectedGameId !== undefined && value.gameId !== expectedGameId) ||
    !Number.isInteger(value.stateRevision) ||
    !isFiniteNumber(value.stateRevision) || value.stateRevision <= 0 ||
    typeof value.status !== "string" ||
    !Number.isInteger(value.turnNumber) ||
    !isFiniteNumber(value.turnNumber) || value.turnNumber < 0 ||
    typeof value.phaseKey !== "string" ||
    (value.phaseKey !== "unknown" && !isValidPhaseKey(value.phaseKey))
  ) {
    return null;
  }

  let participants: PersistedGameStateHeadParticipant[];
  try {
    participants = projectParticipants(value.participants);
  } catch {
    return null;
  }

  let clockInputs: PersistedGameStateHeadClockInputs | null = null;
  if (value.clockInputs !== null) {
    if (
      !isRecord(value.clockInputs) ||
      (value.clockInputs.lastUpdateAtMs !== null &&
        !isFiniteNumber(value.clockInputs.lastUpdateAtMs)) ||
      !Number.isInteger(value.clockInputs.clockTurnNumber) ||
      !isFiniteNumber(value.clockInputs.clockTurnNumber) ||
      value.clockInputs.clockTurnNumber < 0 ||
      !Array.isArray(value.clockInputs.phaseReadiness) ||
      typeof value.clockInputs.missionIntroPending !== "boolean"
    ) {
      return null;
    }
    const rawPhaseHold = value.clockInputs.phaseHold;
    if (
      rawPhaseHold !== null &&
      (!isRecord(rawPhaseHold) ||
        typeof rawPhaseHold.phaseKey !== "string" ||
        typeof rawPhaseHold.holdReason !== "string")
    ) {
      return null;
    }
    try {
      clockInputs = {
        remainingMsByPlayerId: projectRemainingMsByPlayerId(
          value.clockInputs.remainingMsByPlayerId,
        ),
        lastUpdateAtMs: value.clockInputs.lastUpdateAtMs,
        clockTurnNumber: value.clockInputs.clockTurnNumber,
        phaseReadiness: projectPhaseReadiness(
          value.clockInputs.phaseReadiness,
        ),
        phaseHold: rawPhaseHold === null ? null : {
          phaseKey: rawPhaseHold.phaseKey as string,
          holdReason: rawPhaseHold.holdReason as string,
        },
        missionIntroPending: value.clockInputs.missionIntroPending,
      };
    } catch {
      return null;
    }
  }

  return {
    schemaVersion: PERSISTED_GAME_STATE_HEAD_SCHEMA_VERSION,
    gameId: value.gameId,
    stateRevision: value.stateRevision,
    status: value.status,
    turnNumber: value.turnNumber,
    phaseKey: value.phaseKey,
    participants,
    clockInputs,
  };
}

export function projectStoredGameStateHeadResponse(
  head: PersistedGameStateHeadV1,
  nowMs: number,
): { response: GameStateHeadResponse; possibleTimeout: boolean } {
  if (head.clockInputs === null) {
    return {
      response: {
        gameId: head.gameId,
        stateRevision: head.stateRevision,
        status: head.status,
        turnNumber: head.turnNumber,
        phaseKey: head.phaseKey,
        clock: null,
      },
      possibleTimeout: false,
    };
  }

  const clockState = {
    gameId: head.gameId,
    stateRevision: head.stateRevision,
    status: head.status,
    turnNumber: head.clockInputs.clockTurnNumber,
    players: head.participants,
    missionChallengeAssignment: {
      introPending: head.clockInputs.missionIntroPending,
    },
    gameData: {
      phaseReadiness: head.clockInputs.phaseReadiness,
      turnData: {
        ...(head.clockInputs.phaseHold
          ? { phaseHold: head.clockInputs.phaseHold }
          : {}),
      },
      clock: {
        remainingMsByPlayerId: head.clockInputs.remainingMsByPlayerId,
        lastUpdateAtMs: head.clockInputs.lastUpdateAtMs,
      },
    },
  };
  const accruedState = accrueClocks(clockState, nowMs);
  const possibleTimeout = head.status !== "finished" &&
    accruedState.status === "finished";
  const clock = accruedState.gameData.clock;

  return {
    response: {
      gameId: head.gameId,
      stateRevision: head.stateRevision,
      status: head.status,
      turnNumber: head.turnNumber,
      phaseKey: head.phaseKey,
      clock: {
        remainingMsByPlayerId: clock.remainingMsByPlayerId ?? {},
        clocksAreLive: clocksAreLive(accruedState),
        serverNowMs: nowMs,
      },
    },
    possibleTimeout,
  };
}
