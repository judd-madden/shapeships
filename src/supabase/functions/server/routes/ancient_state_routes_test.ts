import assert from 'node:assert/strict';
import { registerGameRoutes } from './game_routes.ts';
import { registerIntentRoutes } from './intent_routes.ts';
import { normalizeAncientGameState } from '../engine/state/ancientState.ts';

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

function createSetupState(gameId = 'game-1') {
  return {
    gameId,
    status: 'active',
    stateRevision: 5,
    currentPhase: 'setup',
    currentSubPhase: 'species_selection',
    turnNumber: 0,
    players: [
      {
        id: 'p1',
        name: 'Player One',
        role: 'player',
        faction: null,
        isReady: false,
        isActive: true,
        health: 25,
        lines: 3,
        joiningLines: 0,
        energy: 44,
      },
    ],
    gameData: {
      turnNumber: 0,
      currentPhase: 'setup',
      currentSubPhase: 'species_selection',
      ships: { p1: [] },
      turnData: {
        turnNumber: 0,
        currentMajorPhase: 'setup',
        currentSubPhase: 'species_selection',
        pendingSOLARPowerDeclarations: { p1: [{ secret: true }] },
        pendingChargeDeclarations: {
          p1: [{ own: true }],
          p2: [{ opponent: true }],
        },
        commitments: {
          SECRET: {
            p2: {
              commitHash: 'hidden',
              revealPayload: { hidden: true },
              nonce: 'hidden',
              committedAt: 1,
              revealedAt: 2,
            },
          },
        },
        shipActivationCueBatches: [{
          key: 'cue-1',
          turnNumber: 0,
          phaseKey: 'setup.species_selection',
          seq: 1,
          sources: [{ playerId: 'p1', sourceInstanceId: 'ship-1' }],
        }],
      },
      phaseReadiness: [],
    },
    ships: { obsoleteRootShips: true },
    battleLogScratch: { currentTurnCapture: null, lastFinalizedTurnNumber: null },
    actions: [],
  };
}

function createGameRouteFixture() {
  const app = new RouteHarness();
  const store = new Map<string, any>();
  const writes: Array<{ key: string; value: any }> = [];
  let sessionId = 'p1';
  let generatedId = 0;
  registerGameRoutes(
    app as any,
    async (key) => structuredClone(store.get(key)),
    async (key, value) => {
      const copy = structuredClone(value);
      store.set(key, copy);
      writes.push({ key, value: copy });
    },
    async () => ({ sessionId }),
    () => `generated-${++generatedId}`,
  );
  return {
    app,
    store,
    writes,
    setSessionId(value: string) {
      sessionId = value;
    },
  };
}

function createFakeSupabase(store: Map<string, any>, writes: any[]) {
  return {
    from() {
      return {
        async upsert(entries: Array<{ key: string; value: any }>) {
          for (const entry of entries) {
            const copy = structuredClone(entry.value);
            store.set(entry.key, copy);
            writes.push({ key: entry.key, value: copy });
          }
          return { error: null };
        },
      };
    },
  };
}

function createIntentRouteFixture(args?: {
  gameReads?: any[];
  storedState?: any;
}) {
  const app = new RouteHarness();
  const store = new Map<string, any>();
  const writes: Array<{ key: string; value: any }> = [];
  const gameReads = [...(args?.gameReads ?? [])];
  if (args?.storedState) store.set(`game_${args.storedState.gameId}`, structuredClone(args.storedState));
  registerIntentRoutes(
    app as any,
    async (key) => {
      if (key.startsWith('game_') && !key.endsWith('_chat') && gameReads.length > 0) {
        return structuredClone(gameReads.shift());
      }
      return structuredClone(store.get(key));
    },
    async (key, value) => {
      const copy = structuredClone(value);
      store.set(key, copy);
      writes.push({ key, value: copy });
    },
    async () => ({ sessionId: 'p1' }),
    createFakeSupabase(store, writes),
  );
  return { app, store, writes };
}

function assertAncientSecretsAbsent(state: any): void {
  assert.equal('battleLogScratch' in state, false);
  assert.equal('energy' in state.players[0], false);
  assert.equal('ancient' in state.gameData, false);
  assert.equal('pendingSOLARPowerDeclarations' in state.gameData.turnData, false);
}

