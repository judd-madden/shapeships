import assert from 'node:assert/strict';
import { resolveBuildSubmitAuthoritatively } from './buildSubmitResolution.ts';

function createResolutionState(args: {
  lines: number;
  payload: Record<string, unknown>;
  ships?: any[];
}): any {
  return {
    gameId: 'build-resolution-qua-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 25, lines: args.lines, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 1,
      ships: { p1: args.ships ?? [] },
      turnData: {
        commitments: {
          BUILD_1: {
            p1: { revealPayload: args.payload },
          },
        },
      },
    },
  };
}

function resolve(state: any) {
  return resolveBuildSubmitAuthoritatively({ state, turnNumber: 1, nowMs: 1000 });
}

Deno.test('build resolution persists ordered QUA selected numbers on successful creation', () => {
  const state = createResolutionState({
    lines: 15,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 3 }],
      quantumMysticSelections: [6, 2, 4],
    },
  });

  resolve(state);
  assert.deepEqual(
    state.gameData.ships.p1.map((ship: any) => ship.permanentConfiguration?.selectedNumber),
    [6, 2, 4],
  );
});

Deno.test('skipped QUA attempts persist no shifted configuration', () => {
  const state = createResolutionState({
    lines: 5,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 2 }],
      quantumMysticSelections: [1, 6],
    },
  });

  const result = resolve(state);
  assert.equal(state.gameData.ships.p1.length, 1);
  assert.equal(state.gameData.ships.p1[0].permanentConfiguration.selectedNumber, 1);
  assert.equal(
    result.events.some((event) =>
      event.type === 'BUILD_ATTEMPT_SKIPPED' &&
      event.shipDefId === 'QUA' &&
      event.attemptIndex === 1 &&
      event.reason === 'insufficient_ordinary_lines'
    ),
    true,
  );
});

Deno.test('legacy invalid committed QUA attempts skip before spending resources', () => {
  for (const quantumMysticSelections of [undefined, [0], [7], ['4']]) {
    const payload: Record<string, unknown> = {
      builds: [{ shipDefId: 'QUA', count: 1 }],
      ...(typeof quantumMysticSelections === 'undefined' ? {} : { quantumMysticSelections }),
    };
    const state = createResolutionState({ lines: 5, payload });
    const result = resolve(state);

    assert.deepEqual(state.gameData.ships.p1, []);
    assert.equal(state.players[0].lines, 5);
    assert.equal(
      result.events.some((event) =>
        event.type === 'BUILD_ATTEMPT_SKIPPED' &&
        event.reason === 'invalid_permanent_configuration'
      ),
      true,
    );
  }
});

Deno.test('generic maximum quantity permits six QUA and skips a seventh', () => {
  const sixState = createResolutionState({
    lines: 30,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 6 }],
      quantumMysticSelections: [1, 2, 3, 4, 5, 6],
    },
  });
  resolve(sixState);
  assert.equal(sixState.gameData.ships.p1.length, 6);

  const seventhState = createResolutionState({
    lines: 5,
    ships: sixState.gameData.ships.p1,
    payload: {
      builds: [{ shipDefId: 'QUA', count: 1 }],
      quantumMysticSelections: [3],
    },
  });
  const seventh = resolve(seventhState);
  assert.equal(seventhState.gameData.ships.p1.length, 6);
  assert.equal(seventhState.players[0].lines, 5);
  assert.equal(
    seventh.events.some((event) =>
      event.type === 'BUILD_ATTEMPT_SKIPPED' && event.reason === 'max_quantity_reached'
    ),
    true,
  );
});

Deno.test('Frigate successful creation keeps its existing trigger memory', () => {
  const state = createResolutionState({
    lines: 0,
    ships: [
      { instanceId: 'def-component', shipDefId: 'DEF' },
      { instanceId: 'fig-component', shipDefId: 'FIG' },
    ],
    payload: {
      builds: [{ shipDefId: 'FRI', count: 1 }],
      frigateTriggers: [4],
    },
  });
  state.players[0].faction = 'human';
  state.players[0].joiningLines = 3;
  resolve(state);
  const frigate = state.gameData.ships.p1[0];
  assert.equal(state.gameData.powerMemory.frigateTriggerByInstanceId[frigate.instanceId], 4);
  assert.equal(frigate.permanentConfiguration, undefined);
});
