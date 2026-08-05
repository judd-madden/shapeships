import assert from 'node:assert/strict';
import type { GameState, ShipInstance } from '../../../engine/state/GameStateTypes.ts';
import {
  createPrivateDrawingPreludeCueKey,
  filterDrawingPreludeEventsForViewer,
  projectDrawingPreludeCarrierActions,
  projectDrawingPreludeFleetsForViewer,
  projectDrawingPreludeRequesterSummary,
  projectDrawingPreludeCuesForIntentState,
  projectPrivateDrawingPreludeCuesForRequester,
  redactDrawingPreludeTurnDataForClient,
  redactPrivateDrawingPreludeCuesForPublic,
} from '../../../engine/state/drawingPreludeProjection.ts';
import { resolveDrawingPreludePowerAction } from '../../../engine/intent/drawingPreludeResolution.ts';

function ship(instanceId: string, shipDefId: string, createdTurn = 4): ShipInstance {
  return { instanceId, shipDefId, createdTurn };
}

function createProjectedState(): GameState {
  return {
    gameId: 'projection',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', health: 25, lines: 3, joiningLines: 0 },
      { id: 'p2', role: 'player', health: 25, lines: 3, joiningLines: 0 },
      { id: 'spec', role: 'spectator', health: 0, lines: 0, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 5,
      ships: {
        p1: [ship('p1-public', 'DEF'), ship('p1-hidden', 'FIG', 5)],
        p2: [ship('p2-public', 'XEN'), ship('p2-hidden', 'ANT', 5)],
      },
      turnData: {
        turnNumber: 5,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        drawingPreludeByPlayerId: {
          p1: {
            turnNumber: 5,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: 'complete',
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
          },
          p2: {
            turnNumber: 5,
            requiredPassCount: 1,
            activePassIndex: 1,
            status: 'complete',
            eligibleSourcePowers: [],
            resolvedSourcePowerKeysByPass: {},
          },
        },
        buildDrawingPublicFleetByPlayerId: {
          p1: [ship('p1-public', 'DEF')],
          p2: [ship('p2-public', 'XEN')],
        },
      },
    },
  };
}

Deno.test('Drawing-prelude fleets project owner live and opponent/spectator snapshots', () => {
  const state = createProjectedState();
  const p1 = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'p1');
  const p2 = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'p2');
  const spectator = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'spec');

  assert.deepEqual(p1.p1.map((entry) => entry.instanceId), ['p1-public', 'p1-hidden']);
  assert.deepEqual(p1.p2.map((entry) => entry.instanceId), ['p2-public']);
  assert.deepEqual(p2.p1.map((entry) => entry.instanceId), ['p1-public']);
  assert.deepEqual(p2.p2.map((entry) => entry.instanceId), ['p2-public', 'p2-hidden']);
  assert.deepEqual(spectator.p1.map((entry) => entry.instanceId), ['p1-public']);
  assert.deepEqual(spectator.p2.map((entry) => entry.instanceId), ['p2-public']);
});

Deno.test('Mixed current/stale Drawing maps fail closed for every non-owner fleet', () => {
  const state = createProjectedState();
  state.gameData.turnData!.drawingPreludeByPlayerId!.p2.turnNumber = 4;

  const p1 = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'p1');
  const p2 = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'p2');
  const spectator = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'spec');
  assert.deepEqual(p1.p2, []);
  assert.deepEqual(p2.p1.map((entry) => entry.instanceId), ['p1-public']);
  assert.deepEqual(p2.p2.map((entry) => entry.instanceId), ['p2-public', 'p2-hidden']);
  assert.deepEqual(spectator.p1.map((entry) => entry.instanceId), ['p1-public']);
  assert.deepEqual(spectator.p2, []);

  state.gameData.turnData!.drawingPreludeByPlayerId!.p2.turnNumber = 5;
  state.gameData.turnData!.buildDrawingPublicFleetByPlayerId!.p2 = [
    { instanceId: '', shipDefId: 'XEN' },
  ];
  assert.deepEqual(
    projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'spec').p2,
    [],
  );

  state.gameData.turnData!.drawingPreludeByPlayerId!.p1.turnNumber = 4;
  state.gameData.turnData!.drawingPreludeByPlayerId!.p2.turnNumber = 4;
  const whollyStale = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'spec');
  assert.deepEqual(whollyStale.p1.map((entry) => entry.instanceId), ['p1-public', 'p1-hidden']);
  assert.deepEqual(whollyStale.p2.map((entry) => entry.instanceId), ['p2-public', 'p2-hidden']);
});

