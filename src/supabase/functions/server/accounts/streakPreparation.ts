import { createFreshComputerGameData } from "../routes/computer_game_factory.ts";
import { projectGameStateHead } from "../routes/game_state_head.ts";
import {
  createEmptyBattleLogHistoryStore,
  getBattleLogHistoryKey,
} from "../engine/state/battleLogHistory.ts";
import {
  getPersistedStateRevisionToken,
  getStateRevisionBase,
  withStateRevisionFromBase,
} from "../routes/state_revision.ts";
import type { TimeControlConfig } from "../engine/clock/clock.ts";
import {
  type PreparedGameRow,
  type PreparedHistoryRow,
  StreakFault,
  type StreakSource,
} from "./streakRepository.ts";

export function prepareStreakGameRow(
  value: Record<string, any>,
): PreparedGameRow {
  const projected = projectGameStateHead(value);
  if (!projected.ok) throw new StreakFault("STREAK_CONFLICT");
  return {
    key: `game_${value.gameId}`,
    value: structuredClone(value),
    game_head: projected.head,
  };
}
export function prepareFreshAccountComputerGame(input: {
  gameId: string;
  sessionId: string;
  displayName: string;
  accountId: string;
  currentCount: number;
  timeControl?: TimeControlConfig | null;
  restartSourceGameId?: string;
}): { game: PreparedGameRow; history: PreparedHistoryRow } {
  if (!Number.isSafeInteger(input.currentCount) || input.currentCount < 0) {
    throw new StreakFault("STREAK_CONFLICT");
  }
  const state = createFreshComputerGameData(
    input.gameId,
    input.sessionId,
    input.displayName,
    input.timeControl,
    input.currentCount,
    input.accountId,
  );
  if (input.restartSourceGameId) {
    state.winStreakRestart = {
      kind: "replacement",
      sourceGameId: input.restartSourceGameId,
    };
  }
  return {
    game: prepareStreakGameRow(state),
    history: {
      key: getBattleLogHistoryKey(input.gameId),
      value: createEmptyBattleLogHistoryStore(input.gameId),
    },
  };
}

export function prepareRestartSource(
  state: Record<string, any>,
  replacementGameId: string,
): StreakSource {
  const token = getPersistedStateRevisionToken(state);
  if (token.kind === "invalid") throw new StreakFault("STREAK_CONFLICT");
  const value = structuredClone(state);
  value.status = "finished";
  delete value.result;
  delete value.winnerPlayerId;
  value.resultReason = "restart";
  value.winStreakRestart = { kind: "source", status: "completed", replacementGameId };
  return {
    gameId: state.gameId,
    expectedRevision: token.kind === "valid" ? token.revision : null,
    update: prepareStreakGameRow(withStateRevisionFromBase(value, getStateRevisionBase(token))),
  };
}
/** Preparation is not proof: the RPC independently checks the validated session. */
export function prepareParticipantAdoption(
  state: Record<string, any>,
  sessionId: string,
  accountId: string,
): StreakSource {
  const token = getPersistedStateRevisionToken(state);
  if (token.kind === "invalid") throw new StreakFault("STREAK_CONFLICT");
  const value = structuredClone(state);
  const human = value.players?.find((p: any) =>
    p.id === sessionId && p.role === "player"
  );
  if (
    !human || human.accountId != null ||
    value.controllersByPlayerId?.[sessionId]?.kind !== "human"
  ) throw new StreakFault("STREAK_SEAT_FORBIDDEN");
  human.accountId = accountId;
  return {
    gameId: state.gameId,
    expectedRevision: token.kind === "valid" ? token.revision : null,
    update: prepareStreakGameRow(
      withStateRevisionFromBase(value, getStateRevisionBase(token)),
    ),
  };
}