function createUnnormalizedTimeoutState(gameId: string) {
  const state: any = createSetupState(gameId);
  state.stateRevision = 7;
  state.turnNumber = 1;
  state.gameData.turnNumber = 1;
  state.players[0].faction = 'ancient';
  state.players.push({
    id: 'p2',
    name: 'Player Two',
    role: 'player',
    faction: 'human',
    isReady: true,
    isActive: true,
    health: 25,
    lines: 3,
    joiningLines: 0,
    energy: 12,
  });
  state.gameData.ships.p2 = [];
  state.gameData.phaseReadiness = [{
    playerId: 'p2',
    isReady: true,
    currentStep: 'setup.species_selection',
  }];
  state.gameData.clock = {
    timeControl: { baseMs: 60_000, incrementMs: 0 },
    remainingMsByPlayerId: { p1: 1, p2: 60_000 },
    lastUpdateAtMs: 0,
  };
  delete state.gameData.ancient;
  return state;
}

Deno.test('fresh constructors and join/role routes persist canonical state with one-bump responses sanitized', async () => {
  const fixture = createGameRouteFixture();
  const create = fixture.app.handler('POST', '/make-server-825e19ab/create-game');
  const createdResponse = await create(createContext({
    body: { playerName: 'Player One', timed: false },
  }));
  assert.equal(createdResponse.status, 200);
  const created = await responseJson(createdResponse);
  const gameKey = `game_${created.gameId}`;
  const fresh = fixture.store.get(gameKey);
  assert.equal(fresh.stateRevision, 1);
  assert.equal('energy' in fresh.players[0], false);
  assert.equal(fresh.gameData.ancient.energyByPlayerId.p1.battleTurnNumber, null);

  fixture.setSessionId('p2');
  const join = fixture.app.handler('POST', '/make-server-825e19ab/join-game/:gameId');
  const joinResponse = await join(createContext({
    params: { gameId: created.gameId },
    body: { playerName: 'Player Two' },
  }));
  const joined = await responseJson(joinResponse);
  assert.equal(fixture.store.get(gameKey).stateRevision, 2);
  assert.equal('p2' in fixture.store.get(gameKey).gameData.ancient.energyByPlayerId, true);
  assert.equal('ancient' in joined.gameData.gameData, false);

  fixture.setSessionId('spectator');
  const spectatorResponse = await join(createContext({
    params: { gameId: created.gameId },
    body: { playerName: 'Watcher' },
  }));
  assert.equal(spectatorResponse.status, 200);
  const afterSpectator = fixture.store.get(gameKey);
  assert.equal(afterSpectator.stateRevision, 3);
  assert.equal('spectator' in afterSpectator.gameData.ancient.energyByPlayerId, false);

  fixture.setSessionId('p2');
  afterSpectator.gameData.ancient.energyByPlayerId.p2.pool.green = 7;
  fixture.store.set(gameKey, afterSpectator);
  const switchRole = fixture.app.handler('POST', '/make-server-825e19ab/switch-role/:gameId');
  const switchResponse = await switchRole(createContext({
    params: { gameId: created.gameId },
    body: { newRole: 'spectator' },
  }));
  const switched = await responseJson(switchResponse);
  const afterSwitch = fixture.store.get(gameKey);
  assert.equal(afterSwitch.stateRevision, 4);
  assert.equal(afterSwitch.gameData.ancient.energyByPlayerId.p2.pool.green, 7);
  assert.equal('ancient' in switched.gameData.gameData, false);

  fixture.setSessionId('p1');
  const createComputer = fixture.app.handler(
    'POST',
    '/make-server-825e19ab/create-computer-game',
  );
  const computerResponse = await createComputer(createContext({
    body: { playerName: 'Player One', timed: false },
  }));
  const computer = await responseJson(computerResponse);
  const computerKey = `game_${computer.gameId}`;
  const computerState = fixture.store.get(computerKey);
  assert.equal(computerState.stateRevision, 1);
  assert.equal(computerState.players.some((player: any) => 'energy' in player), false);
  assert.deepEqual(
    Object.keys(computerState.gameData.ancient.energyByPlayerId).sort(),
    [`bot_${computer.gameId}`, 'p1'].sort(),
  );

  computerState.status = 'finished';
  fixture.store.set(computerKey, computerState);
  const rematch = fixture.app.handler(
    'POST',
    '/make-server-825e19ab/new-game-from/:gameId',
  );
  const rematchResponse = await rematch(createContext({
    params: { gameId: computer.gameId },
    body: {},
  }));
  const rematchBody = await responseJson(rematchResponse);
  const rematchState = fixture.store.get(`game_${rematchBody.gameId}`);
  assert.equal(rematchState.stateRevision, 1);
  assert.equal(rematchState.players.some((player: any) => 'energy' in player), false);
  assert.ok(rematchState.gameData.ancient);
});

