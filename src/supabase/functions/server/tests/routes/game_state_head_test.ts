import assert from "node:assert/strict";
import { Hono } from "npm:hono";
import {
  parsePersistedGameStateHead,
  type PersistedGameStateHeadV1,
  projectGameStateHead,
  projectStoredGameStateHeadResponse,
} from "../../routes/game_state_head.ts";
import { registerGameRoutes } from "../../routes/game_routes.ts";
import type {
  ConditionalWriteResult,
  GameStatePersistence,
} from "../../routes/intent_persistence.ts";

function createState(args: {
  gameId?: string;
  revision?: number;
  clock?: boolean;
  remainingP1?: number;
  remainingP2?: number;
  lastUpdateAtMs?: number;
}) {
  return {
    gameId: args.gameId ?? "head-game",
    stateRevision: args.revision ?? 5,
    status: "active",
    turnNumber: 2,
    currentPhase: "setup",
    currentSubPhase: "species_selection",
    players: [
      {
        id: "p1",
        name: "One",
        role: "player",
        faction: "human",
        privateDeclaration: { secret: true },
      },
      { id: "p2", name: "Two", role: "player", faction: "xenite" },
      { id: "watcher", name: "Watcher", role: "spectator", faction: null },
    ],
    gameData: {
      turnNumber: 2,
      currentPhase: "build",
      currentSubPhase: "drawing",
      phaseReadiness: [{ playerId: "p2", isReady: true, private: "omit" }],
      ships: { p1: [{ instanceId: "secret-ship" }], p2: [] },
      turnData: {
        currentMajorPhase: "battle",
        currentSubPhase: "reveal",
        commitments: { SECRET: { p1: "hidden" } },
      },
      ...(args.clock
        ? {
          clock: {
            timeControl: { baseMs: 1_000, incrementMs: 10 },
            remainingMsByPlayerId: {
              p1: args.remainingP1 ?? 500,
              p2: args.remainingP2 ?? 800,
            },
            lastUpdateAtMs: args.lastUpdateAtMs ?? 1_000,
            incrementAppliedTurnByPlayerId: { p1: 2 },
          },
        }
        : {}),
    },
    actions: [{ content: "private action" }],
    battleLogScratch: { private: true },
    missionChallengeAssignment: {
      introPending: false,
      missionId: "private-mission",
      challenge: { secret: true },
    },
  };
}

function requireProjectedHead(state: unknown): PersistedGameStateHeadV1 {
  const projected = projectGameStateHead(state);
  assert.equal(projected.ok, true);
  return projected.head;
}

class HeadRoutePersistence implements GameStatePersistence {
  readonly states = new Map<string, any>();
  readonly heads = new Map<string, PersistedGameStateHeadV1 | null>();
  fullLoadCount = 0;
  headLoadCount = 0;
  canonicalWriteCount = 0;
  headFillCount = 0;
  conflictBeforeNextFill = false;

  async load(key: string) {
    this.fullLoadCount += 1;
    if (!this.states.has(key)) return { status: "missing" as const };
    return {
      status: "found" as const,
      value: structuredClone(this.states.get(key)),
    };
  }

  async loadGameHead(key: string) {
    this.headLoadCount += 1;
    if (!this.states.has(key)) return { status: "missing" as const };
    return {
      status: "found" as const,
      value: structuredClone(this.heads.get(key) ?? null),
    };
  }

  async conditionalUpdate(
    args: Parameters<GameStatePersistence["conditionalUpdate"]>[0],
  ): Promise<ConditionalWriteResult> {
    const current = this.states.get(args.key);
    if (!current) return { status: "conflict" };
    const matches = args.expected.kind === "missing"
      ? !Object.prototype.hasOwnProperty.call(current, args.revisionField)
      : args.expected.kind === "valid" &&
        current[args.revisionField] === args.expected.revision;
    if (!matches) return { status: "conflict" };
    const projected = projectGameStateHead(args.value);
    if (!projected.ok) {
      return { status: "error", error: { message: projected.error } };
    }
    this.states.set(args.key, structuredClone(args.value));
    this.heads.set(args.key, structuredClone(projected.head));
    this.canonicalWriteCount += 1;
    return { status: "updated" };
  }

  async insertIfMissing(
    key: string,
    value: any,
  ): Promise<ConditionalWriteResult> {
    if (this.states.has(key)) return { status: "conflict" };
    const projected = projectGameStateHead(value);
    if (!projected.ok) {
      return { status: "error", error: { message: projected.error } };
    }
    this.states.set(key, structuredClone(value));
    this.heads.set(key, structuredClone(projected.head));
    return { status: "updated" };
  }

