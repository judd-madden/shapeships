declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  getManualBuildGroupCount,
  makeCanonicalBuildPayload,
  reconcileBuildGroupOrder,
} from '../../gameSession/intents';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  }
}

Deno.test('canonical build payload is stable and shared by preview and submit', () => {
  const payload = makeCanonicalBuildPayload(
    { QUA: 1, FIG: 0, FRI: 2, DEF: 1 },
    [
      { shipDefId: 'AST', sourceShipDefId: 'EVO', afterCaptureSequence: 4 },
      { shipDefId: 'FRI', afterCaptureSequence: 3 },
      { shipDefId: 'DEF', afterCaptureSequence: 2 },
      { shipDefId: 'QUA', afterCaptureSequence: 1 },
      { shipDefId: 'OXI', sourceShipDefId: 'EVO', afterCaptureSequence: 0 },
    ],
    [2, 5],
    [4],
    ['evolver-b', 'evolver-a'],
    { 'evolver-a': 'oxite', 'evolver-b': 'asterite' },
  );
  assertEquals(payload, {
    builds: [
      { shipDefId: 'DEF', count: 1 },
      { shipDefId: 'FRI', count: 2 },
      { shipDefId: 'QUA', count: 1 },
    ],
    buildGroupOrder: [
      { shipDefId: 'AST', sourceShipDefId: 'EVO', afterCaptureSequence: 4 },
      { shipDefId: 'FRI', afterCaptureSequence: 3 },
      { shipDefId: 'DEF', afterCaptureSequence: 2 },
      { shipDefId: 'QUA', afterCaptureSequence: 1 },
      { shipDefId: 'OXI', sourceShipDefId: 'EVO', afterCaptureSequence: 0 },
    ],
    frigateTriggers: [2, 5],
    quantumMysticSelections: [4],
    evolverChoices: [
      { sourceKey: 'evolver-b', choiceId: 'asterite' },
      { sourceKey: 'evolver-a', choiceId: 'oxite' },
    ],
  });
});

Deno.test('empty build is a canonical previewable payload', () => {
  assertEquals(makeCanonicalBuildPayload({}, [], [], [], [], {}), { builds: [] });
});

Deno.test('ZEN free ANT stays in canonical counts but not manual group order', () => {
  assertEquals(getManualBuildGroupCount({ ZEN: 1, ANT: 1 }, 'ANT'), 0);
  assertEquals(getManualBuildGroupCount({ ZEN: 1, ANT: 2 }, 'ANT'), 1);
  const zenOnly = makeCanonicalBuildPayload(
    { ZEN: 1, ANT: 1 },
    [{ shipDefId: 'ZEN', afterCaptureSequence: 4 }],
    [], [], [], {},
  );
  assertEquals(zenOnly, {
    builds: [
      { shipDefId: 'ANT', count: 1 },
      { shipDefId: 'ZEN', count: 1 },
    ],
    buildGroupOrder: [{ shipDefId: 'ZEN', afterCaptureSequence: 4 }],
  });

  const withPaidAnt = makeCanonicalBuildPayload(
    { ZEN: 1, ANT: 2 },
    [
      { shipDefId: 'ANT', afterCaptureSequence: 5 },
      { shipDefId: 'ZEN', afterCaptureSequence: 4 },
    ],
    [], [], [], {},
  );
  assertEquals(withPaidAnt.buildGroupOrder, [
    { shipDefId: 'ANT', afterCaptureSequence: 5 },
    { shipDefId: 'ZEN', afterCaptureSequence: 4 },
  ]);
});

Deno.test('build group count updates stay in place while removal and re-add get a fresh anchor', () => {
  const initial = [
    { shipDefId: 'DEF', afterCaptureSequence: 6 },
    { shipDefId: 'FIG', afterCaptureSequence: 5 },
  ];
  const increased = reconcileBuildGroupOrder({
    order: initial,
    shipDefId: 'DEF',
    previousCount: 1,
    nextCount: 2,
    captureSequence: 9,
  });
  assertEquals(increased, initial);

  const removed = reconcileBuildGroupOrder({
    order: increased,
    shipDefId: 'DEF',
    previousCount: 2,
    nextCount: 0,
    captureSequence: 9,
  });
  assertEquals(removed, [{ shipDefId: 'FIG', afterCaptureSequence: 5 }]);

  const readded = reconcileBuildGroupOrder({
    order: removed,
    shipDefId: 'DEF',
    previousCount: 0,
    nextCount: 1,
    captureSequence: 9,
  });
  assertEquals(readded, [
    { shipDefId: 'DEF', afterCaptureSequence: 9 },
    { shipDefId: 'FIG', afterCaptureSequence: 5 },
  ]);
});

Deno.test('EVO groups share first-appearance reconciliation without moving on count updates', () => {
  const initial = [
    { shipDefId: 'OXF', afterCaptureSequence: 2 },
    { shipDefId: 'OXI', sourceShipDefId: 'EVO' as const, afterCaptureSequence: 2 },
    { shipDefId: 'FIG', afterCaptureSequence: 1 },
  ];
  const increased = reconcileBuildGroupOrder({
    order: initial,
    shipDefId: 'OXI',
    sourceShipDefId: 'EVO',
    previousCount: 1,
    nextCount: 2,
    captureSequence: 4,
  });
  assertEquals(increased, initial);

  const removed = reconcileBuildGroupOrder({
    order: increased,
    shipDefId: 'OXI',
    sourceShipDefId: 'EVO',
    previousCount: 2,
    nextCount: 0,
    captureSequence: 4,
  });
  assertEquals(removed, [
    { shipDefId: 'OXF', afterCaptureSequence: 2 },
    { shipDefId: 'FIG', afterCaptureSequence: 1 },
  ]);

  const readded = reconcileBuildGroupOrder({
    order: removed,
    shipDefId: 'OXI',
    sourceShipDefId: 'EVO',
    previousCount: 0,
    nextCount: 1,
    captureSequence: 4,
  });
  assertEquals(readded, [
    { shipDefId: 'OXI', afterCaptureSequence: 4, sourceShipDefId: 'EVO' },
    { shipDefId: 'OXF', afterCaptureSequence: 2 },
    { shipDefId: 'FIG', afterCaptureSequence: 1 },
  ]);
});
