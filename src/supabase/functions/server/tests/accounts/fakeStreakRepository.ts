import { AccountFault } from "../../accounts/accountRepository.ts";
import {
  type AccountStreakSnapshot,
  type PreparedGameRow,
  type StreakAuth,
  type StreakCommitInput,
  type StreakCommitResult,
  StreakFault,
  type StreakImportInput,
  type StreakImportOutcome,
  type StreakImportResult,
  type StreakRepository,
  type StreakSource,
} from "../../accounts/streakRepository.ts";
import { FakeAccountRepository } from "./fakeAccountRepository.ts";
import { isDeepStrictEqual } from "node:util";

type Row = {
  key: string;
  value: any;
  game_head?: PreparedGameRow["game_head"];
};
export interface FakeStreakImport extends StreakImportOutcome {
  accountId: string | null;
  humanPlayerId: string;
  sourceSessionId: string | null;
  reportedCount: number;
  evidenceKind: "direct_session" | "stored_anchor";
  anchorStateRevision: number;
}
class GameIdTaken extends Error {}
const conflict = (): never => {
  throw new StreakFault("STREAK_CONFLICT");
};
const invalid = (): never => {
  throw new StreakFault("STREAK_IMPORT_UNVERIFIED");
};
const forbidden = (): never => {
  throw new StreakFault("STREAK_SEAT_FORBIDDEN");
};
const consumed = (): never => {
  throw new StreakFault("STREAK_IMPORT_CONSUMED");
};
const equal = isDeepStrictEqual;
const hashKey = (hash: Uint8Array) =>
  Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");

// Local write journal: a failed transaction never restores an old whole-store copy
// over a different account's committed work.
class Journal {
  writes = new Map<Map<any, any>, Map<any, any>>();
  get<K, V>(map: Map<K, V>, key: K): V | undefined {
    const staged = this.writes.get(map);
    return structuredClone(staged?.has(key) ? staged.get(key) : map.get(key));
  }
  set<K, V>(map: Map<K, V>, key: K, value: V) {
    let staged = this.writes.get(map);
    if (!staged) this.writes.set(map, staged = new Map());
    staged.set(key, structuredClone(value));
  }
  commit() {
    for (const [map, writes] of this.writes) {
      for (const [key, value] of writes) {
        map.set(key, value);
      }
    }
  }
}