Deno.test('/game-state projects curated Ancient data without writes and preserves existing privacy filters', async () => {
  const fixture = createGameRouteFixture();
  const setupState: any = createSetupState();
  setupState.players.push(
    {
      id: 'p2',
      name: 'Player Two',
      role: 'player',
      faction: 'human',
      isReady: false,
      isActive: true,
      health: 25,
      lines: 3,
      joiningLines: 0,
    },
    {
      id: 'spectator',
      name: 'Spectator',
      role: 'spectator',
      faction: 'ancient',
      isReady: false,
      isActive: false,
      health: 0,
      lines: 0,
      joiningLines: 0,
    },
  );
  setupState.gameData.ships.p1 = [{ instanceId: 'spi-public', shipDefId: 'SPI' }];
  setupState.gameData.ships.p2 = [];
  const state: any = normalizeAncientGameState(setupState).state;
  state.players[0].energy = 88;
  state.gameData.turnData.pendingSOLARPowerDeclarations = { p1: [{ hidden: true }] };
  state.gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId = {
    p1: { sourceInstanceId: 'spi-public', turnNumber: 0 },
  };
  state.gameData.ancient.energyByPlayerId.p1.pool.green = 3;
  state.gameData.ancient.schemaVersion = 2;
  state.gameData.ancient.futureAuthority = { hidden: true };
  state.gameData.ancient.solarLedgerByPlayerId.p1 = {
    battleTurnNumber: 2,
    entries: [{
      entryId: 'public-ledger',
      order: 0,
      solarPowerId: 'SLIF',
      sourceMode: 'manual',
      paidEnergy: { green: 1, red: 0, blue: 0 },
    }],
  };
  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    declarationId: 'private-declaration',
    playerId: 'p1',
    context: {
      contextVersion: 1,
      battleTurnNumber: 1,
      initialEnergy: { green: 3, red: 0, blue: 0 },
      energySourceIds: [],
    },
  };
  fixture.store.set('game_game-1', structuredClone(state));
  fixture.store.set('game_history_game-1', {
    gameId: 'game-1',
    revision: 1,
    completedTurnCount: 1,
    turns: [{
      turnNumber: 1,
      diceValue: 4,
      players: [{
        playerId: 'p1',
        name: 'Player One',
        healthEnd: 25,
        healthDelta: 0,
        fleetValueEnd: 0,
      }],
      buildLinesByPlayerId: { p1: [] },
      battleLinesByPlayerId: { p1: [] },
    }],
    currentTurnCapture: null,
  });
  fixture.writes.length = 0;

  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const warningCalls: unknown[][] = [];
  const originalWarn = console.warn;
  let body: any;
  let opponentBody: any;
  let spectatorBody: any;
  try {
    console.warn = (...args: unknown[]) => warningCalls.push(args);
    const response = await getState(createContext({ params: { gameId: 'game-1' } }));
    assert.equal(response.status, 200);
    body = await responseJson(response);
    await getState(createContext({ params: { gameId: 'game-1' } }));
    fixture.setSessionId('p2');
    opponentBody = await responseJson(
      await getState(createContext({ params: { gameId: 'game-1' } })),
    );
    fixture.setSessionId('spectator');
    spectatorBody = await responseJson(
      await getState(createContext({ params: { gameId: 'game-1' } })),
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(fixture.writes.length, 0);
  assert.equal(warningCalls.length, 0);
  assert.equal(fixture.store.get('game_game-1').stateRevision, 5);
  assert.equal(body.publicState.ancient.schemaVersion, 1);
  assert.equal(body.publicState.ancient.energyByPlayerId.p1.pool.green, 3);
  assert.equal(
    body.publicState.ancient.solarLedgerByPlayerId.p1.entries[0].entryId,
    'public-ledger',
  );
  assert.deepEqual(opponentBody.publicState.ancient, body.publicState.ancient);
  assert.deepEqual(spectatorBody.publicState.ancient, body.publicState.ancient);
  assert.deepEqual(
    body.publicState.players.map((player: any) => player.maxHealth),
    [40, 35, 35],
  );
  assert.deepEqual(opponentBody.publicState.players, body.publicState.players);
  assert.deepEqual(spectatorBody.publicState.players, body.publicState.players);
  assert.equal('acceptedDeclarationByPlayerId' in body.publicState.ancient, false);
  assert.equal('ancient' in body.gameData, false);
  assert.equal('energy' in body.players[0], false);
  assert.equal('maxHealth' in body.players[0], false);
  assert.equal('maxHealth' in body.requester, false);
  assert.equal('battleLogScratch' in body, false);
  assert.equal('ships' in body, false);
  assert.equal('shipActivationCueBatches' in body.gameData.turnData, false);
  for (const viewerBody of [body, opponentBody, spectatorBody]) {
    assert.equal(
      'thirdSpiralFirstStrikeEligibilityByPlayerId' in viewerBody.gameData.turnData,
      false,
    );
  }
  assert.deepEqual(body.gameData.turnData.pendingChargeDeclarations.p2, []);
  assert.equal(body.gameData.turnData.commitments.SECRET.p2.commitHash, undefined);
  assert.equal(body.gameData.turnData.commitments.SECRET.p2.revealPayload, undefined);

  const head = fixture.app.handler('GET', '/make-server-825e19ab/game-state-head/:gameId');
  const headBody = await responseJson(await head(createContext({ params: { gameId: 'game-1' } })));
  assert.equal('ancient' in headBody, false);
  assert.deepEqual(Object.keys(headBody).sort(), [
    'clock',
    'gameId',
    'phaseKey',
    'stateRevision',
    'status',
    'turnNumber',
  ]);

  const history = fixture.app.handler('GET', '/make-server-825e19ab/game-history/:gameId');
  const historyBody = await responseJson(
    await history(createContext({ params: { gameId: 'game-1' } })),
  );
  assert.equal(historyBody.turns[0].players[0].maxHealthEnd, 35);
  assert.equal(Number.isFinite(historyBody.turns[0].players[0].maxHealthEnd), true);
  assert.equal(fixture.writes.length, 0);
});

Deno.test('/game-state projects DOM transfer targets with shared Spiral capacity legality', async () => {
  const fixture = createGameRouteFixture();
  const setupState: any = createSetupState('dom-projection');
  setupState.players[0].faction = 'centaur';
  setupState.players.push({
    id: 'p2',
    name: 'Player Two',
    role: 'player',
    faction: 'ancient',
    isReady: false,
    isActive: true,
    health: 25,
    lines: 3,
    joiningLines: 0,
  });
  setupState.turnNumber = 2;
  setupState.currentPhase = 'battle';
  setupState.currentSubPhase = 'first_strike';
  setupState.gameData.turnNumber = 2;
  setupState.gameData.currentPhase = 'battle';
  setupState.gameData.currentSubPhase = 'first_strike';
  setupState.gameData.turnData = {
    turnNumber: 2,
    currentMajorPhase: 'battle',
    currentSubPhase: 'first_strike',
  };
  setupState.gameData.ships = {
    p1: [
      { instanceId: 'dom-source', shipDefId: 'DOM', createdTurn: 2 },
      { instanceId: 'own-spi-1', shipDefId: 'SPI' },
      { instanceId: 'own-spi-2', shipDefId: 'SPI' },
      { instanceId: 'own-spi-3', shipDefId: 'SPI' },
    ],
    p2: [
      { instanceId: 'enemy-spi', shipDefId: 'SPI' },
      { instanceId: 'enemy-vig', shipDefId: 'VIG' },
      { instanceId: 'enemy-fig', shipDefId: 'FIG' },
    ],
  };
  fixture.store.set('game_dom-projection', normalizeAncientGameState(setupState).state);

  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const atCapacity = await responseJson(
    await getState(createContext({ params: { gameId: 'dom-projection' } })),
  );
  const domAtCapacity = atCapacity.requester.availableActions.find(
    (action: any) => action.shipDefId === 'DOM',
  );
  assert.ok(domAtCapacity);
  assert.deepEqual(
    domAtCapacity.validTargets.map((target: any) => target.instanceId),
    ['enemy-vig', 'enemy-fig'],
  );

  const underCapacityState = structuredClone(fixture.store.get('game_dom-projection'));
  underCapacityState.gameData.ships.p1 = underCapacityState.gameData.ships.p1.filter(
    (candidate: any) => candidate.instanceId !== 'own-spi-3',
  );
  fixture.store.set('game_dom-projection', underCapacityState);
  const underCapacity = await responseJson(
    await getState(createContext({ params: { gameId: 'dom-projection' } })),
  );
  const domUnderCapacity = underCapacity.requester.availableActions.find(
    (action: any) => action.shipDefId === 'DOM',
  );
  assert.deepEqual(
    domUnderCapacity.validTargets.map((target: any) => target.instanceId),
    ['enemy-spi', 'enemy-vig', 'enemy-fig'],
  );
});

Deno.test('/game-state projects only the qualifying Spiral action and hides its marker from every viewer', async () => {
  const fixture = createGameRouteFixture();
  const state: any = createSetupState('spiral-first-strike-projection');
  state.players[0].faction = 'ancient';
  state.players.push(
    {
      id: 'p2',
      name: 'Player Two',
      role: 'player',
      faction: 'human',
      isReady: false,
      isActive: true,
      health: 25,
      lines: 3,
      joiningLines: 0,
    },
    {
      id: 'spectator',
      name: 'Spectator',
      role: 'spectator',
      faction: null,
      isReady: false,
      isActive: false,
      health: 0,
      lines: 0,
      joiningLines: 0,
    },
  );
  state.turnNumber = 2;
  state.currentPhase = 'battle';
  state.currentSubPhase = 'first_strike';
  state.gameData.turnNumber = 2;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'first_strike';
  state.gameData.turnData = {
    turnNumber: 2,
    currentMajorPhase: 'battle',
    currentSubPhase: 'first_strike',
    thirdSpiralFirstStrikeEligibilityByPlayerId: {
      p1: { sourceInstanceId: 'spi-3', turnNumber: 2 },
    },
  };
  state.gameData.ships = {
    p1: [
      { instanceId: 'spi-1', shipDefId: 'SPI', createdTurn: 1 },
      { instanceId: 'spi-2', shipDefId: 'SPI', createdTurn: 1 },
      { instanceId: 'spi-3', shipDefId: 'SPI', createdTurn: 2 },
    ],
    p2: [
      { instanceId: 'enemy-def', shipDefId: 'DEF' },
      { instanceId: 'enemy-core', shipDefId: 'PLU' },
      { instanceId: 'enemy-gua', shipDefId: 'GUA' },
    ],
  };
  fixture.store.set('game_spiral-first-strike-projection', state);

  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const p1Body = await responseJson(
    await getState(createContext({ params: { gameId: 'spiral-first-strike-projection' } })),
  );
  fixture.setSessionId('p2');
  const p2Body = await responseJson(
    await getState(createContext({ params: { gameId: 'spiral-first-strike-projection' } })),
  );
  fixture.setSessionId('spectator');
  const spectatorBody = await responseJson(
    await getState(createContext({ params: { gameId: 'spiral-first-strike-projection' } })),
  );

  const spiralActions = p1Body.requester.availableActions.filter(
    (action: any) => action.shipDefId === 'SPI',
  );
  assert.equal(spiralActions.length, 1);
  assert.equal(spiralActions[0].actionId, 'SPI#0');
  assert.deepEqual(spiralActions[0].choices, [{ choiceId: 'destroy' }]);
  assert.deepEqual(
    spiralActions[0].validTargets.map((target: any) => target.instanceId),
    ['enemy-def'],
  );
  assert.equal(
    p2Body.requester.availableActions.some((action: any) => action.shipDefId === 'SPI'),
    false,
  );
  assert.equal(
    spectatorBody.requester.availableActions.some((action: any) => action.shipDefId === 'SPI'),
    false,
  );
  for (const viewerBody of [p1Body, p2Body, spectatorBody]) {
    assert.equal(
      'thirdSpiralFirstStrikeEligibilityByPlayerId' in viewerBody.gameData.turnData,
      false,
    );
  }
  assert.deepEqual(
    fixture.store.get('game_spiral-first-strike-projection')
      .gameData.turnData.thirdSpiralFirstStrikeEligibilityByPlayerId,
    { p1: { sourceInstanceId: 'spi-3', turnNumber: 2 } },
  );
});

Deno.test('/game-state terminal maintenance persists normalized Ancient state with one bump', async () => {
  const fixture = createGameRouteFixture();
  const gameId = 'terminal-state';
  const gameKey = `game_${gameId}`;
  fixture.store.set(gameKey, createUnnormalizedTimeoutState(gameId));
  fixture.writes.length = 0;

  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const response = await getState(createContext({ params: { gameId } }));
  const body = await responseJson(response);
  assert.equal(response.status, 200);
  assert.equal(body.status, 'finished');
  assert.equal(body.stateRevision, 8);
  assert.equal(fixture.writes.length, 1);

  const persisted = fixture.store.get(gameKey);
  assert.equal(persisted.status, 'finished');
  assert.equal(persisted.stateRevision, 8);
  assert.equal(persisted.gameData.ancient.schemaVersion, 1);
  assert.equal(persisted.players.some((player: any) => 'energy' in player), false);
  assert.equal(
    'pendingSOLARPowerDeclarations' in persisted.gameData.turnData,
    false,
  );

  await getState(createContext({ params: { gameId } }));
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.store.get(gameKey).stateRevision, 8);
});

