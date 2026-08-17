declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  MATCHUP_INTRO_MOTION_DURATION_MS,
  MATCHUP_INTRO_SPECIES_STAGGER_MS,
  MATCHUP_INTRO_VISUAL_DURATION_MS,
} from '../../matchup/useMatchupIntroPresentation';

function assertEqual(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test('matchup intro presentation composes to the 3300 ms contract', () => {
  assertEqual(MATCHUP_INTRO_MOTION_DURATION_MS, 3_150);
  assertEqual(MATCHUP_INTRO_SPECIES_STAGGER_MS, 150);
  assertEqual(MATCHUP_INTRO_VISUAL_DURATION_MS, 3_300);
  assertEqual(
    MATCHUP_INTRO_MOTION_DURATION_MS + MATCHUP_INTRO_SPECIES_STAGGER_MS,
    MATCHUP_INTRO_VISUAL_DURATION_MS,
  );
});
