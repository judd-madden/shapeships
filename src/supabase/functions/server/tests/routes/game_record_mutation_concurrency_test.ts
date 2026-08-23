import assert from "node:assert/strict";
import { Hono } from "npm:hono";
import { normalizeAncientGameState } from "../../engine/state/ancientState.ts";
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

type PlayerSpec = {
  id: string;
  role: "player" | "spectator";
  isReady?: boolean;
  health?: number;
};

function createState(args: {
  gameId: string;
  revision: number;
  players?: PlayerSpec[];
  status?: "waiting" | "active" | "finished";
}): any {
  const players = args.players ?? [
    { id: "p1", role: "player" as const },
    { id: "p2", role: "player" as const },
  ];
  const state = {
    gameId: args.gameId,
    status: args.status ?? "active",
    stateRevision: args.revision,
    currentPhase: "build",
    currentSubPhase: "drawing",
    turnNumber: 2,
    players: players.map((player) => ({
      id: player.id,
      name: `Player ${player.id}`,
      role: player.role,
      faction: player.role === "player" ? "human" : null,
      isReady: player.isReady ?? false,
      isActive: player.role === "player",
      health: player.health ?? 25,
      lines: player.role === "player" ? 3 : 0,
      joiningLines: 0,
      joinedAt: "2026-01-01T00:00:00.000Z",
    })),
    controllersByPlayerId: Object.fromEntries(
      players
        .filter((player) => player.role === "player")
        .map((player) => [player.id, { kind: "human" }]),
    ),
    missionChallengeAssignment: {
      missionId: "mission-preserved",
      challengeId: "challenge-preserved",
    },
    gameData: {
      turnNumber: 2,
      currentPhase: "build",
      currentSubPhase: "drawing",
      phaseReadiness: [],
      ships: Object.fromEntries(players.map((player) => [player.id, []])),
      turnData: {
        turnNumber: 2,
        currentMajorPhase: "build",
        currentSubPhase: "drawing",
        commitments: {},
      },
      clock: {
        timeControl: { baseMs: 300_000, incrementMs: 3_000 },
        remainingMsByPlayerId: Object.fromEntries(
          players
            .filter((player) => player.role === "player")
            .map((player) => [player.id, 250_000]),
        ),
        lastUpdateAtMs: 1_000,
        incrementAppliedTurnByPlayerId: {},
      },
    },
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
    actions: [],
  };
  return normalizeAncientGameState(state).state;
}

function createFixture(state: any, sessionId: string) {
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
    async () => ({ sessionId }),
    () => "unused",
    persistence,
  );
  return { app, persistence, gameKey, kvSetWrites };
}

function joinRequest(app: Hono, gameId: string, playerName = "Joining Player") {
  return app.request(`/make-server-825e19ab/join-game/${gameId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerName }),
  });
}

function switchRequest(
  app: Hono,
  gameId: string,
  newRole: "player" | "spectator",
) {
  return app.request(`/make-server-825e19ab/switch-role/${gameId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newRole }),
  });
}

Deno.test("stale join reloads N+1 and preserves unrelated authoritative state", async () => {
  const gameId = "join-gameplay-race";
  const fixture = createFixture(createState({ gameId, revision: 5 }), "p3");
  const replacement = createState({ gameId, revision: 6 });
  replacement.authoritativeMutationMarker = "accepted-at-revision-6";
  replacement.gameData.ships.p1 = [{
    instanceId: "authoritative-ship",
    shipDefId: "SCO",
  }];
  replacement.gameData.clock.remainingMsByPlayerId.p1 = 123_456;
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await joinRequest(fixture.app, gameId, "Late Spectator");
  assert.equal(response.status, 200);
  assert.equal(fixture.persistence.conditionalAttempts, 2);
  assert.equal(fixture.persistence.writes.length, 1);
  assert.equal(fixture.kvSetWrites.length, 0);

  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.stateRevision, 7);
  assert.equal(stored.authoritativeMutationMarker, "accepted-at-revision-6");
  assert.equal(
    stored.players.find((player: any) => player.id === "p3").role,
    "spectator",
  );
  assert.equal(stored.gameData.ships.p1[0].instanceId, "authoritative-ship");
  assert.equal(stored.gameData.clock.remainingMsByPlayerId.p1, 123_456);
  assert.equal(stored.controllersByPlayerId.p1.kind, "human");
  assert.equal(
    stored.missionChallengeAssignment.missionId,
    "mission-preserved",
  );
});

