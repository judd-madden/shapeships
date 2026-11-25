import {
  AccountFault,
  type AccountRpcClient,
  mapAccountDatabaseError,
} from "./accountRepository.ts";
import type { PersistedGameStateHeadV1 } from "../routes/game_state_head.ts";
import type { BattleLogHistoryStore } from "../engine/state/battleLogHistory.ts";

export type StreakStatus =
  | "unfinished"
  | "settled"
  | "retired"
  | "restart_pending";
export interface AccountStreakSnapshot {
  accountId: string;
  runId: string;
  currentCount: number;
  revision: string;
  trackedGame: null | {
    gameId: string;
    humanPlayerId: string;
    status: StreakStatus;
  };
  endedStreak: null | { count: number; endingGameId: string };
  updatedAt: string;
}
export interface PreparedGameRow {
  key: string;
  value: Record<string, any>;
  game_head: PersistedGameStateHeadV1;
}
export interface PreparedHistoryRow {
  key: string;
  value: BattleLogHistoryStore;
}
export interface StreakSource {
  gameId: string;
  /** null means the persisted stateRevision field is absent, not JSON null. */
  expectedRevision: number | null;
  update: PreparedGameRow | null;
}
export interface StreakAuth {
  tokenHash: Uint8Array;
  sessionId: string;
}
export interface StreakCommitInput extends StreakAuth {
  expectedRevision: string;
  action: "create" | "rematch" | "restart";
  game: PreparedGameRow;
  history: PreparedHistoryRow;
  source: StreakSource | null;
}
export type StreakCommitResult =
  | { status: "committed"; streak: AccountStreakSnapshot; gameId: string }
  | { status: "gameIdTaken" };
export interface StreakGuestCandidate {
  currentCount: number;
  anchorGameId: string;
  humanPlayerId: string;
  resultPending: boolean;
}
export interface StreakImportInput extends StreakAuth {
  expectedRevision: string;
  decision: "compare" | "decline";
  guest: StreakGuestCandidate;
  adoption: StreakSource | null;
}
export interface StreakImportOutcome {
  anchorGameId: string;
  selection: "guest" | "account" | "declined";
  acceptedCount: number;
  continuation: "none" | "authorised";
}
export interface StreakImportResult {
  streak: AccountStreakSnapshot;
  import: StreakImportOutcome;
}
export interface StreakRepository {
  reconcile(input: StreakAuth): Promise<AccountStreakSnapshot>;
  reset(
    input: StreakAuth & { expectedRevision: string },
  ): Promise<AccountStreakSnapshot>;
  commitGame(input: StreakCommitInput): Promise<StreakCommitResult>;
  importGuest(input: StreakImportInput): Promise<StreakImportResult>;
}

