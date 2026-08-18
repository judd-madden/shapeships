declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  LORE_UNREAD_STORAGE_KEY,
  MINIMIZE_MISSIONS_STORAGE_KEY,
  MISSION_FINDINGS_COMPLETED_STORAGE_KEY,
  clearLoreUnread,
  recordCompletedMissionFindingIds,
  readLoreUnread,
  readMinimizeMissionsThisSession,
  readCompletedMissionFindingIds,
  writeMinimizeMissionsThisSession,
  type StorageLike,
} from '../../../gameSession/mission/missionChallengeSession';

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
  assertEquals(readCompletedMissionFindingIds(storage), []);
  assertEquals(
    recordCompletedMissionFindingIds(['rebel-alliance-human'], storage),
    ['rebel-alliance-human'],
  );
  assertEquals(
    recordCompletedMissionFindingIds(
      ['sol-1', 'rebel-alliance-human', 'mintaka'],
      storage,
    ),
    ['rebel-alliance-human', 'sol-1', 'mintaka'],
  );
  assertEquals(readCompletedMissionFindingIds(storage), [
    'rebel-alliance-human',
    'sol-1',
    'mintaka',
  ]);
  assertEquals(
    JSON.parse(storage.values.get(MISSION_FINDINGS_COMPLETED_STORAGE_KEY) ?? 'null'),
    ['rebel-alliance-human', 'sol-1', 'mintaka'],
  );
});

Deno.test('Mission Findings do not migrate the old visibility-based session key', () => {
  const storage = new FakeStorage();
  storage.values.set(
    'shapeships.missionFindingsSeen.v1',
    JSON.stringify(['mintaka']),
  );

  assertEquals(readCompletedMissionFindingIds(storage), []);
  assert(
    storage.values.has(MISSION_FINDINGS_COMPLETED_STORAGE_KEY) === false,
  );
});

Deno.test('Mission Findings ignore invalid IDs and malformed stored JSON', () => {
  const storage = new FakeStorage();
  storage.values.set(MISSION_FINDINGS_COMPLETED_STORAGE_KEY, '{bad json');
  assertEquals(readCompletedMissionFindingIds(storage), []);
  assertEquals(
    recordCompletedMissionFindingIds(['', '   ', 'mintaka', 'mintaka'], storage),
    ['mintaka'],
  );

  storage.values.set(
    MISSION_FINDINGS_COMPLETED_STORAGE_KEY,
    JSON.stringify(['sol-1', '', 4, 'sol-1']),
  );
  assertEquals(readCompletedMissionFindingIds(storage), ['sol-1']);
});

Deno.test('Mission Findings tolerate unavailable and throwing storage', () => {
  assertEquals(readCompletedMissionFindingIds(null), []);
  assertEquals(readCompletedMissionFindingIds(throwingStorage), []);
  assertEquals(recordCompletedMissionFindingIds(['mintaka'], null), ['mintaka']);
  assertEquals(recordCompletedMissionFindingIds(['mintaka'], throwingStorage), ['mintaka']);
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

Deno.test('Lore unread follows newly unlocked completed Mission Findings', () => {
  const storage = new FakeStorage();

  recordCompletedMissionFindingIds(['mintaka'], storage);
  assert(readLoreUnread(storage) === true);

  recordCompletedMissionFindingIds(['ancient-mysteries-human'], storage);
  assert(readLoreUnread(storage) === true);

  clearLoreUnread(storage);
  assert(readLoreUnread(storage) === false);

  recordCompletedMissionFindingIds(['mintaka'], storage);
  assert(readLoreUnread(storage) === false);

  recordCompletedMissionFindingIds(['ancient-mysteries-centaur'], storage);
  assert(readLoreUnread(storage) === false);

  recordCompletedMissionFindingIds(['ancient-mysteries-xenite'], storage);
  assert(readLoreUnread(storage) === true);

  assertEquals(readCompletedMissionFindingIds(storage), [
    'mintaka',
    'ancient-mysteries-human',
    'ancient-mysteries-centaur',
    'ancient-mysteries-xenite',
  ]);
});

Deno.test('Lore unread unlocks grouped Rebel Alliance requirements in either order', () => {
  const humanFirstStorage = new FakeStorage();
  recordCompletedMissionFindingIds(['rebel-alliance-human'], humanFirstStorage);
  assert(readLoreUnread(humanFirstStorage) === false);
  recordCompletedMissionFindingIds(['rebel-alliance-centaur'], humanFirstStorage);
  assert(readLoreUnread(humanFirstStorage) === true);

  const centaurFirstStorage = new FakeStorage();
  recordCompletedMissionFindingIds(['rebel-alliance-centaur'], centaurFirstStorage);
  assert(readLoreUnread(centaurFirstStorage) === false);
  recordCompletedMissionFindingIds(['rebel-alliance-human'], centaurFirstStorage);
  assert(readLoreUnread(centaurFirstStorage) === true);
});

Deno.test('Lore unread recognizes ordinary rows emitted with grouped partial progress', () => {
  const storage = new FakeStorage();

  recordCompletedMissionFindingIds(['sol-1', 'rebel-alliance-human'], storage);
  assert(readLoreUnread(storage) === true);

  clearLoreUnread(storage);
  recordCompletedMissionFindingIds(['rebel-alliance-human'], storage);
  assert(readLoreUnread(storage) === false);

  recordCompletedMissionFindingIds(['rebel-alliance-centaur'], storage);
  assert(readLoreUnread(storage) === true);
});

Deno.test('Lore unread ignores inputs that do not grow the normalized completed set', () => {
  const storage = new FakeStorage();
  storage.values.set(
    MISSION_FINDINGS_COMPLETED_STORAGE_KEY,
    JSON.stringify(['mintaka']),
  );

  recordCompletedMissionFindingIds(['', '   ', 'mintaka', 'mintaka'], storage);
  assert(readLoreUnread(storage) === false);
  assertEquals(readCompletedMissionFindingIds(storage), ['mintaka']);
});

Deno.test('Lore unread remains safe with unavailable and throwing storage', () => {
  assert(readLoreUnread(null) === false);
  assert(readLoreUnread(throwingStorage) === false);
  clearLoreUnread(null);
  clearLoreUnread(throwingStorage);
});

Deno.test('Lore unread is not written when the completed-ID write fails', () => {
  const unreadWrites: string[] = [];
  const completedWriteThrowingStorage: StorageLike = {
    getItem() {
      return null;
    },
    setItem(key, value) {
      if (key === MISSION_FINDINGS_COMPLETED_STORAGE_KEY) {
        throw new Error('completed write blocked');
      }
      if (key === LORE_UNREAD_STORAGE_KEY) {
        unreadWrites.push(value);
      }
    },
  };

  assertEquals(
    recordCompletedMissionFindingIds(['mintaka'], completedWriteThrowingStorage),
    ['mintaka'],
  );
  assertEquals(unreadWrites, []);
});
