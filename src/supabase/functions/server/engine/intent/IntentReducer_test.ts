import assert from 'node:assert/strict';
import { applyIntent, type IntentRequest } from './IntentReducer.ts';

function createBuildState() {
  return {
    gameId: 'intent-reducer-qua-test',
    status: 'active',
    players: [
      { id: 'p1', role: 'player', faction: 'ancient', health: 25, lines: 30, joiningLines: 0 },
      { id: 'p2', role: 'player', faction: 'human', health: 25, lines: 12, joiningLines: 0 },
    ],
    gameData: {
      turnNumber: 1,
      currentPhase: 'build',
      currentSubPhase: 'drawing',
      phaseReadiness: [],
      ships: { p1: [], p2: [] },
      turnData: { commitments: {} },
    },
  };
}

function buildIntent(payload: unknown): IntentRequest {
  return {
    gameId: 'intent-reducer-qua-test',
    intentType: 'BUILD_SUBMIT',
    turnNumber: 1,
    payload,
    nonce: 'qua-test-nonce',
  };
}

Deno.test('BUILD_SUBMIT accepts every legal Quantum Mystic selected number', async () => {
  for (let selectedNumber = 1; selectedNumber <= 6; selectedNumber += 1) {
    const result = await applyIntent(
      createBuildState(),
      'p1',
      buildIntent({
        builds: [{ shipDefId: 'QUA', count: 1 }],
        quantumMysticSelections: [selectedNumber],
      }),
      1000,
    );
    assert.equal(result.ok, true, `selection ${selectedNumber}`);
  }
});

Deno.test('BUILD_SUBMIT rejects malformed Quantum Mystic selection shapes and counts atomically', async () => {
  const invalidPayloads: unknown[] = [
    { builds: [{ shipDefId: 'QUA', count: 1 }] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: '4' },
    { builds: [{ shipDefId: 'QUA', count: 2 }], quantumMysticSelections: [1] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [1, 2] },
    { builds: [{ shipDefId: 'DEF', count: 1 }], quantumMysticSelections: [1] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [0] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [-1] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [1.5] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [Number.NaN] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: ['1'] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [null] },
    { builds: [{ shipDefId: 'QUA', count: 1 }], quantumMysticSelections: [7] },
  ];

  for (const payload of invalidPayloads) {
    const state = createBuildState();
    const before = structuredClone(state);
    const result = await applyIntent(state, 'p1', buildIntent(payload), 1000);
    assert.equal(result.ok, false, JSON.stringify(payload));
    assert.equal(result.rejected?.code, 'BAD_PAYLOAD');
    assert.deepEqual(result.state, before);
  }
});

Deno.test('BUILD_SUBMIT permits no QUA selection field or an empty array when no QUA is requested', async () => {
  for (const payload of [
    { builds: [{ shipDefId: 'DEF', count: 1 }] },
    { builds: [{ shipDefId: 'DEF', count: 1 }], quantumMysticSelections: [] },
  ]) {
    const result = await applyIntent(createBuildState(), 'p1', buildIntent(payload), 1000);
    assert.equal(result.ok, true);
  }
});

Deno.test('BUILD_SUBMIT preserves existing optional Frigate trigger behavior', async () => {
  const omitted = await applyIntent(
    createBuildState(),
    'p1',
    buildIntent({ builds: [{ shipDefId: 'FRI', count: 1 }] }),
    1000,
  );
  assert.equal(omitted.ok, true);

  const malformedState = createBuildState();
  const before = structuredClone(malformedState);
  const malformed = await applyIntent(
    malformedState,
    'p1',
    buildIntent({ builds: [{ shipDefId: 'FRI', count: 1 }], frigateTriggers: [7] }),
    1000,
  );
  assert.equal(malformed.ok, false);
  assert.equal(malformed.rejected?.code, 'BAD_PAYLOAD');
  assert.deepEqual(malformed.state, before);
});
