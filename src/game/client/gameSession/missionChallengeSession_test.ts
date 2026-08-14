declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  MINIMIZE_MISSIONS_STORAGE_KEY,
  MISSION_FINDINGS_SEEN_STORAGE_KEY,
  markMissionFindingIdsSeen,
  readMinimizeMissionsThisSession,
  readSeenMissionFindingIds,
  writeMinimizeMissionsThisSession,
  type StorageLike,
} from './missionChallengeSession';

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

class FakeStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const throwingStorage: StorageLike = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

Deno.test('Minimize Missions defaults safely and uses its dedicated versioned key', () => {
  const storage = new FakeStorage();
  assert(readMinimizeMissionsThisSession(storage) === false);
  storage.values.set(MINIMIZE_MISSIONS_STORAGE_KEY, 'malformed');
  assert(readMinimizeMissionsThisSession(storage) === false);
  storage.values.set(MINIMIZE_MISSIONS_STORAGE_KEY, 'false');
  assert(readMinimizeMissionsThisSession(storage) === false);
  storage.values.set(MINIMIZE_MISSIONS_STORAGE_KEY, 'true');
  assert(readMinimizeMissionsThisSession(storage) === true);

  writeMinimizeMissionsThisSession(false, storage);
  assert(storage.values.get(MINIMIZE_MISSIONS_STORAGE_KEY) === 'false');
  writeMinimizeMissionsThisSession(true, storage);
  assert(storage.values.get(MINIMIZE_MISSIONS_STORAGE_KEY) === 'true');
});

Deno.test('Minimize Missions tolerates unavailable and throwing storage', () => {
  assert(readMinimizeMissionsThisSession(null) === false);
  assert(readMinimizeMissionsThisSession(throwingStorage) === false);
  writeMinimizeMissionsThisSession(true, null);
  writeMinimizeMissionsThisSession(true, throwingStorage);
});

Deno.test('Mission Findings read empty and add flat unique IDs deterministically', () => {
  const storage = new FakeStorage();
  assertEquals(readSeenMissionFindingIds(storage), []);
  assertEquals(markMissionFindingIdsSeen(['rebel-alliance'], storage), ['rebel-alliance']);
  assertEquals(
    markMissionFindingIdsSeen(['sol-1', 'rebel-alliance', 'mintaka'], storage),
    ['rebel-alliance', 'sol-1', 'mintaka'],
  );
  assertEquals(readSeenMissionFindingIds(storage), [
    'rebel-alliance',
    'sol-1',
    'mintaka',
  ]);
  assertEquals(
    JSON.parse(storage.values.get(MISSION_FINDINGS_SEEN_STORAGE_KEY) ?? 'null'),
    ['rebel-alliance', 'sol-1', 'mintaka'],
  );
});

Deno.test('Mission Findings ignore invalid IDs and malformed stored JSON', () => {
  const storage = new FakeStorage();
  storage.values.set(MISSION_FINDINGS_SEEN_STORAGE_KEY, '{bad json');
  assertEquals(readSeenMissionFindingIds(storage), []);
  assertEquals(
    markMissionFindingIdsSeen(['', '   ', 'mintaka', 'mintaka'], storage),
    ['mintaka'],
  );

  storage.values.set(
    MISSION_FINDINGS_SEEN_STORAGE_KEY,
    JSON.stringify(['sol-1', '', 4, 'sol-1']),
  );
  assertEquals(readSeenMissionFindingIds(storage), ['sol-1']);
});

Deno.test('Mission Findings tolerate unavailable and throwing storage', () => {
  assertEquals(readSeenMissionFindingIds(null), []);
  assertEquals(readSeenMissionFindingIds(throwingStorage), []);
  assertEquals(markMissionFindingIdsSeen(['mintaka'], null), ['mintaka']);
  assertEquals(markMissionFindingIdsSeen(['mintaka'], throwingStorage), ['mintaka']);
});
