import assert from "node:assert/strict";
import { Hono } from "hono";
import {
  generateSecureGameId,
  MAX_GAME_ID_ALLOCATION_ATTEMPTS,
} from "../../routes/game_id_allocation.ts";
import { registerGameRoutes } from "../../routes/game_routes.ts";

type InsertAttempt = { key: string; value: unknown };

type StoredGame = {
  gameId: string;
  stateRevision: number;
  status: string;
  players: Array<{ id: string; lines?: number }>;
  controllersByPlayerId: Record<string, { kind: string }>;
};

function createFinishedSourceGame(args: { botOpponent?: boolean } = {}) {
  const gameId = args.botOpponent ? "BOTOLD" : "HUMOLD";
  const opponentId = args.botOpponent ? "bot-old" : "player-2";
  return {
    gameId,
    status: "finished",
    stateRevision: 9,
    players: [
      { id: "player-1", name: "Player One", role: "player" },
      { id: opponentId, name: "Opponent", role: "player" },
    ],
    controllersByPlayerId: {
      "player-1": { kind: "human" },
      [opponentId]: args.botOpponent ? { kind: "bot" } : { kind: "human" },
    },
    gameData: {
      clock: {
        timeControl: { baseMs: 600_000, incrementMs: 5_000 },
      },
    },
  };
}

function createFixture(args: {
  candidates: string[];
  initialEntries?: Array<[string, unknown]>;
  errorCandidate?: string;
}) {
  const app = new Hono();
  const store = new Map<string, unknown>(
    (args.initialEntries ?? []).map(([key, value]) => [
      key,
      structuredClone(value),
    ]),
  );
  const insertAttempts: InsertAttempt[] = [];
  const kvSetWrites: InsertAttempt[] = [];
  let generatedCount = 0;

  const persistence = {
    load(key: string) {
      return Promise.resolve(
        store.has(key)
          ? { status: "found" as const, value: structuredClone(store.get(key)) }
          : { status: "missing" as const },
      );
    },
    conditionalUpdate(_args: unknown) {
      return Promise.resolve({ status: "conflict" as const });
    },
    insertIfMissing(key: string, value: unknown) {
      const copy = structuredClone(value);
      insertAttempts.push({ key, value: copy });
      if (key === `game_${args.errorCandidate}`) {
        return Promise.resolve({
          status: "error" as const,
          error: { message: "database unavailable" },
        });
      }
      if (store.has(key)) {
        return Promise.resolve({ status: "conflict" as const });
      }
      store.set(key, copy);
      return Promise.resolve({ status: "updated" as const });
    },
  };

  registerGameRoutes(
    app,
    (key) => Promise.resolve(structuredClone(store.get(key))),
    (key, value) => {
      const copy = structuredClone(value);
      kvSetWrites.push({ key, value: copy });
      store.set(key, copy);
      return Promise.resolve();
    },
    () => Promise.resolve({ sessionId: "player-1" }),
    () => {
      const candidate = args.candidates[generatedCount];
      generatedCount += 1;
      assert.ok(candidate, `Missing scripted candidate ${generatedCount}`);
      return candidate;
    },
    persistence,
  );

  return {
    app,
    store,
    insertAttempts,
    kvSetWrites,
    get generatedCount() {
      return generatedCount;
    },
  };
}

function getStoredGame(
  fixture: ReturnType<typeof createFixture>,
  gameId: string,
): StoredGame {
  const value = fixture.store.get(`game_${gameId}`);
  assert.ok(value);
  return value as StoredGame;
}

function getStoredObject(
  fixture: ReturnType<typeof createFixture>,
  key: string,
): Record<string, unknown> {
  const value = fixture.store.get(key);
  assert.ok(value);
  return value as Record<string, unknown>;
}

function getAttemptGame(
  fixture: ReturnType<typeof createFixture>,
  attemptIndex: number,
): StoredGame {
  const attempt = fixture.insertAttempts[attemptIndex];
  assert.ok(attempt);
  return attempt.value as StoredGame;
}

async function postJson(
  app: Hono,
  path: string,
  body: Record<string, unknown> = {},
) {
  const response = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    response,
    body: await response.json() as Record<string, unknown>,
  };
}

Deno.test("secure game IDs retain the six-character uppercase-alphanumeric format", () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(generateSecureGameId(), /^[A-Z0-9]{6}$/);
  }
});

