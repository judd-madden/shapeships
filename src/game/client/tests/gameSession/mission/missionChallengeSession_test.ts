declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  LORE_UNREAD_STORAGE_KEY,
  MINIMIZE_MISSIONS_STORAGE_KEY,
  MISSION_FINDINGS_COMPLETED_STORAGE_KEY,
  MISSIONS_COMPLETED_STORAGE_KEY,
  clearLoreUnread,
  readCompletedMissionIds,
  recordCompletedMissionId,
  recordCompletedMissionFindingIds,
  readLoreUnread,
  readMinimizeMissionsThisSession,
  readCompletedMissionFindingIds,
  writeMinimizeMissionsThisSession,
  type StorageLike,
} from '../../../gameSession/mission/missionChallengeSession';
import {
  didUnlockAnyMissionFinding,
  isMissionFindingUnlocked,
} from '../../../gameSession/mission/missionFindingUnlocks';

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

Deno.test('retired Mintaka records and late results cannot unlock Findings or mark Lore unread', () => {
  const storage = new FakeStorage();
  storage.values.set(MISSION_FINDINGS_COMPLETED_STORAGE_KEY, JSON.stringify(['mintaka']));
  assert(!isMissionFindingUnlocked({ id: 'groombridge' }, new Set(readCompletedMissionFindingIds(storage))));
  assert(!isMissionFindingUnlocked({ id: 'mintaka' }, new Set(['mintaka'])));
  assert(!didUnlockAnyMissionFinding(new Set(), new Set(['mintaka'])));
  assert(!recordCompletedMissionFindingIds(['mintaka'], storage).didUnlockMissionFinding);
  assert(!readLoreUnread(storage));

  const lateResultStorage = new FakeStorage();
  assert(!recordCompletedMissionFindingIds(['mintaka'], lateResultStorage).didUnlockMissionFinding);
  assert(!readLoreUnread(lateResultStorage));
  assert(recordCompletedMissionFindingIds(['groombridge', 'mintaka'], lateResultStorage).didUnlockMissionFinding);
  assert(readLoreUnread(lateResultStorage));
  clearLoreUnread(lateResultStorage);
  assert(!recordCompletedMissionFindingIds(['groombridge'], lateResultStorage).didUnlockMissionFinding);
  assert(!readLoreUnread(lateResultStorage));
});

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
    {
      completedFindingIds: ['rebel-alliance-human'],
      didUnlockMissionFinding: false,
    },
  );
  assertEquals(
    recordCompletedMissionFindingIds(
      ['sol-1', 'rebel-alliance-human', 'groombridge'],
      storage,
    ),
    {
      completedFindingIds: ['rebel-alliance-human', 'sol-1', 'groombridge'],
      didUnlockMissionFinding: true,
    },
  );
  assertEquals(readCompletedMissionFindingIds(storage), [
    'rebel-alliance-human',
    'sol-1',
    'groombridge',
  ]);
  assertEquals(
    JSON.parse(storage.values.get(MISSION_FINDINGS_COMPLETED_STORAGE_KEY) ?? 'null'),
    ['rebel-alliance-human', 'sol-1', 'groombridge'],
  );
});

