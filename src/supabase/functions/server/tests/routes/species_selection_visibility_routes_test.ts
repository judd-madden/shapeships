import assert from 'node:assert/strict';
import { registerGameRoutes } from '../../routes/game_routes.ts';
import { registerIntentRoutes } from '../../routes/intent_routes.ts';
import type { GameStatePersistence } from '../../routes/intent_persistence.ts';

type RouteHandler = (context: any) => Promise<Response> | Response;

class RouteHarness {
  readonly routes = new Map<string, RouteHandler>();

  get(path: string, handler: RouteHandler): void {
    this.routes.set(`GET ${path}`, handler);
  }

  post(path: string, handler: RouteHandler): void {
    this.routes.set(`POST ${path}`, handler);
  }

  handler(method: 'GET' | 'POST', path: string): RouteHandler {
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
    json: (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  };
}

async function responseJson(response: Response): Promise<any> {
  return await response.json();
}

function createPlayer(
  id: string,
  faction: 'human' | 'xenite' | 'centaur' | 'ancient' | null,
) {
  return {
    id,
    name: id === 'p1' ? 'Player One' : 'Player Two',
    role: 'player',
    faction,
    species: faction,
    isReady: false,
    isActive: true,
    health: 25,
    lines: 3,
    joiningLines: 0,
  };
}

function createState(args: {
  gameId: string;
  p1Faction?: 'human' | 'xenite' | 'centaur' | 'ancient' | null;
  p2Faction?: 'human' | 'xenite' | 'centaur' | 'ancient' | null;
  computer?: boolean;
}) {
  const p1Faction = args.p1Faction ?? null;
  const p2Faction = args.p2Faction ?? null;
  const phaseReadiness = [
    ...(p1Faction
      ? [{
          playerId: 'p1',
          isReady: true,
          currentStep: 'setup.species_selection',
        }]
      : []),
    ...(p2Faction
      ? [{
          playerId: 'p2',
          isReady: true,
          currentStep: 'setup.species_selection',
        }]
      : []),
  ];

  return {
    gameId: args.gameId,
    status: 'active',
    stateRevision: 1,
    turnNumber: 0,
    currentPhase: 'setup',
    currentSubPhase: 'species_selection',
    players: [
      createPlayer('p1', p1Faction),
      createPlayer('p2', p2Faction),
      {
        id: 'spectator',
        name: 'Watcher',
        role: 'spectator',
        faction: null,
        species: null,
        isReady: false,
        isActive: false,
        health: 0,
        lines: 0,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      p1: { kind: 'human' },
      p2: args.computer
        ? { kind: 'bot', speciesId: null, chosenPlanId: null }
        : { kind: 'human' },
    },
    gameData: {
      turnNumber: 0,
      currentPhase: 'setup',
      currentSubPhase: 'species_selection',
      phaseReadiness,
      ships: { p1: [], p2: [] },
      turnData: {
        turnNumber: 0,
        currentMajorPhase: 'setup',
        currentSubPhase: 'species_selection',
        commitments: {},
      },
    },
    actions: [],
  };
}

function createPersistence(store: Map<string, any>): GameStatePersistence {
  return {
    async load(key) {
      if (!store.has(key)) return { status: 'missing' };
      return { status: 'found', value: structuredClone(store.get(key)) };
    },
    async conditionalUpdate(args) {
      const current = store.get(args.key);
      if (!current) return { status: 'conflict' };
      const hasRevision = Object.prototype.hasOwnProperty.call(
        current,
        args.revisionField,
      );
      const matches = args.expected.kind === 'missing'
        ? !hasRevision
        : args.expected.kind === 'valid' &&
          current[args.revisionField] === args.expected.revision;
      if (!matches) return { status: 'conflict' };
      store.set(args.key, structuredClone(args.value));
      return { status: 'updated' };
    },
    async insertIfMissing(key, value) {
      if (store.has(key)) return { status: 'conflict' };
      store.set(key, structuredClone(value));
      return { status: 'updated' };
    },
    async loadGameHead(key) {
      return store.has(key)
        ? { status: 'found', value: null }
        : { status: 'missing' };
    },
    async conditionalUpdateGameHead() {
      return { status: 'conflict' };
    },
  };
}

function createFixture(state: any) {
  const app = new RouteHarness();
  const store = new Map<string, any>([
    [`game_${state.gameId}`, structuredClone(state)],
  ]);
  const persistence = createPersistence(store);
  let sessionId = 'p1';
  const kvGet = async (key: string) => structuredClone(store.get(key));
  const kvSet = async (key: string, value: any) => {
    store.set(key, structuredClone(value));
  };
  const requireSession = async () => ({ sessionId });

  registerGameRoutes(
    app as any,
    kvGet,
    kvSet,
    requireSession,
    () => 'unused-generated-id',
    persistence,
  );
  registerIntentRoutes(
    app as any,
    kvGet,
    kvSet,
    requireSession,
    persistence,
  );

  return {
    app,
    store,
    setSessionId(nextSessionId: string) {
      sessionId = nextSessionId;
    },
  };
}

async function getGameState(fixture: ReturnType<typeof createFixture>, gameId: string) {
  const handler = fixture.app.handler(
    'GET',
    '/make-server-825e19ab/game-state/:gameId',
  );
  const response = await handler(createContext({ params: { gameId } }));
  assert.equal(response.status, 200);
  return await responseJson(response);
}

async function postIntent(
  fixture: ReturnType<typeof createFixture>,
  body: Record<string, unknown>,
) {
  const handler = fixture.app.handler(
    'POST',
    '/make-server-825e19ab/intent',
  );
  const response = await handler(createContext({ body }));
  return { response, body: await responseJson(response) };
}

function assertPlayerSpeciesHidden(player: any): void {
  assert.equal('faction' in player, false);
  assert.equal('species' in player, false);
}

function assertPublicPlayersHidden(body: any): void {
  for (const player of body.publicState.players.filter(
    (entry: any) => entry.role === 'player',
  )) {
    assertPlayerSpeciesHidden(player);
  }
}

Deno.test('/game-state keeps either single submitted species private for every viewer', async () => {
  for (const selectedPlayerId of ['p1', 'p2'] as const) {
    const gameId = `single-${selectedPlayerId}`;
    const selectedSpecies = selectedPlayerId === 'p1' ? 'xenite' : 'centaur';
    const state = createState({
      gameId,
      p1Faction: selectedPlayerId === 'p1' ? selectedSpecies : null,
      p2Faction: selectedPlayerId === 'p2' ? selectedSpecies : null,
    });
    const fixture = createFixture(state);

    for (const viewerId of ['p1', 'p2', 'spectator'] as const) {
      fixture.setSessionId(viewerId);
      const body = await getGameState(fixture, gameId);
      assertPublicPlayersHidden(body);

      const legacyP1 = body.players.find((entry: any) => entry.id === 'p1');
      const legacyP2 = body.players.find((entry: any) => entry.id === 'p2');
      const selectedLegacy = selectedPlayerId === 'p1' ? legacyP1 : legacyP2;
      const otherLegacy = selectedPlayerId === 'p1' ? legacyP2 : legacyP1;
      if (viewerId === selectedPlayerId) {
        assert.equal(selectedLegacy.faction, selectedSpecies);
        assert.deepEqual(body.requester.speciesSelection, {
          selectedSpecies,
        });
      } else {
        assertPlayerSpeciesHidden(selectedLegacy);
        assert.equal('speciesSelection' in body.requester, false);
      }
      assertPlayerSpeciesHidden(otherLegacy);

      assert.deepEqual(body.publicState.controllersByPlayerId, {
        p1: { kind: 'player' },
        p2: { kind: 'player' },
      });
      assert.equal(
        body.publicState.phaseReadiness.some(
          (entry: any) =>
            entry.playerId === selectedPlayerId && entry.isReady === true,
        ),
        true,
      );
    }
  }
});

Deno.test('/intent accepted message and rejected action hide an already selected opponent', async () => {
  const acceptedFixture = createFixture(createState({
    gameId: 'accepted-message-privacy',
    p1Faction: 'human',
  }));
  acceptedFixture.setSessionId('p2');
  const accepted = await postIntent(acceptedFixture, {
    gameId: 'accepted-message-privacy',
    intentType: 'ACTION',
    turnNumber: 0,
    payload: { actionType: 'message', content: 'privacy-check' },
  });
  assert.equal(accepted.response.status, 200);
  assert.equal(accepted.body.ok, true);
  assertPlayerSpeciesHidden(
    accepted.body.state.players.find((entry: any) => entry.id === 'p1'),
  );

  const rejectedFixture = createFixture(createState({
    gameId: 'rejected-message-privacy',
    p1Faction: 'human',
  }));
  rejectedFixture.setSessionId('p2');
  const rejected = await postIntent(rejectedFixture, {
    gameId: 'rejected-message-privacy',
    intentType: 'ACTION',
    turnNumber: 0,
    payload: { actionType: 'message', content: '' },
  });
  assert.equal(rejected.response.status, 400);
  assert.equal(rejected.body.ok, false);
  assertPlayerSpeciesHidden(
    rejected.body.state.players.find((entry: any) => entry.id === 'p1'),
  );
});

Deno.test('species intent responses stay private until the second submission starts matchup intro', async () => {
  const gameId = 'multiplayer-species-resolution';
  const fixture = createFixture(createState({ gameId }));

  fixture.setSessionId('p1');
  const first = await postIntent(fixture, {
    gameId,
    intentType: 'SPECIES_SUBMIT',
    turnNumber: 0,
    payload: { species: 'xenite' },
    nonce: 'p1-species-nonce',
  });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.ok, true);
  assert.equal(
    first.body.state.players.find((entry: any) => entry.id === 'p1').faction,
    'xenite',
  );
  assertPlayerSpeciesHidden(
    first.body.state.players.find((entry: any) => entry.id === 'p2'),
  );

  fixture.setSessionId('p2');
  const p2BeforeResolution = await getGameState(fixture, gameId);
  assertPublicPlayersHidden(p2BeforeResolution);
  assertPlayerSpeciesHidden(
    p2BeforeResolution.players.find((entry: any) => entry.id === 'p1'),
  );

  fixture.setSessionId('spectator');
  const spectatorBeforeResolution = await getGameState(fixture, gameId);
  assertPublicPlayersHidden(spectatorBeforeResolution);
  assertPlayerSpeciesHidden(
    spectatorBeforeResolution.players.find((entry: any) => entry.id === 'p1'),
  );

  fixture.setSessionId('p2');
  const second = await postIntent(fixture, {
    gameId,
    intentType: 'SPECIES_SUBMIT',
    turnNumber: 0,
    payload: { species: 'centaur' },
    nonce: 'p2-species-nonce',
  });
  assert.equal(second.response.status, 200);
  assert.equal(second.body.ok, true);
  assert.equal(
    second.body.state.players.find((entry: any) => entry.id === 'p1').faction,
    'xenite',
  );
  assert.equal(
    second.body.state.players.find((entry: any) => entry.id === 'p2').faction,
    'centaur',
  );
  assert.equal(
    second.body.state.gameData.turnData.phaseHold.holdReason,
    'matchup_intro',
  );
  assert.equal(
    second.body.state.gameData.currentSubPhase,
    'species_selection',
  );

  fixture.setSessionId('spectator');
  const spectatorResolved = await getGameState(fixture, gameId);
  assert.equal(
    spectatorResolved.publicState.players.find((entry: any) => entry.id === 'p1').faction,
    'xenite',
  );
  assert.equal(
    spectatorResolved.publicState.players.find((entry: any) => entry.id === 'p2').faction,
    'centaur',
  );
  assert.equal('speciesSelection' in spectatorResolved.requester, false);
  assert.equal(spectatorResolved.meta.phaseKey, 'setup.species_selection');
});

Deno.test('Play Computer reveals both atomic selections to later spectators', async () => {
  const gameId = 'computer-species-resolution';
  const fixture = createFixture(createState({ gameId, computer: true }));

  fixture.setSessionId('p1');
  const submitted = await postIntent(fixture, {
    gameId,
    intentType: 'SPECIES_SUBMIT',
    turnNumber: 0,
    payload: {
      species: 'ancient',
      botSpecies: 'centaur',
      completedMissionIds: [],
    },
    nonce: 'computer-species-nonce',
  });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.body.ok, true);
  assert.equal(
    submitted.body.state.players.find((entry: any) => entry.id === 'p1').faction,
    'ancient',
  );
  assert.equal(
    submitted.body.state.players.find((entry: any) => entry.id === 'p2').faction,
    'centaur',
  );
  assert.notEqual(submitted.body.state.controllersByPlayerId.p2.speciesId, null);

  fixture.setSessionId('spectator');
  const spectator = await getGameState(fixture, gameId);
  assert.equal(
    spectator.publicState.players.find((entry: any) => entry.id === 'p1').faction,
    'ancient',
  );
  assert.equal(
    spectator.publicState.players.find((entry: any) => entry.id === 'p2').faction,
    'centaur',
  );
  assert.notEqual(spectator.publicState.controllersByPlayerId.p2.speciesId, null);
  assert.notEqual(spectator.publicState.controllersByPlayerId.p2.chosenPlanId, null);
});
