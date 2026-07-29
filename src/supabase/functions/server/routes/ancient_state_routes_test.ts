import assert from 'node:assert/strict';
import { registerGameRoutes } from './game_routes.ts';
import { registerIntentRoutes } from './intent_routes.ts';
import { normalizeAncientGameState } from '../engine/state/ancientState.ts';
import { onEnterPhase } from '../engine/phase/onEnterPhase.ts';

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
  assert.equal('solarGridDeclarationSourceIdsByPlayerId' in state.gameData.turnData, false);
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

Deno.test('/game-state projects turn-start Simulacrum support maps without changing the public Solar ledger', async () => {
  const fixture = createGameRouteFixture();
  const setupState: any = createSetupState('drawing-simulacrum');
  setupState.turnNumber = 3;
  setupState.gameData.turnNumber = 3;
  setupState.gameData.currentPhase = 'build';
  setupState.gameData.currentSubPhase = 'drawing';
  setupState.gameData.turnData.turnNumber = 3;
  setupState.gameData.turnData.currentMajorPhase = 'build';
  setupState.gameData.turnData.currentSubPhase = 'drawing';
  setupState.players[0].faction = 'ancient';
  setupState.players[0].joiningLines = 4;
  setupState.players.push(
    {
      id: 'p2',
      name: 'Player Two',
      role: 'player',
      faction: 'ancient',
      isReady: false,
      isActive: true,
      health: 25,
      lines: 3,
      joiningLines: 6,
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
  setupState.gameData.ships = {
    p1: [
      { instanceId: 'p1-public', shipDefId: 'DEF' },
      { instanceId: 'p1-hidden', shipDefId: 'ZEN', createdTurn: 3 },
    ],
    p2: [
      { instanceId: 'p2-public', shipDefId: 'DEF' },
      { instanceId: 'p2-hidden', shipDefId: 'FIG', createdTurn: 3 },
    ],
  };
  setupState.gameData.turnData.buildDrawingPublicSavedResourcesByPlayerId = {
    p1: { savedLines: 3, savedJoiningLines: 0 },
    p2: { savedLines: 3, savedJoiningLines: 0 },
  };
  const state: any = normalizeAncientGameState(setupState).state;
  state.gameData.ancient.pendingSimulacrumCopies = [
    {
      pendingCopyId: 'p1-ssim:simulacrum-copy:primary',
      declarationId: 'p1-declaration',
      ownerPlayerId: 'p1',
      sourceTargetInstanceId: 'p2-source',
      copiedShipDefId: 'ZEN',
      queuedTurnNumber: 2,
      materializationTurnNumber: 3,
      queueOrder: 0,
      capturedStartOfBattleCharges: 0,
      permanentConfiguration: {},
      sourceMode: 'primary',
      status: 'materialized',
      materializedInstanceId: 'p1-hidden',
      materializationOutcome: {
        joiningLinesGranted: 0,
        producedShips: [],
      },
    },
    {
      pendingCopyId: 'p2-ssim:simulacrum-copy:primary',
      declarationId: 'p2-declaration',
      ownerPlayerId: 'p2',
      sourceTargetInstanceId: 'p1-source',
      copiedShipDefId: 'FIG',
      queuedTurnNumber: 2,
      materializationTurnNumber: 3,
      queueOrder: 0,
      capturedStartOfBattleCharges: 0,
      permanentConfiguration: {},
      sourceMode: 'primary',
      status: 'materialized',
      materializedInstanceId: 'p2-hidden',
      materializationOutcome: {
        joiningLinesGranted: 0,
        producedShips: [],
      },
    },
  ];
  state.gameData.ancient.solarLedgerByPlayerId.p1 = {
    battleTurnNumber: 2,
    entries: [{
      entryId: 'p1-ssim',
      order: 0,
      solarPowerId: 'SSIM',
      sourceMode: 'manual',
      paidEnergy: { green: 0, red: 0, blue: 3 },
      simulacrum: {
        sourceTargetInstanceId: 'p2-source',
        copiedShipDefId: 'ZEN',
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
      },
    }],
  };
  state.gameData.ancient.solarLedgerByPlayerId.p2 = {
    battleTurnNumber: 2,
    entries: [{
      entryId: 'p2-ssim',
      order: 0,
      solarPowerId: 'SSIM',
      sourceMode: 'manual',
      paidEnergy: { green: 0, red: 0, blue: 3 },
      simulacrum: {
        sourceTargetInstanceId: 'p1-source',
        copiedShipDefId: 'FIG',
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
      },
    }],
  };
  fixture.store.set('game_drawing-simulacrum', structuredClone(state));

  const getState = fixture.app.handler(
    'GET',
    '/make-server-825e19ab/game-state/:gameId',
  );
  const owner = await responseJson(
    await getState(createContext({ params: { gameId: 'drawing-simulacrum' } })),
  );
  fixture.setSessionId('p2');
  const opponent = await responseJson(
    await getState(createContext({ params: { gameId: 'drawing-simulacrum' } })),
  );
  fixture.setSessionId('spectator');
  const spectator = await responseJson(
    await getState(createContext({ params: { gameId: 'drawing-simulacrum' } })),
  );

  const publicIds = (body: any, playerId: string) =>
    body.publicState.ships[playerId].map((entry: any) => entry.instanceId);
  for (const body of [owner, opponent, spectator]) {
    assert.deepEqual(publicIds(body, 'p1'), ['p1-public', 'p1-hidden']);
    assert.deepEqual(publicIds(body, 'p2'), ['p2-public', 'p2-hidden']);
    assert.equal(
      body.publicState.players.find((player: any) => player.id === 'p1').joiningLines,
      0,
    );
    assert.equal(
      body.publicState.players.find((player: any) => player.id === 'p2').joiningLines,
      0,
    );
    assert.equal(
      body.publicState.ancient.solarLedgerByPlayerId.p1.entries[0].entryId,
      'p1-ssim',
    );
    assert.deepEqual(
      body.publicState.ancient.solarLedgerByPlayerId.p1.entries[0].simulacrum,
      {
        sourceTargetInstanceId: 'p2-source',
        copiedShipDefId: 'ZEN',
        capturedStartOfBattleCharges: 0,
        permanentConfiguration: {},
      },
    );
    assert.equal(
      'pendingSimulacrumCopies' in body.publicState.ancient,
      false,
    );
    assert.deepEqual(
      body.publicState.ancient
        .materializedSimulacrumFleetInstanceIdsByPlayerId,
      { p1: ['p1-hidden'], p2: ['p2-hidden'] },
    );
    assert.deepEqual(
      body.publicState.ancient
        .materializedSimulacrumLedgerEntryIdsByPlayerId,
      { p1: ['p1-ssim'], p2: ['p2-ssim'] },
    );
    assert.equal('ancient' in body.gameData, false);
    assert.equal('hiddenDrawingSimulacrumShips' in body.requester, false);
  }
  assert.deepEqual(
    owner.publicState.ancient.solarLedgerByPlayerId,
    state.gameData.ancient.solarLedgerByPlayerId,
  );
  owner.publicState.ancient.solarLedgerByPlayerId.p1.entries[0].simulacrum
    .capturedStartOfBattleCharges = 99;
  owner.publicState.ancient.solarLedgerByPlayerId.p1.entries[0].simulacrum
    .permanentConfiguration.selectedNumber = 6;
  assert.deepEqual(
    fixture.store.get('game_drawing-simulacrum').gameData.ancient
      .solarLedgerByPlayerId.p1.entries[0].simulacrum,
    {
      sourceTargetInstanceId: 'p2-source',
      copiedShipDefId: 'ZEN',
      capturedStartOfBattleCharges: 0,
      permanentConfiguration: {},
    },
  );
  assert.deepEqual(
    owner.gameData.ships.p1.map((entry: any) => entry.instanceId),
    ['p1-public', 'p1-hidden'],
  );
  assert.deepEqual(
    owner.gameData.ships.p2.map((entry: any) => entry.instanceId),
    ['p2-public', 'p2-hidden'],
  );
  assert.deepEqual(
    spectator.gameData.ships.p1.map((entry: any) => entry.instanceId),
    ['p1-public', 'p1-hidden'],
  );
  assert.deepEqual(
    spectator.gameData.ships.p2.map((entry: any) => entry.instanceId),
    ['p2-public', 'p2-hidden'],
  );
  assert.equal(owner.players.find((player: any) => player.id === 'p1').joiningLines, 4);
  assert.equal(owner.players.find((player: any) => player.id === 'p2').joiningLines, 0);
  assert.equal(opponent.players.find((player: any) => player.id === 'p1').joiningLines, 0);
  assert.equal(opponent.players.find((player: any) => player.id === 'p2').joiningLines, 6);
  assert.equal(spectator.players.find((player: any) => player.id === 'p1').joiningLines, 0);
  assert.equal(spectator.players.find((player: any) => player.id === 'p2').joiningLines, 0);
  assert.equal(owner.requester.buildEconomy.joiningLinesAvailable, 4);
  assert.equal(opponent.requester.buildEconomyByPlayerId.p1.joiningLinesAvailable, 0);
  assert.equal(spectator.requester.buildEconomyByPlayerId.p1.joiningLinesAvailable, 0);

  fixture.setSessionId('late-spectator');
  const join = fixture.app.handler('POST', '/make-server-825e19ab/join-game/:gameId');
  const joined = await responseJson(await join(createContext({
    params: { gameId: 'drawing-simulacrum' },
    body: { playerName: 'Late Spectator' },
  })));
  assert.equal(
    joined.gameData.players.find((player: any) => player.id === 'p1').joiningLines,
    0,
  );
  assert.equal(
    joined.gameData.players.find((player: any) => player.id === 'p2').joiningLines,
    0,
  );

  fixture.setSessionId('spectator');
  const switchRole = fixture.app.handler(
    'POST',
    '/make-server-825e19ab/switch-role/:gameId',
  );
  const switched = await responseJson(await switchRole(createContext({
    params: { gameId: 'drawing-simulacrum' },
    body: { newRole: 'spectator' },
  })));
  assert.equal(
    switched.gameData.players.find((player: any) => player.id === 'p1').joiningLines,
    0,
  );
  assert.equal(
    switched.gameData.players.find((player: any) => player.id === 'p2').joiningLines,
    0,
  );

  const intentFixture = createIntentRouteFixture({ storedState: state });
  const intent = intentFixture.app.handler('POST', '/make-server-825e19ab/intent');
  const intentBody = await responseJson(await intent(createContext({
    body: {
      gameId: 'drawing-simulacrum',
      intentType: 'ACTION',
      turnNumber: 3,
      payload: { actionType: 'message', content: 'projection check' },
    },
  })));
  assert.equal(
    intentBody.state.players.find((player: any) => player.id === 'p1').joiningLines,
    4,
  );
  assert.equal(
    intentBody.state.players.find((player: any) => player.id === 'p2').joiningLines,
    0,
  );

  const revealedState = structuredClone(state);
  revealedState.gameData.currentPhase = 'battle';
  revealedState.gameData.currentSubPhase = 'reveal';
  revealedState.gameData.turnData.currentMajorPhase = 'battle';
  revealedState.gameData.turnData.currentSubPhase = 'reveal';
  fixture.store.set('game_drawing-simulacrum', revealedState);
  fixture.setSessionId('spectator');
  const revealed = await responseJson(
    await getState(createContext({ params: { gameId: 'drawing-simulacrum' } })),
  );
  assert.deepEqual(publicIds(revealed, 'p1'), ['p1-public', 'p1-hidden']);
  assert.equal('hiddenDrawingSimulacrumShips' in revealed.requester, false);
});

Deno.test('/game-state projects the normal CAR choice action for a turn-start copied source', async () => {
  const fixture = createGameRouteFixture();
  const setupState: any = createSetupState('copied-car-action');
  setupState.turnNumber = 3;
  setupState.gameData.turnNumber = 3;
  setupState.gameData.currentPhase = 'build';
  setupState.gameData.currentSubPhase = 'dice_roll';
  setupState.gameData.turnData.turnNumber = 3;
  setupState.gameData.turnData.currentMajorPhase = 'build';
  setupState.gameData.turnData.currentSubPhase = 'dice_roll';
  setupState.players[0].faction = 'ancient';
  setupState.players.push({
    id: 'p2',
    name: 'Player Two',
    role: 'player',
    faction: 'human',
    isReady: false,
    isActive: true,
    health: 25,
    lines: 0,
    joiningLines: 0,
  });
  setupState.gameData.ships = { p1: [], p2: [] };
  const state: any = normalizeAncientGameState(setupState).state;
  state.gameData.ancient.pendingSimulacrumCopies = [{
    pendingCopyId: 'copy-car',
    declarationId: 'declaration-2',
    ownerPlayerId: 'p1',
    sourceTargetInstanceId: 'source-car',
    copiedShipDefId: 'CAR',
    queuedTurnNumber: 2,
    materializationTurnNumber: 3,
    queueOrder: 0,
    capturedStartOfBattleCharges: 6,
    permanentConfiguration: {},
    sourceMode: 'primary',
    status: 'queued',
  }];

  const entered = onEnterPhase(
    state,
    'battle.end_of_turn_resolution',
    'build.dice_roll',
    100,
  );
  assert.equal(entered.state.gameData.currentSubPhase, 'ships_that_build');
  const copiedCar = entered.state.gameData.ships.p1.find(
    (ship: any) => ship.shipDefId === 'CAR',
  );
  assert.ok(copiedCar);
  fixture.store.set('game_copied-car-action', structuredClone(entered.state));

  const getState = fixture.app.handler(
    'GET',
    '/make-server-825e19ab/game-state/:gameId',
  );
  const body = await responseJson(
    await getState(createContext({ params: { gameId: 'copied-car-action' } })),
  );
  assert.deepEqual(body.requester.availableActions, [{
    kind: 'choice',
    actionId: 'CAR#0',
    shipDefId: 'CAR',
    sourceInstanceId: copiedCar.instanceId,
    choices: [
      { choiceId: 'defender' },
      { choiceId: 'fighter' },
      { choiceId: 'hold' },
    ],
  }]);
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

Deno.test('/game-state projects stable SOL choices only to an unaccepted Ancient declarer and hides SOL snapshot scratch', async () => {
  const fixture = createGameRouteFixture();
  const state: any = createSetupState('solar-grid-projection');
  state.turnNumber = 3;
  state.players[0].faction = 'ancient';
  state.players.push({
    id: 'p2', name: 'Player Two', role: 'player', faction: 'human', isActive: true,
    health: 25, lines: 0, joiningLines: 0,
  });
  state.gameData.turnNumber = 3;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.phaseReadiness = [];
  state.gameData.ships = {
    p1: [
      { instanceId: 'sol-z', shipDefId: 'SOL', chargesCurrent: 4 },
      { instanceId: 'foreign-int', shipDefId: 'INT', chargesCurrent: 1 },
      { instanceId: 'sol-a', shipDefId: 'SOL', chargesCurrent: 1 },
    ],
    p2: [{ instanceId: 'non-ancient-sol', shipDefId: 'SOL', chargesCurrent: 4 }],
  };
  state.gameData.turnData = {
    turnNumber: 3,
    currentMajorPhase: 'battle',
    currentSubPhase: 'charge_declaration',
    chargeDeclarationEligibleByPlayerId: { p1: true, p2: false },
    chargeDeclarationEligibleSourceIdsByPlayerId: { p1: ['foreign-int'], p2: [] },
    solarGridDeclarationSourceIdsByPlayerId: { p1: ['sol-z', 'sol-a'], p2: [] },
    chargeDeclarationFleetSnapshotByPlayerId: {
      p1: structuredClone(state.gameData.ships.p1),
      p2: structuredClone(state.gameData.ships.p2),
    },
    chargePowerUsedByInstanceId: {},
  };
  const normalized: any = normalizeAncientGameState(state).state;
  normalized.gameData.ancient.energyByPlayerId.p1 = {
    battleTurnNumber: 3,
    pool: { green: 1, red: 0, blue: 0 },
    sources: [],
  };
  fixture.store.set('game_solar-grid-projection', normalized);

  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const p1Body = await responseJson(await getState(createContext({
    params: { gameId: 'solar-grid-projection' },
  })));
  assert.deepEqual(
    p1Body.requester.availableActions.map((action: any) => [action.shipDefId, action.sourceInstanceId]),
    [['INT', 'foreign-int'], ['SOL', 'sol-a'], ['SOL', 'sol-z']],
  );
  assert.deepEqual(
    p1Body.requester.availableActions.filter((action: any) => action.shipDefId === 'SOL')
      .map((action: any) => action.choices),
    [
      [{ choiceId: 'use' }, { choiceId: 'hold' }],
      [{ choiceId: 'use' }, { choiceId: 'hold' }],
    ],
  );
  assert.equal('solarGridDeclarationSourceIdsByPlayerId' in p1Body.gameData.turnData, false);

  fixture.setSessionId('p2');
  const p2Body = await responseJson(await getState(createContext({
    params: { gameId: 'solar-grid-projection' },
  })));
  assert.equal(p2Body.requester.availableActions.some((action: any) => action.shipDefId === 'SOL'), false);
  assert.equal('solarGridDeclarationSourceIdsByPlayerId' in p2Body.gameData.turnData, false);

  const acceptedState = structuredClone(fixture.store.get('game_solar-grid-projection'));
  acceptedState.gameData.ancient.energyByPlayerId.p1.pool = { green: 2, red: 1, blue: 1 };
  acceptedState.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    contractVersion: 1,
    declarationId: 'accepted-declaration',
    declarationFingerprint: JSON.stringify({
      contractVersion: 1,
      ordinaryChargeActions: [],
      solarGridChoices: [
        { sourceInstanceId: 'sol-a', choiceId: 'hold' },
        { sourceInstanceId: 'sol-z', choiceId: 'hold' },
      ],
      solarCasts: [],
      autocastEnabled: false,
    }),
    playerId: 'p1',
    context: {
      contextVersion: 1,
      battleTurnNumber: 3,
      initialEnergy: { green: 1, red: 0, blue: 0 },
      energySourceIds: [],
    },
    ordinaryChargeActions: [],
    solarGridChoices: [
      { sourceInstanceId: 'sol-a', choiceId: 'hold' },
      { sourceInstanceId: 'sol-z', choiceId: 'hold' },
    ],
    solarCasts: [],
    autocastEnabled: false,
  };
  fixture.store.set('game_solar-grid-projection', acceptedState);
  fixture.setSessionId('p1');
  const acceptedBody = await responseJson(await getState(createContext({
    params: { gameId: 'solar-grid-projection' },
  })));
  assert.deepEqual(acceptedBody.requester.availableActions, []);
  assert.deepEqual(
    acceptedBody.publicState.ancient.energyByPlayerId.p1.pool,
    { green: 2, red: 1, blue: 1 },
  );
  assert.equal('acceptedDeclarationByPlayerId' in acceptedBody.publicState.ancient, false);
  assert.equal('solarGridDeclarationSourceIdsByPlayerId' in acceptedBody.gameData.turnData, false);

  const responseState = structuredClone(acceptedState);
  responseState.gameData.currentSubPhase = 'charge_response';
  responseState.gameData.turnData.currentSubPhase = 'charge_response';
  fixture.store.set('game_solar-grid-projection', responseState);
  const responseBody = await responseJson(await getState(createContext({
    params: { gameId: 'solar-grid-projection' },
  })));
  assert.equal(responseBody.requester.availableActions.some((action: any) => action.shipDefId === 'SOL'), false);
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
