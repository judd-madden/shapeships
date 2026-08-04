import assert from 'node:assert/strict';
import { replaceChargeDeclarationVisibilityState } from '../../engine/state/chargeDeclarationVisibility.ts';
import { applyIntent } from '../../engine/intent/IntentReducer.ts';
import { registerGameRoutes } from '../../routes/game_routes.ts';
import { registerIntentRoutes } from '../../routes/intent_routes.ts';
import type { IntentPersistence } from '../../routes/intent_persistence.ts';
import {
  applyAncientBattleRevealPreparation,
  normalizeAncientGameState,
} from '../../engine/state/ancientState.ts';
import { onEnterPhase } from '../../engine/phase/onEnterPhase.ts';

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
    async (key) => store.has(key)
      ? { status: 'found', value: structuredClone(store.get(key)) }
      : { status: 'missing' },
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

function createFakeIntentPersistence(
  store: Map<string, any>,
  writes: any[],
  gameReads: any[],
): IntentPersistence {
  return {
    async load(key) {
      if (key.startsWith('game_') && !key.startsWith('game_history_') && gameReads.length > 0) {
        const value = structuredClone(gameReads.shift());
        store.set(key, structuredClone(value));
        return { status: 'found', value };
      }
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
      const copy = structuredClone(args.value);
      store.set(args.key, copy);
      writes.push({ key: args.key, value: copy });
      return { status: 'updated' };
    },
    async insertIfMissing(key, value) {
      if (store.has(key)) return { status: 'conflict' };
      const copy = structuredClone(value);
      store.set(key, copy);
      writes.push({ key, value: copy });
      return { status: 'updated' };
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
  let sessionId = 'p1';
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
    async () => ({ sessionId }),
    createFakeIntentPersistence(store, writes, gameReads),
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
  state.gameData.turnData.acceptedShipOfEqualityTargetsByPlayerId = {
    p1: {
      'private-equ-source': {
        ownTargetInstanceId: 'private-own-target',
        opponentTargetInstanceId: 'private-opponent-target',
      },
    },
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
    assert.equal(
      'acceptedShipOfEqualityTargetsByPlayerId' in viewerBody.gameData.turnData,
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

Deno.test('JSON-reloaded Ancient state preserves owner, opponent, and spectator privacy', async () => {
  const fixture = createGameRouteFixture();
  const createPrivacyState = (gameId: string) => {
    const state: any = createSetupState(gameId);
    state.turnNumber = 3;
    state.players[0].faction = 'ancient';
    state.players.push(
      {
        id: 'p2',
        name: 'Player Two',
        role: 'player',
        faction: 'ancient',
        isReady: false,
        isActive: true,
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: 'spectator',
        name: 'Watcher',
        role: 'spectator',
        faction: null,
        isReady: false,
        isActive: false,
        health: 0,
        lines: 0,
        joiningLines: 0,
      },
    );
    state.gameData.turnNumber = 3;
    state.gameData.currentPhase = 'battle';
    state.gameData.currentSubPhase = 'charge_declaration';
    state.gameData.phaseReadiness = [{
      playerId: 'p2',
      isReady: true,
      currentStep: 'battle.charge_declaration',
    }];
    state.gameData.ships = {
      p1: [
        { instanceId: 'owner-sol', shipDefId: 'SOL', chargesCurrent: 4 },
        { instanceId: 'owner-cube', shipDefId: 'CUB', createdTurn: 3 },
      ],
      p2: [{ instanceId: 'opponent-def', shipDefId: 'DEF' }],
      spectator: [],
    };
    state.gameData.turnData = {
      turnNumber: 3,
      currentMajorPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      chargeDeclarationEligibleSourceIdsByPlayerId: { p1: [], p2: [] },
      solarGridDeclarationSourceIdsByPlayerId: {
        p1: ['owner-sol'],
        p2: [],
      },
      chargeDeclarationFleetSnapshotByPlayerId: {
        p1: structuredClone(state.gameData.ships.p1),
        p2: structuredClone(state.gameData.ships.p2),
      },
      chargePowerUsedByInstanceId: {},
      diceManipulationStage: 'cube',
      baseDiceRoll: 3,
      effectiveDiceRollByPlayerId: { p1: 5, p2: 3 },
      cubeDiceRollsByPlayerId: {
        p1: [{ sourceInstanceId: 'owner-cube', value: 5 }],
      },
      pendingCubeDiceChoiceByPlayerId: {
        p1: 'cube:owner-cube',
      },
      cubeDiceSelectionByPlayerId: {
        p1: {
          choiceId: 'cube:owner-cube',
          value: 5,
          sourceInstanceId: 'owner-cube',
        },
      },
      visibleCubeDiceValueByPlayerId: { p1: 5 },
    };
    const normalized: any = normalizeAncientGameState(state).state;
    normalized.gameData.ancient.energyByPlayerId.p1 = {
      battleTurnNumber: 3,
      pool: { green: 2, red: 1, blue: 0 },
      sources: [],
    };
    normalized.gameData.ancient.acceptedDeclarationByPlayerId.p2 = {
      schemaVersion: 1,
      contractVersion: 1,
      declarationId: 'opponent-private-declaration',
      declarationFingerprint: JSON.stringify({
        contractVersion: 1,
        ordinaryChargeActions: [],
        solarGridChoices: [],
        solarCasts: [],
        autocastEnabled: false,
      }),
      playerId: 'p2',
      context: {
        contextVersion: 1,
        battleTurnNumber: 3,
        initialEnergy: { green: 0, red: 0, blue: 0 },
        energySourceIds: [],
      },
      ordinaryChargeActions: [],
      solarGridChoices: [],
      solarCasts: [],
      autocastEnabled: false,
    };
    normalized.gameData.ancient.solarLedgerByPlayerId.p1 = {
      battleTurnNumber: 3,
      entries: [{
        entryId: 'public-life',
        order: 0,
        solarPowerId: 'SLIF',
        sourceMode: 'manual',
        paidEnergy: { green: 1, red: 0, blue: 0 },
      }],
    };
    normalized.gameData.ancient.pendingBlackHoleDestructions = [{
      pendingDestructionId: 'private-black-hole',
      declarationId: 'private-declaration',
      ownerPlayerId: 'p1',
      targetPlayerId: 'p2',
      targetInstanceIds: ['opponent-def'],
      battleTurnNumber: 3,
      lockedDamage: 2,
      status: 'committed',
    }];
    normalized.gameData.ancient.pendingSimulacrumCopies = [{
      pendingCopyId: 'private-simulacrum',
      declarationId: 'private-declaration',
      ownerPlayerId: 'p1',
      sourceTargetInstanceId: 'opponent-def',
      copiedShipDefId: 'DEF',
      queuedTurnNumber: 3,
      materializationTurnNumber: 4,
      queueOrder: 0,
      capturedStartOfBattleCharges: 0,
      permanentConfiguration: {},
      sourceMode: 'primary',
      status: 'queued',
    }];
    replaceChargeDeclarationVisibilityState(normalized);
    return normalized;
  };

  const chargeState = createPrivacyState('privacy-reload-charge');
  fixture.store.set(
    'game_privacy-reload-charge',
    JSON.parse(JSON.stringify(chargeState)),
  );
  const getState = fixture.app.handler(
    'GET',
    '/make-server-825e19ab/game-state/:gameId',
  );
  const readAs = async (playerId: string, gameId: string) => {
    fixture.setSessionId(playerId);
    return await responseJson(await getState(createContext({
      params: { gameId },
    })));
  };

  const owner = await readAs('p1', 'privacy-reload-charge');
  const opponent = await readAs('p2', 'privacy-reload-charge');
  const spectator = await readAs('spectator', 'privacy-reload-charge');
  for (const body of [owner, opponent, spectator]) {
    assert.deepEqual(
      body.publicState.ancient.energyByPlayerId.p1.pool,
      { green: 2, red: 1, blue: 0 },
    );
    assert.equal(
      body.publicState.ancient.solarLedgerByPlayerId.p1.entries[0].entryId,
      'public-life',
    );
    assert.deepEqual(
      body.publicState.visibleDice.cubeDiceValueByPlayerId,
      { p1: 5 },
    );
    assert.equal('acceptedDeclarationByPlayerId' in body.publicState.ancient, false);
    assert.equal('pendingBlackHoleDestructions' in body.publicState.ancient, false);
    assert.equal('pendingSimulacrumCopies' in body.publicState.ancient, false);
    assert.equal('cubeDiceRollsByPlayerId' in body.gameData.turnData, false);
    assert.equal('cubeDiceSelectionByPlayerId' in body.gameData.turnData, false);
  }
  assert.equal(
    owner.requester.availableActions.some((action: any) =>
      action.sourceInstanceId === 'owner-sol'
    ),
    true,
  );
  assert.deepEqual(opponent.requester.availableActions, []);
  assert.deepEqual(spectator.requester.availableActions, []);
  assert.deepEqual(owner.gameData.turnData.pendingCubeDiceChoiceByPlayerId, {
    p1: 'cube:owner-cube',
  });
  assert.deepEqual(opponent.gameData.turnData.pendingCubeDiceChoiceByPlayerId, {});
  assert.deepEqual(spectator.gameData.turnData.pendingCubeDiceChoiceByPlayerId, {});

  const drawingState = createPrivacyState('privacy-reload-drawing');
  drawingState.gameData.currentPhase = 'build';
  drawingState.gameData.currentSubPhase = 'drawing';
  drawingState.gameData.turnData.currentMajorPhase = 'build';
  drawingState.gameData.turnData.currentSubPhase = 'drawing';
  drawingState.players.find((player: any) => player.id === 'p1').joiningLines = 4;
  drawingState.gameData.turnData.buildDrawingPublicSavedResourcesByPlayerId = {
    p1: { savedLines: 3, savedJoiningLines: 0 },
    p2: { savedLines: 3, savedJoiningLines: 0 },
  };
  drawingState.gameData.ancient.pendingSimulacrumCopies[0] = {
    ...drawingState.gameData.ancient.pendingSimulacrumCopies[0],
    materializationTurnNumber: 3,
    status: 'materialized',
    materializedInstanceId: 'owner-cube',
    materializationOutcome: {
      joiningLinesGranted: 0,
      producedShips: [],
    },
  };
  fixture.store.set(
    'game_privacy-reload-drawing',
    JSON.parse(JSON.stringify(drawingState)),
  );
  const drawingOwner = await readAs('p1', 'privacy-reload-drawing');
  const drawingOpponent = await readAs('p2', 'privacy-reload-drawing');
  const drawingSpectator = await readAs('spectator', 'privacy-reload-drawing');
  for (const body of [drawingOwner, drawingOpponent, drawingSpectator]) {
    assert.equal('pendingSimulacrumCopies' in body.publicState.ancient, false);
    assert.equal('hiddenDrawingSimulacrumShips' in body.requester, false);
    assert.equal(
      body.publicState.ships.p1.some((candidate: any) =>
        candidate.instanceId === 'owner-cube'
      ),
      true,
    );
  }
  assert.equal(drawingOwner.requester.buildEconomy.joiningLinesAvailable, 4);
  assert.equal(
    drawingOpponent.requester.buildEconomyByPlayerId.p1.joiningLinesAvailable,
    0,
  );
  assert.equal(
    drawingSpectator.requester.buildEconomyByPlayerId.p1.joiningLinesAvailable,
    0,
  );
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

  const oneUnreservedState = structuredClone(fixture.store.get('game_dom-projection'));
  oneUnreservedState.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId = {
    p1: {
      'other-source': {
        actionId: 'GUA#0',
        sourceInstanceId: 'other-source',
        choiceId: 'destroy',
        targetInstanceId: 'enemy-vig',
      },
    },
  };
  fixture.store.set('game_dom-projection', oneUnreservedState);
  const oneUnreserved = await responseJson(
    await getState(createContext({ params: { gameId: 'dom-projection' } })),
  );
  const domOneUnreserved = oneUnreserved.requester.availableActions.find(
    (action: any) => action.shipDefId === 'DOM',
  );
  assert.deepEqual(
    domOneUnreserved.validTargets.map((target: any) => target.instanceId),
    ['enemy-fig'],
  );
  assert.equal(domOneUnreserved.requiredTargetCount, 1);

  const zeroUnreservedState = structuredClone(oneUnreservedState);
  zeroUnreservedState.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId.p1[
    'another-source'
  ] = {
    actionId: 'SAC#0',
    sourceInstanceId: 'another-source',
    choiceId: 'destroy',
    targetInstanceId: 'enemy-fig',
  };
  fixture.store.set('game_dom-projection', zeroUnreservedState);
  const zeroUnreserved = await responseJson(
    await getState(createContext({ params: { gameId: 'dom-projection' } })),
  );
  assert.equal(
    zeroUnreserved.requester.availableActions.some(
      (action: any) => action.shipDefId === 'DOM',
    ),
    false,
  );

  const underCapacityState = normalizeAncientGameState(structuredClone(setupState)).state;
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

Deno.test('/game-state derives EQU pairs after same-player reservation filtering and ignores opponent reservations', async () => {
  const state: any = normalizeAncientGameState(createSetupState('equ-reservation-projection')).state;
  state.turnNumber = 3;
  state.players[0].faction = 'human';
  state.players.push({
    id: 'p2', name: 'Player Two', role: 'player', faction: 'human', isActive: true,
    health: 25, lines: 0, joiningLines: 0,
  });
  state.players.push({
    id: 'spectator', name: 'Watcher', role: 'spectator', faction: null, isActive: true,
    health: 0, lines: 0, joiningLines: 0,
  });
  state.gameData.turnNumber = 3;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.phaseReadiness = [];
  state.gameData.ships = {
    p1: [
      { instanceId: 'p1-equ-a', shipDefId: 'EQU', chargesCurrent: 1 },
      { instanceId: 'p1-equ-b', shipDefId: 'EQU', chargesCurrent: 1 },
      { instanceId: 'p1-def-reserved', shipDefId: 'DEF' },
      { instanceId: 'p1-def-orphan', shipDefId: 'DEF' },
      { instanceId: 'p1-int-opponent-reserved', shipDefId: 'INT' },
    ],
    p2: [
      { instanceId: 'p2-equ-a', shipDefId: 'EQU', chargesCurrent: 1 },
      { instanceId: 'p2-def-reserved', shipDefId: 'DEF' },
      { instanceId: 'p2-int-opponent-reserved', shipDefId: 'INT' },
    ],
  };
  state.gameData.voidShipsByPlayerId = { p1: [], p2: [] };
  state.gameData.pendingTurn = {
    damageByPlayerId: {},
    healByPlayerId: {},
    breakdownEntries: [],
  };
  state.gameData.turnData = {
    turnNumber: 3,
    currentMajorPhase: 'battle',
    currentSubPhase: 'charge_declaration',
    chargeDeclarationEligibleSourceIdsByPlayerId: {
      p1: ['p1-equ-a', 'p1-equ-b'],
      p2: ['p2-equ-a'],
    },
    solarGridDeclarationSourceIdsByPlayerId: { p1: [], p2: [] },
    chargeDeclarationFleetSnapshotByPlayerId: structuredClone(state.gameData.ships),
    chargePowerUsedByInstanceId: {},
  };
  state.gameData.powerMemory = { onceOnlyFired: {}, frigateTriggerByInstanceId: {} };
  replaceChargeDeclarationVisibilityState(state);

  const p2Accepted = await applyIntent(state, 'p2', {
    gameId: state.gameId,
    intentType: 'ACTION',
    turnNumber: 3,
    nonce: 'p2-equ-accepted',
    payload: {
      actionType: 'power',
      actionId: 'EQU#0',
      sourceInstanceId: 'p2-equ-a',
      choiceId: 'damage',
      targetInstanceIds: ['p2-int-opponent-reserved', 'p1-int-opponent-reserved'],
    },
  }, 100);
  assert.equal(p2Accepted.ok, true, p2Accepted.rejected?.message);

  const p1Accepted = await applyIntent(p2Accepted.state, 'p1', {
    gameId: state.gameId,
    intentType: 'ACTION',
    turnNumber: 3,
    nonce: 'p1-equ-accepted',
    payload: {
      actionType: 'power',
      actionId: 'EQU#0',
      sourceInstanceId: 'p1-equ-a',
      choiceId: 'damage',
      targetInstanceIds: ['p1-def-reserved', 'p2-def-reserved'],
    },
  }, 101);
  assert.equal(p1Accepted.ok, true, p1Accepted.rejected?.message);
  assert.deepEqual(
    p1Accepted.state.gameData.turnData.acceptedShipOfEqualityTargetsByPlayerId,
    {
      p1: {
        'p1-equ-a': {
          ownTargetInstanceId: 'p1-def-reserved',
          opponentTargetInstanceId: 'p2-def-reserved',
        },
      },
      p2: {
        'p2-equ-a': {
          ownTargetInstanceId: 'p2-int-opponent-reserved',
          opponentTargetInstanceId: 'p1-int-opponent-reserved',
        },
      },
    },
  );

  const fixture = createGameRouteFixture();
  fixture.store.set('game_equ-reservation-projection', p1Accepted.state);
  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const p1Body = await responseJson(
    await getState(createContext({ params: { gameId: 'equ-reservation-projection' } })),
  );
  const equalityAction = p1Body.requester.availableActions.find(
    (action: any) => action.sourceInstanceId === 'p1-equ-b',
  );
  assert.ok(equalityAction);
  assert.deepEqual(
    equalityAction.validOwnTargets.map((target: any) => target.instanceId),
    ['p1-int-opponent-reserved'],
  );
  assert.deepEqual(
    equalityAction.validOpponentTargets.map((target: any) => target.instanceId),
    ['p2-int-opponent-reserved'],
  );

  fixture.setSessionId('p2');
  const p2Body = await responseJson(
    await getState(createContext({ params: { gameId: 'equ-reservation-projection' } })),
  );
  fixture.setSessionId('spectator');
  const spectatorBody = await responseJson(
    await getState(createContext({ params: { gameId: 'equ-reservation-projection' } })),
  );
  for (const body of [p1Body, p2Body, spectatorBody]) {
    assert.equal(
      'acceptedShipOfEqualityTargetsByPlayerId' in body.gameData.turnData,
      false,
    );
  }
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
  replaceChargeDeclarationVisibilityState(normalized);
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

});

Deno.test('/game-state freezes declaration consequences for every viewer and releases them only after phase exit', async () => {
  const fixture = createGameRouteFixture();
  const state: any = normalizeAncientGameState(createSetupState('charge-privacy-barrier')).state;
  state.turnNumber = 3;
  state.players[0].faction = 'ancient';
  state.players.push(
    {
      id: 'p2', name: 'Player Two', role: 'player', faction: 'human', isActive: true,
      health: 35, lines: 4, joiningLines: 1,
    },
    {
      id: 'spectator', name: 'Watcher', role: 'spectator', faction: null, isActive: true,
      health: 0, lines: 0, joiningLines: 0,
    },
  );
  state.gameData.turnNumber = 3;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.phaseReadiness = [];
  state.gameData.ships = {
    p1: [
      { instanceId: 'p1-equ', shipDefId: 'EQU', chargesCurrent: 1 },
      { instanceId: 'p1-spi', shipDefId: 'SPI' },
      { instanceId: 'p1-orb', shipDefId: 'ORB' },
      { instanceId: 'p1-frigate', shipDefId: 'FRI' },
      {
        instanceId: 'p1-qua',
        shipDefId: 'QUA',
        permanentConfiguration: { selectedNumber: 4 },
      },
    ],
    p2: [
      { instanceId: 'p2-equ', shipDefId: 'EQU', chargesCurrent: 1 },
      { instanceId: 'p2-spi', shipDefId: 'SPI' },
      { instanceId: 'p2-orb', shipDefId: 'ORB' },
    ],
  };
  state.gameData.voidShipsByPlayerId = { p1: [], p2: [] };
  state.gameData.turnData = {
    turnNumber: 3,
    currentMajorPhase: 'battle',
    currentSubPhase: 'charge_declaration',
    chargeDeclarationEligibleSourceIdsByPlayerId: {
      p1: ['p1-equ'],
      p2: ['p2-equ'],
    },
    solarGridDeclarationSourceIdsByPlayerId: { p1: [], p2: [] },
    chargeDeclarationFleetSnapshotByPlayerId: structuredClone(state.gameData.ships),
    chargePowerUsedByInstanceId: {},
    effectiveDiceRollByPlayerId: { p1: 4, p2: 4 },
  };
  state.gameData.pendingTurn = {
    damageByPlayerId: {},
    healByPlayerId: {},
    breakdownEntries: [],
  };
  state.gameData.powerMemory = {
    onceOnlyFired: { 'pre-existing::memory': true },
    frigateTriggerByInstanceId: { 'p1-frigate': 5 },
    unknownFutureMemory: { secret: true },
  };
  applyAncientBattleRevealPreparation(state);
  replaceChargeDeclarationVisibilityState(state);

  state.players.find((player: any) => player.id === 'p1').health = 20;
  state.players.find((player: any) => player.id === 'p1').name = 'Live Renamed Player';
  state.players.find((player: any) => player.id === 'p1').lines = 9;
  state.gameData.ships.p1 = [
    { instanceId: 'p1-equ', shipDefId: 'EQU', chargesCurrent: 0 },
    { instanceId: 'p1-frigate', shipDefId: 'FRI' },
    {
      instanceId: 'p1-qua',
      shipDefId: 'QUA',
      permanentConfiguration: { selectedNumber: 4 },
    },
  ];
  state.gameData.ships.p2 = [
    { instanceId: 'p2-equ', shipDefId: 'EQU', chargesCurrent: 1 },
  ];
  state.gameData.voidShipsByPlayerId = {
    p1: [
      { instanceId: 'p1-spi', shipDefId: 'SPI' },
      { instanceId: 'p1-orb', shipDefId: 'ORB' },
    ],
    p2: [
      { instanceId: 'p2-spi', shipDefId: 'SPI' },
      { instanceId: 'p2-orb', shipDefId: 'ORB' },
    ],
  };
  state.gameData.pendingTurn.damageByPlayerId = { p2: 7 };
  state.gameData.powerMemory.onceOnlyFired = { 'p1-equ::EQU#0': true };
  state.players.find((player: any) => player.id === 'p1').maxHealth = 1;
  state.gameData.turnData.pendingEffects = [{ kind: 'Destroy', targetPlayerId: 'p2' }];
  state.gameData.turnData.chargePowerUsedByInstanceId = { 'p1-equ': 3 };
  state.gameData.turnData.chargeDeclarationAcknowledgements.chargeAfterByPlayerId = {
    p1: { 'p1-equ': 0 },
  };
  state.gameData.turnData.shipActivationCueBatches = [
    {
      key: 'ship-activation:2:battle.charge_declaration:1',
      turnNumber: 2,
      phaseKey: 'battle.charge_declaration',
      seq: 1,
      sources: [{ playerId: 'p2', sourceInstanceId: 'prior-turn-source' }],
    },
    {
      key: 'ship-activation:3:battle.charge_declaration:1',
      turnNumber: 3,
      phaseKey: 'battle.charge_declaration',
      seq: 1,
      sources: [{ playerId: 'p1', sourceInstanceId: 'p1-equ' }],
    },
  ];
  state.gameData.phaseReadiness = [{
    playerId: 'p1',
    isReady: true,
    currentStep: 'battle.charge_declaration',
  }];
  state.gameData.ancient.energyByPlayerId.p1.pool = { green: 2, red: 1, blue: 1 };
  state.gameData.ancient.solarLedgerByPlayerId.p1 = {
    battleTurnNumber: 3,
    entries: [{
      entryId: 'own-accepted-ledger',
      order: 0,
      solarPowerId: 'SLIF',
      sourceMode: 'manual',
      paidEnergy: { green: 1, red: 0, blue: 0 },
    }],
  };
  state.gameData.ancient.acceptedDeclarationByPlayerId.p1 = {
    schemaVersion: 1,
    contractVersion: 1,
    declarationId: 'p1-accepted',
    declarationFingerprint: JSON.stringify({
      contractVersion: 1,
      ordinaryChargeActions: [],
      solarGridChoices: [],
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
    solarGridChoices: [],
    solarCasts: [],
    autocastEnabled: false,
  };
  fixture.store.set('game_charge-privacy-barrier', state);

  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const readAs = async (participantId: string) => {
    fixture.setSessionId(participantId);
    return await responseJson(await getState(createContext({
      params: { gameId: 'charge-privacy-barrier' },
    })));
  };
  const p1Body = await readAs('p1');
  const p2Body = await readAs('p2');
  const spectatorBody = await readAs('spectator');

  for (const body of [p1Body, p2Body, spectatorBody]) {
    assert.deepEqual(
      body.publicState.ships.p1.map((ship: any) => ship.instanceId),
      ['p1-equ', 'p1-spi', 'p1-orb', 'p1-frigate', 'p1-qua'],
    );
    assert.deepEqual(
      body.publicState.ships.p2.map((ship: any) => ship.instanceId),
      ['p2-equ', 'p2-spi', 'p2-orb'],
    );
    assert.deepEqual(body.publicState.voidShipsByPlayerId, { p1: [], p2: [] });
    assert.equal(body.publicState.players.find((player: any) => player.id === 'p1').health, 25);
    assert.equal(body.publicState.players.find((player: any) => player.id === 'p1').maxHealth, 40);
    assert.equal(body.publicState.players.find((player: any) => player.id === 'p1').name, 'Live Renamed Player');
    assert.equal(body.publicState.players.find((player: any) => player.id === 'p1').lines, 9);
    assert.equal(body.publicState.phaseReadiness[0].isReady, true);
    assert.equal(body.publicState.bonusLinesByPlayerId.p1, 1);
    assert.equal(body.requester.buildEconomyByPlayerId.p1.ordinaryBonusLines, 1);
    assert.equal('pendingTurn' in body.gameData, false);
    assert.deepEqual(body.gameData.powerMemory, {
      frigateTriggerByInstanceId: { 'p1-frigate': 5 },
    });
    assert.equal(
      body.publicState.ships.p1.find(
        (ship: any) => ship.instanceId === 'p1-qua',
      ).permanentConfiguration.selectedNumber,
      4,
    );
    for (const internalField of [
      'chargeDeclarationVisibilitySnapshot',
      'chargeDeclarationAcknowledgements',
      'chargeDeclarationFleetSnapshotByPlayerId',
      'chargeDeclarationEligibleSourceIdsByPlayerId',
      'chargePowerUsedByInstanceId',
      'pendingEffects',
      'shipActivationCueBatches',
    ]) {
      assert.equal(internalField in body.gameData.turnData, false);
    }
    assert.deepEqual(
      body.publicState.presentationEvents.shipActivationCueBatches.map(
        (batch: any) => batch.key,
      ),
      ['ship-activation:2:battle.charge_declaration:1'],
    );
    assert.equal(
      body.publicState.ancient.energyByPlayerId.p1.sources.some(
        (source: any) =>
          source.sourceInstanceId === 'p1-qua' &&
          source.sourceShipDefId === 'QUA',
      ),
      true,
    );
    assert.equal(
      'maxHealth' in body.players.find((player: any) => player.id === 'p1'),
      false,
    );
  }
  assert.equal(
    p1Body.publicState.ships.p1.find((ship: any) => ship.instanceId === 'p1-equ').chargesCurrent,
    0,
  );
  assert.equal(
    p2Body.publicState.ships.p1.find((ship: any) => ship.instanceId === 'p1-equ').chargesCurrent,
    1,
  );
  assert.equal(
    spectatorBody.publicState.ships.p1.find((ship: any) => ship.instanceId === 'p1-equ').chargesCurrent,
    1,
  );
  assert.deepEqual(p1Body.requester.availableActions, []);
  assert.equal(p2Body.requester.availableActions.some((action: any) => action.shipDefId === 'EQU'), true);
  assert.equal(p1Body.requester.presentationEvents.shipActivationCueBatches.length, 1);
  assert.deepEqual(p2Body.requester.presentationEvents.shipActivationCueBatches, []);
  assert.deepEqual(spectatorBody.requester.presentationEvents.shipActivationCueBatches, []);
  assert.deepEqual(
    p1Body.publicState.ancient.energyByPlayerId.p1.pool,
    { green: 2, red: 1, blue: 1 },
  );
  assert.equal(
    p1Body.publicState.ancient.solarLedgerByPlayerId.p1.entries[0].entryId,
    'own-accepted-ledger',
  );
  assert.deepEqual(
    p2Body.publicState.ancient.energyByPlayerId.p1.pool,
    { green: 0, red: 0, blue: 2 },
  );

  const terminal = structuredClone(fixture.store.get('game_charge-privacy-barrier'));
  terminal.status = 'finished';
  terminal.result = 'win';
  terminal.resultReason = 'timeout';
  terminal.winnerPlayerId = 'p2';
  fixture.store.set('game_charge-privacy-barrier', terminal);
  const terminalBody = await readAs('spectator');
  assert.deepEqual(
    terminalBody.publicState.ships.p1.map((ship: any) => ship.instanceId),
    ['p1-equ', 'p1-spi', 'p1-orb', 'p1-frigate', 'p1-qua'],
  );
  assert.deepEqual(terminalBody.publicState.voidShipsByPlayerId, { p1: [], p2: [] });
  assert.deepEqual(terminalBody.gameData.powerMemory, {
    frigateTriggerByInstanceId: { 'p1-frigate': 5 },
  });
  assert.deepEqual(
    terminalBody.publicState.presentationEvents.shipActivationCueBatches.map(
      (batch: any) => batch.key,
    ),
    ['ship-activation:2:battle.charge_declaration:1'],
  );
  assert.equal(terminalBody.result.resultReason, 'timeout');

  const revealed = structuredClone(terminal);
  revealed.status = 'active';
  revealed.gameData.currentSubPhase = 'end_of_turn_resolution';
  revealed.gameData.turnData.currentSubPhase = 'end_of_turn_resolution';
  fixture.store.set('game_charge-privacy-barrier', revealed);
  const revealedBody = await readAs('spectator');
  assert.deepEqual(
    revealedBody.publicState.ships.p1.map((ship: any) => ship.instanceId),
    ['p1-equ', 'p1-frigate', 'p1-qua'],
  );
  assert.deepEqual(
    revealedBody.publicState.voidShipsByPlayerId.p1.map((ship: any) => ship.instanceId),
    ['p1-spi', 'p1-orb'],
  );
  assert.deepEqual(
    revealedBody.publicState.presentationEvents.shipActivationCueBatches.map(
      (batch: any) => batch.key,
    ),
    [
      'ship-activation:2:battle.charge_declaration:1',
      'ship-activation:3:battle.charge_declaration:1',
    ],
  );
  assert.equal('pendingTurn' in revealedBody.gameData, true);
  assert.equal('powerMemory' in revealedBody.gameData, true);
});

Deno.test('/game-state surfaces a stale declaration legality invariant even for a ready requester', async () => {
  const fixture = createGameRouteFixture();
  const state: any = normalizeAncientGameState(createSetupState('stale-ready-legality')).state;
  state.turnNumber = 3;
  state.gameData.turnNumber = 3;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.ships = {
    p1: [{ instanceId: 'p1-equ', shipDefId: 'EQU', chargesCurrent: 1 }],
  };
  state.gameData.turnData = {
    turnNumber: 3,
    currentMajorPhase: 'battle',
    currentSubPhase: 'charge_declaration',
    chargeDeclarationFleetSnapshotByPlayerId: structuredClone(state.gameData.ships),
  };
  state.gameData.phaseReadiness = [{
    playerId: 'p1',
    isReady: true,
    currentStep: 'battle.charge_declaration',
  }];
  replaceChargeDeclarationVisibilityState(state);
  state.gameData.turnData.chargeDeclarationVisibilitySnapshot.battleTurnNumber = 2;
  fixture.store.set('game_stale-ready-legality', state);

  const getState = fixture.app.handler('GET', '/make-server-825e19ab/game-state/:gameId');
  const response = await getState(createContext({
    params: { gameId: 'stale-ready-legality' },
  }));
  assert.equal(response.status, 500);
  assert.equal((await responseJson(response)).error, 'Internal server error');
});

Deno.test('/intent filters declaration effects after history processing and returns requester-safe state', async () => {
  const state: any = normalizeAncientGameState(createSetupState('intent-charge-privacy')).state;
  state.turnNumber = 3;
  state.players.push({
    id: 'p2', name: 'Player Two', role: 'player', faction: 'human', isActive: true,
    health: 25, lines: 0, joiningLines: 0,
  });
  state.gameData.turnNumber = 3;
  state.gameData.currentPhase = 'battle';
  state.gameData.currentSubPhase = 'charge_declaration';
  state.gameData.phaseReadiness = [];
  state.gameData.ships = {
    p1: [{ instanceId: 'p1-int', shipDefId: 'INT', chargesCurrent: 1 }],
    p2: [],
  };
  state.gameData.voidShipsByPlayerId = { p1: [], p2: [] };
  state.gameData.pendingTurn = { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] };
  state.gameData.turnData = {
    turnNumber: 3,
    currentMajorPhase: 'battle',
    currentSubPhase: 'charge_declaration',
    chargeDeclarationEligibleSourceIdsByPlayerId: { p1: ['p1-int'], p2: [] },
    solarGridDeclarationSourceIdsByPlayerId: { p1: [], p2: [] },
    chargeDeclarationFleetSnapshotByPlayerId: structuredClone(state.gameData.ships),
    chargePowerUsedByInstanceId: {},
  };
  replaceChargeDeclarationVisibilityState(state);
  const fixture = createIntentRouteFixture({ storedState: state });
  const intent = fixture.app.handler('POST', '/make-server-825e19ab/intent');
  const response = await intent(createContext({
    body: {
      gameId: state.gameId,
      intentType: 'ACTION',
      turnNumber: 3,
      payload: {
        actionType: 'power',
        actionId: 'INT#0',
        sourceInstanceId: 'p1-int',
        choiceId: 'damage',
      },
    },
  }));
  const body = await responseJson(response);
  assert.equal(response.status, 200);
  assert.deepEqual(body.events, []);
  assert.equal(body.state.gameData.ships.p1[0].chargesCurrent, 0);
  assert.equal('pendingTurn' in body.state.gameData, false);
  assert.equal('chargeDeclarationAcknowledgements' in body.state.gameData.turnData, false);
  const persisted = fixture.store.get('game_intent-charge-privacy');
  assert.equal(persisted.gameData.pendingTurn.damageByPlayerId.p2 > 0, true);
  assert.equal(
    persisted.gameData.turnData.chargeDeclarationAcknowledgements
      .chargeAfterByPlayerId.p1['p1-int'],
    0,
  );
});

Deno.test('/intent terminal Declaration resolution finalizes once without initializing another turn', async () => {
  const ships = {
    p1: [{ instanceId: 'p1-int', shipDefId: 'INT', chargesCurrent: 1 }],
    p2: [{ instanceId: 'p2-int', shipDefId: 'INT', chargesCurrent: 1 }],
  };
  const state: any = normalizeAncientGameState({
    gameId: 'terminal-declaration-resolution',
    status: 'active',
    stateRevision: 5,
    turnNumber: 3,
    players: [
      {
        id: 'p1', name: 'Player One', role: 'player', faction: 'human', isActive: true,
        health: 20, lines: 0, joiningLines: 0,
      },
      {
        id: 'p2', name: 'Player Two', role: 'player', faction: 'human', isActive: true,
        health: 5, lines: 0, joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'battle',
      currentSubPhase: 'charge_declaration',
      phaseReadiness: [],
      ships,
      voidShipsByPlayerId: { p1: [], p2: [] },
      pendingTurn: { damageByPlayerId: {}, healByPlayerId: {}, breakdownEntries: [] },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'battle',
        currentSubPhase: 'charge_declaration',
        chargeDeclarationEligibleSourceIdsByPlayerId: {
          p1: ['p1-int'],
          p2: ['p2-int'],
        },
        solarGridDeclarationSourceIdsByPlayerId: { p1: [], p2: [] },
        chargeDeclarationFleetSnapshotByPlayerId: structuredClone(ships),
        chargePowerUsedByInstanceId: {},
      },
    },
    battleLogScratch: { currentTurnCapture: null, lastFinalizedTurnNumber: null },
  }).state;
  replaceChargeDeclarationVisibilityState(state);

  const fixture = createIntentRouteFixture({ storedState: state });
  const intent = fixture.app.handler('POST', '/make-server-825e19ab/intent');
  const submit = async (body: Record<string, unknown>) => {
    const response = await intent(createContext({
      body: {
        gameId: state.gameId,
        turnNumber: 3,
        ...body,
      },
    }));
    return { response, body: await responseJson(response) };
  };

  fixture.setSessionId('p2');
  assert.equal((await submit({
    intentType: 'ACTION',
    nonce: 'p2-hold',
    payload: {
      actionType: 'power',
      actionId: 'INT#0',
      sourceInstanceId: 'p2-int',
      choiceId: 'hold',
    },
  })).response.status, 200);
  const firstReady = await submit({
    intentType: 'DECLARE_READY',
    nonce: 'p2-ready',
    payload: {},
  });
  assert.equal(firstReady.response.status, 200);
  assert.equal(
    fixture.store.get('game_terminal-declaration-resolution').gameData.currentSubPhase,
    'charge_declaration',
  );

  fixture.setSessionId('p1');
  assert.equal((await submit({
    intentType: 'ACTION',
    nonce: 'p1-damage',
    payload: {
      actionType: 'power',
      actionId: 'INT#0',
      sourceInstanceId: 'p1-int',
      choiceId: 'damage',
    },
  })).response.status, 200);
  const finalReady = await submit({
    intentType: 'DECLARE_READY',
    nonce: 'p1-ready',
    payload: {},
  });
  assert.equal(finalReady.response.status, 200);
  assert.equal(finalReady.body.state.status, 'finished');
  assert.equal(
    finalReady.body.events.filter((event: any) =>
      event.type === 'BATTLE_LOG_FINALIZE_TURN'
    ).length,
    1,
  );
  assert.equal(
    finalReady.body.events.some((event: any) =>
      event.type === 'PHASE_ADVANCED' &&
      event.from === 'battle.charge_declaration' &&
      event.to === 'battle.end_of_turn_resolution'
    ),
    true,
  );

  const persisted = fixture.store.get('game_terminal-declaration-resolution');
  assert.equal(persisted.status, 'finished');
  assert.equal(persisted.turnNumber, 3);
  assert.equal(persisted.gameData.turnNumber, 3);
  assert.equal(persisted.players.find((player: any) => player.id === 'p2').health, 0);
  assert.equal(
    'chargeDeclarationVisibilitySnapshot' in persisted.gameData.turnData,
    false,
  );
  assert.equal(
    'chargeDeclarationAcknowledgements' in persisted.gameData.turnData,
    false,
  );
  assert.equal('diceRoll' in persisted.gameData, false);
  assert.equal('diceRolled' in persisted.gameData.turnData, false);

  const historyKey = 'game_history_terminal-declaration-resolution';
  const history = fixture.store.get(historyKey);
  assert.equal(history.completedTurnCount, 1);
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].turnNumber, 3);

  const afterFinish = await submit({
    intentType: 'DECLARE_READY',
    nonce: 'p1-ready-after-finish',
    payload: {},
  });
  assert.equal(afterFinish.response.status, 400);
  assert.equal(fixture.store.get(historyKey).completedTurnCount, 1);
  assert.equal(fixture.store.get(historyKey).turns.length, 1);
});

Deno.test('/game-state hard-prunes raw legacy Cube Convert entries before build projection', async () => {
  const fixture = createGameRouteFixture();
  const state: any = createSetupState('convert-build-projection');
  state.turnNumber = 4;
  state.currentPhase = 'build';
  state.currentSubPhase = 'line_generation';
  state.players[0].faction = 'ancient';
  state.players[0].lines = 7;
  state.players.push({
    id: 'p2',
    name: 'Player Two',
    role: 'player',
    faction: 'human',
    isReady: false,
    isActive: true,
    health: 25,
    lines: 3,
    joiningLines: 0,
  });
  state.gameData.turnNumber = 4;
  state.gameData.currentPhase = 'build';
  state.gameData.currentSubPhase = 'line_generation';
  state.gameData.ships = { p1: [], p2: [] };
  state.gameData.turnData = {
    turnNumber: 4,
    currentMajorPhase: 'build',
    currentSubPhase: 'line_generation',
    diceRolled: true,
    diceFinalized: true,
    effectiveDiceRoll: 3,
    effectiveDiceRollByPlayerId: { p1: 3, p2: 3 },
    linesDistributed: true,
  };

  const canonicalState = normalizeAncientGameState(state).state;
  const persistedLegacyState: unknown = structuredClone(canonicalState);
  const rawPersistedState = persistedLegacyState as any;
  rawPersistedState.gameData.ancient.solarLedgerByPlayerId.p1 = {
    battleTurnNumber: 3,
    entries: [
      {
        entryId: 'convert-manual',
        order: 0,
        solarPowerId: 'SCON',
        sourceMode: 'manual',
        paidEnergy: { green: 0, red: 0, blue: 1 },
      },
      {
        entryId: 'convert-autocast',
        order: 1,
        solarPowerId: 'SCON',
        sourceMode: 'autocast',
        paidEnergy: { green: 0, red: 0, blue: 1 },
      },
      {
        entryId: 'convert-cube-a',
        order: 2,
        solarPowerId: 'SCON',
        sourceMode: 'cube',
        paidEnergy: { green: 0, red: 0, blue: 0 },
      },
      {
        entryId: 'convert-cube-b',
        order: 3,
        solarPowerId: 'SCON',
        sourceMode: 'cube',
        paidEnergy: { green: 0, red: 0, blue: 0 },
      },
    ],
  };
  fixture.store.set('game_convert-build-projection', rawPersistedState);

  const getState = fixture.app.handler(
    'GET',
    '/make-server-825e19ab/game-state/:gameId',
  );
  const body = await responseJson(await getState(createContext({
    params: { gameId: 'convert-build-projection' },
  })));

  assert.deepEqual(
    body.publicState.ancient.solarLedgerByPlayerId.p1.entries.map(
      (entry: any) => [entry.entryId, entry.sourceMode],
    ),
    [
      ['convert-manual', 'manual'],
      ['convert-autocast', 'autocast'],
    ],
  );
  assert.equal(body.publicState.bonusLinesByPlayerId.p1, 2);
  assert.deepEqual(body.publicState.bonusBreakdownByPlayerId.p1, [{
    rowKind: 'solar_power',
    solarPowerId: 'SCON',
    label: 'Convert',
    count: 2,
    amount: 2,
    amountText: '2',
  }]);
  assert.equal(body.requester.buildEconomy.ordinaryBonusLines, 2);
  assert.equal(
    body.requester.buildEconomyByPlayerId.p1.ordinaryBonusLines,
    2,
  );
  assert.equal(
    body.requester.buildEconomyByPlayerId.p2.ordinaryBonusLines,
    0,
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

Deno.test('/game-state keeps Cube rolls private while projecting one public value', async () => {
  const fixture = createGameRouteFixture();
  const state: any = createSetupState('cube-projection');
  state.status = 'active';
  state.turnNumber = 2;
  state.players[0].faction = 'human';
  state.players.push(
    {
      id: 'p2',
      name: 'Player Two',
      role: 'player',
      faction: 'centaur',
      health: 25,
      lines: 0,
      joiningLines: 0,
    },
    {
      id: 'spectator',
      name: 'Watcher',
      role: 'spectator',
      faction: null,
      health: 25,
      lines: 0,
      joiningLines: 0,
    },
  );
  Object.assign(state.gameData, {
    turnNumber: 2,
    currentPhase: 'build',
    currentSubPhase: 'dice_roll',
    diceRoll: 3,
    phaseReadiness: [],
  });
  state.gameData.ships = {
    p1: [
      { instanceId: 'cube-a', shipDefId: 'CUB' },
      { instanceId: 'cube-b', shipDefId: 'CUB' },
    ],
    p2: [
      { instanceId: 'cube-lev', shipDefId: 'CUB' },
      { instanceId: 'lev', shipDefId: 'LEV' },
    ],
    spectator: [],
  };
  state.gameData.turnData = {
    turnNumber: 2,
    currentMajorPhase: 'build',
    currentSubPhase: 'dice_roll',
    diceManipulationStage: 'cube',
    diceRolled: true,
    diceFinalized: false,
    baseDiceRoll: 3,
    effectiveDiceRoll: 3,
    diceRoll: 3,
    effectiveDiceRollByPlayerId: { p1: 3, p2: 6 },
    cubeDiceRollsByPlayerId: {
      p1: [
        { sourceInstanceId: 'cube-a', value: 2 },
        { sourceInstanceId: 'cube-b', value: 6 },
      ],
    },
    pendingCubeDiceChoiceByPlayerId: { p1: 'cube:cube-b' },
    cubeDiceSelectionByPlayerId: {},
    visibleCubeDiceValueByPlayerId: { p1: 2 },
    chronoswarmRolls: [],
    chronoswarmCountByPlayerId: { p1: 0, p2: 0 },
    chronoswarmSharedRollCount: 0,
  };
  fixture.store.set(
    'game_cube-projection',
    normalizeAncientGameState(state).state,
  );

  const getState = fixture.app.handler(
    'GET',
    '/make-server-825e19ab/game-state/:gameId',
  );
  const readAs = async (playerId: string) => {
    fixture.setSessionId(playerId);
    return await responseJson(await getState(createContext({
      params: { gameId: 'cube-projection' },
    })));
  };

  const owner = await readAs('p1');
  const opponent = await readAs('p2');
  const spectator = await readAs('spectator');

  for (const body of [owner, opponent, spectator]) {
    assert.deepEqual(body.publicState.visibleDice.cubeDiceValueByPlayerId, { p1: 2 });
    assert.equal('cubeDiceRollsByPlayerId' in body.gameData.turnData, false);
    assert.equal('cubeDiceSelectionByPlayerId' in body.gameData.turnData, false);
  }
  assert.deepEqual(
    owner.requester.availableActions[0].choices,
    [
      { choiceId: 'main', projectedAmount: 3 },
      { choiceId: 'cube:cube-a', projectedAmount: 2 },
      { choiceId: 'cube:cube-b', projectedAmount: 6 },
    ],
  );
  assert.deepEqual(owner.gameData.turnData.pendingCubeDiceChoiceByPlayerId, {
    p1: 'cube:cube-b',
  });
  assert.deepEqual(opponent.requester.availableActions, []);
  assert.deepEqual(spectator.requester.availableActions, []);
  assert.deepEqual(opponent.gameData.turnData.pendingCubeDiceChoiceByPlayerId, {});
  assert.deepEqual(spectator.gameData.turnData.pendingCubeDiceChoiceByPlayerId, {});
  assert.equal(
    'p2' in owner.publicState.visibleDice.cubeDiceValueByPlayerId,
    false,
  );

  const resolvedState = fixture.store.get('game_cube-projection');
  resolvedState.gameData.turnData.visibleCubeDiceValueByPlayerId.p1 = 6;
  resolvedState.gameData.turnData.cubeDiceSelectionByPlayerId = {
    p1: {
      choiceId: 'cube:cube-b',
      value: 6,
      sourceInstanceId: 'cube-b',
    },
  };
  resolvedState.gameData.turnData.pendingCubeDiceChoiceByPlayerId = {};
  delete resolvedState.gameData.turnData.diceManipulationStage;
  fixture.store.set('game_cube-projection', resolvedState);
  const afterSelection = await readAs('spectator');
  assert.deepEqual(
    afterSelection.publicState.visibleDice.cubeDiceValueByPlayerId,
    { p1: 6 },
  );
  assert.equal(
    'cubeDiceRollsByPlayerId' in afterSelection.gameData.turnData,
    false,
  );
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
  const latest = createBuildDrawingState('duplicate-repair', true, false);
  const repair = createIntentRouteFixture({ gameReads: [latest] });
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

  const cleanLatest = createBuildDrawingState('duplicate-noop', true, true);
  const noop = createIntentRouteFixture({ gameReads: [cleanLatest] });
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
