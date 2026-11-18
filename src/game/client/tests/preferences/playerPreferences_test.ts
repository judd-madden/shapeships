import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPlayerPreferencesStore,
  PLAYER_PREFERENCE_DEFAULTS as defaults,
  PLAYER_PREFERENCE_STORAGE_KEYS as keys,
  type PlayerPreferenceKey,
} from '../../preferences/playerPreferences';

const stores: ReturnType<typeof createPlayerPreferencesStore>[] = [];

function setup(values: Record<string, string> = {}) {
  const data = new Map(Object.entries(values));
  const storage: Storage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: (key) => { data.delete(key); },
    clear: () => { data.clear(); },
  };
  const eventTarget = new EventTarget();
  const store = createPlayerPreferencesStore({ storage, eventTarget });
  stores.push(store);
  function external(key: string | null, newValue: string | null, storageArea: Storage | null = storage) {
    eventTarget.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, storageArea }));
  }
  return { storage, eventTarget, store, external };
}

afterEach(() => {
  stores.splice(0).forEach((store) => store.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('player preferences', () => {
  it('reads defaults once without writes on read or subscribe', () => {
    const { store, storage } = setup();
    const first = store.getSnapshot();
    const unsubscribe = store.subscribe('soundEnabled', vi.fn());
    expect(first).toEqual(defaults);
    expect(store.getSnapshot()).toBe(first);
    unsubscribe();
    expect(storage.getItem).toHaveBeenCalledTimes(5);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('honors all saved values and ignores the old battle-log key', () => {
    const stored = Object.fromEntries(Object.entries(keys).map(([key, storageKey]) =>
      [storageKey, String(!defaults[key as PlayerPreferenceKey])]));
    const { store, storage } = setup(stored);
    for (const key of Object.keys(keys) as PlayerPreferenceKey[]) {
      expect(store.getSnapshot()[key]).toBe(!defaults[key]);
    }
    expect(storage.getItem).not.toHaveBeenCalledWith('shapeships.preferBattleLog.v1');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('falls back to each field default for invalid strings', () => {
    const { store } = setup(Object.fromEntries(Object.values(keys).map((key) => [key, 'TRUE'])));
    expect(store.getSnapshot()).toEqual(defaults);
  });

  it('writes and notifies only for changed deliberate setters and subscribed fields', () => {
    const { store, storage } = setup();
    const sound = vi.fn();
    const music = vi.fn();
    const unsubscribe = store.subscribe('soundEnabled', sound);
    store.subscribe('musicEnabled', music);
    store.setPreference('soundEnabled', true);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(sound).not.toHaveBeenCalled();
    store.setPreference('soundEnabled', false);
    const changed = store.getSnapshot();
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(keys.soundEnabled, 'false');
    expect(sound).toHaveBeenCalledOnce();
    expect(music).not.toHaveBeenCalled();
    store.setPreference('soundEnabled', false);
    expect(store.getSnapshot()).toBe(changed);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(sound).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.setPreference('soundEnabled', true);
    expect(sound).toHaveBeenCalledTimes(1);
  });

  it('keeps changes in memory when reads or writes throw', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('blocked read'); }),
      setItem: vi.fn(() => { throw new Error('blocked write'); }),
    } as unknown as Storage;
    const store = createPlayerPreferencesStore({ storage, eventTarget: new EventTarget() });
    stores.push(store);
    const listener = vi.fn();
    store.subscribe('healthFlashEnabled', listener);
    expect(store.getSnapshot()).toEqual(defaults);
    expect(() => store.setPreference('healthFlashEnabled', false)).not.toThrow();
    expect(store.getSnapshot().healthFlashEnabled).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
    store.setPreference('healthFlashEnabled', false);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('applies external fields, removal and clearing without writing or notifying unrelated fields', () => {
    const { store, storage, external } = setup();
    const sound = vi.fn();
    const music = vi.fn();
    store.subscribe('soundEnabled', sound);
    store.subscribe('musicEnabled', music);
    external(keys.soundEnabled, 'false');
    expect(store.getSnapshot().soundEnabled).toBe(false);
    expect(sound).toHaveBeenCalledOnce();
    expect(music).not.toHaveBeenCalled();
    external(keys.soundEnabled, 'false');
    expect(sound).toHaveBeenCalledTimes(1);
    external(keys.soundEnabled, null);
    expect(store.getSnapshot().soundEnabled).toBe(true);
    external(keys.musicEnabled, 'false');
    external(keys.battleLogPreferred, 'true');
    external(null, null);
    expect(store.getSnapshot()).toEqual(defaults);
    expect(music).toHaveBeenCalledTimes(2);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('ignores other storage areas, unknown keys and malformed events', () => {
    const { store, storage, eventTarget, external } = setup();
    const first = store.getSnapshot();
    external(keys.soundEnabled, 'false', null);
    external(keys.soundEnabled, 'false', { ...storage });
    external('shapeships.preferBattleLog.v1', 'true');
    external('unrelated', 'false');
    external(null, null, null);
    eventTarget.dispatchEvent(new Event('storage'));
    expect(store.getSnapshot()).toBe(first);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('removes the external listener and subscriptions on dispose', () => {
    const { store, external } = setup();
    const listener = vi.fn();
    store.subscribe('soundEnabled', listener);
    store.dispose();
    store.dispose();
    external(keys.soundEnabled, 'false');
    expect(store.getSnapshot().soundEnabled).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    store.setPreference('soundEnabled', false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('creates the default store safely without window', async () => {
    vi.resetModules();
    const module = await import('../../preferences/playerPreferences');
    expect(module.getPlayerPreference('soundEnabled')).toBe(true);
    module.setPreference('soundEnabled', false);
    expect(module.getPlayerPreference('soundEnabled')).toBe(false);
    module.getPlayerPreferencesStore().dispose();
  });

  it('guards a throwing browser localStorage accessor', async () => {
    vi.resetModules();
    const browser = new EventTarget();
    Object.defineProperty(browser, 'localStorage', { get() { throw new Error('blocked access'); } });
    vi.stubGlobal('window', browser);
    const module = await import('../../preferences/playerPreferences');
    expect(module.getPlayerPreference('musicEnabled')).toBe(true);
    module.setPreference('musicEnabled', false);
    expect(module.getPlayerPreference('musicEnabled')).toBe(false);
    module.getPlayerPreferencesStore().dispose();
  });
});
