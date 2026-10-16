import type {
  WinStreakCreationReservation,
  WinStreakProfile,
  WinStreakTrackedGame,
} from './types';

export const WIN_STREAK_STORAGE_KEY = 'shapeships.winStreakProfile.v1';
export const WIN_STREAK_LOCK_NAME = 'shapeships.winStreakProfile.v1';
export const MAX_RETIRED_GAME_IDS = 64;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ExclusiveRunner = <T>(work: () => Promise<T> | T) => Promise<T>;

export function createEmptyWinStreakProfile(): WinStreakProfile {
  return {
    version: 1,
    revision: 0,
    generation: 0,
    currentCount: 0,
    trackedGame: null,
    endedStreak: null,
    creationReservation: null,
    retiredGameIds: [],
    automaticEnrollmentSealed: false,
  };
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseTrackedGame(value: unknown): WinStreakTrackedGame | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WinStreakTrackedGame>;
  if (
    typeof candidate.gameId !== 'string' ||
    typeof candidate.humanPlayerId !== 'string' ||
    !['unfinished', 'settled', 'retired', 'restart_pending'].includes(candidate.status ?? '') ||
    typeof candidate.resultEligible !== 'boolean'
  ) {
    return null;
  }
  return candidate as WinStreakTrackedGame;
}

function parseReservation(value: unknown): WinStreakCreationReservation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<WinStreakCreationReservation>;
  if (
    typeof candidate.token !== 'string' ||
    (candidate.kind !== 'create' && candidate.kind !== 'rematch') ||
    (candidate.sourceGameId !== null && typeof candidate.sourceGameId !== 'string') ||
    !isNonNegativeSafeInteger(candidate.requestedCount) ||
    !isNonNegativeSafeInteger(candidate.baseGeneration) ||
    (candidate.baseTrackedGameId !== null && typeof candidate.baseTrackedGameId !== 'string') ||
    (candidate.baseTrackedGameStatus !== null &&
      !['unfinished', 'settled', 'retired', 'restart_pending'].includes(
        candidate.baseTrackedGameStatus ?? '',
      )) ||
    !['reserved', 'creating', 'ambiguous', 'stale_success'].includes(candidate.status ?? '') ||
    !isNonNegativeSafeInteger(candidate.createdAtMs) ||
    (candidate.error !== null && typeof candidate.error !== 'string') ||
    (candidate.recoveryGameId !== null && typeof candidate.recoveryGameId !== 'string')
  ) {
    return null;
  }
  return candidate as WinStreakCreationReservation;
}

export function parseWinStreakProfile(raw: string | null): WinStreakProfile {
  if (raw == null) return createEmptyWinStreakProfile();
  try {
    const value = JSON.parse(raw) as Partial<WinStreakProfile>;
    if (
      value?.version !== 1 ||
      !isNonNegativeSafeInteger(value.revision) ||
      !isNonNegativeSafeInteger(value.generation) ||
      !isNonNegativeSafeInteger(value.currentCount) ||
      !Array.isArray(value.retiredGameIds) ||
      value.retiredGameIds.some((id) => typeof id !== 'string') ||
      value.retiredGameIds.length > MAX_RETIRED_GAME_IDS ||
      typeof value.automaticEnrollmentSealed !== 'boolean'
    ) {
      return createEmptyWinStreakProfile();
    }
    const ended = value.endedStreak;
    const endedStreak = ended == null
      ? null
      : isNonNegativeSafeInteger(ended.count) &&
          ended.count > 0 &&
          typeof ended.endingGameId === 'string'
        ? { count: ended.count, endingGameId: ended.endingGameId }
        : null;
    const retiredGameIds = [...new Set(value.retiredGameIds)];
    return {
      version: 1,
      revision: value.revision,
      generation: value.generation,
      currentCount: value.currentCount,
      trackedGame: parseTrackedGame(value.trackedGame),
      endedStreak,
      creationReservation: parseReservation(value.creationReservation),
      retiredGameIds,
      automaticEnrollmentSealed:
        value.automaticEnrollmentSealed || retiredGameIds.length >= MAX_RETIRED_GAME_IDS,
    };
  } catch {
    return createEmptyWinStreakProfile();
  }
}

export function retireGameId(profile: WinStreakProfile, gameId: string): void {
  if (!gameId || profile.retiredGameIds.includes(gameId)) return;
  if (profile.retiredGameIds.length >= MAX_RETIRED_GAME_IDS) {
    profile.automaticEnrollmentSealed = true;
    return;
  }
  profile.retiredGameIds.push(gameId);
  if (profile.retiredGameIds.length >= MAX_RETIRED_GAME_IDS) {
    profile.automaticEnrollmentSealed = true;
  }
}

function cloneProfile(profile: WinStreakProfile): WinStreakProfile {
  return structuredClone(profile);
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createDefaultExclusiveRunner(): ExclusiveRunner {
  let fallbackQueue: Promise<unknown> = Promise.resolve();
  return async <T>(work: () => Promise<T> | T): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request(WIN_STREAK_LOCK_NAME, () => work());
    }
    // Best effort only: this queue serializes this document, but cannot provide
    // cross-tab exclusion when the Web Locks API is unavailable.
    const run = fallbackQueue.then(work, work);
    fallbackQueue = run.then(() => undefined, () => undefined);
    return run;
  };
}

export class WinStreakProfileStore {
  private snapshot: WinStreakProfile;
  private storageAvailable: boolean;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: StorageLike | null = defaultStorage(),
    private readonly runExclusive: ExclusiveRunner = createDefaultExclusiveRunner(),
  ) {
    this.storageAvailable = storage !== null;
    this.snapshot = this.readStorage();
  }

  private readStorage(): WinStreakProfile {
    if (!this.storage || !this.storageAvailable) {
      return this.snapshot ?? createEmptyWinStreakProfile();
    }
    try {
      return parseWinStreakProfile(this.storage.getItem(WIN_STREAK_STORAGE_KEY));
    } catch {
      this.storageAvailable = false;
      return this.snapshot ?? createEmptyWinStreakProfile();
    }
  }

  private publish(profile: WinStreakProfile): void {
    this.snapshot = profile;
    for (const listener of this.listeners) listener();
  }

  getSnapshot = (): WinStreakProfile => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  acceptExternalValue(raw: string | null): void {
    this.publish(parseWinStreakProfile(raw));
  }

  async inspect<T>(reader: (profile: WinStreakProfile) => T): Promise<T> {
    return this.runExclusive(() => {
      const latest = this.readStorage();
      this.snapshot = latest;
      return reader(cloneProfile(latest));
    });
  }

  async mutate<T>(mutator: (profile: WinStreakProfile) => T): Promise<T> {
    return this.runExclusive(() => {
      const latest = this.readStorage();
      const next = cloneProfile(latest);
      const result = mutator(next);
      const before = JSON.stringify(latest);
      const afterWithoutRevision = JSON.stringify(next);
      if (before !== afterWithoutRevision) {
        next.revision = latest.revision + 1;
        if (this.storage && this.storageAvailable) {
          try {
            this.storage.setItem(WIN_STREAK_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Continue from the in-memory record after storage becomes unavailable.
            this.storageAvailable = false;
          }
        }
        this.publish(next);
      } else {
        this.snapshot = latest;
      }
      return result;
    });
  }
}

let singleton: WinStreakProfileStore | null = null;

export function getWinStreakProfileStore(): WinStreakProfileStore {
  if (!singleton) {
    singleton = new WinStreakProfileStore();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === WIN_STREAK_STORAGE_KEY) {
          singleton?.acceptExternalValue(event.newValue);
        }
      });
    }
  }
  return singleton;
}