Deno.test('Mission Findings do not migrate the old visibility-based session key', () => {
  const storage = new FakeStorage();
  storage.values.set(
    'shapeships.missionFindingsSeen.v1',
    JSON.stringify(['groombridge']),
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
    recordCompletedMissionFindingIds(['', '   ', 'groombridge', 'groombridge'], storage),
    {
      completedFindingIds: ['groombridge'],
      didUnlockMissionFinding: true,
    },
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
  assertEquals(recordCompletedMissionFindingIds(['groombridge'], null), {
    completedFindingIds: ['groombridge'],
    didUnlockMissionFinding: false,
  });
  assertEquals(recordCompletedMissionFindingIds(['groombridge'], throwingStorage), {
    completedFindingIds: ['groombridge'],
    didUnlockMissionFinding: false,
  });
});

Deno.test('completed Missions use a separate versioned session key', () => {
  const storage = new FakeStorage();
  assertEquals(readCompletedMissionIds(storage), []);
  assertEquals(
    recordCompletedMissionId('mission-human-v-human-eliminate-rebels', storage),
    ['mission-human-v-human-eliminate-rebels'],
  );
  assertEquals(
    recordCompletedMissionId('mission-human-v-human-eliminate-rebels', storage),
    ['mission-human-v-human-eliminate-rebels'],
  );
  assertEquals(
    JSON.parse(storage.values.get(MISSIONS_COMPLETED_STORAGE_KEY) ?? 'null'),
    ['mission-human-v-human-eliminate-rebels'],
  );
  assert(storage.values.has(MISSION_FINDINGS_COMPLETED_STORAGE_KEY) === false);
  assert(storage.values.has(LORE_UNREAD_STORAGE_KEY) === false);
});

Deno.test('completed Missions normalize malformed data and tolerate unavailable storage', () => {
  const storage = new FakeStorage();
  storage.values.set(MISSIONS_COMPLETED_STORAGE_KEY, '{bad json');
  assertEquals(readCompletedMissionIds(storage), []);

  storage.values.set(
    MISSIONS_COMPLETED_STORAGE_KEY,
    JSON.stringify(['mission-a', '', 4, 'mission-a', 'mission-b']),
  );
  assertEquals(readCompletedMissionIds(storage), ['mission-a', 'mission-b']);
  assertEquals(recordCompletedMissionId('   ', storage), [
    'mission-a',
    'mission-b',
  ]);
  assertEquals(readCompletedMissionIds(null), []);
  assertEquals(readCompletedMissionIds(throwingStorage), []);
  assertEquals(recordCompletedMissionId('mission-a', null), ['mission-a']);
  assertEquals(recordCompletedMissionId('mission-a', throwingStorage), [
    'mission-a',
  ]);
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

  assertEquals(recordCompletedMissionFindingIds(['groombridge'], storage), {
    completedFindingIds: ['groombridge'],
    didUnlockMissionFinding: true,
  });
  assert(readLoreUnread(storage) === true);

  recordCompletedMissionFindingIds(['ancient-mysteries-human'], storage);
  assert(readLoreUnread(storage) === true);

  clearLoreUnread(storage);
  assert(readLoreUnread(storage) === false);

  assertEquals(recordCompletedMissionFindingIds(['groombridge'], storage), {
    completedFindingIds: ['groombridge', 'ancient-mysteries-human'],
    didUnlockMissionFinding: false,
  });
  assert(readLoreUnread(storage) === false);

  recordCompletedMissionFindingIds(['ancient-mysteries-centaur'], storage);
  assert(readLoreUnread(storage) === false);

  recordCompletedMissionFindingIds(['ancient-mysteries-xenite'], storage);
  assert(readLoreUnread(storage) === true);

  assertEquals(readCompletedMissionFindingIds(storage), [
    'groombridge',
    'ancient-mysteries-human',
    'ancient-mysteries-centaur',
    'ancient-mysteries-xenite',
  ]);
});

Deno.test('Lore unread unlocks grouped Rebel Alliance requirements in either order', () => {
  const humanFirstStorage = new FakeStorage();
  assertEquals(
    recordCompletedMissionFindingIds(['rebel-alliance-human'], humanFirstStorage),
    {
      completedFindingIds: ['rebel-alliance-human'],
      didUnlockMissionFinding: false,
    },
  );
  assert(readLoreUnread(humanFirstStorage) === false);
  assertEquals(
    recordCompletedMissionFindingIds(['rebel-alliance-centaur'], humanFirstStorage),
    {
      completedFindingIds: ['rebel-alliance-human', 'rebel-alliance-centaur'],
      didUnlockMissionFinding: true,
    },
  );
  assert(readLoreUnread(humanFirstStorage) === true);

  const centaurFirstStorage = new FakeStorage();
  recordCompletedMissionFindingIds(['rebel-alliance-centaur'], centaurFirstStorage);
  assert(readLoreUnread(centaurFirstStorage) === false);
  recordCompletedMissionFindingIds(['rebel-alliance-human'], centaurFirstStorage);
  assert(readLoreUnread(centaurFirstStorage) === true);
});

Deno.test('Lore unread recognizes ordinary rows emitted with grouped partial progress', () => {
  const storage = new FakeStorage();

  assertEquals(
    recordCompletedMissionFindingIds(['sol-1', 'rebel-alliance-human'], storage),
    {
      completedFindingIds: ['sol-1', 'rebel-alliance-human'],
      didUnlockMissionFinding: true,
    },
  );
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
    JSON.stringify(['groombridge']),
  );

  recordCompletedMissionFindingIds(['', '   ', 'groombridge', 'groombridge'], storage);
  assert(readLoreUnread(storage) === false);
  assertEquals(readCompletedMissionFindingIds(storage), ['groombridge']);
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
    recordCompletedMissionFindingIds(['groombridge'], completedWriteThrowingStorage),
    {
      completedFindingIds: ['groombridge'],
      didUnlockMissionFinding: false,
    },
  );
  assertEquals(unreadWrites, []);
});