Deno.test('Requester summaries require settled semantics and remain owner-only', () => {
  const state = createProjectedState();
  assert.deepEqual(projectDrawingPreludeRequesterSummary(state, 'p1'), {
    turnNumber: 5,
    status: 'complete',
    passIndex: 1,
    passCount: 1,
  });
  assert.equal(projectDrawingPreludeRequesterSummary(state, 'spec'), null);

  state.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 5,
    requiredPassCount: 2,
    activePassIndex: 2,
    status: 'complete',
    eligibleSourcePowers: [],
    resolvedSourcePowerKeysByPass: {},
  };
  assert.deepEqual(projectDrawingPreludeRequesterSummary(state, 'p1'), {
    turnNumber: 5,
    status: 'complete',
    passIndex: 2,
    passCount: 2,
  });

  state.gameData.ships!.p1 = [
    { instanceId: 'carrier', shipDefId: 'CAR', createdTurn: 5, chargesCurrent: 1 },
  ];
  state.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 5,
    requiredPassCount: 1,
    activePassIndex: 1,
    status: 'awaiting_actions',
    eligibleSourcePowers: [{
      key: 'carrier:CAR#0', sourceInstanceId: 'carrier', shipDefId: 'CAR',
      rawPowerIndex: 0, mode: 'interactive',
    }],
    resolvedSourcePowerKeysByPass: {},
  };
  assert.equal(projectDrawingPreludeRequesterSummary(state, 'p1')?.status, 'awaiting_actions');

  state.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 5,
    requiredPassCount: 1,
    activePassIndex: 1,
    status: 'awaiting_actions',
    eligibleSourcePowers: [{
      key: 'bug:BUG#0', sourceInstanceId: 'bug', shipDefId: 'BUG',
      rawPowerIndex: 0, mode: 'automatic',
    }],
    resolvedSourcePowerKeysByPass: {},
  };
  assert.equal(projectDrawingPreludeRequesterSummary(state, 'p1'), null);
});

Deno.test('Carrier action projection is pure, pass-aware, charge-aware, and fail-closed', () => {
  const state = createProjectedState();
  state.gameData.ships!.p1 = [
    { instanceId: 'carrier', shipDefId: 'CAR', createdTurn: 4, chargesCurrent: 2 },
  ];
  state.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 5,
    requiredPassCount: 2,
    activePassIndex: 2,
    status: 'awaiting_actions',
    eligibleSourcePowers: [{
      key: 'carrier:CAR#0', sourceInstanceId: 'carrier', shipDefId: 'CAR',
      rawPowerIndex: 0, mode: 'interactive',
    }],
    resolvedSourcePowerKeysByPass: { 1: ['carrier:CAR#0'] },
  };
  const serialized = JSON.stringify(state);
  assert.deepEqual(projectDrawingPreludeCarrierActions(state, 'p1'), [{
    kind: 'choice', actionId: 'CAR#0', shipDefId: 'CAR',
    sourceInstanceId: 'carrier', passIndex: 2,
    choices: [{ choiceId: 'defender' }, { choiceId: 'fighter' }, { choiceId: 'hold' }],
  }]);
  assert.equal(JSON.stringify(state), serialized);

  state.gameData.ships!.p1[0].chargesCurrent = 1;
  assert.deepEqual(
    projectDrawingPreludeCarrierActions(state, 'p1')[0].choices,
    [{ choiceId: 'defender' }, { choiceId: 'hold' }],
  );
  state.gameData.ships!.p1[0].chargesCurrent = 0;
  assert.deepEqual(projectDrawingPreludeCarrierActions(state, 'p1'), []);

  state.gameData.ships!.p1[0].chargesCurrent = 1;
  state.gameData.turnData!.drawingPreludeByPlayerId!.p1.eligibleSourcePowers[0].rawPowerIndex = 1;
  assert.deepEqual(projectDrawingPreludeCarrierActions(state, 'p1'), []);
});