/** Contract fake for 22D.2. SQL locks/ACLs still require disposable PostgreSQL acceptance. */
export class FakeStreakRepository implements StreakRepository {
  runs = new Map<string, AccountStreakSnapshot>();
  rows = new Map<string, Row>();
  imports = new Map<string, FakeStreakImport>();
  failAt?: "game" | "history" | "run" | "import" | "adoption" | "commit";
  afterLocks?: () => Promise<void>;
  beforeCommit?: () => Promise<void>;
  beforeGameInsert?: (key: string) => Promise<void>;
  beforeAnchorInsert?: (key: string) => Promise<void>;
  lockLog: string[] = [];
  #locks = new Map<string, Promise<void>>();
  #next = 0;
  constructor(readonly authority = new FakeAccountRepository()) {}
  #id() {
    return "00000000-0000-4000-9000-" +
      (++this.#next).toString().padStart(12, "0");
  }
  #step(point: typeof this.failAt) {
    if (this.failAt === point) {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
  }
  async #lock(key: string, release: Array<() => void>) {
    const previous = this.#locks.get(key) ?? Promise.resolve();
    const gate = Promise.withResolvers<void>();
    this.#locks.set(key, gate.promise);
    await previous;
    this.lockLog.push(key);
    release.push(() => {
      gate.resolve();
      if (this.#locks.get(key) === gate.promise) this.#locks.delete(key);
    });
  }
  async #auth(input: StreakAuth) {
    await this.authority.getPreferences(input.tokenHash); // existing strict account/name error mapping
    const token = [...this.authority.tokens.values()].find((t) =>
      t.hash === hashKey(input.tokenHash)
    );
    const link = this.authority.links.get(input.sessionId);
    if (
      !token || !link || link.detached !== null || link.tokenId !== token.id ||
      link.accountId !== token.accountId
    ) throw new AccountFault("ACCOUNT_TOKEN_INVALID");
    return token;
  }
  async #transaction<T>(
    input: StreakAuth,
    ids: string[],
    work: (tx: Journal, run: AccountStreakSnapshot) => T | Promise<T>,
  ): Promise<T> {
    const initial = [...this.authority.tokens.values()].find((t) =>
      t.hash === hashKey(input.tokenHash)
    );
    if (!initial) throw new AccountFault("ACCOUNT_TOKEN_INVALID");
    const release: Array<() => void> = [];
    try {
      for (
        const key of [
          `account:${initial.accountId}`,
          `token:${initial.id}`,
          `link:${input.sessionId}`,
          `run:${initial.accountId}`,
        ]
      ) await this.#lock(key, release);
      const token = await this.#auth(input);
      const tx = new Journal();
      const run = tx.get(this.runs, token.accountId) ??
        {
          accountId: token.accountId,
          runId: this.#id(),
          currentCount: 0,
          revision: "1",
          trackedGame: null,
          endedStreak: null,
          updatedAt: new Date(this.authority.now).toISOString(),
        };
      const gameIds = [
        ...ids,
        ...(run.trackedGame ? [run.trackedGame.gameId] : []),
      ];
      for (const id of ids) {
        const source = this.rows.get(`game_${id}`)?.value;
        if (source?.winStreakRestart?.replacementGameId) {
          gameIds.push(source.winStreakRestart.replacementGameId);
        }
      }
      for (const id of [...new Set(gameIds)].sort()) {
        await this.#lock(`game:${id}`, release);
      }
      await this.afterLocks?.();
      await this.#auth(input);
      this.#reconcile(tx, run);
      const result = await work(tx, run);
      tx.set(this.runs, run.accountId, run);
      await this.beforeCommit?.();
      await this.#auth(input);
      this.#step("commit");
      tx.commit();
      return structuredClone(result);
    } finally {
      for (const unlock of release.reverse()) unlock();
    }
  }
  #load(tx: Journal, id: string) {
    const game = tx.get(this.rows, `game_${id}`)?.value;
    if (!game) throw new StreakFault("STREAK_GAME_NOT_FOUND");
    if (game.gameId !== id) invalid();
    return game;
  }
  #evidence(game: any, humanId: string) {
    if (!Array.isArray(game.players) || game.players.length !== 2) invalid();
    const human = game.players.find((p: any) =>
      p?.id === humanId && p?.role === "player"
    );
    const bot = game.players.find((p: any) =>
      p?.id === `bot_${game.gameId}` && p?.role === "player"
    );
    const bonus = game.gameData?.winStreakBonus;
    if (
      !human || !bot || human.id === bot.id ||
      game.controllersByPlayerId?.[humanId]?.kind !== "human" ||
      game.controllersByPlayerId?.[bot.id]?.kind !== "bot" ||
      bonus?.recipientPlayerId !== bot.id ||
      !Number.isSafeInteger(bonus?.appliedCount) || bonus.appliedCount < 0 ||
      !["active", "finished"].includes(game.status) ||
      (Object.hasOwn(game, "stateRevision") &&
        (!Number.isSafeInteger(game.stateRevision) || game.stateRevision < 1))
    ) invalid();
    let outcome: "win" | "loss" | "draw" | "restart" | null = null;
    if (game.status === "finished") {
      if (game.resultReason === "restart") outcome = "restart";
      else if (
        ["mutual_destruction", "timeout_draw", "agreement"].includes(
          game.resultReason,
        )
      ) outcome = "draw";
      else if (game.winnerPlayerId === humanId) outcome = "win";
      else if (game.winnerPlayerId === bot.id) outcome = "loss";
      else invalid();
    }
    return { human, bot, bonus: bonus.appliedCount as number, outcome };
  }
  #bump(run: AccountStreakSnapshot) {
    if (BigInt(run.revision) >= 9223372036854775807n) {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
    run.revision = (BigInt(run.revision) + 1n).toString();
    run.updatedAt = new Date(this.authority.now).toISOString();
  }
  #expected(run: AccountStreakSnapshot, expected: string) {
    if (run.revision !== expected) conflict();
  }
  #reconcile(tx: Journal, run: AccountStreakSnapshot) {
    if (run.trackedGame?.status !== "unfinished") return;
    let game: any;
    let evidence: {
      human: any;
      outcome: "win" | "loss" | "draw" | "restart" | null;
    };
    try {
      game = this.#load(tx, run.trackedGame.gameId);
      evidence = this.#evidence(game, run.trackedGame.humanPlayerId);
      if (evidence.human.accountId !== run.accountId) forbidden();
    } catch (error) {
      if (
        !(error instanceof StreakFault) ||
        ![
          "STREAK_GAME_NOT_FOUND",
          "STREAK_IMPORT_UNVERIFIED",
          "STREAK_SEAT_FORBIDDEN",
        ].includes(error.code)
      ) throw error;
      run.trackedGame.status = "retired";
      this.#bump(run);
      return;
    }
    if (!evidence.outcome) return;
    if (evidence.outcome === "win") {
      run.currentCount = Math.min(
        Number.MAX_SAFE_INTEGER,
        run.currentCount + 1,
      );
    }
    if (evidence.outcome === "loss") {
      run.endedStreak = run.currentCount
        ? { count: run.currentCount, endingGameId: game.gameId }
        : null;
      run.currentCount = 0;
    }
    run.trackedGame.status = evidence.outcome === "restart"
      ? "retired"
      : "settled";
    this.#bump(run);
  }
  reconcile(input: StreakAuth) {
    return this.#transaction(input, [], (_tx, run) => run);
  }
  reset(input: StreakAuth & { expectedRevision: string }) {
    return this.#transaction(input, [], (_tx, run) => {
      this.#expected(run, input.expectedRevision);
      run.currentCount = 0;
      run.runId = this.#id();
      run.endedStreak = null;
      if (run.trackedGame) run.trackedGame.status = "retired";
      this.#step("run");
      this.#bump(run);
      return run;
    });
  }
  #source(
    tx: Journal,
    source: StreakSource,
    input: StreakAuth,
    accountId: string,
  ) {
    const state = this.#load(tx, source.gameId);
    const human = state.players?.find((p: any) =>
      p.id === input.sessionId && p.role === "player"
    );
    if (
      !human ||
      state.controllersByPlayerId?.[input.sessionId]?.kind !== "human" ||
      (human.accountId != null && human.accountId !== accountId)
    ) forbidden();
    return state;
  }
  #cas(state: any, source: StreakSource) {
    if (
      source.expectedRevision === null
        ? Object.hasOwn(state, "stateRevision")
        : source.expectedRevision !== state.stateRevision
    ) conflict();
    if (source.update) {
      const { key, value, game_head: head } = source.update;
      if (
        key !== `game_${source.gameId}` || value.gameId !== source.gameId ||
        value.stateRevision !== (state.stateRevision ?? 1) + 1 ||
        head.gameId !== source.gameId ||
        head.stateRevision !== value.stateRevision ||
        head.status !== value.status
      ) conflict();
    }
  }
  async commitGame(input: StreakCommitInput): Promise<StreakCommitResult> {
    try {
      return await this.#transaction(input, [
        input.game.value.gameId,
        ...(input.source ? [input.source.gameId] : []),
      ], async (tx, run) => {
        if (
          !["create", "rematch", "restart"].includes(input.action) ||
          (input.action === "create" && input.source)
        ) conflict();
        let source: any;
        let recovered = false;
        if (input.action !== "create") {
          if (!input.source) throw new StreakFault("STREAK_GAME_NOT_FOUND");
          source = this.#source(tx, input.source, input, run.accountId);
          if (
            input.action === "restart" &&
            source.winStreakRestart?.kind === "source" &&
            source.winStreakRestart?.status === "completed"
          ) {
            const id = source.winStreakRestart.replacementGameId;
            const replacement = this.#load(tx, id);
            const human = replacement.players?.find((p: any) =>
              p.id === input.sessionId && p.accountId === run.accountId
            );
            if (
              replacement.winStreakRestart?.kind !== "replacement" ||
              replacement.winStreakRestart?.sourceGameId !==
                input.source.gameId ||
              !human ||
              replacement.controllersByPlayerId?.[input.sessionId]?.kind !==
                "human"
            ) conflict();
            return { status: "committed" as const, streak: run, gameId: id };
          }
        }
        const id = input.game.value.gameId;
        const existing = tx.get(this.rows, `game_${id}`);
        if (existing) {
          recovered = !!(input.action === "restart" &&
            source?.winStreakRestart?.kind === "source" &&
            source.winStreakRestart.status === "pending" &&
            source.winStreakRestart.replacementGameId === id &&
            existing.value.winStreakRestart?.kind === "replacement" &&
            existing.value.winStreakRestart?.sourceGameId ===
              input.source?.gameId &&
            existing.value.controllersByPlayerId?.[input.sessionId]?.kind ===
              "human" &&
            existing.value.players?.some((p: any) =>
              p.id === input.sessionId && p.accountId === run.accountId
            ));
          const before = this.runs.get(run.accountId)?.trackedGame;
          const selected = before?.gameId === input.source?.gameId &&
            !!before &&
            ["unfinished", "restart_pending"].includes(before.status);
          if (recovered && !selected) {
            return { status: "committed" as const, streak: run, gameId: id };
          }
          if (
            run.trackedGame?.gameId === id &&
            run.trackedGame?.humanPlayerId === input.sessionId &&
            existing.value.players?.some((p: any) =>
              p.id === input.sessionId && p.accountId === run.accountId
            )
          ) return { status: "committed" as const, streak: run, gameId: id };
          if (!recovered) throw new GameIdTaken();
        }
        this.#expected(run, input.expectedRevision);
        const reset = input.action === "restart" ||
          (!!run.trackedGame &&
            ["unfinished", "restart_pending"].includes(
              run.trackedGame.status,
            ) && run.trackedGame.humanPlayerId === input.sessionId);
        const next = reset ? 0 : run.currentCount;
        const { value, game_head: head, key } = input.game;
        const human = value.players?.find((p: any) =>
          p.id === input.sessionId && p.accountId === run.accountId &&
          p.role === "player"
        );
        const bot = value.players?.find((p: any) =>
          p.id === `bot_${id}` && p.role === "player"
        );
        const history = input.history;
        if (
          !id || key !== `game_${id}` || value.stateRevision !== 1 ||
          value.status !== "active" || value.players?.length !== 2 || !human ||
          !bot || human.id === bot.id ||
          value.controllersByPlayerId?.[input.sessionId]?.kind !== "human" ||
          value.controllersByPlayerId?.[bot.id]?.kind !== "bot" ||
          value.gameData?.winStreakBonus?.appliedCount !== next ||
          value.gameData?.winStreakBonus?.recipientPlayerId !== bot.id ||
          head.gameId !== id || head.stateRevision !== value.stateRevision ||
          head.status !== value.status ||
          history.key !== `game_history_${id}` ||
          !equal(history.value, {
            gameId: id,
            revision: 0,
            completedTurnCount: 0,
            turns: [],
            currentTurnCapture: null,
          })
        ) conflict();
        if (input.source) {
          this.#cas(source, input.source);
          if (
            input.action === "rematch" &&
            (source.status !== "finished" ||
              source.resultReason === "restart" ||
              source.winStreakRestart?.kind === "source")
          ) conflict();
          const update = input.source.update;
          if (
            input.action === "restart" &&
            (!update || update.value.status !== "finished" ||
              update.value.resultReason !== "restart" ||
              update.value.winStreakRestart?.kind !== "source" ||
              update.value.winStreakRestart?.status !== "completed" ||
              update.value.winStreakRestart?.replacementGameId !== id ||
              value.winStreakRestart?.kind !== "replacement" ||
              value.winStreakRestart?.sourceGameId !== input.source.gameId)
          ) conflict();
          if (update) {
            if (
              !equal(update.value.players, source.players) ||
              !equal(
                update.value.controllersByPlayerId,
                source.controllersByPlayerId,
              )
            ) conflict();
            tx.set(this.rows, update.key, update);
          }
        }
        await this.beforeGameInsert?.(key);
        if (!recovered) {
          if (this.rows.has(key)) throw new GameIdTaken();
          tx.set(this.rows, key, input.game);
          this.#step("game");
        }
        const existingHistory = tx.get(this.rows, history.key);
        if (
          existingHistory && (!recovered || existingHistory.value.gameId !== id)
        ) conflict();
        if (!existingHistory) tx.set(this.rows, history.key, history);
        this.#step("history");
        run.currentCount = next;
        if (reset) run.runId = this.#id();
        run.trackedGame = {
          gameId: id,
          humanPlayerId: input.sessionId,
          status: "unfinished",
        };
        run.endedStreak = null;
        this.#bump(run);
        this.#step("run");
        return { status: "committed" as const, streak: run, gameId: id };
      });
    } catch (error) {
      if (error instanceof GameIdTaken) return { status: "gameIdTaken" };
      throw error;
    }
  }
  #replay(
    run: AccountStreakSnapshot,
    imported: FakeStreakImport,
  ): StreakImportResult {
    if (imported.accountId !== run.accountId) consumed();
    return {
      streak: run,
      import: {
        anchorGameId: imported.anchorGameId,
        selection: imported.selection,
        acceptedCount: imported.acceptedCount,
        continuation: imported.continuation,
      },
    };
  }
  importGuest(input: StreakImportInput) {
    return this.#transaction(
      input,
      [input.guest.anchorGameId],
      async (tx, run) => {
        const guest = input.guest;
        if (
          !guest.anchorGameId || !guest.humanPlayerId ||
          !Number.isSafeInteger(guest.currentCount) || guest.currentCount < 0 ||
          typeof guest.resultPending !== "boolean" ||
          !["compare", "decline"].includes(input.decision)
        ) invalid();
        const replay = tx.get(this.imports, guest.anchorGameId);
        if (replay) return this.#replay(run, replay);
        const game = this.#load(tx, guest.anchorGameId);
        const { human, bot, bonus, outcome } = this.#evidence(
          game,
          guest.humanPlayerId,
        );
        if (outcome === "restart") invalid();
        if (
          human.accountId != null ||
          [...this.runs.values()].some((r) =>
            r.trackedGame?.gameId === guest.anchorGameId
          )
        ) consumed();
        this.#expected(run, input.expectedRevision);
        const local = guest.resultPending && outcome === "win"
          ? Math.min(Number.MAX_SAFE_INTEGER, guest.currentCount + 1)
          : guest.currentCount;
        const accepted = outcome === "loss" ? 0 : Math.min(
          Number.MAX_SAFE_INTEGER,
          local,
          bonus + (outcome === "win" ? 1 : 0),
        );
        const selection = input.decision === "decline"
          ? "declined"
          : accepted > run.currentCount
          ? "guest"
          : "account";
        const direct = guest.humanPlayerId === input.sessionId;
        const continuation = selection === "guest" && outcome === null && direct
          ? "authorised"
          : "none";
        if (!direct && input.adoption) forbidden();
        if (continuation === "authorised") {
          const adoption = input.adoption;
          if (
            !adoption || adoption.gameId !== guest.anchorGameId ||
            !adoption.update
          ) return conflict();
          this.#cas(game, adoption);
          const update = adoption.update.value;
          const oldOther = { ...game };
          delete oldOther.players;
          delete oldOther.stateRevision;
          const newOther = { ...update };
          delete newOther.players;
          delete newOther.stateRevision;
          if (
            !equal(oldOther, newOther) || update.players?.length !== 2
          ) conflict();
          const newHuman = update.players.find((p: any) => p.id === human.id),
            newBot = update.players.find((p: any) => p.id === bot.id);
          const before = { ...human };
          delete before.accountId;
          const after = { ...newHuman };
          delete after.accountId;
          if (
            !equal(before, after) || newHuman?.accountId !== run.accountId ||
            !equal(newBot, bot)
          ) forbidden();
        }
        await this.beforeAnchorInsert?.(guest.anchorGameId);
        const raced = this.imports.get(guest.anchorGameId);
        if (raced) return this.#replay(run, raced);
        const imported: FakeStreakImport = {
          anchorGameId: guest.anchorGameId,
          accountId: run.accountId,
          humanPlayerId: human.id,
          sourceSessionId: direct ? input.sessionId : null,
          reportedCount: guest.currentCount,
          acceptedCount: accepted,
          evidenceKind: direct ? "direct_session" : "stored_anchor",
          selection,
          continuation,
          anchorStateRevision: game.stateRevision ?? 1,
        };
        tx.set(this.imports, guest.anchorGameId, imported);
        this.#step("import");
        if (continuation === "authorised") {
          tx.set(
            this.rows,
            `game_${guest.anchorGameId}`,
            input.adoption!.update!,
          );
          this.#step("adoption");
        }
        if (selection === "guest") {
          run.currentCount = accepted;
          run.runId = this.#id();
          run.endedStreak = null;
          run.trackedGame = continuation === "authorised"
            ? {
              gameId: guest.anchorGameId,
              humanPlayerId: human.id,
              status: "unfinished",
            }
            : null;
          this.#bump(run);
          this.#step("run");
        }
        return this.#replay(run, imported);
      },
    );
  }
}