Deno.test('/game-state-head terminal maintenance persists normalization without changing its payload', async () => {
  const fixture = createGameRouteFixture();
  const gameId = 'terminal-head';
  const gameKey = `game_${gameId}`;
  fixture.store.set(gameKey, createUnnormalizedTimeoutState(gameId));
  fixture.writes.length = 0;

  const getHead = fixture.app.handler('GET', '/make-server-825e19ab/game-state-head/:gameId');
  const response = await getHead(createContext({ params: { gameId } }));
  const body = await responseJson(response);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(body).sort(), [
    'clock',
    'gameId',
    'phaseKey',
    'stateRevision',
    'status',
    'turnNumber',
  ]);
  assert.equal('ancient' in body, false);
  assert.equal(body.status, 'finished');
  assert.equal(body.stateRevision, 8);
  assert.equal(fixture.writes.length, 1);

  const persisted = fixture.store.get(gameKey);
  assert.equal(persisted.gameData.ancient.schemaVersion, 1);
  assert.equal(persisted.players.some((player: any) => 'energy' in player), false);
  assert.equal(
    'pendingSOLARPowerDeclarations' in persisted.gameData.turnData,
    false,
  );

  await getHead(createContext({ params: { gameId } }));
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.store.get(gameKey).stateRevision, 8);
});

