import { AccountFault } from "./accountRepository.ts";
import type { AccountLog } from "./accountService.ts";
import { requireFields } from "./accountRequests.ts";
import {
  type StreakAuth,
  StreakFault,
  type StreakGuestCandidate,
  type StreakRepository,
} from "./streakRepository.ts";
import {
  prepareFreshAccountComputerGame,
  prepareParticipantAdoption,
  prepareRestartSource,
} from "./streakPreparation.ts";
import { tokenDigest } from "./tokens.ts";
import { MAX_GAME_ID_ALLOCATION_ATTEMPTS } from "../routes/game_id_allocation.ts";
import { getPersistedStateRevisionToken } from "../routes/state_revision.ts";
import type { TimeControlConfig } from "../engine/clock/clock.ts";

export interface StreakRouteOptions {
  getRepository?: () => Promise<StreakRepository>;
  log?: AccountLog;
}
export interface AccountStreakDependencies extends StreakRouteOptions {
  loadGame: (gameId: string) => Promise<any>;
}

export function streakRevision(
  value: unknown,
  field = "expectedRevision",
): string {
  if (
    typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value) ||
    BigInt(value) > 9223372036854775807n
  ) throw new AccountFault("INVALID_REQUEST", field);
  return value;
}

export async function streakRequestAuth(
  c: any,
  sessionId: string,
): Promise<StreakAuth> {
  const raw = c.req.header("X-Account-Token");
  if (raw === undefined) throw new AccountFault("ACCOUNT_TOKEN_REQUIRED");
  return { tokenHash: await tokenDigest(raw), sessionId };
}

export async function streakCall<T>(
  options: StreakRouteOptions,
  work: (repository: StreakRepository) => Promise<T>,
): Promise<T> {
  try {
    if (!options.getRepository) {
      throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
    }
    return await work(await options.getRepository());
  } catch (error) {
    if (error instanceof AccountFault) throw error;
    if (error instanceof StreakFault) throw new AccountFault(error.code);
    throw new AccountFault("ACCOUNT_SERVICE_UNAVAILABLE");
  }
}

export async function handleAccountStreak(
  options: AccountStreakDependencies,
  route: string,
  body: Record<string, unknown>,
  auth: StreakAuth,
): Promise<object> {
  requireFields(
    body,
    route === "streak/state"
      ? []
      : route === "streak/reset"
      ? ["expectedRevision"]
      : ["expectedRevision", "decision", "guest"],
  );
  const expectedRevision = route === "streak/state"
    ? undefined
    : streakRevision(body.expectedRevision);
  let guest: StreakGuestCandidate;
  if (route === "streak/import") {
    const candidate = body.guest;
    if (
      !candidate || typeof candidate !== "object" || Array.isArray(candidate)
    ) {
      throw new AccountFault("INVALID_REQUEST", "guest");
    }
    const row = candidate as Record<string, unknown>;
    requireFields(row, [
      "currentCount",
      "anchorGameId",
      "humanPlayerId",
      "resultPending",
    ]);
    if (
      !Number.isSafeInteger(row.currentCount) ||
      (row.currentCount as number) < 0 ||
      typeof row.anchorGameId !== "string" || !row.anchorGameId.length ||
      typeof row.humanPlayerId !== "string" || !row.humanPlayerId.length ||
      typeof row.resultPending !== "boolean" ||
      (body.decision !== "compare" && body.decision !== "decline")
    ) throw new AccountFault("INVALID_REQUEST", "guest");
    guest = row as unknown as StreakGuestCandidate;
  }
  return await streakCall(options, async (repository) => {
    if (route === "streak/state") {
      return { streak: await repository.reconcile(auth) };
    }
    if (route === "streak/reset") {
      return {
        streak: await repository.reset({
          ...auth,
          expectedRevision: expectedRevision!,
        }),
      };
    }
    let adoption = null;
    if (guest.humanPlayerId === auth.sessionId) {
      const anchor = await options.loadGame(guest.anchorGameId);
      const human = Array.isArray(anchor?.players)
        ? anchor.players.find((p: any) =>
          p?.id === auth.sessionId && p?.role === "player"
        )
        : undefined;
      if (
        anchor?.gameId === guest.anchorGameId && anchor.status === "active" &&
        human && human.accountId == null &&
        anchor.controllersByPlayerId?.[auth.sessionId]?.kind === "human"
      ) {
        const snapshot = await repository.reconcile(auth);
        adoption = prepareParticipantAdoption(
          anchor,
          auth.sessionId,
          snapshot.accountId,
        );
      }
    }
    return await repository.importGuest({
      ...auth,
      expectedRevision: expectedRevision!,
      decision: body.decision as "compare" | "decline",
      guest,
      adoption,
    });
  });
}