  async conditionalUpdateGameHead(
    args: Parameters<GameStatePersistence["conditionalUpdateGameHead"]>[0],
  ): Promise<ConditionalWriteResult> {
    this.headFillCount += 1;
    const current = this.states.get(args.key);
    if (!current) return { status: "conflict" };
    if (this.conflictBeforeNextFill) {
      current.stateRevision += 1;
      this.conflictBeforeNextFill = false;
    }
    if (current.stateRevision !== args.expectedStateRevision) {
      return { status: "conflict" };
    }
    this.heads.set(args.key, structuredClone(args.gameHead));
    return { status: "updated" };
  }
}

function createRouteFixture(
  state: any,
  storedHead: PersistedGameStateHeadV1 | null,
) {
  const persistence = new HeadRoutePersistence();
  const key = `game_${state.gameId}`;
  persistence.states.set(key, structuredClone(state));
  persistence.heads.set(key, structuredClone(storedHead));
  let sessionId = "p1";
  const app = new Hono();
  registerGameRoutes(
    app,
    async (sideKey) => structuredClone(persistence.states.get(sideKey)),
    async (sideKey, value) => {
      persistence.states.set(sideKey, structuredClone(value));
    },
    async () => ({ sessionId }),
    () => "unused",
    persistence,
  );
  return {
    app,
    key,
    persistence,
    setSessionId(value: string) {
      sessionId = value;
    },
  };
}

function headUrl(gameId: string): string {
  return `/make-server-825e19ab/game-state-head/${gameId}`;
}

Deno.test("game-head projector is compact and follows synchronized phase precedence", () => {
  const state = createState({ clock: true });
  const head = requireProjectedHead(state);

  assert.deepEqual(Object.keys(head), [
    "schemaVersion",
    "gameId",
    "stateRevision",
    "status",
    "turnNumber",
    "phaseKey",
    "participants",
    "clockInputs",
  ]);
  assert.equal(head.phaseKey, "build.drawing");
  assert.deepEqual(head.participants[0], {
    id: "p1",
    role: "player",
    faction: "human",
  });
  assert.deepEqual(head.clockInputs?.phaseReadiness, [{
    playerId: "p2",
    isReady: true,
  }]);
  const serialized = JSON.stringify(head);
  for (
    const forbidden of [
      "secret-ship",
      "private action",
      "private-mission",
      "commitments",
      "timeControl",
      "incrementAppliedTurnByPlayerId",
    ]
  ) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }

  const turnDataOnly = createState({});
  delete (turnDataOnly.gameData as any).currentPhase;
  delete (turnDataOnly.gameData as any).currentSubPhase;
  assert.equal(requireProjectedHead(turnDataOnly).phaseKey, "battle.reveal");

  const legacyOnly = createState({});
  delete (legacyOnly.gameData as any).currentPhase;
  delete (legacyOnly.gameData as any).currentSubPhase;
  delete (legacyOnly.gameData.turnData as any).currentMajorPhase;
  delete (legacyOnly.gameData.turnData as any).currentSubPhase;
  assert.equal(
    requireProjectedHead(legacyOnly).phaseKey,
    "setup.species_selection",
  );

  Reflect.deleteProperty(legacyOnly, "currentPhase");
  Reflect.deleteProperty(legacyOnly, "currentSubPhase");
  assert.equal(requireProjectedHead(legacyOnly).phaseKey, "unknown");
});

Deno.test("stored head parser rejects unsupported, malformed, and mismatched heads", () => {
  const head = requireProjectedHead(createState({}));
  assert.ok(parsePersistedGameStateHead(head, head.gameId));
  assert.equal(
    parsePersistedGameStateHead({ ...head, schemaVersion: 2 }, head.gameId),
    null,
  );
  assert.equal(
    parsePersistedGameStateHead({ ...head, participants: null }, head.gameId),
    null,
  );
  assert.equal(
    parsePersistedGameStateHead(
      { ...head, phaseKey: "invalid.phase" },
      head.gameId,
    ),
    null,
  );
  assert.equal(parsePersistedGameStateHead(head, "different-game"), null);
});