Deno.test('legacy action route rejects obsolete Solar action and sanitizes early/final state responses', async () => {
  const fixture = createGameRouteFixture();
  const state: any = normalizeAncientGameState(createSetupState()).state;
  state.players[0].energy = 5;
  state.gameData.turnData.pendingSOLARPowerDeclarations = { p1: [{ hidden: true }] };
  state.gameData.phaseReadiness = [{
    playerId: 'p1',
    isReady: true,
    currentStep: 'setup.species_selection',
  }];
  fixture.store.set('game_game-1', state);
  const sendAction = fixture.app.handler('POST', '/make-server-825e19ab/send-action/:gameId');

  const obsoleteResponse = await sendAction(createContext({
    params: { gameId: 'game-1' },
    body: { actionType: 'use_solar_power', content: {} },
  }));
  assert.equal(obsoleteResponse.status, 400);

  const messageResponse = await sendAction(createContext({
    params: { gameId: 'game-1' },
    body: { actionType: 'message', content: { content: 'hello' } },
  }));
  const messageBody = await responseJson(messageResponse);
  assert.equal(messageResponse.status, 200);
  assert.equal('ancient' in messageBody.gameState.gameData, false);
  assert.equal('energy' in messageBody.gameState.players[0], false);

  const persisted = fixture.store.get('game_game-1');
  persisted.players[0].faction = 'human';
  persisted.gameData.phaseReadiness = [{
    playerId: 'p1',
    isReady: true,
    currentStep: 'setup.species_selection',
  }];
  fixture.store.set('game_game-1', persisted);
  const advanceResponse = await sendAction(createContext({
    params: { gameId: 'game-1' },
    body: { actionType: 'advance_phase', content: {} },
  }));
  const advanceBody = await responseJson(advanceResponse);
  assert.equal(advanceResponse.status, 200);
  assert.equal('ancient' in advanceBody.gameState.gameData, false);
});