Deno.test("join recomputes last-seat assignment after a competing join", async () => {
  const gameId = "join-last-seat-race";
  const base = createState({
    gameId,
    revision: 5,
    players: [{ id: "p1", role: "player" }],
    status: "waiting",
  });
  const fixture = createFixture(base, "p3");
  const replacement = createState({
    gameId,
    revision: 6,
    players: [
      { id: "p1", role: "player" },
      { id: "p2", role: "player" },
    ],
    status: "active",
  });
  replacement.actions.push({
    playerId: "system",
    playerName: "System",
    actionType: "system",
    content: "Player p2 joined as a player",
    timestamp: "2026-01-01T00:00:01.000Z",
  });
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await joinRequest(fixture.app, gameId, "Player p3");
  assert.equal(response.status, 200);
  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.stateRevision, 7);
  assert.equal(
    stored.players.find((player: any) => player.id === "p2").role,
    "player",
  );
  assert.equal(
    stored.players.find((player: any) => player.id === "p3").role,
    "spectator",
  );
  assert.equal(stored.actions.length, 2);
});

Deno.test("duplicate join becomes an idempotent success after conflict reload", async () => {
  const gameId = "join-duplicate-race";
  const base = createState({
    gameId,
    revision: 5,
    players: [{ id: "p1", role: "player" }],
    status: "waiting",
  });
  const fixture = createFixture(base, "p2");
  const replacement = createState({
    gameId,
    revision: 6,
    players: [
      { id: "p1", role: "player" },
      { id: "p2", role: "player" },
    ],
    status: "active",
  });
  replacement.actions.push({
    playerId: "system",
    playerName: "System",
    actionType: "system",
    content: "Player p2 joined as a player",
    timestamp: "2026-01-01T00:00:01.000Z",
  });
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await joinRequest(fixture.app, gameId, "Player p2");
  assert.equal(response.status, 200);
  assert.equal(fixture.persistence.conditionalAttempts, 1);
  assert.equal(fixture.persistence.writes.length, 0);
  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.stateRevision, 6);
  assert.equal(stored.actions.length, 1);
  assert.equal(
    stored.players.filter((player: any) => player.id === "p2").length,
    1,
  );
});

Deno.test("stale switch-role reloads N+1 and preserves gameplay state", async () => {
  const gameId = "switch-gameplay-race";
  const fixture = createFixture(createState({ gameId, revision: 5 }), "p2");
  const replacement = createState({
    gameId,
    revision: 6,
    players: [
      { id: "p1", role: "player" },
      { id: "p2", role: "player", health: 14 },
    ],
  });
  replacement.authoritativeMutationMarker = "accepted-at-revision-6";
  replacement.gameData.ships.p1 = [{
    instanceId: "new-fleet",
    shipDefId: "DES",
  }];
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await switchRequest(fixture.app, gameId, "spectator");
  assert.equal(response.status, 200);
  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.stateRevision, 7);
  assert.equal(stored.authoritativeMutationMarker, "accepted-at-revision-6");
  assert.equal(
    stored.players.find((player: any) => player.id === "p2").role,
    "spectator",
  );
  assert.equal(
    stored.players.find((player: any) => player.id === "p2").health,
    14,
  );
  assert.equal(stored.gameData.ships.p1[0].instanceId, "new-fleet");
  assert.equal(fixture.kvSetWrites.length, 0);
});

Deno.test("competing promotion makes a stale switch-role request illegal", async () => {
  const gameId = "switch-last-seat-race";
  const base = createState({
    gameId,
    revision: 5,
    players: [
      { id: "p1", role: "player" },
      { id: "p2", role: "spectator" },
    ],
  });
  const fixture = createFixture(base, "p2");
  const replacement = createState({
    gameId,
    revision: 6,
    players: [
      { id: "p1", role: "player" },
      { id: "p2", role: "spectator" },
      { id: "p3", role: "player" },
    ],
  });
  replacement.authoritativeMutationMarker = "p3-won-seat";
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await switchRequest(fixture.app, gameId, "player");
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Game already has 2 active players",
  });
  assert.equal(fixture.persistence.conditionalAttempts, 1);
  assert.equal(fixture.persistence.writes.length, 0);
  assert.equal(
    fixture.persistence.store.get(fixture.gameKey).authoritativeMutationMarker,
    "p3-won-seat",
  );
});

Deno.test("already-satisfied role switch is a true persisted-state no-op", async () => {
  const gameId = "switch-noop";
  const state = createState({
    gameId,
    revision: 5,
    players: [
      { id: "p1", role: "player" },
      { id: "p2", role: "spectator", isReady: false },
    ],
  });
  const fixture = createFixture(state, "p2");

  const response = await switchRequest(fixture.app, gameId, "spectator");
  assert.equal(response.status, 200);
  assert.equal(fixture.persistence.conditionalAttempts, 0);
  assert.equal(fixture.persistence.writes.length, 0);
  assert.equal(fixture.persistence.store.get(fixture.gameKey).stateRevision, 5);
});

