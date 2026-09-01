declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { buildSpeciesSubmitPayload } from '../../gameSession/intents';

function assertEquals(actual: unknown, expected: unknown, message = 'values differ'): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

Deno.test('computer species submit carries transient completed Mission IDs', () => {
  assertEquals(
    buildSpeciesSubmitPayload({
      selectedSpecies: 'human',
      botSpecies: 'xenite',
      completedMissionIds: ['mission-a', 'mission-b'],
    }),
    {
      species: 'human',
      botSpecies: 'xenite',
      completedMissionIds: ['mission-a', 'mission-b'],
    },
  );
  assertEquals(
    buildSpeciesSubmitPayload({
      selectedSpecies: 'human',
      botSpecies: 'ancient',
    }),
    {
      species: 'human',
      botSpecies: 'ancient',
      completedMissionIds: [],
    },
  );
});

Deno.test('multiplayer species submit remains canonical reveal-shaped', () => {
  assertEquals(
    buildSpeciesSubmitPayload({
      selectedSpecies: 'centaur',
      completedMissionIds: ['mission-a'],
    }),
    { species: 'centaur' },
  );
});
