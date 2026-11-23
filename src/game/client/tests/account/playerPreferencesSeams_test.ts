import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerPreferencesStore, PLAYER_PREFERENCE_STORAGE_KEYS as keys } from '../../preferences/playerPreferences';
import { cleanup, envelope, harness, memoryStorage } from './fixtures';

afterEach(cleanup);

describe('player preference account seams', () => {
  it('isolates a throwing deliberate listener and still completes a guest toggle', () => {
    const h = harness();
    const notified = vi.fn(), nextListener = vi.fn();
    h.preferences.subscribe('soundEnabled', notified);
    h.preferences.subscribeDeliberateChanges(() => { throw new Error('listener failed'); });
    h.preferences.subscribeDeliberateChanges(nextListener);
    expect(() => h.preferences.setPreference('soundEnabled', false)).not.toThrow();
    expect(h.preferences.getSnapshot().soundEnabled).toBe(false);
    expect(h.storage!.getItem(keys.soundEnabled)).toBe('false');
    expect(notified).toHaveBeenCalledOnce();
    expect(nextListener).toHaveBeenCalledExactlyOnceWith({ soundEnabled: false });
    expect(h.fetchMock).not.toHaveBeenCalled();
  });

  it('persists all five external values, notifies only changed fields and emits no deliberate change', () => {
    const h = harness();
    const sound = vi.fn(), music = vi.fn(), deliberate = vi.fn();
    h.preferences.subscribe('soundEnabled', sound);
    h.preferences.subscribe('musicEnabled', music);
    h.preferences.subscribeDeliberateChanges(deliberate);
    const values = envelope('1', { soundEnabled: false, chatMinimized: true }).values;
    h.preferences.applyExternalSnapshot(values);
    expect(h.preferences.getSnapshot()).toEqual(values);
    expect(h.storage?.setItem).toHaveBeenCalledTimes(5);
    expect(sound).toHaveBeenCalledOnce();
    expect(music).not.toHaveBeenCalled();
    expect(deliberate).not.toHaveBeenCalled();
    const reloaded = createPlayerPreferencesStore({ storage: h.storage, eventTarget: null });
    expect(reloaded.getSnapshot()).toEqual(values);
    reloaded.dispose();
  });

  it('only changed local setters emit deliberate patches; storage removal and clearing do not', () => {
    const h = harness();
    const deliberate = vi.fn();
    const unsubscribe = h.preferences.subscribeDeliberateChanges(deliberate);
    h.preferences.setPreference('soundEnabled', true);
    h.preferences.setPreference('soundEnabled', false);
    h.preferences.setPreference('soundEnabled', false);
    h.external(keys.musicEnabled, 'false');
    h.external(keys.musicEnabled, null);
    h.external(null, null);
    expect(deliberate).toHaveBeenCalledExactlyOnceWith({ soundEnabled: false });
    unsubscribe();
    h.preferences.setPreference('soundEnabled', false);
    expect(deliberate).toHaveBeenCalledOnce();
  });

  it('external hydration and deliberate changes survive unavailable persistence', () => {
    const { storage } = memoryStorage();
    vi.mocked(storage.setItem).mockImplementation(() => { throw new Error('blocked'); });
    const h = harness({ storage });
    const deliberate = vi.fn();
    h.preferences.subscribeDeliberateChanges(deliberate);
    h.preferences.applyExternalSnapshot(envelope('1', { soundEnabled: false }).values);
    expect(h.preferences.getSnapshot().soundEnabled).toBe(false);
    expect(deliberate).not.toHaveBeenCalled();
    h.preferences.setPreference('musicEnabled', false);
    expect(deliberate).toHaveBeenCalledExactlyOnceWith({ musicEnabled: false });
  });

  it('dispose clears deliberate subscriptions', () => {
    const h = harness();
    const listener = vi.fn();
    h.preferences.subscribeDeliberateChanges(listener);
    h.preferences.dispose();
    h.preferences.setPreference('soundEnabled', false);
    expect(listener).not.toHaveBeenCalled();
  });
});
