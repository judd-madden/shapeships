import assert from "node:assert/strict";
import { registerGameRoutes } from "../../routes/game_routes.ts";
import { registerIntentRoutes } from "../../routes/intent_routes.ts";
import type { IntentPersistence } from "../../routes/intent_persistence.ts";
import { normalizeAncientGameState } from "../../engine/state/ancientState.ts";
import { ensureMissionChallengeAssignment } from "../../engine/mission/MissionChallenge.ts";

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

function createContext(
  args: { params?: Record<string, string>; body?: unknown },
) {
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

function missionState() {
  const raw = {
    gameId: "mission-route-game",
    status: "active",
    stateRevision: 3,
    currentPhase: "setup",
    currentSubPhase: "species_selection",
    turnNumber: 0,
    players: [
      {
        id: "human",
        name: "Human",
        role: "player",
        faction: "human",
        isActive: true,
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: "bot",
        name: "Computer",
        role: "player",
        faction: "xenite",
        isActive: true,
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: "spectator",
        name: "Spectator",
        role: "spectator",
        faction: null,
        isActive: true,
        health: 0,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      human: { kind: "human" },
      bot: { kind: "bot", speciesId: "XEN", chosenPlanId: null },
    },
    gameData: {
      turnNumber: 0,
      currentPhase: "setup",
      currentSubPhase: "species_selection",
      phaseReadiness: [],
      ships: { human: [], bot: [] },
      turnData: {
        turnNumber: 0,
        currentMajorPhase: "setup",
        currentSubPhase: "species_selection",
        commitments: {},
      },
    },
    actions: [],
  };
  return ensureMissionChallengeAssignment(normalizeAncientGameState(raw).state);
}

function createPersistence(
  store: Map<string, any>,
  writes: any[],
): IntentPersistence {
  return {
    async load(key) {
      if (!store.has(key)) return { status: "missing" };
      return { status: "found", value: structuredClone(store.get(key)) };
    },
    async conditionalUpdate(args) {
      const current = store.get(args.key);
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
      store.set(args.key, value);
      writes.push({ key: args.key, value });
      return { status: "updated" };
    },
    async insertIfMissing(key, value) {
      if (store.has(key)) return { status: "conflict" };
      const copy = structuredClone(value);
      store.set(key, copy);
      writes.push({ key, value: copy });
      return { status: "updated" };
    },
  };
}

function createRouteFixture() {
  const app = new RouteHarness();
  const store = new Map<string, any>();
  const writes: any[] = [];
  let sessionId = "human";
  const state = missionState();
  store.set(`game_${state.gameId}`, structuredClone(state));
  const persistence = createPersistence(store, writes);

  const kvGet = async (key: string) => structuredClone(store.get(key));
  const kvSet = async (key: string, value: any) => {
    const copy = structuredClone(value);
    store.set(key, copy);
    writes.push({ key, value: copy });
  };
  const requireSession = async () => ({ sessionId });

  registerGameRoutes(
    app as any,
    kvGet,
    kvSet,
    requireSession,
    () => "unused-generated-id",
    persistence.load,
  );
  registerIntentRoutes(app as any, kvGet, kvSet, requireSession, persistence);

  return {
    app,
    store,
    state,
    setSessionId(value: string) {
      sessionId = value;
    },
  };
}

function containsCanonicalAssignmentKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (
    Object.prototype.hasOwnProperty.call(value, "missionChallengeAssignment")
  ) return true;
  return Object.values(value).some(containsCanonicalAssignmentKey);
}

async function getGameState(
  fixture: ReturnType<typeof createRouteFixture>,
  sessionId: string,
) {
  fixture.setSessionId(sessionId);
  const response = await fixture.app.handler(
    "GET",
    "/make-server-825e19ab/game-state/:gameId",
  )(createContext({ params: { gameId: fixture.state.gameId } }));
  assert.equal(response.status, 200);
  return responseJson(response);
}

Deno.test("/game-state strips canonical assignment and projects Mission only to its human owner", async () => {
  const fixture = createRouteFixture();
  const stored = fixture.store.get(`game_${fixture.state.gameId}`);
  stored.missionChallengeAssignment.introPending = true;
  fixture.store.set(`game_${fixture.state.gameId}`, stored);
  const human = await getGameState(fixture, "human");
  const bot = await getGameState(fixture, "bot");
  const spectator = await getGameState(fixture, "spectator");

  assert.equal(containsCanonicalAssignmentKey(human), false);
  assert.equal(containsCanonicalAssignmentKey(bot), false);
  assert.equal(containsCanonicalAssignmentKey(spectator), false);
  assert.equal("missionChallenge" in human.publicState, false);
  assert.equal("missionChallenge" in bot.publicState, false);
  assert.equal("missionChallenge" in spectator.publicState, false);

  assert.equal(human.requester.missionChallenge.mission.year, 2814);
  assert.equal(human.requester.missionChallenge.mission.author, "juddly");
  assert.deepEqual(human.requester.missionChallenge.mission.findingIds, [
    "mintaka",
  ]);
  assert.ok(human.requester.missionChallenge.mission.paragraphs.length > 0);
  assert.equal(human.requester.missionChallenge.introPending, true);
  assert.equal("missionChallenge" in bot.requester, false);
  assert.equal("missionChallenge" in spectator.requester, false);
});

Deno.test("/intent strips canonical assignment from successful and rejected response state", async () => {
  const successfulFixture = createRouteFixture();
  const success = await successfulFixture.app.handler(
    "POST",
    "/make-server-825e19ab/intent",
  )(createContext({
    body: {
      gameId: successfulFixture.state.gameId,
      intentType: "ACTION",
      turnNumber: 0,
      payload: {
        actionType: "message",
        content: "Mission chat remains available",
      },
      nonce: "mission-chat",
    },
  }));
  const successBody = await responseJson(success);
  assert.equal(successBody.ok, true);
  assert.equal(containsCanonicalAssignmentKey(successBody.state), false);

  const rejectedFixture = createRouteFixture();
  const persistedPending = rejectedFixture.store.get(
    `game_${rejectedFixture.state.gameId}`,
  );
  persistedPending.missionChallengeAssignment.introPending = true;
  rejectedFixture.store.set(
    `game_${rejectedFixture.state.gameId}`,
    persistedPending,
  );
  const rejected = await rejectedFixture.app.handler(
    "POST",
    "/make-server-825e19ab/intent",
  )(createContext({
    body: {
      gameId: rejectedFixture.state.gameId,
      intentType: "BUILD_SUBMIT",
      turnNumber: 0,
      payload: { builds: [] },
      nonce: "mission-gate-bypass",
    },
  }));
  const rejectedBody = await responseJson(rejected);
  assert.equal(rejectedBody.ok, false);
  assert.equal(rejectedBody.rejected.code, "MISSION_INTRO_PENDING");
  assert.equal(containsCanonicalAssignmentKey(rejectedBody.state), false);
});

Deno.test("/game-state derives finished Mission and Challenge results in the human requester DTO", async () => {
  const fixture = createRouteFixture();
  const stored = fixture.store.get(`game_${fixture.state.gameId}`);
  stored.status = "finished";
  stored.winnerPlayerId = "human";
  stored.result = "win";
  stored.resultReason = "timeout";
  stored.gameData.ships.human = [{
    instanceId: "final-target",
    shipDefId: stored.missionChallengeAssignment.challenge.shipDefId,
  }];
  stored.missionChallengeAssignment.challenge.condition = "with";
  fixture.store.set(`game_${fixture.state.gameId}`, stored);

  const body = await getGameState(fixture, "human");
  assert.deepEqual(body.requester.missionChallenge.result, {
    missionSucceeded: true,
    challengeSucceeded: true,
    fleetConditionMet: true,
  });
  assert.equal(containsCanonicalAssignmentKey(body), false);
});
