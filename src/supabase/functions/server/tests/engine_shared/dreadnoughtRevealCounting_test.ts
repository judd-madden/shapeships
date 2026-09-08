import assert from 'node:assert/strict';
import { resolveBuildSubmitAuthoritatively } from '../../engine/intent/buildSubmitResolution.ts';
import { advancePhaseCore } from '../../engine/phase/advancePhase.ts';
import { resolveRevealSpecialPowers } from '../../engine_shared/resolve/resolvePhase.ts';

const TURN_NUMBER = 3;

function createBuildState(args: {
  ships: any[];
  builds: Array<{ shipDefId: string; count: number }>;
  lines?: number;
  joiningLines?: number;
  shipsMadeThisTurn?: number;
  frigateTriggers?: number[];
}): any {
  return {
    gameId: 'dreadnought-reveal-counting-test',
    status: 'active',
    players: [{
      id: 'p1',
      role: 'player',
      faction: 'human',
      health: 25,
      lines: args.lines ?? 0,
      joiningLines: args.joiningLines ?? 0,
    }],
    gameData: {
      turnNumber: TURN_NUMBER,
      ships: { p1: args.ships },
      turnData: {
        turnNumber: TURN_NUMBER,
        commitments: {
          [`BUILD_${TURN_NUMBER}`]: {
            p1: {
              revealPayload: {
                builds: args.builds,
                ...(args.frigateTriggers
                  ? { frigateTriggers: args.frigateTriggers }
                  : {}),
              },
            },
          },
        },
        ...(typeof args.shipsMadeThisTurn === 'number'
          ? { shipsMadeThisTurnByPlayerId: { p1: args.shipsMadeThisTurn } }
          : {}),
      },
      powerMemory: {
        onceOnlyFired: {},
        frigateTriggerByInstanceId: {},
      },
    },
  };
}

function submitBuild(state: any) {
  return resolveBuildSubmitAuthoritatively({
    state,
    turnNumber: TURN_NUMBER,
    nowMs: 1_000,
  });
}

function earlierDreadnoughtComponents(): any[] {
  return [
    { instanceId: 'old-def-1', shipDefId: 'DEF', createdTurn: 1 },
    { instanceId: 'old-def-2', shipDefId: 'DEF', createdTurn: 1 },
    { instanceId: 'old-def-3', shipDefId: 'DEF', createdTurn: 1 },
    { instanceId: 'old-fig-1', shipDefId: 'FIG', createdTurn: 1 },
    { instanceId: 'old-fig-2', shipDefId: 'FIG', createdTurn: 1 },
    { instanceId: 'old-fig-3', shipDefId: 'FIG', createdTurn: 1 },
    { instanceId: 'old-fig-4', shipDefId: 'FIG', createdTurn: 1 },
    { instanceId: 'old-com', shipDefId: 'COM', createdTurn: 1 },
  ];
}

function createdFighterEvents(result: { events: any[] }): any[] {
  return result.events.filter((event) =>
    event.type === 'EFFECT_APPLIED' &&
    event.kind === 'CreateShip' &&
    event.details?.shipDefId === 'FIG'
  );
}

Deno.test('same-turn component consumed into a new DRE produces no Fighters', () => {
  const state = createBuildState({
    lines: 2,
    joiningLines: 10,
    ships: [
      { instanceId: 'old-def', shipDefId: 'DEF', createdTurn: 1 },
      { instanceId: 'old-fig-1', shipDefId: 'FIG', createdTurn: 1 },
      { instanceId: 'old-fig-2', shipDefId: 'FIG', createdTurn: 1 },
      { instanceId: 'old-fig-3', shipDefId: 'FIG', createdTurn: 1 },
      { instanceId: 'old-com', shipDefId: 'COM', createdTurn: 1 },
    ],
    builds: [
      { shipDefId: 'DEF', count: 1 },
      { shipDefId: 'DRE', count: 1 },
    ],
  });

  submitBuild(state);
  assert.equal(state.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 2);
  const dreadnought = state.gameData.ships.p1.find(
    (ship: any) => ship.shipDefId === 'DRE',
  );
  assert.equal(
    state.gameData.turnData
      .dreadnoughtConsumedCurrentTurnComponentsByInstanceId[dreadnought.instanceId],
    1,
  );

  const revealed = resolveRevealSpecialPowers(state);
  assert.equal(createdFighterEvents(revealed).length, 0);
  assert.equal(
    revealed.state.gameData.ships?.p1
      ?.filter((ship: any) => ship.shipDefId === 'FIG').length ?? 0,
    0,
  );
});