Deno.test("idempotent rejoin persists compatibility normalization once", async () => {
  const gameId = "join-repair";
  const state = createState({
    gameId,
    revision: 5,
    players: [{ id: "p1", role: "player" }],
  });
  state.players[0].energy = 11;
  delete state.gameData.ancient;
  const fixture = createFixture(state, "p1");

  const response = await joinRequest(fixture.app, gameId, "Player p1");
  assert.equal(response.status, 200);
  assert.equal(fixture.persistence.conditionalAttempts, 1);
  assert.equal(fixture.persistence.writes.length, 1);
  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.stateRevision, 6);
  assert.equal("energy" in stored.players[0], false);
  assert.equal(stored.gameData.ancient.schemaVersion, 1);
});

Deno.test("compatibility repair is discarded and recomputed after conflict", async () => {
  const gameId = "join-repair-race";
  const state = createState({
    gameId,
    revision: 5,
    players: [{ id: "p1", role: "player" }],
  });
  state.players[0].energy = 9;
  delete state.gameData.ancient;
  const fixture = createFixture(state, "p1");

  const replacement = createState({
    gameId,
    revision: 6,
    players: [{ id: "p1", role: "player" }],
  });
  replacement.players[0].energy = 13;
  delete replacement.gameData.ancient;
  replacement.authoritativeMutationMarker = "fresh-repair-source";
  fixture.persistence.conflictReplacementStates.push(replacement);

  const response = await joinRequest(fixture.app, gameId, "Player p1");
  assert.equal(response.status, 200);
  assert.equal(fixture.persistence.conditionalAttempts, 2);
  const stored = fixture.persistence.store.get(fixture.gameKey);
  assert.equal(stored.stateRevision, 7);
  assert.equal(stored.authoritativeMutationMarker, "fresh-repair-source");
  assert.equal("energy" in stored.players[0], false);
  assert.equal(stored.gameData.ancient.schemaVersion, 1);
});

Deno.test("missing and malformed revisions follow shared persistence conventions", async () => {
  const missingGameId = "join-missing-revision";
  const missingState = createState({
    gameId: missingGameId,
    revision: 5,
    players: [{ id: "p1", role: "player" }],
  });
  delete missingState.stateRevision;
  const missing = createFixture(missingState, "p1");
  const missingResponse = await joinRequest(
    missing.app,
    missingGameId,
    "Player p1",
  );
  assert.equal(missingResponse.status, 200);
  assert.equal(missing.persistence.store.get(missing.gameKey).stateRevision, 2);
  assert.equal(missing.persistence.writes.length, 1);

  const invalidGameId = "switch-invalid-revision";
  const invalidState = createState({ gameId: invalidGameId, revision: 5 });
  invalidState.stateRevision = null;
  const invalid = createFixture(invalidState, "p2");
  const invalidResponse = await switchRequest(
    invalid.app,
    invalidGameId,
    "spectator",
  );
  assert.equal(invalidResponse.status, 500);
  assert.deepEqual(await invalidResponse.json(), {
    error: "Internal server error",
  });
  assert.equal(invalid.persistence.conditionalAttempts, 0);
  assert.equal(invalid.persistence.writes.length, 0);
  assert.equal(
    invalid.persistence.store.get(invalid.gameKey).stateRevision,
    null,
  );
});

Deno.test("join and switch-role conflict exhaustion return 409 without stale writes", async () => {
  for (const route of ["join", "switch"] as const) {
    const gameId = `${route}-conflict-exhaustion`;
    const fixture = createFixture(
      createState({ gameId, revision: 5 }),
      route === "join" ? "p3" : "p2",
    );
    for (const revision of [6, 7, 8]) {
      const replacement = createState({ gameId, revision });
      replacement.authoritativeMutationMarker = `revision-${revision}`;
      fixture.persistence.conflictReplacementStates.push(replacement);
    }

    const response = route === "join"
      ? await joinRequest(fixture.app, gameId, "Player p3")
      : await switchRequest(fixture.app, gameId, "spectator");
    assert.equal(response.status, 409);
    assert.equal(fixture.persistence.conditionalAttempts, 3);
    assert.equal(fixture.persistence.writes.length, 0);
    assert.equal(fixture.kvSetWrites.length, 0);
    assert.equal(
      fixture.persistence.store.get(fixture.gameKey)
        .authoritativeMutationMarker,
      "revision-8",
    );
    assert.equal(
      fixture.persistence.store.get(fixture.gameKey).stateRevision,
      8,
    );
  }
});
