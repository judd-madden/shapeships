import assert from "node:assert/strict";
import { Hono } from "npm:hono";
import { registerGameRoutes } from "../../routes/game_routes.ts";
import type {
  ConditionalWriteResult,
  IntentPersistence,
} from "../../routes/intent_persistence.ts";

type GameRoutePersistence = Pick<
  IntentPersistence,
  "load" | "conditionalUpdate" | "insertIfMissing"
>;

class ScriptedGamePersistence implements GameRoutePersistence {
  readonly store = new Map<string, any>();
  readonly writes: Array<{ key: string; value: any }> = [];
  readonly conflictReplacementStates: any[] = [];
  conditionalAttempts = 0;

  async load(key: string) {
    if (!this.store.has(key)) return { status: "missing" as const };
    return {
      status: "found" as const,
      value: structuredClone(this.store.get(key)),
    };
  }

  async conditionalUpdate(
    args: Parameters<IntentPersistence["conditionalUpdate"]>[0],
  ): Promise<ConditionalWriteResult> {
    this.conditionalAttempts += 1;
    const replacement = this.conflictReplacementStates.shift();
    if (replacement) {
      this.store.set(args.key, structuredClone(replacement));
      return { status: "conflict" };
    }

    const current = this.store.get(args.key);
    if (!current) return { status: "conflict" };
    const hasRevision = Object.prototype.hasOwnProperty.call(
      current,
      args.revisionField,
    );
    const matches = args.expected.kind === "missing"
      ? !hasRevision
      : args.expected.kind === "valid" &&
        current[args.revisionField] === args.expected.revision;
    if (!matches) return { status: "conflict" };

    const value = structuredClone(args.value);
    this.store.set(args.key, value);
    this.writes.push({ key: args.key, value });
    return { status: "updated" };
  }

  async insertIfMissing(
    key: string,
    value: any,
  ): Promise<ConditionalWriteResult> {
    if (this.store.has(key)) return { status: "conflict" };
    const copy = structuredClone(value);
    this.store.set(key, copy);
    this.writes.push({ key, value: copy });
    return { status: "updated" };
  }
}

function createTimedState(args: {
  gameId: string;
  revision: number;
  remainingP1?: number;
  remainingP2?: number;
  lastUpdateAtMs?: number;
}): any {
  return {
    gameId: args.gameId,
    status: "active",
    stateRevision: args.revision,
    currentPhase: "build",
    currentSubPhase: "dice_roll",
    turnNumber: 1,
    players: [
      {
        id: "p1",
        name: "One",
        role: "player",
        faction: "human",
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: "p2",
        name: "Two",
        role: "player",
        faction: "xenite",
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 1,
      currentPhase: "build",
      currentSubPhase: "dice_roll",
      phaseReadiness: [],
      pendingDrawOffer: { offeredByPlayerId: "p2" },
      drawAgreement: { offeredByPlayerId: "p2" },
      ships: { p1: [], p2: [] },
      turnData: {
        turnNumber: 1,
        currentMajorPhase: "build",
        currentSubPhase: "dice_roll",
        commitments: {},
      },
      clock: {
        timeControl: { baseMs: 300_000, incrementMs: 3_000 },
        remainingMsByPlayerId: {
          p1: args.remainingP1 ?? 1,
          p2: args.remainingP2 ?? 1_000,
        },
        lastUpdateAtMs: args.lastUpdateAtMs ?? 0,
        incrementAppliedTurnByPlayerId: {},
      },
    },
    battleLogScratch: {
      currentTurnCapture: { turnNumber: 1, marker: "unchanged" },
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
    actions: [],
  };
}

function createFixture(state: any) {
  const persistence = new ScriptedGamePersistence();
  const gameKey = `game_${state.gameId}`;
  persistence.store.set(gameKey, structuredClone(state));
  const kvSetWrites: Array<{ key: string; value: any }> = [];
  const app = new Hono();
  registerGameRoutes(
    app,
    async (key) => structuredClone(persistence.store.get(key)),
    async (key, value) => {
      const copy = structuredClone(value);
      persistence.store.set(key, copy);
      kvSetWrites.push({ key, value: copy });
    },
    async () => ({ sessionId: "p1" }),
    () => "unused",
    persistence,
  );
  return { app, persistence, gameKey, kvSetWrites };
}

function headUrl(gameId: string): string {
  return `/make-server-825e19ab/game-state-head/${gameId}`;
}

function fullUrl(gameId: string): string {
  return `/make-server-825e19ab/game-state/${gameId}`;
}

Deno.test("stale timeout CAS reloads N+1 and recomputes the terminal result", async () => {
  const gameId = "timeout-race-recomputed";
  const fixture = createFixture(createTimedState({ gameId, revision: 5 }));
  const replacement = createTimedState({
    gameId,
    revision: 6,
    remainingP1: 1_000,
    remainingP2: 1,
  });
  replacement.authoritativeMutationMarker = "accepted-at-revision-6";
  replacement.gameData.phaseReadiness = [{
    playerId: "p1",
    isReady: true,
    currentStep: "build.dice_roll",
  }];
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await fixture.app.request(headUrl(gameId));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "finished");
  assert.equal(body.stateRevision, 7);
  assert.equal(fixture.persistence.conditionalAttempts, 2);
  assert.equal(fixture.persistence.writes.length, 1);
  assert.equal(fixture.kvSetWrites.length, 0);

  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.stateRevision, 7);
  assert.equal(stored.authoritativeMutationMarker, "accepted-at-revision-6");
  assert.equal(stored.timeoutLoserId, "p2");
  assert.equal(stored.winnerPlayerId, "p1");
  assert.equal(
    stored.actions.filter((action: any) =>
      action.content?.includes("Game ended by timeout")
    ).length,
    1,
  );
});