Deno.test('/intent success and rejection keep one-bump persistence and composed sanitization', async () => {
  const successfulState = createSetupState('intent-success');
  const success = createIntentRouteFixture({ storedState: successfulState });
  const intent = success.app.handler('POST', '/make-server-825e19ab/intent');
  const successResponse = await intent(createContext({
    body: {
      gameId: 'intent-success',
      intentType: 'ACTION',
      turnNumber: 0,
      payload: { actionType: 'message', content: 'hello' },
    },
  }));
  const successBody = await responseJson(successResponse);
  assert.equal(successResponse.status, 200);
  assertAncientSecretsAbsent(successBody.state);
  const persistedSuccess = success.store.get('game_intent-success');
  assert.equal(persistedSuccess.stateRevision, 6);
  assert.equal('energy' in persistedSuccess.players[0], false);
  assert.ok(persistedSuccess.gameData.ancient);

  const rejectedState = createSetupState('intent-rejected');
  const rejected = createIntentRouteFixture({ storedState: rejectedState });
  const rejectedIntent = rejected.app.handler('POST', '/make-server-825e19ab/intent');
  const rejectedResponse = await rejectedIntent(createContext({
    body: {
      gameId: 'intent-rejected',
      intentType: 'ACTION',
      turnNumber: 99,
      payload: { actionType: 'message', content: 'hello' },
    },
  }));
  const rejectedBody = await responseJson(rejectedResponse);
  assert.equal(rejectedResponse.status, 400);
  assertAncientSecretsAbsent(rejectedBody.state);
  assert.equal(
    rejected.writes.some((write) => write.key === 'game_intent-rejected'),
    false,
  );
  assert.equal(rejected.store.get('game_intent-rejected').stateRevision, 5);
});