Deno.test("fresh normal creation claims once and initializes canonical state and history", async () => {
  const fixture = createFixture({ candidates: ["ABC123"] });
  const result = await postJson(
    fixture.app,
    "/make-server-825e19ab/create-game",
    { playerName: "Player One", timed: false },
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, {
    gameId: "ABC123",
    message: "Game created successfully",
  });
  assert.equal(fixture.generatedCount, 1);
  assert.deepEqual(fixture.insertAttempts.map(({ key }) => key), [
    "game_ABC123",
  ]);
  const game = getStoredGame(fixture, "ABC123");
  assert.equal(game.gameId, "ABC123");
  assert.equal(game.stateRevision, 1);
  assert.equal(game.status, "waiting");
  assert.equal(game.players[0].id, "player-1");
  assert.equal(game.players[0].lines, 3);
  assert.equal(
    getStoredObject(fixture, "game_history_ABC123").gameId,
    "ABC123",
  );
  assert.deepEqual(fixture.kvSetWrites.map(({ key }) => key), [
    "game_history_ABC123",
  ]);
});

Deno.test("normal creation retries a collision without changing the existing game", async () => {
  const collidedGame = { gameId: "ABC123", marker: "must remain intact" };
  const collidedSnapshot = JSON.stringify(collidedGame);
  const fixture = createFixture({
    candidates: ["ABC123", "XYZ789"],
    initialEntries: [["game_ABC123", collidedGame]],
  });
  const result = await postJson(
    fixture.app,
    "/make-server-825e19ab/create-game",
    { playerName: "Player One", timed: false },
  );

  assert.equal(result.response.status, 200);
  assert.equal(result.body.gameId, "XYZ789");
  assert.deepEqual(fixture.insertAttempts.map(({ key }) => key), [
    "game_ABC123",
    "game_XYZ789",
  ]);
  assert.equal(getAttemptGame(fixture, 0).gameId, "ABC123");
  assert.equal(getAttemptGame(fixture, 1).gameId, "XYZ789");
  assert.equal(
    JSON.stringify(fixture.store.get("game_ABC123")),
    collidedSnapshot,
  );
  assert.equal(fixture.store.has("game_history_ABC123"), false);
  assert.equal(getStoredGame(fixture, "XYZ789").gameId, "XYZ789");
  assert.equal(getStoredGame(fixture, "XYZ789").stateRevision, 1);
  assert.equal(
    getStoredObject(fixture, "game_history_XYZ789").gameId,
    "XYZ789",
  );
});

Deno.test("computer creation retries with replacement IDs embedded in bot state", async () => {
  const collidedGame = { gameId: "ABC123", marker: "computer collision" };
  const collidedSnapshot = JSON.stringify(collidedGame);
  const fixture = createFixture({
    candidates: ["ABC123", "XYZ789"],
    initialEntries: [["game_ABC123", collidedGame]],
  });
  const result = await postJson(
    fixture.app,
    "/make-server-825e19ab/create-computer-game",
    { playerName: "Player One", timed: false },
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, {
    gameId: "XYZ789",
    message: "Computer game created successfully",
    chosenBotPlanId: null,
  });
  assert.equal(
    JSON.stringify(fixture.store.get("game_ABC123")),
    collidedSnapshot,
  );
  assert.equal(fixture.store.has("game_history_ABC123"), false);
  assert.ok(
    getAttemptGame(fixture, 0).players.some((player) =>
      player.id === "bot_ABC123"
    ),
  );
  const game = getStoredGame(fixture, "XYZ789");
  assert.equal(game.gameId, "XYZ789");
  assert.equal(game.stateRevision, 1);
  assert.ok(game.players.some((player) => player.id === "bot_XYZ789"));
  assert.equal(game.controllersByPlayerId["bot_XYZ789"].kind, "bot");
});