Deno.test('Drawing-prelude event routing strips private metadata and fails closed', () => {
  const state = createProjectedState();
  const events = [
    { type: 'EXISTING_EVENT', value: 1 },
    {
      type: 'PRIVATE_EVENT', secret: 'owner-only',
      producedBuildOccurrence: { stage: 'drawing_prelude', passIndex: 1 },
      drawingPreludeVisibility: { audience: 'owner', playerId: 'p1' },
    },
    {
      type: 'PUBLIC_CAPTURE_EVENT',
      producedBuildOccurrence: { stage: 'drawing' },
    },
    { type: 'MALFORMED_PRIVATE', drawingPreludeVisibility: { audience: 'owner' } },
  ];
  assert.deepEqual(filterDrawingPreludeEventsForViewer(state, 'p1', events), [
    events[0],
    { type: 'PRIVATE_EVENT', secret: 'owner-only' },
    { type: 'PUBLIC_CAPTURE_EVENT' },
  ]);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(state, 'p2', events), [
    events[0], { type: 'PUBLIC_CAPTURE_EVENT' },
  ]);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(state, 'spec', events), [
    events[0], { type: 'PUBLIC_CAPTURE_EVENT' },
  ]);
});

Deno.test('events emitted by live Carrier resolution are owner-only and sanitized', () => {
  const state = createProjectedState();
  (state.gameData as any).currentPhase = 'build';
  (state.gameData as any).currentSubPhase = 'drawing';
  state.gameData.ships!.p1 = [{ instanceId: 'car-live', shipDefId: 'CAR', chargesCurrent: 1, createdTurn: 4 }];
  state.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 5,
    requiredPassCount: 1,
    activePassIndex: 1,
    status: 'awaiting_actions',
    eligibleSourcePowers: [{ key: 'car-live:CAR#0', sourceInstanceId: 'car-live', shipDefId: 'CAR', rawPowerIndex: 0, mode: 'interactive' }],
    resolvedSourcePowerKeysByPass: {},
  };
  const resolved = resolveDrawingPreludePowerAction({
    state,
    playerId: 'p1',
    action: { actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-live', choiceId: 'defender', passIndex: 1 },
    nowMs: 10,
  });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const ownerEvents = filterDrawingPreludeEventsForViewer(resolved.state, 'p1', resolved.events);
  assert.equal(ownerEvents.length, resolved.events.length);
  assert.equal(ownerEvents.some((event) => event.type === 'EFFECT_APPLIED'), true);
  assert.equal(ownerEvents.some((event) => event.type === 'BATTLE_LOG_CAPTURE_BUILD_PRODUCED'), true);
  assert.equal(ownerEvents.some((event) => event.type === 'POWER_USED'), true);
  assert.equal(ownerEvents.some((event) => 'drawingPreludeVisibility' in event), false);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(resolved.state, 'p2', resolved.events), []);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(resolved.state, 'spec', resolved.events), []);
});

Deno.test('pass-2 Carrier events remain owner-private and use the pass-2 cue key', () => {
  const state = createProjectedState();
  (state.gameData as any).currentPhase = 'build';
  (state.gameData as any).currentSubPhase = 'drawing';
  state.gameData.ships!.p1 = [{ instanceId: 'car-live', shipDefId: 'CAR', chargesCurrent: 1, createdTurn: 4 }];
  state.gameData.turnData!.chronoswarmRolls = [4];
  state.gameData.turnData!.drawingPreludeByPlayerId!.p1 = {
    turnNumber: 5,
    requiredPassCount: 2,
    activePassIndex: 2,
    status: 'awaiting_actions',
    eligibleSourcePowers: [{ key: 'car-live:CAR#0', sourceInstanceId: 'car-live', shipDefId: 'CAR', rawPowerIndex: 0, mode: 'interactive' }],
    resolvedSourcePowerKeysByPass: { 1: ['car-live:CAR#0'] },
  };
  const resolved = resolveDrawingPreludePowerAction({
    state,
    playerId: 'p1',
    action: { actionType: 'power', actionId: 'CAR#0', sourceInstanceId: 'car-live', choiceId: 'defender', passIndex: 2 },
    nowMs: 10,
  });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.equal(resolved.events.every((event) => event.drawingPreludeVisibility?.playerId === 'p1'), true);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(resolved.state, 'p2', resolved.events), []);
  assert.deepEqual(filterDrawingPreludeEventsForViewer(resolved.state, 'spec', resolved.events), []);
  assert.equal(
    resolved.state.gameData.turnData?.shipActivationCueBatches?.some((batch) =>
      batch.key === createPrivateDrawingPreludeCueKey({ turnNumber: 5, playerId: 'p1', passIndex: 2 })
    ),
    true,
  );
});

