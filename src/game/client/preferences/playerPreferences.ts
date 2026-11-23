export interface PlayerPreferences {
  soundEnabled: boolean;
  healthFlashEnabled: boolean;
  chatMinimized: boolean;
  battleLogPreferred: boolean;
  musicEnabled: boolean;
}

export type PlayerPreferenceKey = keyof PlayerPreferences;

export const PLAYER_PREFERENCE_DEFAULTS: Readonly<PlayerPreferences> = Object.freeze({
  soundEnabled: true,
  healthFlashEnabled: true,
  chatMinimized: false,
  battleLogPreferred: false,
  musicEnabled: true,
});

export const PLAYER_PREFERENCE_STORAGE_KEYS: Readonly<Record<PlayerPreferenceKey, string>> = Object.freeze({
  soundEnabled: 'shapeships.soundEnabled.v1',
  healthFlashEnabled: 'shapeships.boardFlashEnabled.v1',
  chatMinimized: 'shapeships.chatMinimized.v1',
  battleLogPreferred: 'shapeships.preferBattleLog.v2',
  musicEnabled: 'shapeships.musicEnabled.v1',
});

const preferenceKeys = Object.keys(PLAYER_PREFERENCE_DEFAULTS) as PlayerPreferenceKey[];

function parsePreference(key: PlayerPreferenceKey, raw: string | null): boolean {
  return raw === 'true' ? true : raw === 'false' ? false : PLAYER_PREFERENCE_DEFAULTS[key];
}

export function createPlayerPreferencesStore({ storage, eventTarget }: {
  storage: Storage | null;
  eventTarget: EventTarget | null;
}) {
  const initial = { ...PLAYER_PREFERENCE_DEFAULTS };
  for (const key of preferenceKeys) {
    try {
      initial[key] = parsePreference(key, storage?.getItem(PLAYER_PREFERENCE_STORAGE_KEYS[key]) ?? null);
    } catch {
      // Unavailable storage must not prevent first render or later in-memory changes.
    }
  }
  let snapshot: Readonly<PlayerPreferences> = Object.freeze(initial);
  const listeners = new Map<PlayerPreferenceKey, Set<() => void>>();
  const deliberateListeners = new Set<(patch: Partial<PlayerPreferences>) => void>();

  // Applying external values is separate from the deliberate persistence path.
  function applySnapshot(patch: Partial<PlayerPreferences>): void {
    const changedKeys = preferenceKeys.filter((key) =>
      patch[key] !== undefined && patch[key] !== snapshot[key]);
    if (changedKeys.length === 0) return;
    snapshot = Object.freeze({ ...snapshot, ...patch });
    for (const key of changedKeys) {
      listeners.get(key)?.forEach((listener) => listener());
    }
  }

  function onStorage(event: Event): void {
    const { key: storageKey, newValue, storageArea } = event as Event & {
      key?: string | null;
      newValue?: string | null;
      storageArea?: Storage | null;
    };
    if (!storage || storageArea !== storage) return;
    if (storageKey === null) {
      applySnapshot(PLAYER_PREFERENCE_DEFAULTS);
      return;
    }
    const key = preferenceKeys.find((candidate) => PLAYER_PREFERENCE_STORAGE_KEYS[candidate] === storageKey);
    if (key && (newValue === null || typeof newValue === 'string')) {
      applySnapshot({ [key]: parsePreference(key, newValue) });
    }
  }

  eventTarget?.addEventListener('storage', onStorage);

  return {
    getSnapshot: (): Readonly<PlayerPreferences> => snapshot,
    applyExternalSnapshot(values: Readonly<PlayerPreferences>): void {
      for (const key of preferenceKeys) {
        try {
          storage?.setItem(PLAYER_PREFERENCE_STORAGE_KEYS[key], String(values[key]));
        } catch {
          // Hydration still applies in memory when persistence is unavailable.
        }
      }
      applySnapshot(values);
    },
    subscribeDeliberateChanges(listener: (patch: Partial<PlayerPreferences>) => void): () => void {
      deliberateListeners.add(listener);
      return () => { deliberateListeners.delete(listener); };
    },
    subscribe(key: PlayerPreferenceKey, listener: () => void): () => void {
      let fieldListeners = listeners.get(key);
      if (!fieldListeners) {
        fieldListeners = new Set();
        listeners.set(key, fieldListeners);
      }
      fieldListeners.add(listener);
      return () => { fieldListeners.delete(listener); };
    },
    setPreference(key: PlayerPreferenceKey, value: boolean): void {
      if (snapshot[key] === value) return;
      try {
        storage?.setItem(PLAYER_PREFERENCE_STORAGE_KEYS[key], String(value));
      } catch {
        // The user action still takes effect when persistence is unavailable.
      }
      applySnapshot({ [key]: value });
      deliberateListeners.forEach((listener) => {
        try { listener({ [key]: value }); } catch { /* Account listeners cannot break a local toggle. */ }
      });
    },
    dispose(): void {
      eventTarget?.removeEventListener('storage', onStorage);
      listeners.clear();
      deliberateListeners.clear();
    },
  };
}

let defaultStore: ReturnType<typeof createPlayerPreferencesStore> | undefined;

export function getPlayerPreferencesStore(): ReturnType<typeof createPlayerPreferencesStore> {
  if (!defaultStore) {
    let storage: Storage | null = null;
    const eventTarget = typeof window === 'undefined' ? null : window;
    try {
      storage = eventTarget?.localStorage ?? null;
    } catch {
      // Some browser privacy modes throw while accessing localStorage itself.
    }
    defaultStore = createPlayerPreferencesStore({ storage, eventTarget });
  }
  return defaultStore;
}

export function getPlayerPreference(key: PlayerPreferenceKey): boolean {
  return getPlayerPreferencesStore().getSnapshot()[key];
}

export function setPreference(key: PlayerPreferenceKey, value: boolean): void {
  getPlayerPreferencesStore().setPreference(key, value);
}
