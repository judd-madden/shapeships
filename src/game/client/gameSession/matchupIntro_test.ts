declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  deriveMatchupIntroViewModel,
  getMatchupIntroDurationMs,
} from './matchupIntro';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

const baseArgs = {
  gameId: 'matchup-game',
  isFinished: false,
  isPlayerViewer: true,
  phaseKey: 'setup.species_selection',
  phaseHold: {
    phaseKey: 'setup.species_selection',
    holdReason: 'matchup_intro',
    holdStartedAtMs: 10_000,
    holdUntilMs: 13_000,
  },
  localPlayer: { id: 'p2', name: 'Local Player', faction: 'xenite' },
  opponentPlayer: { id: 'p1', name: 'Opponent', faction: 'human' },
};

Deno.test('derives a player-relative matchup only from a valid authoritative hold', () => {
  const vm = deriveMatchupIntroViewModel(baseArgs);
  assert(vm);
  assertDeepEqual(vm.localPlayer, { name: 'Local Player', speciesId: 'xenite' });
  assertDeepEqual(vm.opponentPlayer, { name: 'Opponent', speciesId: 'human' });
  assertEqual(vm.endsAtMs - vm.startedAtMs, 3_000);
  assertEqual(deriveMatchupIntroViewModel({ ...baseArgs, isPlayerViewer: false }), null);
  assertEqual(deriveMatchupIntroViewModel({ ...baseArgs, isFinished: true }), null);
  assertEqual(deriveMatchupIntroViewModel({ ...baseArgs, phaseKey: 'build.dice_roll' }), null);
  assertEqual(deriveMatchupIntroViewModel({
    ...baseArgs,
    phaseHold: { ...baseArgs.phaseHold, holdReason: 'battle_reveal' },
  }), null);
});

Deno.test('presentation identity is stable and duration comes only from authoritative timestamps', () => {
  const first = deriveMatchupIntroViewModel(baseArgs);
  const second = deriveMatchupIntroViewModel(baseArgs);
  assert(first);
  assert(second);
  assertEqual(first.presentationKey, second.presentationKey);

  assertEqual(getMatchupIntroDurationMs(first), 3_000);

  const scaled = { startedAtMs: 50, endsAtMs: 3_450 };
  assertEqual(getMatchupIntroDurationMs(scaled), 3_400);
});
