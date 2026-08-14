declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  ANCIENT_FOREIGN_CHALLENGE_NOTE,
  BASIC_CHALLENGE_NOTE,
  formatMissionSystem,
  getChallengeExplanatoryCopy,
  getMissionPresentationIdentity,
  interpolateMissionPlayer,
  isNewVisibleMissionPresentation,
  shouldLockMissionInteraction,
  shouldShowMissionChallengeAction,
} from './missionChallengePresentation';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`values differ\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

Deno.test('formats only a trailing Mission system suffix', () => {
  assertEquals(formatMissionSystem('Mintaka system'), 'Mintaka');
  assertEquals(formatMissionSystem('Proxima Centauri SYSTEM'), 'Proxima Centauri');
  assertEquals(formatMissionSystem('[unknown]'), '[unknown]');
});

Deno.test('replaces every exact Mission player token', () => {
  assertEquals(
    interpolateMissionPlayer('[player], this is yours, [player].', 'Judd'),
    'Judd, this is yours, Judd.',
  );
  assertEquals(interpolateMissionPlayer('[Player]', 'Judd'), '[Player]');
});

Deno.test('derives Basic and Ancient foreign explanatory copy', () => {
  assertEquals(getChallengeExplanatoryCopy({
    playerSpecies: 'human',
    targetSpecies: 'Human',
    targetShipType: 'Basic',
  }), BASIC_CHALLENGE_NOTE);
  assertEquals(getChallengeExplanatoryCopy({
    playerSpecies: 'human',
    targetSpecies: 'Xenite',
    targetShipType: 'Basic - Evolved',
  }), null);
  assertEquals(getChallengeExplanatoryCopy({
    playerSpecies: 'ancient',
    targetSpecies: 'Ancient',
    targetShipType: 'Basic',
  }), null);
  assertEquals(getChallengeExplanatoryCopy({
    playerSpecies: 'ancient',
    targetSpecies: 'Human',
    targetShipType: 'Basic',
  }), ANCIENT_FOREIGN_CHALLENGE_NOTE);
  assertEquals(getChallengeExplanatoryCopy({
    playerSpecies: 'ancient',
    targetSpecies: 'Centaur',
    targetShipType: 'Upgraded',
  }), ANCIENT_FOREIGN_CHALLENGE_NOTE);
});

Deno.test('presentation identity changes only for genuine visible transitions', () => {
  const initial = getMissionPresentationIdentity({
    gameId: 'game-a',
    missionId: 'mission-a',
    mode: 'initial',
  });
  const rerender = getMissionPresentationIdentity({
    gameId: 'game-a',
    missionId: 'mission-a',
    mode: 'initial',
  });
  const reopen = getMissionPresentationIdentity({
    gameId: 'game-a',
    missionId: 'mission-a',
    mode: 'reopen',
  });

  assert(isNewVisibleMissionPresentation(null, initial));
  assert(!isNewVisibleMissionPresentation(initial, rerender));
  assert(isNewVisibleMissionPresentation(initial, reopen));
  assert(!isNewVisibleMissionPresentation(reopen, null));
  assert(isNewVisibleMissionPresentation(null, reopen));
});

Deno.test('Mission interaction stays locked for pending or visible presentation', () => {
  assert(shouldLockMissionInteraction({
    introPending: true,
    overlayVisible: false,
  }));
  assert(shouldLockMissionInteraction({
    introPending: false,
    overlayVisible: true,
  }));
  assert(!shouldLockMissionInteraction({
    introPending: false,
    overlayVisible: false,
  }));
});

Deno.test('Challenge action requires an acknowledged active player Mission', () => {
  assert(!shouldShowMissionChallengeAction({
    hasMission: true,
    isPlayerViewer: true,
    isFinished: false,
    introPending: true,
  }));
  assert(shouldShowMissionChallengeAction({
    hasMission: true,
    isPlayerViewer: true,
    isFinished: false,
    introPending: false,
  }));
  assert(!shouldShowMissionChallengeAction({
    hasMission: true,
    isPlayerViewer: false,
    isFinished: false,
    introPending: false,
  }));
  assert(!shouldShowMissionChallengeAction({
    hasMission: true,
    isPlayerViewer: true,
    isFinished: true,
    introPending: false,
  }));
  assert(!shouldShowMissionChallengeAction({
    hasMission: false,
    isPlayerViewer: true,
    isFinished: false,
    introPending: false,
  }));
});