Deno.test('new DEF, FIG, and FRI survive older FRI and DRE reservations and produce three Fighters', () => {
  const state = createBuildState({
    lines: 5,
    joiningLines: 13,
    ships: earlierDreadnoughtComponents(),
    builds: [
      { shipDefId: 'DEF', count: 1 },
      { shipDefId: 'FIG', count: 1 },
      { shipDefId: 'FRI', count: 1 },
      { shipDefId: 'DRE', count: 1 },
    ],
    frigateTriggers: [4],
  });

  submitBuild(state);
  assert.deepEqual(
    state.gameData.ships.p1.map((ship: any) => ship.shipDefId),
    ['DEF', 'FIG', 'FRI', 'DRE'],
  );
  assert.equal(state.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 4);
  assert.equal(
    state.gameData.turnData
      .dreadnoughtConsumedCurrentTurnComponentsByInstanceId?.[
        state.gameData.ships.p1.find((ship: any) => ship.shipDefId === 'DRE')
          .instanceId
      ] ?? 0,
    0,
  );

  const firstReveal = resolveRevealSpecialPowers(state);
  assert.equal(createdFighterEvents(firstReveal).length, 3);
  assert.equal(
    firstReveal.state.gameData.turnData?.shipsMadeThisTurnByPlayerId?.p1,
    4,
  );

  const retry = resolveRevealSpecialPowers(firstReveal.state);
  assert.equal(createdFighterEvents(retry).length, 0);
  assert.equal(
    retry.state.gameData.ships?.p1
      ?.filter((ship: any) => ship.shipDefId === 'FIG').length ?? 0,
    4,
  );
});

Deno.test('submitting only FRI and DRE with older components produces one Fighter', () => {
  const state = createBuildState({
    joiningLines: 13,
    ships: earlierDreadnoughtComponents(),
    builds: [
      { shipDefId: 'FRI', count: 1 },
      { shipDefId: 'DRE', count: 1 },
    ],
    frigateTriggers: [4],
  });

  submitBuild(state);
  assert.deepEqual(
    state.gameData.ships.p1.map((ship: any) => ship.shipDefId),
    ['FRI', 'DRE'],
  );
  assert.equal(state.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 2);

  const revealed = resolveRevealSpecialPowers(state);
  assert.equal(createdFighterEvents(revealed).length, 1);
});

Deno.test('mixed DRE consumption excludes new components but counts a surviving new ship', () => {
  const state = createBuildState({
    lines: 7,
    joiningLines: 10,
    ships: [
      { instanceId: 'old-def', shipDefId: 'DEF', createdTurn: 1 },
      { instanceId: 'old-fig-1', shipDefId: 'FIG', createdTurn: 1 },
      { instanceId: 'old-fig-2', shipDefId: 'FIG', createdTurn: 1 },
      { instanceId: 'old-com', shipDefId: 'COM', createdTurn: 1 },
    ],
    builds: [
      { shipDefId: 'DEF', count: 2 },
      { shipDefId: 'FIG', count: 1 },
      { shipDefId: 'DRE', count: 1 },
    ],
  });

  submitBuild(state);
  assert.deepEqual(
    state.gameData.ships.p1.map((ship: any) => ship.shipDefId),
    ['DEF', 'DRE'],
  );
  assert.equal(state.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 4);
  const dreadnought = state.gameData.ships.p1.find(
    (ship: any) => ship.shipDefId === 'DRE',
  );
  assert.equal(
    state.gameData.turnData
      .dreadnoughtConsumedCurrentTurnComponentsByInstanceId[dreadnought.instanceId],
    2,
  );

  const revealed = resolveRevealSpecialPowers(state);
  assert.equal(createdFighterEvents(revealed).length, 1);
});

Deno.test('two new DREs exclude all consumed components and count each other once', () => {
  const currentTurnComponents = [
    ...Array.from({ length: 4 }, (_, index) => ({
      instanceId: `new-def-${index + 1}`,
      shipDefId: 'DEF',
      createdTurn: TURN_NUMBER,
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      instanceId: `new-fig-${index + 1}`,
      shipDefId: 'FIG',
      createdTurn: TURN_NUMBER,
    })),
    ...Array.from({ length: 2 }, (_, index) => ({
      instanceId: `new-com-${index + 1}`,
      shipDefId: 'COM',
      createdTurn: TURN_NUMBER,
    })),
  ];
  const state = createBuildState({
    joiningLines: 20,
    ships: currentTurnComponents,
    shipsMadeThisTurn: 12,
    builds: [{ shipDefId: 'DRE', count: 2 }],
  });

  submitBuild(state);
  assert.equal(state.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 14);
  const dreadnoughts = state.gameData.ships.p1;
  assert.equal(dreadnoughts.length, 2);
  for (const dreadnought of dreadnoughts) {
    assert.equal(
      state.gameData.turnData
        .dreadnoughtConsumedCurrentTurnComponentsByInstanceId[
          dreadnought.instanceId
        ],
      6,
    );
  }

  const revealed = resolveRevealSpecialPowers(state);
  assert.equal(createdFighterEvents(revealed).length, 14);
  for (const dreadnought of dreadnoughts) {
    assert.equal(
      createdFighterEvents(revealed).filter((event) =>
        event.effectId.includes(dreadnought.instanceId)
      ).length,
      7,
    );
  }
});