const faults = {
  P2250: "STREAK_CONFLICT",
  P2251: "STREAK_IMPORT_UNVERIFIED",
  P2252: "STREAK_IMPORT_CONSUMED",
  P2253: "STREAK_SEAT_FORBIDDEN",
  P2255: "STREAK_GAME_NOT_FOUND",
} as const;
export type StreakErrorCode = typeof faults[keyof typeof faults];
export class StreakFault extends Error {
  constructor(readonly code: StreakErrorCode) {
    super(code);
    this.name = "StreakFault";
  }
}
export function mapStreakDatabaseError(
  error: unknown,
): StreakFault | AccountFault {
  const code = error && typeof error === "object"
    ? (error as { code?: unknown }).code
    : undefined;
  return typeof code === "string" && Object.hasOwn(faults, code)
    ? new StreakFault(faults[code as keyof typeof faults])
    : mapAccountDatabaseError(error);
}
function unavailable(): never {
  throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    unavailable();
  }
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.length) unavailable();
  return value;
}
function uuid(value: unknown): string {
  const result = text(value);
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result)) {
    unavailable();
  }
  return result;
}
function count(value: unknown, positive = false): number {
  if (
    typeof value !== "number" || !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0)
  ) unavailable();
  return value;
}
export function parseAccountStreakSnapshot(
  value: unknown,
): AccountStreakSnapshot {
  const row = object(value);
  const revision = text(row.revision);
  if (
    !/^[1-9][0-9]{0,18}$/.test(revision) ||
    BigInt(revision) > 9223372036854775807n
  ) unavailable();
  const updatedAt = text(row.updatedAt);
  if (
    !/^\d{4}-\d\d-\d\dT/.test(updatedAt) ||
    !Number.isFinite(Date.parse(updatedAt))
  ) unavailable();
  let trackedGame: AccountStreakSnapshot["trackedGame"] = null;
  if (row.trackedGame !== null) {
    const game = object(row.trackedGame);
    if (
      !["unfinished", "settled", "retired", "restart_pending"].includes(
        text(game.status),
      )
    ) unavailable();
    trackedGame = {
      gameId: text(game.gameId),
      humanPlayerId: text(game.humanPlayerId),
      status: game.status as StreakStatus,
    };
  }
  let endedStreak: AccountStreakSnapshot["endedStreak"] = null;
  if (row.endedStreak !== null) {
    const ended = object(row.endedStreak);
    endedStreak = {
      count: count(ended.count, true),
      endingGameId: text(ended.endingGameId),
    };
  }
  return {
    accountId: uuid(row.accountId),
    runId: uuid(row.runId),
    currentCount: count(row.currentCount),
    revision,
    trackedGame,
    endedStreak,
    updatedAt,
  };
}
function parseImport(value: unknown): StreakImportOutcome {
  const row = object(value);
  if (
    !["guest", "account", "declined"].includes(text(row.selection)) ||
    !["none", "authorised"].includes(text(row.continuation))
  ) unavailable();
  return {
    anchorGameId: text(row.anchorGameId),
    selection: row.selection as StreakImportOutcome["selection"],
    acceptedCount: count(row.acceptedCount),
    continuation: row.continuation as StreakImportOutcome["continuation"],
  };
}
const bytea = (hash: Uint8Array) =>
  "\\x" + Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");

/** No eager calls, routes, logging of database errors, or browser-facing SQLSTATEs. */
export function createStreakRepository(
  client: AccountRpcClient,
): StreakRepository {
  async function rpc(
    name: string,
    args: Record<string, unknown>,
    collision = false,
  ): Promise<unknown> {
    let result: { data: unknown; error: unknown };
    try {
      result = await client.rpc(name, args);
    } catch {
      unavailable();
    }
    if (result.error) {
      if (collision && object(result.error).code === "P2256") {
        return { status: "gameIdTaken" };
      }
      throw mapStreakDatabaseError(result.error);
    }
    return result.data;
  }
  const auth = (input: StreakAuth) => ({
    p_token_hash: bytea(input.tokenHash),
    p_session_id: input.sessionId,
  });
  return {
    async reconcile(input) {
      return parseAccountStreakSnapshot(
        await rpc("account_streak_reconcile", auth(input)),
      );
    },
    async reset(input) {
      return parseAccountStreakSnapshot(
        await rpc("account_streak_reset", {
          ...auth(input),
          p_expected_revision: input.expectedRevision,
        }),
      );
    },
    async commitGame(input) {
      const row = object(
        await rpc("account_streak_commit_game", {
          ...auth(input),
          p_expected_revision: input.expectedRevision,
          p_action: input.action,
          p_game: input.game,
          p_history: input.history,
          p_source: input.source,
        }, true),
      );
      if (row.status === "gameIdTaken") return { status: "gameIdTaken" };
      if (row.status !== "committed") unavailable();
      return {
        status: "committed",
        streak: parseAccountStreakSnapshot(row.streak),
        gameId: text(row.gameId),
      };
    },
    async importGuest(input) {
      const row = object(
        await rpc("account_streak_import", {
          ...auth(input),
          p_expected_revision: input.expectedRevision,
          p_decision: input.decision,
          p_guest: input.guest,
          p_adoption: input.adoption,
        }),
      );
      return {
        streak: parseAccountStreakSnapshot(row.streak),
        import: parseImport(row.import),
      };
    },
  };
}
