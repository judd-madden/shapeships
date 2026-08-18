declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  ANCIENT_FOREIGN_CHALLENGE_NOTE,
  formatMissionSystem,
  getChallengePresentationCopy,
  getMissionChallengeResultPresentation,
  interpolateMissionPlayer,
  shouldLockMissionInteraction,
  shouldShowMissionChallengeAction,
  shouldShowPostgameMissionChallengeAction,
} from '../../mission/missionChallengePresentation';

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

Deno.test('formats WITH Challenge copy with singular names and final-fleet guidance', () => {
  assertEquals(getChallengePresentationCopy({
    condition: 'with',
    playerSpecies: 'human',
    targetSpecies: 'Human',
    targetShipType: 'Basic',
    targetShipName: 'Defender',
    targetPluralShipName: 'Defenders',
  }), {
    heading: 'Win with a Defender',
    explanatoryCopy:
      "At least one Defender in your final fleet. Defenders consumed by upgrades don't count.",
  });
  assertEquals(getChallengePresentationCopy({
    condition: 'with',
    playerSpecies: 'human',
    targetSpecies: 'Xenite',
    targetShipType: 'Basic - Evolved',
    targetShipName: 'Asterite',
    targetPluralShipName: 'Asterites',
  }), {
    heading: 'Win with an Asterite',
    explanatoryCopy: 'At least one Asterite in your final fleet.',
  });
  assertEquals(getChallengePresentationCopy({
    condition: 'with',
    playerSpecies: 'xenite',
    targetSpecies: 'Xenite',
    targetShipType: 'Upgraded',
    targetShipName: 'Hive',
    targetPluralShipName: 'Hives',
  }), {
    heading: 'Win with a Hive',
    explanatoryCopy: 'At least one Hive in your final fleet.',
  });
  assertEquals(getChallengePresentationCopy({
    condition: 'with',
    playerSpecies: 'centaur',
    targetSpecies: 'Centaur',
    targetShipType: 'Upgraded',
    targetShipName: 'Ark of Redemption',
    targetPluralShipName: 'Arks of Redemption',
  }), {
    heading: 'Win with an Ark of Redemption',
    explanatoryCopy: 'At least one Ark of Redemption in your final fleet.',
  });
});

Deno.test('formats WITHOUT Challenge copy with plural names and final-fleet guidance', () => {
  assertEquals(getChallengePresentationCopy({
    condition: 'without',
    playerSpecies: 'human',
    targetSpecies: 'Human',
    targetShipType: 'Basic',
    targetShipName: 'Defender',
    targetPluralShipName: 'Defenders',
  }), {
    heading: 'Win without Defenders',
    explanatoryCopy: 'No Defenders in your final fleet.',
  });
  assertEquals(getChallengePresentationCopy({
    condition: 'without',
    playerSpecies: 'xenite',
    targetSpecies: 'Xenite',
    targetShipType: 'Upgraded',
    targetShipName: 'Hive',
    targetPluralShipName: 'Hives',
  }), {
    heading: 'Win without Hives',
    explanatoryCopy: 'No Hives in your final fleet.',
  });
  assertEquals(getChallengePresentationCopy({
    condition: 'without',
    playerSpecies: 'centaur',
    targetSpecies: 'Centaur',
    targetShipType: 'Upgraded',
    targetShipName: 'Ark of Terror',
    targetPluralShipName: 'Arks of Terror',
  }), {
    heading: 'Win without Arks of Terror',
    explanatoryCopy: 'No Arks of Terror in your final fleet.',
  });
});

Deno.test('preserves Ancient foreign Challenge guidance ahead of generic copy', () => {
  assertEquals(getChallengePresentationCopy({
    condition: 'with',
    playerSpecies: 'ancient',
    targetSpecies: 'Human',
    targetShipType: 'Basic',
    targetShipName: 'Defender',
    targetPluralShipName: 'Defenders',
  }), {
    heading: 'Win with a Defender',
    explanatoryCopy: ANCIENT_FOREIGN_CHALLENGE_NOTE,
  });
  assertEquals(getChallengePresentationCopy({
    condition: 'with',
    playerSpecies: 'ancient',
    targetSpecies: 'Centaur',
    targetShipType: 'Upgraded',
    targetShipName: 'Ark of Terror',
    targetPluralShipName: 'Arks of Terror',
  }), {
    heading: 'Win with an Ark of Terror',
    explanatoryCopy: ANCIENT_FOREIGN_CHALLENGE_NOTE,
  });
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