Deno.test("stale timeout CAS returns fresh N+1 when it no longer qualifies", async () => {
  const gameId = "timeout-race-no-longer-expired";
  const fixture = createFixture(createTimedState({ gameId, revision: 5 }));
  const replacement = createTimedState({
    gameId,
    revision: 6,
    remainingP1: 1_000_000,
    remainingP2: 1_000_000,
    lastUpdateAtMs: Date.now(),
  });
  replacement.authoritativeMutationMarker = "fresh-active-state";
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await fixture.app.request(headUrl(gameId));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "active");
  assert.equal(body.stateRevision, 6);
  assert.equal(fixture.persistence.conditionalAttempts, 1);
  assert.equal(fixture.persistence.writes.length, 0);
  assert.equal(fixture.kvSetWrites.length, 0);
  assert.deepEqual(fixture.persistence.store.get(fixture.gameKey), replacement);
});

Deno.test("expired timeout persists once across repeated head and full polling", async () => {
  const gameId = "timeout-once";
  const fixture = createFixture(createTimedState({ gameId, revision: 5 }));

  const first = await fixture.app.request(headUrl(gameId));
  const second = await fixture.app.request(headUrl(gameId));
  const full = await fixture.app.request(fullUrl(gameId));
  const firstBody = await first.json();
  const fullBody = await full.json();

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(full.status, 200);
  assert.equal(firstBody.status, "finished");
  assert.equal(firstBody.stateRevision, 6);
  assert.equal(fullBody.status, "finished");
  assert.equal(fullBody.stateRevision, 6);
  assert.equal(fixture.persistence.conditionalAttempts, 1);
  assert.equal(fixture.persistence.writes.length, 1);
  assert.equal(fixture.kvSetWrites.length, 0);
  assert.equal(
    fixture.persistence.store.has(`game_history_${gameId}`),
    false,
  );

  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.status, "finished");
  assert.equal(stored.stateRevision, 6);
  assert.equal(stored.result, "win");
  assert.equal(stored.resultReason, "timeout");
  assert.equal(stored.endReason, "timeout");
  assert.equal(stored.timeoutLoserId, "p1");
  assert.equal(stored.winnerPlayerId, "p2");
  assert.equal(stored.gameData.clock.remainingMsByPlayerId.p1, 0);
  assert.equal(stored.gameData.pendingDrawOffer, null);
  assert.equal(stored.gameData.drawAgreement, null);
  assert.deepEqual(stored.battleLogScratch, {
    currentTurnCapture: { turnNumber: 1, marker: "unchanged" },
    lastFinalizedTurnNumber: null,
    archiveCheckpoint: null,
  });
  assert.equal(stored.actions.length, 1);
});

Deno.test("three timeout CAS conflicts return 409 without a stale state payload", async () => {
  const gameId = "timeout-conflict-exhaustion";
  const fixture = createFixture(createTimedState({ gameId, revision: 5 }));
  for (const revision of [6, 7, 8]) {
    const replacement = createTimedState({ gameId, revision });
    replacement.authoritativeMutationMarker = `revision-${revision}`;
    fixture.persistence.conflictReplacementStates.push(replacement);
  }

  const response = await fixture.app.request(headUrl(gameId));
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.deepEqual(body, {
    error: "Game changed during timeout finalization; retry the request",
  });
  assert.equal("state" in body, false);
  assert.equal(fixture.persistence.conditionalAttempts, 3);
  assert.equal(fixture.persistence.writes.length, 0);
  assert.equal(fixture.kvSetWrites.length, 0);
  assert.equal(
    fixture.persistence.store.get(fixture.gameKey).authoritativeMutationMarker,
    "revision-8",
  );
  assert.equal(fixture.persistence.store.get(fixture.gameKey).stateRevision, 8);
});