function createBuildDrawingState(gameId: string, committed: boolean, repaired: boolean) {
  const state: any = createSetupState(gameId);
  state.currentPhase = 'build';
  state.currentSubPhase = 'drawing';
  state.turnNumber = 1;
  state.gameData.currentPhase = 'build';
  state.gameData.currentSubPhase = 'drawing';
  state.gameData.turnNumber = 1;
  state.gameData.turnData = {
    turnNumber: 1,
    currentMajorPhase: 'build',
    currentSubPhase: 'drawing',
    commitments: committed
      ? { BUILD_1: { p1: { commitHash: 'hash', committedAt: 1 } } }
      : {},
  };
  state.battleLogScratch = { currentTurnCapture: null, lastFinalizedTurnNumber: null };
  if (!repaired) return state;
  return normalizeAncientGameState(state).state;
}

Deno.test('duplicate-safe /intent repairs once and skips a no-op persistence', async () => {
  const base = createBuildDrawingState('duplicate-repair', false, false);
  const latest = createBuildDrawingState('duplicate-repair', true, false);
  const repair = createIntentRouteFixture({ gameReads: [base, latest] });
  const handler = repair.app.handler('POST', '/make-server-825e19ab/intent');
  const repairResponse = await handler(createContext({
    body: {
      gameId: 'duplicate-repair',
      intentType: 'BUILD_COMMIT',
      turnNumber: 1,
      commitHash: 'hash',
    },
  }));
  const repairBody = await responseJson(repairResponse);
  assert.equal(repairResponse.status, 200);
  assertAncientSecretsAbsent(repairBody.state);
  const repairWrites = repair.writes.filter((write) => write.key === 'game_duplicate-repair');
  assert.equal(repairWrites.length, 1);
  assert.equal(repairWrites[0].value.stateRevision, 6);

  const cleanBase = createBuildDrawingState('duplicate-noop', false, true);
  const cleanLatest = createBuildDrawingState('duplicate-noop', true, true);
  const noop = createIntentRouteFixture({ gameReads: [cleanBase, cleanLatest] });
  const noopHandler = noop.app.handler('POST', '/make-server-825e19ab/intent');
  const noopResponse = await noopHandler(createContext({
    body: {
      gameId: 'duplicate-noop',
      intentType: 'BUILD_COMMIT',
      turnNumber: 1,
      commitHash: 'hash',
    },
  }));
  assert.equal(noopResponse.status, 200);
  assert.equal(
    noop.writes.some((write) => write.key === 'game_duplicate-noop'),
    false,
  );
});
