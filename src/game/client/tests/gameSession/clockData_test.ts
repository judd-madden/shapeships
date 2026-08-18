declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import { getClockData } from '../../gameSession/selectors';

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

const inferredLiveLegacyState = {
  gameData: {
    currentPhase: 'build',
    currentSubPhase: 'dice_roll',
    turnNumber: 1,
    clock: {
      remainingMsByPlayerId: { p1: 60_000 },
      lastUpdateAtMs: 100,
    },
  },
};

Deno.test('public clock truth wins over root and legacy clock families', () => {
  const result = getClockData({
    ...inferredLiveLegacyState,
    clock: {
      remainingMsByPlayerId: { p1: 50_000 },
      clocksAreLive: true,
      serverNowMs: 200,
    },
    publicState: {
      clock: {
        remainingMsByPlayerId: { p1: 40_000 },
        clocksAreLive: false,
        serverNowMs: 300,
      },
    },
  });

  assertDeepEqual(result, {
    remainingMsByPlayerId: { p1: 40_000 },
    clocksAreLive: false,
    serverNowMs: 300,
  });
});

Deno.test('root projected clock wins when the public clock property is absent', () => {
  const result = getClockData({
    ...inferredLiveLegacyState,
    publicState: {},
    clock: {
      remainingMsByPlayerId: { p1: 50_000 },
      clocksAreLive: false,
      serverNowMs: 200,
    },
  });

  assertDeepEqual(result, {
    remainingMsByPlayerId: { p1: 50_000 },
    clocksAreLive: false,
    serverNowMs: 200,
  });
});

Deno.test('explicit normalized null clocks do not resurrect legacy state', () => {
  const publicNullResult = getClockData({
    ...inferredLiveLegacyState,
    clock: {
      remainingMsByPlayerId: { p1: 50_000 },
      clocksAreLive: true,
      serverNowMs: 200,
    },
    publicState: { clock: null },
  });
  const rootNullResult = getClockData({
    ...inferredLiveLegacyState,
    publicState: {},
    clock: null,
  });

  assertDeepEqual(publicNullResult.remainingMsByPlayerId, {});
  assertEqual(publicNullResult.clocksAreLive, false);
  assertDeepEqual(rootNullResult.remainingMsByPlayerId, {});
  assertEqual(rootNullResult.clocksAreLive, false);
});

Deno.test('normalized clocks with missing or invalid liveness fail safe to paused', () => {
  const missingResult = getClockData({
    ...inferredLiveLegacyState,
    publicState: {
      clock: {
        remainingMsByPlayerId: { p1: 40_000 },
        serverNowMs: 300,
      },
    },
  });
  const invalidResult = getClockData({
    ...inferredLiveLegacyState,
    publicState: {},
    clock: {
      remainingMsByPlayerId: { p1: 50_000 },
      clocksAreLive: 'yes',
      serverNowMs: 200,
    },
  });

  assertEqual(missingResult.clocksAreLive, false);
  assertEqual(invalidResult.clocksAreLive, false);
});

Deno.test('legacy clocks retain explicit liveness and phase-based inference', () => {
  const inferredResult = getClockData(inferredLiveLegacyState);
  const explicitPausedResult = getClockData({
    gameData: {
      ...inferredLiveLegacyState.gameData,
      clock: {
        ...inferredLiveLegacyState.gameData.clock,
        clocksAreLive: false,
      },
    },
  });

  assertDeepEqual(inferredResult, {
    remainingMsByPlayerId: { p1: 60_000 },
    clocksAreLive: true,
    serverNowMs: 100,
  });
  assertEqual(explicitPausedResult.clocksAreLive, false);
});

Deno.test('ordinary projected live clocks remain live', () => {
  const result = getClockData({
    publicState: {
      clock: {
        remainingMsByPlayerId: { p1: 30_000 },
        clocksAreLive: true,
        serverNowMs: 400,
      },
    },
  });

  assertDeepEqual(result, {
    remainingMsByPlayerId: { p1: 30_000 },
    clocksAreLive: true,
    serverNowMs: 400,
  });
});