Deno.test("compact clock projection preserves running, ready, paused, untimed, and timeout behavior", () => {
  const runningHead = requireProjectedHead(createState({ clock: true }));
  const running = projectStoredGameStateHeadResponse(runningHead, 1_100);
  assert.equal(running.possibleTimeout, false);
  assert.deepEqual(running.response.clock, {
    remainingMsByPlayerId: { p1: 400, p2: 800 },
    clocksAreLive: true,
    serverNowMs: 1_100,
  });

  const pausedState = createState({ clock: true });
  (pausedState.gameData.turnData as any).phaseHold = {
    phaseKey: "setup.species_selection",
    holdReason: "matchup_intro",
  };
  const paused = projectStoredGameStateHeadResponse(
    requireProjectedHead(pausedState),
    1_100,
  );
  assert.deepEqual(paused.response.clock?.remainingMsByPlayerId, {
    p1: 500,
    p2: 800,
  });
  assert.equal(paused.response.clock?.clocksAreLive, false);

  const untimed = projectStoredGameStateHeadResponse(
    requireProjectedHead(createState({})),
    1_100,
  );
  assert.equal(untimed.response.clock, null);

  const legacyTurnState = createState({ clock: true });
  legacyTurnState.turnNumber = 0;
  const legacyTurnHead = requireProjectedHead(legacyTurnState);
  assert.equal(legacyTurnHead.turnNumber, 2);
  assert.equal(legacyTurnHead.clockInputs?.clockTurnNumber, 0);
  const legacyTurn = projectStoredGameStateHeadResponse(
    legacyTurnHead,
    1_100,
  );
  assert.equal(legacyTurn.response.clock?.clocksAreLive, false);
  assert.deepEqual(legacyTurn.response.clock?.remainingMsByPlayerId, {
    p1: 500,
    p2: 800,
  });

  const timeout = projectStoredGameStateHeadResponse(
    requireProjectedHead(createState({ clock: true, remainingP1: 50 })),
    1_100,
  );
  assert.equal(timeout.possibleTimeout, true);
});

Deno.test("valid player and spectator head polls use only the compact loader", async () => {
  const state = createState({});
  const fixture = createRouteFixture(state, requireProjectedHead(state));

  const player = await fixture.app.request(headUrl(state.gameId));
  assert.equal(player.status, 200);
  assert.deepEqual(Object.keys(await player.json()), [
    "gameId",
    "stateRevision",
    "status",
    "turnNumber",
    "phaseKey",
    "clock",
  ]);

  fixture.setSessionId("watcher");
  const spectator = await fixture.app.request(headUrl(state.gameId));
  assert.equal(spectator.status, 200);
  assert.equal(fixture.persistence.headLoadCount, 2);
  assert.equal(fixture.persistence.fullLoadCount, 0);
  assert.equal(fixture.persistence.headFillCount, 0);

  fixture.setSessionId("stranger");
  const forbidden = await fixture.app.request(headUrl(state.gameId));
  assert.equal(forbidden.status, 403);
  assert.equal(fixture.persistence.fullLoadCount, 0);
});

Deno.test("legacy null head falls back, self-heals, and then uses the compact path", async () => {
  const state = createState({});
  const fixture = createRouteFixture(state, null);

  const first = await fixture.app.request(headUrl(state.gameId));
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.stateRevision, state.stateRevision);
  assert.equal(fixture.persistence.fullLoadCount, 1);
  assert.equal(fixture.persistence.headFillCount, 1);
  assert.ok(fixture.persistence.heads.get(fixture.key));

  const second = await fixture.app.request(headUrl(state.gameId));
  assert.equal(second.status, 200);
  assert.equal(fixture.persistence.fullLoadCount, 1);
});

Deno.test("a stale lazy fill conflict does not rewrite canonical state or corrupt the response", async () => {
  const state = createState({});
  const fixture = createRouteFixture(state, null);
  fixture.persistence.conflictBeforeNextFill = true;

  const response = await fixture.app.request(headUrl(state.gameId));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.stateRevision, state.stateRevision);
  assert.equal(
    fixture.persistence.states.get(fixture.key).stateRevision,
    state.stateRevision + 1,
  );
  assert.equal(fixture.persistence.heads.get(fixture.key), null);
  assert.equal(fixture.persistence.canonicalWriteCount, 0);
});

Deno.test("a compact possible timeout falls back to authoritative CAS finalization", async () => {
  const state = createState({
    gameId: "head-timeout",
    clock: true,
    remainingP1: 1,
    remainingP2: 10_000,
    lastUpdateAtMs: 0,
  });
  const fixture = createRouteFixture(state, requireProjectedHead(state));

  const response = await fixture.app.request(headUrl(state.gameId));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "finished");
  assert.equal(body.stateRevision, state.stateRevision + 1);
  assert.equal(fixture.persistence.fullLoadCount, 1);
  assert.equal(fixture.persistence.canonicalWriteCount, 1);
  assert.equal(
    fixture.persistence.states.get(fixture.key).resultReason,
    "timeout",
  );
});
