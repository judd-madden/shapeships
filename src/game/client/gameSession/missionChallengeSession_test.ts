declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  LORE_UNREAD_STORAGE_KEY,
  MINIMIZE_MISSIONS_STORAGE_KEY,
  MISSION_FINDINGS_SEEN_STORAGE_KEY,
  clearLoreUnread,
  markMissionFindingIdsSeen,
  readLoreUnread,
  readMinimizeMissionsThisSession,
  readSeenMissionFindingIds,
  writeMinimizeMissionsThisSession,
  type StorageLike,
// @ts-ignore -- Deno 2.7 requires an explicit extension for this direct test run.
} from './missionChallengeSession.ts';

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
  assertEquals(
    markMissionFindingIdsSeen(['rebel-alliance-human'], storage),
    ['rebel-alliance-human'],
  );
  assertEquals(
    markMissionFindingIdsSeen(
      ['sol-1', 'rebel-alliance-human', 'mintaka'],
      storage,
    ),
    ['rebel-alliance-human', 'sol-1', 'mintaka'],
  );
  assertEquals(readSeenMissionFindingIds(storage), [
    'rebel-alliance-human',
    'sol-1',
    'mintaka',
  ]);
  assertEquals(
    JSON.parse(storage.values.get(MISSION_FINDINGS_SEEN_STORAGE_KEY) ?? 'null'),
    ['rebel-alliance-human', 'sol-1', 'mintaka'],
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

Deno.test('Lore unread defaults safely and only accepts true', () => {
  const storage = new FakeStorage();
  assert(readLoreUnread(storage) === false);
  storage.values.set(LORE_UNREAD_STORAGE_KEY, 'malformed');
  assert(readLoreUnread(storage) === false);
  storage.values.set(LORE_UNREAD_STORAGE_KEY, 'false');
  assert(readLoreUnread(storage) === false);
  storage.values.set(LORE_UNREAD_STORAGE_KEY, 'true');
  assert(readLoreUnread(storage) === true);
});

Deno.test('Lore unread follows newly unlocked visible Mission Findings', () => {
  const storage = new FakeStorage();

  markMissionFindingIdsSeen(['mintaka'], storage);
  assert(readLoreUnread(storage) === true);

  markMissionFindingIdsSeen(['ancient-mysteries-human'], storage);
  assert(readLoreUnread(storage) === true);

  clearLoreUnread(storage);
  assert(readLoreUnread(storage) === false);

  markMissionFindingIdsSeen(['mintaka'], storage);
  assert(readLoreUnread(storage) === false);

  markMissionFindingIdsSeen(['ancient-mysteries-centaur'], storage);
  assert(readLoreUnread(storage) === false);

  markMissionFindingIdsSeen(['ancient-mysteries-xenite'], storage);
  assert(readLoreUnread(storage) === true);

  assertEquals(readSeenMissionFindingIds(storage), [
    'mintaka',
    'ancient-mysteries-human',
    'ancient-mysteries-centaur',
    'ancient-mysteries-xenite',
  ]);
});

Deno.test('Lore unread unlocks grouped Rebel Alliance requirements in either order', () => {
  const humanFirstStorage = new FakeStorage();
  markMissionFindingIdsSeen(['rebel-alliance-human'], humanFirstStorage);
  assert(readLoreUnread(humanFirstStorage) === false);
  markMissionFindingIdsSeen(['rebel-alliance-centaur'], humanFirstStorage);
  assert(readLoreUnread(humanFirstStorage) === true);

  const centaurFirstStorage = new FakeStorage();
  markMissionFindingIdsSeen(['rebel-alliance-centaur'], centaurFirstStorage);
  assert(readLoreUnread(centaurFirstStorage) === false);
  markMissionFindingIdsSeen(['rebel-alliance-human'], centaurFirstStorage);
  assert(readLoreUnread(centaurFirstStorage) === true);
});

Deno.test('Lore unread recognizes ordinary rows emitted with grouped partial progress', () => {
  const storage = new FakeStorage();

  markMissionFindingIdsSeen(['sol-1', 'rebel-alliance-human'], storage);
  assert(readLoreUnread(storage) === true);

  clearLoreUnread(storage);
  markMissionFindingIdsSeen(['rebel-alliance-human'], storage);
  assert(readLoreUnread(storage) === false);

  markMissionFindingIdsSeen(['rebel-alliance-centaur'], storage);
  assert(readLoreUnread(storage) === true);
});

Deno.test('Lore unread ignores inputs that do not grow the normalized seen set', () => {
  const storage = new FakeStorage();
  storage.values.set(
    MISSION_FINDINGS_SEEN_STORAGE_KEY,
    JSON.stringify(['mintaka']),
  );

  markMissionFindingIdsSeen(['', '   ', 'mintaka', 'mintaka'], storage);
  assert(readLoreUnread(storage) === false);
  assertEquals(readSeenMissionFindingIds(storage), ['mintaka']);
});

Deno.test('Lore unread remains safe with unavailable and throwing storage', () => {
  assert(readLoreUnread(null) === false);
  assert(readLoreUnread(throwingStorage) === false);
  clearLoreUnread(null);
  clearLoreUnread(throwingStorage);
});

Deno.test('Lore unread is not written when the seen-ID write fails', () => {
  const unreadWrites: string[] = [];
  const seenWriteThrowingStorage: StorageLike = {
    getItem() {
      return null;
    },
    setItem(key, value) {
      if (key === MISSION_FINDINGS_SEEN_STORAGE_KEY) {
        throw new Error('seen write blocked');
      }
      if (key === LORE_UNREAD_STORAGE_KEY) {
        unreadWrites.push(value);
      }
    },
  };

  assertEquals(
    markMissionFindingIdsSeen(['mintaka'], seenWriteThrowingStorage),
    ['mintaka'],
  );
  assertEquals(unreadWrites, []);
});