Deno.test('each DRE excludes only its own new Commander components', () => {
  const state = createBuildState({
    lines: 14,
    joiningLines: 20,
    ships: [
      { instanceId: 'existing-dre', shipDefId: 'DRE', createdTurn: 1 },
      ...Array.from({ length: 4 }, (_, index) => ({
        instanceId: `old-def-${index + 1}`,
        shipDefId: 'DEF',
        createdTurn: 1,
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        instanceId: `old-fig-${index + 1}`,
        shipDefId: 'FIG',
        createdTurn: 1,
      })),
    ],
    builds: [
      { shipDefId: 'ORB', count: 1 },
      { shipDefId: 'COM', count: 2 },
      { shipDefId: 'DRE', count: 2 },
    ],
  });

  submitBuild(state);
  assert.equal(state.gameData.turnData.shipsMadeThisTurnByPlayerId.p1, 5);
  assert.deepEqual(
    state.gameData.ships.p1.map((ship: any) => ship.shipDefId),
    ['DRE', 'ORB', 'DRE', 'DRE'],
  );
  const newDreadnoughts = state.gameData.ships.p1.filter(
    (ship: any) => ship.shipDefId === 'DRE' && ship.createdTurn === TURN_NUMBER,
  );
  assert.equal(newDreadnoughts.length, 2);
  for (const dreadnought of newDreadnoughts) {
    assert.equal(
      state.gameData.turnData
        .dreadnoughtConsumedCurrentTurnComponentsByInstanceId[
          dreadnought.instanceId
        ],
      1,
    );
  }

  const revealed = resolveRevealSpecialPowers(state);
  const fighterEvents = createdFighterEvents(revealed);
  assert.equal(fighterEvents.length, 11);
  assert.equal(
    fighterEvents.filter((event) => event.effectId.includes('existing-dre')).length,
    5,
  );
  for (const dreadnought of newDreadnoughts) {
    assert.equal(
      fighterEvents.filter((event) =>
        event.effectId.includes(dreadnought.instanceId)
      ).length,
      3,
    );
  }
});

Deno.test('an existing DRE counts a newly made DRE while the new DRE excludes itself', () => {
  const state = createBuildState({
    joiningLines: 10,
    ships: [
      { instanceId: 'existing-dre', shipDefId: 'DRE', createdTurn: 1 },
      ...earlierDreadnoughtComponents().slice(0, 2),
      ...earlierDreadnoughtComponents().slice(3, 6),
      { instanceId: 'old-com', shipDefId: 'COM', createdTurn: 1 },
    ],
    builds: [{ shipDefId: 'DRE', count: 1 }],
  });

  submitBuild(state);
  const revealed = resolveRevealSpecialPowers(state);
  const fighterEvents = createdFighterEvents(revealed);
  assert.equal(fighterEvents.length, 1);
  assert.equal(fighterEvents[0].effectId.includes('existing-dre'), true);
});

Deno.test('missing DRE exclusion state preserves legacy Reveal counting', () => {
  const state = createBuildState({
    ships: [{ instanceId: 'existing-dre', shipDefId: 'DRE', createdTurn: 1 }],
    builds: [],
    shipsMadeThisTurn: 2,
  });
  delete state.gameData.turnData.commitments;

  const revealed = resolveRevealSpecialPowers(state);
  assert.equal(createdFighterEvents(revealed).length, 2);
});

Deno.test('both new-turn paths reset DRE component exclusions', () => {
  const setupState: any = {
    players: [{ id: 'p1', role: 'player', faction: 'human' }],
    turnNumber: 0,
    gameData: {
      currentPhase: 'setup',
      currentSubPhase: 'species_selection',
      turnNumber: 0,
      phaseReadiness: [],
      turnData: {
        turnNumber: 0,
        dreadnoughtConsumedCurrentTurnComponentsByInstanceId: { 'stale-dre': 4 },
      },
    },
  };
  const setupAdvanced = advancePhaseCore(setupState, 1_000);
  assert.equal(setupAdvanced.ok, true);
  if (!setupAdvanced.ok) return;
  assert.deepEqual(
    setupAdvanced.state.gameData?.turnData
      ?.dreadnoughtConsumedCurrentTurnComponentsByInstanceId,
    {},
  );

  const endOfTurnState: any = {
    players: [{ id: 'p1', role: 'player', faction: 'human' }],
    turnNumber: TURN_NUMBER,
    gameData: {
      currentPhase: 'battle',
      currentSubPhase: 'end_of_turn_resolution',
      turnNumber: TURN_NUMBER,
      phaseReadiness: [],
      turnData: {
        currentMajorPhase: 'battle',
        currentSubPhase: 'end_of_turn_resolution',
        turnNumber: TURN_NUMBER,
        dreadnoughtConsumedCurrentTurnComponentsByInstanceId: { 'stale-dre': 4 },
      },
    },
  };
  const turnAdvanced = advancePhaseCore(endOfTurnState, 1_000);
  assert.equal(turnAdvanced.ok, true);
  if (!turnAdvanced.ok) return;
  assert.deepEqual(
    turnAdvanced.state.gameData?.turnData
      ?.dreadnoughtConsumedCurrentTurnComponentsByInstanceId,
    {},
  );
});
