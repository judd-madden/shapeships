import assert from 'node:assert/strict';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
import { onEnterPhase } from '../../../engine/phase/onEnterPhase.ts';
import type { GameState } from '../../../engine/state/GameStateTypes.ts';
import { PHASE_SEQUENCE } from '../../../engine_shared/phase/PhaseTable.ts';

function createDrawingState(): GameState {
  return {
    gameId: 'drawing-prelude-inactivity',
    status: 'active',
    stateRevision: 17,
    players: [
      {
        id: 'p1',
        name: 'One',
        role: 'player',
        faction: 'human',
        health: 25,
        lines: 12,
        joiningLines: 0,
      },
      {
        id: 'p2',
        name: 'Two',
        role: 'player',
        faction: 'human',
        health: 25,
        lines: 12,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: {
        p1: [{ instanceId: 'p1-carrier', shipDefId: 'CAR', chargesCurrent: 2 }],
        p2: [],
      },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        commitments: {},
      },
    },
    actions: [],
    events: [],
    battleLogScratch: {
      currentTurnCapture: null,
      lastFinalizedTurnNumber: null,
      archiveCheckpoint: null,
    },
  } as GameState;
}

Deno.test('Drawing entry leaves the prelude foundation inactive', () => {
  const state = createDrawingState();

  const entered = onEnterPhase(
    state,
    'build.ships_that_build',
    'build.drawing',
    1_000,
  );

  assert.equal(entered.state.gameData.turnData?.currentSubPhase, 'drawing');
  assert.equal(entered.state.stateRevision, 17);
  assert.equal(
    entered.state.gameData.turnData.drawingPreludeByPlayerId,
    undefined,
  );
  assert.equal(
    entered.state.gameData.turnData.buildDrawingPublicFleetByPlayerId,
    undefined,
  );
  assert.equal(
    entered.events.some((event: any) => 'drawingPreludeVisibility' in event),
    false,
  );
});

Deno.test('the canonical phase sequence retains global Ships That Build before Drawing', () => {
  const shipsThatBuildIndex = PHASE_SEQUENCE.indexOf('build.ships_that_build');
  const drawingIndex = PHASE_SEQUENCE.indexOf('build.drawing');

  assert.equal(shipsThatBuildIndex >= 0, true);
  assert.equal(drawingIndex, shipsThatBuildIndex + 1);
});

Deno.test('BUILD_SUBMIT is gated while an injected current prelude entry awaits a Carrier choice', async () => {
  const state = createDrawingState();
  const turnData = state.gameData.turnData!;
  turnData.drawingPreludeByPlayerId = {
    p1: {
      turnNumber: 3,
      requiredPassCount: 1,
      activePassIndex: 1,
      status: 'awaiting_actions',
      eligibleSourcePowers: [{
        key: 'p1-carrier:CAR#0',
        sourceInstanceId: 'p1-carrier',
        shipDefId: 'CAR',
        rawPowerIndex: 0,
        mode: 'interactive',
      }],
      resolvedSourcePowerKeysByPass: {},
    },
  };
  turnData.buildDrawingPublicFleetByPlayerId = {
    p1: structuredClone(state.gameData.ships?.p1 ?? []),
    p2: [],
  };

  const result = await applyIntent(
    state,
    'p1',
    {
      gameId: state.gameId,
      intentType: 'BUILD_SUBMIT',
      turnNumber: 3,
      nonce: 'inactive-foundation-submit',
      payload: { builds: [] },
    },
    2_000,
  );

  assert.equal(result.ok, false);
  assert.equal(result.rejected?.code, 'DRAWING_PRELUDE_INCOMPLETE');
  assert.deepEqual(result.events, []);
  assert.equal(
    result.state.gameData.turnData.drawingPreludeByPlayerId.p1.status,
    'awaiting_actions',
  );
});

Deno.test('phase machinery and legacy phase resolution do not initialize the dormant foundation', async () => {
  const protectedModules = [
    '../../../engine/phase/onEnterPhase.ts',
    '../../../engine/phase/advancePhase.ts',
    '../../../engine_shared/resolve/resolvePhase.ts',
    '../../../engine_shared/phase/PhaseTable.ts',
  ];

  for (const modulePath of protectedModules) {
    const source = await Deno.readTextFile(
      new URL(modulePath, import.meta.url),
    );
    assert.equal(
      source.includes('drawingPreludeState'),
      false,
      `${modulePath} must not invoke the Drawing-prelude foundation`,
    );
  }

  const reducerSource = await Deno.readTextFile(
    new URL('../../../engine/intent/IntentReducer.ts', import.meta.url),
  );
  assert.equal(reducerSource.includes('createDrawingPreludeInitializationCandidate'), false);
  assert.equal(reducerSource.includes('finalizeDrawingPreludeInitializationCandidate'), false);
});
