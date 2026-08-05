import assert from 'node:assert/strict';
import { onEnterPhase } from '../../../engine/phase/onEnterPhase.ts';
import type { GameState } from '../../../engine/state/GameStateTypes.ts';

function createDrawingEntryState(shipDefId = 'CAR'): GameState {
  return {
    gameId: 'drawing-prelude-foundation',
    status: 'active',
    stateRevision: 17,
    players: [
      { id: 'p1', name: 'One', role: 'player', faction: 'human', health: 25, lines: 12, joiningLines: 0 },
      { id: 'p2', name: 'Two', role: 'player', faction: 'human', health: 25, lines: 12, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 3,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: {
        p1: [{ instanceId: `p1-${shipDefId.toLowerCase()}`, shipDefId, chargesCurrent: 1, createdTurn: 1 }],
        p2: [],
      },
      powerMemory: { onceOnlyFired: {}, frigateTriggerByInstanceId: {} },
      turnData: {
        turnNumber: 3,
        currentMajorPhase: 'build',
        currentSubPhase: 'drawing',
        commitments: {},
        effectiveDiceRollByPlayerId: { p1: 4, p2: 3 },
      },
    },
    actions: [],
    events: [],
    battleLogScratch: { currentTurnCapture: null, lastFinalizedTurnNumber: null, archiveCheckpoint: null },
  } as GameState;
}

Deno.test('Drawing entry initializes exact public baselines and private Carrier work once', () => {
  const state = createDrawingEntryState();
  const entered = onEnterPhase(state, 'build.line_generation', 'build.drawing', 1_000);

  assert.equal(entered.state.gameData.turnData?.currentSubPhase, 'drawing');
  assert.equal(entered.state.gameData.turnData?.drawingPreludeByPlayerId?.p1.status, 'awaiting_actions');
  assert.equal(entered.state.gameData.turnData?.drawingPreludeByPlayerId?.p2.status, 'complete');
  assert.deepEqual(
    entered.state.gameData.turnData?.buildDrawingPublicFleetByPlayerId?.p1,
    state.gameData.ships?.p1,
  );

  const reentered = onEnterPhase(entered.state, 'build.line_generation', 'build.drawing', 1_001);
  assert.deepEqual(reentered.state, entered.state);
  assert.deepEqual(reentered.events, []);
});

Deno.test('Drawing entry resolves automatic work before returning a persistable state', () => {
  const state = createDrawingEntryState('BUG');
  const entered = onEnterPhase(state, 'build.line_generation', 'build.drawing', 2_000);
  const prelude = entered.state.gameData.turnData?.drawingPreludeByPlayerId?.p1;

  assert.equal(prelude?.status, 'complete');
  assert.deepEqual(prelude?.resolvedSourcePowerKeysByPass[1], ['p1-bug:BUG#0']);
  assert.equal(entered.state.gameData.ships?.p1?.some((ship: { shipDefId: string }) => ship.shipDefId === 'XEN'), true);
  assert.equal(
    prelude?.eligibleSourcePowers.some((source: { mode: string; key: string }) =>
      source.mode === 'automatic' &&
      !(prelude.resolvedSourcePowerKeysByPass[1] ?? []).includes(source.key)
    ),
    false,
  );
});
