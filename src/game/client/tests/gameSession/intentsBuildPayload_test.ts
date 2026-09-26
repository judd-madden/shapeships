declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import { makeCanonicalBuildPayload } from '../../gameSession/intents';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  }
}

Deno.test('canonical build payload is stable and shared by preview and submit', () => {
  const payload = makeCanonicalBuildPayload(
    { QUA: 1, FIG: 0, FRI: 2, DEF: 1 },
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
    frigateTriggers: [2, 5],
    quantumMysticSelections: [4],
    evolverChoices: [
      { sourceKey: 'evolver-b', choiceId: 'asterite' },
      { sourceKey: 'evolver-a', choiceId: 'oxite' },
    ],
  });
});

Deno.test('empty build is a canonical previewable payload', () => {
  assertEquals(makeCanonicalBuildPayload({}, [], [], [], {}), { builds: [] });
});