/** Only ID collisions on fresh allocations are retryable. */
export async function commitAccountComputerGame(
  options: StreakRouteOptions,
  input: {
    auth: StreakAuth;
    expectedRevision: string;
    action: "create" | "rematch" | "restart";
    displayName: string;
    timeControl: TimeControlConfig | null;
    generateGameId: () => string;
    sourceState?: any;
    fixedGameId?: string;
    completedReplay?: boolean;
  },
): Promise<{ status: "committed"; gameId: string } | { status: "exhausted" }> {
  return await streakCall(options, async (repository) => {
    const snapshot = await repository.reconcile(input.auth);
    const tracked = snapshot.trackedGame;
    const count = input.action === "restart" || (tracked &&
        ["unfinished", "restart_pending"].includes(tracked.status) &&
        tracked.humanPlayerId === input.auth.sessionId)
      ? 0
      : snapshot.currentCount;
    const attempts = input.fixedGameId !== undefined
      ? 1
      : MAX_GAME_ID_ALLOCATION_ATTEMPTS;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const gameId = input.fixedGameId ?? input.generateGameId();
      const prepared = prepareFreshAccountComputerGame({
        gameId,
        sessionId: input.auth.sessionId,
        displayName: input.displayName,
        accountId: snapshot.accountId,
        currentCount: count,
        timeControl: input.timeControl,
        ...(input.action === "restart"
          ? { restartSourceGameId: input.sourceState.gameId }
          : {}),
      });
      let source = null;
      if (input.sourceState) {
        const token = getPersistedStateRevisionToken(input.sourceState);
        if (token.kind === "invalid") throw new StreakFault("STREAK_CONFLICT");
        source = input.action === "restart" && !input.completedReplay
          ? prepareRestartSource(input.sourceState, gameId)
          : {
            gameId: input.sourceState.gameId,
            expectedRevision: token.kind === "valid" ? token.revision : null,
            update: null,
          };
      }
      const result = await repository.commitGame({
        ...input.auth,
        expectedRevision: input.expectedRevision,
        action: input.action,
        ...prepared,
        source,
      });
      if (result.status === "committed") {
        return { status: "committed", gameId: result.gameId };
      }
      if (input.fixedGameId !== undefined) {
        throw new StreakFault("STREAK_CONFLICT");
      }
    }
    return { status: "exhausted" };
  });
}

/** Called only after a successful terminal write; never gates the game response. */
export async function settleAccountComputerGame(
  options: StreakRouteOptions,
  c: any,
  state: any,
  sessionId: string,
): Promise<void> {
  try {
    const human = state?.players?.find((p: any) =>
      p?.id === sessionId && p?.role === "player" && p?.accountId
    );
    if (
      state?.status !== "finished" || !human || state.players.length !== 2 ||
      state.controllersByPlayerId?.[sessionId]?.kind !== "human" ||
      !state.players.some((p: any) =>
        p.id !== sessionId &&
        p.role === "player" &&
        state.controllersByPlayerId?.[p.id]?.kind === "bot"
      )
    ) return;
    const auth = await streakRequestAuth(c, sessionId);
    await streakCall(options, (repository) => repository.reconcile(auth));
  } catch (error) {
    try {
      options.log?.(
        "streak-settlement",
        error instanceof AccountFault
          ? error.code
          : "ACCOUNT_SERVICE_UNAVAILABLE",
      );
    } catch { /* Safe logging cannot change a committed action. */ }
  }
}
