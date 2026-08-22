import assert from "node:assert/strict";
import { registerGameRoutes } from "../../routes/game_routes.ts";

type RouteHandler = (context: any) => Promise<Response> | Response;

class RouteHarness {
  readonly routes = new Map<string, RouteHandler>();

  get(path: string, handler: RouteHandler): void {
    this.routes.set(`GET ${path}`, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.routes.set(`POST ${path}`, handler);
  }

  handler(method: "GET" | "POST", path: string): RouteHandler {
    const handler = this.routes.get(`${method} ${path}`);
    assert.ok(handler, `Missing route ${method} ${path}`);
    return handler;
  }
}

function createContext(args: {
  params?: Record<string, string>;
  body?: unknown;
}) {
  return {
    req: {
      json: async () => args.body,
      param: (name: string) => args.params?.[name],
    },
    json: (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  };
}

async function responseJson(response: Response): Promise<any> {
  return await response.json();
}

function createRouteFixture() {
  const app = new RouteHarness();
  const store = new Map<string, any>();
  let generatedId = 0;
  const persistence = {
    async load(key: string) {
      return store.has(key)
        ? { status: "found" as const, value: structuredClone(store.get(key)) }
        : { status: "missing" as const };
    },
    async conditionalUpdate(args: any) {
      const current = store.get(args.key);
      if (!current) return { status: "conflict" as const };
      const hasRevision = Object.prototype.hasOwnProperty.call(
        current,
        args.revisionField,
      );
      const matches = args.expected.kind === "missing"
        ? !hasRevision
        : args.expected.kind === "valid" &&
          current[args.revisionField] === args.expected.revision;
      if (!matches) return { status: "conflict" as const };
      store.set(args.key, structuredClone(args.value));
      return { status: "updated" as const };
    },
  };

  registerGameRoutes(
    app as any,
    async (key) => structuredClone(store.get(key)),
    async (key, value) => {
      store.set(key, structuredClone(value));
    },
    async () => ({ sessionId: "player-1" }),
    () => `generated-${++generatedId}`,
    persistence,
  );

  return { app, store };
}

async function createGame(
  fixture: ReturnType<typeof createRouteFixture>,
  path:
    | "/make-server-825e19ab/create-game"
    | "/make-server-825e19ab/create-computer-game",
  body: Record<string, unknown>,
) {
  const handler = fixture.app.handler("POST", path);
  const response = await handler(createContext({ body }));
  const responseBody = await responseJson(response);
  const state = responseBody.gameId
    ? fixture.store.get(`game_${responseBody.gameId}`)
    : undefined;

  return { response, responseBody, state };
}

const SUPPORTED_PRESETS = [
  {
    minutes: 5,
    incrementSeconds: 3,
    timeControl: { baseMs: 300_000, incrementMs: 3_000 },
  },
  {
    minutes: 10,
    incrementSeconds: 5,
    timeControl: { baseMs: 600_000, incrementMs: 5_000 },
  },
  {
    minutes: 15,
    incrementSeconds: 10,
    timeControl: { baseMs: 900_000, incrementMs: 10_000 },
  },
  {
    minutes: 30,
    incrementSeconds: 20,
    timeControl: { baseMs: 1_800_000, incrementMs: 20_000 },
  },
] as const;

const INVALID_PRESET_MESSAGE =
  "Invalid timed preset. Supported presets are 5+3, 10+5, 15+10, and 30+20.";

Deno.test("create-game accepts the supported timed presets", async () => {
  for (const preset of SUPPORTED_PRESETS) {
    const fixture = createRouteFixture();
    const result = await createGame(
      fixture,
      "/make-server-825e19ab/create-game",
      {
        playerName: "Player One",
        timed: true,
        minutes: preset.minutes,
        incrementSeconds: preset.incrementSeconds,
      },
    );

    assert.equal(result.response.status, 200);
    assert.deepEqual(
      result.state.gameData.clock.timeControl,
      preset.timeControl,
    );
  }
});

Deno.test("create-game rejects the retired selectable 5+0 preset", async () => {
  const fixture = createRouteFixture();
  const result = await createGame(
    fixture,
    "/make-server-825e19ab/create-game",
    {
      playerName: "Player One",
      timed: true,
      minutes: 5,
      incrementSeconds: 0,
    },
  );

  assert.equal(result.response.status, 400);
  assert.equal(result.responseBody.error, INVALID_PRESET_MESSAGE);
});

Deno.test("create-computer-game accepts 5+3 and rejects 5+0", async () => {
  const acceptedFixture = createRouteFixture();
  const accepted = await createGame(
    acceptedFixture,
    "/make-server-825e19ab/create-computer-game",
    {
      playerName: "Player One",
      timed: true,
      minutes: 5,
      incrementSeconds: 3,
    },
  );

  assert.equal(accepted.response.status, 200);
  assert.deepEqual(accepted.state.gameData.clock.timeControl, {
    baseMs: 300_000,
    incrementMs: 3_000,
  });

  const rejectedFixture = createRouteFixture();
  const rejected = await createGame(
    rejectedFixture,
    "/make-server-825e19ab/create-computer-game",
    {
      playerName: "Player One",
      timed: true,
      minutes: 5,
      incrementSeconds: 0,
    },
  );

  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.responseBody.error, INVALID_PRESET_MESSAGE);
});

Deno.test("create-game preserves untimed and omitted-settings behavior", async () => {
  const untimedFixture = createRouteFixture();
  const untimed = await createGame(
    untimedFixture,
    "/make-server-825e19ab/create-game",
    { playerName: "Player One", timed: false },
  );

  assert.equal(untimed.response.status, 200);
  assert.equal(untimed.state.gameData.clock, undefined);

  const legacyFixture = createRouteFixture();
  const legacy = await createGame(
    legacyFixture,
    "/make-server-825e19ab/create-game",
    { playerName: "Player One" },
  );

  assert.equal(legacy.response.status, 200);
  assert.deepEqual(legacy.state.gameData.clock.timeControl, {
    baseMs: 900_000,
    incrementMs: 10_000,
  });
});

Deno.test("rematch preserves a historical 5+0 time control", async () => {
  const fixture = createRouteFixture();
  const source = await createGame(
    fixture,
    "/make-server-825e19ab/create-game",
    { playerName: "Player One", timed: false },
  );

  assert.equal(source.response.status, 200);
  source.state.status = "finished";
  source.state.gameData.clock = {
    timeControl: { baseMs: 300_000, incrementMs: 0 },
    remainingMsByPlayerId: { "player-1": 0 },
    lastUpdateAtMs: Date.now(),
    incrementAppliedTurnByPlayerId: {},
  };
  fixture.store.set(`game_${source.responseBody.gameId}`, source.state);

  const rematch = fixture.app.handler(
    "POST",
    "/make-server-825e19ab/new-game-from/:gameId",
  );
  const response = await rematch(createContext({
    params: { gameId: source.responseBody.gameId },
    body: {},
  }));
  const responseBody = await responseJson(response);
  const rematchState = fixture.store.get(`game_${responseBody.gameId}`);

  assert.equal(response.status, 200);
  assert.deepEqual(rematchState.gameData.clock.timeControl, {
    baseMs: 300_000,
    incrementMs: 0,
  });
});
