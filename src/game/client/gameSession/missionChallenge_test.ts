declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  buildMissionChallengeViewModel,
  claimMissionAcknowledgement,
  createMissionAutoAckState,
  normalizeRequesterMissionChallenge,
  shouldAutomaticallyAcknowledgeMission,
  shouldPresentInitialMissionIntro,
} from './missionChallenge';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message = 'values differ'): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nactual: ${actualJson}\nexpected: ${expectedJson}`);
  }
}

function requesterState(overrides: Record<string, unknown> = {}) {
  return {
    requester: {
      missionChallenge: {
        mission: {
          id: 'mission-h-x',
          year: 2814,
          title: 'The Signal',
          location: 'Mintaka',
          author: 'juddly',
          paragraphs: ['Commander [player], respond.', 'Second paragraph.'],
          findingIds: ['mintaka', 'rebel-alliance', 'mintaka'],
        },
        challenge: { shipDefId: 'DEF', condition: 'with' },
        introPending: true,
        ...overrides,
      },
    },
  };
}

Deno.test('normalizes only the requester Mission DTO and preserves authored data', () => {
  const raw = requesterState();
  const normalized = normalizeRequesterMissionChallenge(raw);
  assert(normalized);
  assertEquals(normalized.mission, {
    id: 'mission-h-x',
    year: 2814,
    title: 'The Signal',
    location: 'Mintaka',
    author: 'juddly',
    paragraphs: ['Commander [player], respond.', 'Second paragraph.'],
    findingIds: ['mintaka', 'rebel-alliance'],
  });
  assertEquals(normalized.challenge, { shipDefId: 'DEF', condition: 'with' });
  assert(normalized.introPending === true);
  assert(normalized.result === null);

  normalized.mission.paragraphs[0] = 'changed';
  assert(
    raw.requester.missionChallenge.mission.paragraphs[0] ===
      'Commander [player], respond.',
    'normalization must not mutate raw state',
  );
});

Deno.test('normalizes WITH and WITHOUT challenge conditions', () => {
  assert(
    normalizeRequesterMissionChallenge(requesterState())?.challenge.condition === 'with',
  );
  const without = requesterState({
    challenge: { shipDefId: 'FIG', condition: 'without' },
  });
  assert(
    normalizeRequesterMissionChallenge(without)?.challenge.condition === 'without',
  );
});

Deno.test('preserves server-authored finished result booleans exactly', () => {
  const failed = normalizeRequesterMissionChallenge(requesterState({
    introPending: false,
    result: {
      missionSucceeded: false,
      fleetConditionMet: true,
      challengeSucceeded: false,
    },
  }));
  assertEquals(failed?.result, {
    missionSucceeded: false,
    fleetConditionMet: true,
    challengeSucceeded: false,
  });

  const complete = normalizeRequesterMissionChallenge(requesterState({
    introPending: false,
    result: {
      missionSucceeded: true,
      fleetConditionMet: true,
      challengeSucceeded: true,
    },
  }));
  assertEquals(complete?.result, {
    missionSucceeded: true,
    fleetConditionMet: true,
    challengeSucceeded: true,
  });
});

Deno.test('drops malformed optional results without discarding a valid Mission', () => {
  const normalized = normalizeRequesterMissionChallenge(requesterState({
    result: {
      missionSucceeded: true,
      fleetConditionMet: true,
    },
  }));
  assert(normalized);
  assert(normalized.result === null);
});

Deno.test('rejects malformed core DTO fields', () => {
  assert(normalizeRequesterMissionChallenge(requesterState({ introPending: 'yes' })) === null);
  assert(normalizeRequesterMissionChallenge(requesterState({
    challenge: { shipDefId: '', condition: 'with' },
  })) === null);
  assert(normalizeRequesterMissionChallenge({
    requester: {
      missionChallenge: {
        ...requesterState().requester.missionChallenge,
        mission: {
          ...requesterState().requester.missionChallenge.mission,
          findingIds: ['mintaka', ''],
        },
      },
    },
  }) === null);
  assert(normalizeRequesterMissionChallenge({
    requester: {
      missionChallenge: {
        ...requesterState().requester.missionChallenge,
        mission: {
          ...requesterState().requester.missionChallenge.mission,
          findingIds: [],
        },
      },
    },
  }) === null);
});

Deno.test('does not read root or gameData Mission fallbacks', () => {
  const missionChallenge = requesterState().requester.missionChallenge;
  assert(normalizeRequesterMissionChallenge({ missionChallenge }) === null);
  assert(normalizeRequesterMissionChallenge({ gameData: { missionChallenge } }) === null);
  assert(normalizeRequesterMissionChallenge({ requester: {} }) === null);
});

Deno.test('builds one central VM without deriving result truth', () => {
  const normalized = normalizeRequesterMissionChallenge(requesterState({
    result: {
      missionSucceeded: false,
      fleetConditionMet: true,
      challengeSucceeded: false,
    },
  }));
  const vm = buildMissionChallengeViewModel({
    normalized,
    isFinished: true,
    minimizeMissionsThisSession: true,
    shouldPresentInitialIntro: false,
  });
  assert(vm);
  assert(vm.isFinished === true);
  assert(vm.minimizeMissionsThisSession === true);
  assert(vm.shouldPresentInitialIntro === false);
  assertEquals(vm.result, normalized?.result);
});

Deno.test('initial Mission presentation follows captured auto-ack state', () => {
  const pendingMission = normalizeRequesterMissionChallenge(requesterState());
  const acknowledgedMission = normalizeRequesterMissionChallenge(
    requesterState({ introPending: false }),
  );
  assert(pendingMission);
  assert(acknowledgedMission);

  const normalGame = createMissionAutoAckState('game-a', false);
  assert(shouldPresentInitialMissionIntro({
    state: normalGame,
    gameId: 'game-a',
    missionChallenge: pendingMission,
  }));

  // Changing the live preference does not mutate the captured state.
  assert(normalGame.eligible === false);
  assert(shouldPresentInitialMissionIntro({
    state: normalGame,
    gameId: 'game-a',
    missionChallenge: pendingMission,
  }));

  const minimizedGame = createMissionAutoAckState('game-b', true);
  assert(!shouldPresentInitialMissionIntro({
    state: minimizedGame,
    gameId: 'game-b',
    missionChallenge: pendingMission,
  }));

  const automaticClaim = claimMissionAcknowledgement({
    state: minimizedGame,
    gameId: 'game-b',
    missionChallenge: pendingMission,
    source: 'automatic',
  });
  assert(automaticClaim);
  assert(!shouldPresentInitialMissionIntro({
    state: automaticClaim,
    gameId: 'game-b',
    missionChallenge: pendingMission,
  }));

  automaticClaim.inFlight = false;
  automaticClaim.automaticAttemptSettled = true;
  assert(shouldPresentInitialMissionIntro({
    state: automaticClaim,
    gameId: 'game-b',
    missionChallenge: pendingMission,
  }));
  assert(!shouldPresentInitialMissionIntro({
    state: automaticClaim,
    gameId: 'game-b',
    missionChallenge: acknowledgedMission,
  }));
});

Deno.test('manual PLAY does not hide an initial Mission optimistically', () => {
  const pendingMission = normalizeRequesterMissionChallenge(requesterState());
  assert(pendingMission);

  const fallback = createMissionAutoAckState('game-b', true);
  fallback.autoAttempted = true;
  fallback.automaticAttemptSettled = true;
  const manualClaim = claimMissionAcknowledgement({
    state: fallback,
    gameId: 'game-b',
    missionChallenge: pendingMission,
    source: 'manual',
  });
  assert(manualClaim);
  assert(manualClaim.inFlight === true);
  assert(manualClaim.automaticAttemptSettled === true);
  assert(shouldPresentInitialMissionIntro({
    state: manualClaim,
    gameId: 'game-b',
    missionChallenge: pendingMission,
  }));
});

Deno.test('auto-ack eligibility is captured per game and waits for a pending Mission', () => {
  const mission = normalizeRequesterMissionChallenge(requesterState());
  assert(mission);

  const gameA = createMissionAutoAckState('game-a', false);
  assert(!shouldAutomaticallyAcknowledgeMission({ state: gameA, gameId: 'game-a', missionChallenge: mission }));

  // A later preference change does not mutate Game A's captured eligibility.
  assert(gameA.eligible === false);

  const gameB = createMissionAutoAckState('game-b', true);
  assert(!shouldAutomaticallyAcknowledgeMission({ state: gameB, gameId: 'game-b', missionChallenge: null }));
  assert(gameB.autoAttempted === false);
  assert(shouldAutomaticallyAcknowledgeMission({ state: gameB, gameId: 'game-b', missionChallenge: mission }));
});

Deno.test('automatic claim consumes one attempt and polling cannot reclaim it', () => {
  const mission = normalizeRequesterMissionChallenge(requesterState());
  const initial = createMissionAutoAckState('game-b', true);
  const claimed = claimMissionAcknowledgement({
    state: initial,
    gameId: 'game-b',
    missionChallenge: mission,
    source: 'automatic',
  });
  assert(claimed);
  assert(claimed.autoAttempted === true);
  assert(claimed.inFlight === true);
  assert(claimMissionAcknowledgement({
    state: claimed,
    gameId: 'game-b',
    missionChallenge: mission,
    source: 'automatic',
  }) === null);

  claimed.inFlight = false;
  assert(!shouldAutomaticallyAcknowledgeMission({
    state: claimed,
    gameId: 'game-b',
    missionChallenge: mission,
  }));
  assert(claimMissionAcknowledgement({
    state: claimed,
    gameId: 'game-b',
    missionChallenge: mission,
    source: 'manual',
  })?.inFlight === true);
});

Deno.test('acknowledged or absent Missions do not auto-ack and new games reset latches', () => {
  const acknowledgedMission = normalizeRequesterMissionChallenge(requesterState({ introPending: false }));
  const oldGame = createMissionAutoAckState('game-a', true);
  oldGame.autoAttempted = true;
  oldGame.inFlight = true;
  assert(!shouldAutomaticallyAcknowledgeMission({
    state: oldGame,
    gameId: 'game-a',
    missionChallenge: acknowledgedMission,
  }));
  assert(!shouldAutomaticallyAcknowledgeMission({
    state: oldGame,
    gameId: 'game-a',
    missionChallenge: null,
  }));

  const newGame = createMissionAutoAckState('game-b', true);
  assert(newGame.autoAttempted === false);
  assert(newGame.inFlight === false);
  oldGame.inFlight = false;
  assert(newGame.inFlight === false, 'old settlement must not alter the new object');
});