Deno.test('Private cue filtering is limited to exact current-turn Drawing-prelude keys', () => {
  const state = createProjectedState();
  const currentPrivateKey = createPrivateDrawingPreludeCueKey({
    turnNumber: 5, playerId: 'p1', passIndex: 1,
  });
  const cues = [
    {
      key: currentPrivateKey, turnNumber: 5, phaseKey: 'build.drawing', seq: 1,
      sources: [{ playerId: 'p1', sourceInstanceId: 'private-source' }],
    },
    {
      key: createPrivateDrawingPreludeCueKey({ turnNumber: 4, playerId: 'p1', passIndex: 1 }),
      turnNumber: 4, phaseKey: 'build.drawing', seq: 2,
      sources: [{ playerId: 'p1', sourceInstanceId: 'older-source' }],
    },
    {
      key: 'ship-activation:5:build.drawing:public', turnNumber: 5,
      phaseKey: 'build.drawing', seq: 3,
      sources: [{ playerId: 'p1', sourceInstanceId: 'public-source' }],
    },
    {
      key: createPrivateDrawingPreludeCueKey({ turnNumber: 5, playerId: 'p1', passIndex: 2 }),
      turnNumber: 5, phaseKey: 'build.drawing', seq: 4,
      sources: [
        { playerId: 'p1', sourceInstanceId: 'mixed-owner-source' },
        { playerId: 'p2', sourceInstanceId: 'wrong-owner-source' },
      ],
    },
  ];

  assert.deepEqual(
    redactPrivateDrawingPreludeCuesForPublic(state, cues).map((batch) => batch.key),
    [cues[1].key, cues[2].key],
  );
  assert.deepEqual(
    projectPrivateDrawingPreludeCuesForRequester(state, cues, 'p1')
      .flatMap((batch) => batch.sources.map((source) => source.sourceInstanceId)),
    ['private-source'],
  );
  assert.deepEqual(projectPrivateDrawingPreludeCuesForRequester(state, cues, 'p2'), []);
  assert.deepEqual(
    projectDrawingPreludeCuesForIntentState(state, cues, 'p1').map((batch) => batch.key),
    [cues[0].key, cues[1].key, cues[2].key],
  );
  assert.deepEqual(
    projectDrawingPreludeCuesForIntentState(state, cues, 'p2').map((batch) => batch.key),
    [cues[1].key, cues[2].key],
  );
});

Deno.test('Turn-data redaction and all returned projections are deeply isolated', () => {
  const state = createProjectedState();
  const before = structuredClone(state);
  const fleets = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'p1');
  const summary = projectDrawingPreludeRequesterSummary(state, 'p1')!;
  const safeTurnData = redactDrawingPreludeTurnDataForClient(
    state.gameData.turnData,
    state,
    'p1',
  )!;

  assert.equal('drawingPreludeByPlayerId' in safeTurnData, false);
  assert.equal('buildDrawingPublicFleetByPlayerId' in safeTurnData, false);
  fleets.p2[0].shipDefId = 'MUTATED';
  summary.status = 'awaiting_actions';
  assert.deepEqual(state, before);

  const repeatedFleets = projectDrawingPreludeFleetsForViewer(state, state.gameData.ships, 'p1');
  const repeatedSummary = projectDrawingPreludeRequesterSummary(state, 'p1');
  assert.equal(repeatedFleets.p2[0].shipDefId, 'XEN');
  assert.equal(repeatedSummary?.status, 'complete');
});