Deno.test("human rematch collision uses the claimed ID in state, history, and invitation", async () => {
  const source = createFinishedSourceGame();
  const collidedGame = { gameId: "ABC123", marker: "human rematch collision" };
  const sourceSnapshot = JSON.stringify(source);
  const collidedSnapshot = JSON.stringify(collidedGame);
  const fixture = createFixture({
    candidates: ["ABC123", "XYZ789"],
    initialEntries: [
      [`game_${source.gameId}`, source],
      ["game_ABC123", collidedGame],
    ],
  });
  const result = await postJson(
    fixture.app,
    `/make-server-825e19ab/new-game-from/${source.gameId}`,
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { gameId: "XYZ789" });
  assert.equal(
    JSON.stringify(fixture.store.get(`game_${source.gameId}`)),
    sourceSnapshot,
  );
  assert.equal(
    JSON.stringify(fixture.store.get("game_ABC123")),
    collidedSnapshot,
  );
  assert.equal(getStoredGame(fixture, "XYZ789").gameId, "XYZ789");
  assert.equal(getStoredGame(fixture, "XYZ789").status, "waiting");
  assert.equal(
    getStoredObject(fixture, "game_history_XYZ789").gameId,
    "XYZ789",
  );
  assert.equal(fixture.store.has("game_history_ABC123"), false);
  const chat = getStoredObject(fixture, `game_${source.gameId}_chat`) as {
    entries: Array<{ type: string; newGameId: string }>;
  };
  const invitation = chat.entries[0];
  assert.equal(invitation.type, "rematch_invite");
  assert.equal(invitation.newGameId, "XYZ789");
});

Deno.test("bot rematch collision uses the claimed ID throughout bot state", async () => {
  const source = createFinishedSourceGame({ botOpponent: true });
  const collidedGame = { gameId: "ABC123", marker: "bot rematch collision" };
  const collidedSnapshot = JSON.stringify(collidedGame);
  const fixture = createFixture({
    candidates: ["ABC123", "XYZ789"],
    initialEntries: [
      [`game_${source.gameId}`, source],
      ["game_ABC123", collidedGame],
    ],
  });
  const result = await postJson(
    fixture.app,
    `/make-server-825e19ab/new-game-from/${source.gameId}`,
  );

  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { gameId: "XYZ789" });
  assert.equal(
    JSON.stringify(fixture.store.get("game_ABC123")),
    collidedSnapshot,
  );
  const game = getStoredGame(fixture, "XYZ789");
  assert.equal(game.gameId, "XYZ789");
  assert.equal(game.status, "active");
  assert.equal(game.stateRevision, 1);
  assert.ok(game.players.some((player) => player.id === "bot_XYZ789"));
  assert.equal(game.controllersByPlayerId["bot_XYZ789"].kind, "bot");
  assert.equal(fixture.store.has(`game_${source.gameId}_chat`), false);
});

Deno.test("allocation exhaustion is bounded and creates no unclaimed metadata", async () => {
  const collidedGame = { gameId: "ABC123", marker: "exhaustion collision" };
  const collidedSnapshot = JSON.stringify(collidedGame);
  const fixture = createFixture({
    candidates: Array(MAX_GAME_ID_ALLOCATION_ATTEMPTS).fill("ABC123"),
    initialEntries: [["game_ABC123", collidedGame]],
  });
  const result = await postJson(
    fixture.app,
    "/make-server-825e19ab/create-game",
    { playerName: "Player One", timed: false },
  );

  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, { error: "Internal server error" });
  assert.equal(fixture.generatedCount, MAX_GAME_ID_ALLOCATION_ATTEMPTS);
  assert.equal(fixture.insertAttempts.length, MAX_GAME_ID_ALLOCATION_ATTEMPTS);
  assert.equal(
    JSON.stringify(fixture.store.get("game_ABC123")),
    collidedSnapshot,
  );
  assert.equal(fixture.store.has("game_history_ABC123"), false);
  assert.deepEqual(fixture.kvSetWrites, []);
});

Deno.test("allocation persistence errors fail immediately without metadata writes", async () => {
  const fixture = createFixture({
    candidates: ["ABC123", "XYZ789"],
    errorCandidate: "ABC123",
  });
  const result = await postJson(
    fixture.app,
    "/make-server-825e19ab/create-game",
    { playerName: "Player One", timed: false },
  );

  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, { error: "Internal server error" });
  assert.equal(fixture.generatedCount, 1);
  assert.deepEqual(fixture.insertAttempts.map(({ key }) => key), [
    "game_ABC123",
  ]);
  assert.equal(fixture.store.has("game_ABC123"), false);
  assert.equal(fixture.store.has("game_XYZ789"), false);
  assert.deepEqual(fixture.kvSetWrites, []);
});
