declare const Deno: { test(name: string, fn: () => void | Promise<void>): void };

import {
  MAX_RETIRED_GAME_IDS,
  WIN_STREAK_STORAGE_KEY,
  WinStreakProfileStore,
  createEmptyWinStreakProfile,
  parseWinStreakProfile,
  retireGameId,
  type ExclusiveRunner,
  type StorageLike,
} from '../../winStreak/profile';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`actual: ${a}\nexpected: ${e}`);
}

class FakeStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function serialRunner(): ExclusiveRunner {
  let queue: Promise<unknown> = Promise.resolve();
  return async <T>(work: () => T | Promise<T>) => {
    const run = queue.then(work, work);
    queue = run.then(() => undefined, () => undefined);
    return run;
  };
}

Deno.test('win streak profile defaults safely for missing, malformed, and unavailable storage', async () => {
  assertEquals(parseWinStreakProfile(null), createEmptyWinStreakProfile());
  assertEquals(parseWinStreakProfile('{bad'), createEmptyWinStreakProfile());
  const throwing: StorageLike = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const store = new WinStreakProfileStore(throwing, serialRunner());
  await store.mutate((profile) => { profile.currentCount = 3; });
  await store.mutate((profile) => { profile.currentCount += 2; });
  assert(store.getSnapshot().currentCount === 5);
});

Deno.test('profile persistence is independent of player names and session storage', async () => {
  const storage = new FakeStorage();
  const store = new WinStreakProfileStore(storage, serialRunner());
  await store.mutate((profile) => {
    profile.currentCount = 4;
    profile.endedStreak = { count: 2, endingGameId: 'ENDED' };
  });
  const reloaded = new WinStreakProfileStore(storage, serialRunner());
  assert(reloaded.getSnapshot().currentCount === 4);
  assertEquals(reloaded.getSnapshot().endedStreak, { count: 2, endingGameId: 'ENDED' });
  assert(storage.values.size === 1 && storage.values.has(WIN_STREAK_STORAGE_KEY));
});

Deno.test('same-document subscribers are notified and external values are accepted', async () => {
  const storage = new FakeStorage();
  const store = new WinStreakProfileStore(storage, serialRunner());
  let notifications = 0;
  const unsubscribe = store.subscribe(() => { notifications += 1; });
  await store.mutate((profile) => { profile.currentCount = 1; });
  store.acceptExternalValue(JSON.stringify({ ...store.getSnapshot(), currentCount: 2 }));
  unsubscribe();
  assert(notifications === 2);
  assert(store.getSnapshot().currentCount === 2);
});

Deno.test('retirement ledger is bounded and seals discovery without evicting IDs', () => {
  const profile = createEmptyWinStreakProfile();
  for (let index = 0; index < MAX_RETIRED_GAME_IDS + 5; index += 1) {
    retireGameId(profile, `GAME-${index}`);
  }
  assert(profile.retiredGameIds.length === MAX_RETIRED_GAME_IDS);
  assert(profile.retiredGameIds[0] === 'GAME-0');
  assert(profile.automaticEnrollmentSealed === true);
});
