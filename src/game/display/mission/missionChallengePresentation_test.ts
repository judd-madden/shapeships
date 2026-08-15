declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  ANCIENT_FOREIGN_CHALLENGE_NOTE,
  BASIC_CHALLENGE_NOTE,
  formatMissionSystem,
  getChallengeExplanatoryCopy,
  getMissionChallengeResultPresentation,
  getMissionPresentationIdentity,
  interpolateMissionPlayer,
  isNewVisibleMissionPresentation,
  shouldLockMissionInteraction,
  shouldShowMissionChallengeAction,
  shouldShowPostgameMissionChallengeAction,
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
  const result = getMissionPresentationIdentity({
    gameId: 'game-a',
    missionId: 'mission-a',
    mode: 'result',
  });

  assert(isNewVisibleMissionPresentation(null, initial));
  assert(!isNewVisibleMissionPresentation(initial, rerender));
  assert(isNewVisibleMissionPresentation(initial, reopen));
  assert(!isNewVisibleMissionPresentation(reopen, null));
  assert(isNewVisibleMissionPresentation(null, reopen));
  assert(isNewVisibleMissionPresentation(reopen, result));
  assertEquals(result, 'game-a\u0000mission-a\u0000result');
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

Deno.test('postgame Challenge action requires a finished requester Mission result', () => {
  const eligible = {
    hasMission: true,
    isPlayerViewer: true,
    isFinished: true,
    hasResult: true,
  };

  assert(shouldShowPostgameMissionChallengeAction(eligible));
  assert(!shouldShowPostgameMissionChallengeAction({ ...eligible, hasMission: false }));
  assert(!shouldShowPostgameMissionChallengeAction({ ...eligible, isPlayerViewer: false }));
  assert(!shouldShowPostgameMissionChallengeAction({ ...eligible, isFinished: false }));
  assert(!shouldShowPostgameMissionChallengeAction({ ...eligible, hasResult: false }));
});

Deno.test('result presentation uses only authoritative Mission and Challenge outcomes', () => {
  assertEquals(getMissionChallengeResultPresentation({
    missionSucceeded: true,
    fleetConditionMet: true,
    challengeSucceeded: true,
  }), {
    missionLabel: 'COMPLETE',
    missionSucceeded: true,
    challengeLabel: 'COMPLETE',
    challengeSucceeded: true,
  });

  assertEquals(getMissionChallengeResultPresentation({
    missionSucceeded: false,
    fleetConditionMet: true,
    challengeSucceeded: false,
  }), {
    missionLabel: 'FAILED',
    missionSucceeded: false,
    challengeLabel: 'INCOMPLETE',
    challengeSucceeded: false,
  });
});
