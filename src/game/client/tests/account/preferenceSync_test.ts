import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_TOKEN_STORAGE_KEY as tokenKey } from '../../account/accountStore';
import { PLAYER_PREFERENCE_STORAGE_KEYS as keys } from '../../preferences/playerPreferences';
import {
  OTHER_ACCOUNT_ID, OTHER_TOKEN, TOKEN, cleanup, deferred, entry, envelope, error,
  harness, json, putBodies, resumed,
} from './fixtures';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(cleanup);

describe('account preference synchronization', () => {
  it('hydrates and persists all five account values without a save-back', async () => {
    const h = harness();
    const values = { soundEnabled: false, healthFlashEnabled: false, chatMinimized: true, battleLogPreferred: true, musicEnabled: false };
    h.fetchMock.mockResolvedValueOnce(json(entry(TOKEN, undefined, undefined, envelope('4', values))));
    await h.signIn();
    expect(h.preferences.getSnapshot()).toEqual(values);
    for (const [key, storageKey] of Object.entries(keys)) {
      expect(h.storage?.getItem(storageKey)).toBe(String(values[key as keyof typeof values]));
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.fetchMock).toHaveBeenCalledOnce();
    expect(putBodies(h.fetchMock)).toEqual([]);
  });

  it('coalesces two deliberate changes for 300 ms into one partial PUT', async () => {
    const h = harness();
    await h.signIn();
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(150);
    h.preferences.setPreference('musicEnabled', false);
    await vi.advanceTimersByTimeAsync(299);
    expect(putBodies(h.fetchMock)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(putBodies(h.fetchMock)).toEqual([{ patch: { soundEnabled: false, musicEnabled: false }, expectedRevision: '1' }]);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', preferences: { revision: '2' }, preferenceSync: { saving: false, unsaved: false } });
  });

  it('rebases a conflict over latest unrelated fields and retries once', async () => {
    const h = harness();
    await h.signIn();
    const latest = envelope('9007199254740993', { musicEnabled: false });
    h.fetchMock.mockResolvedValueOnce(error('PREFERENCE_CONFLICT', 409, {}, latest))
      .mockResolvedValueOnce(json({ ok: true, preferences: envelope('9007199254740994', { musicEnabled: false, soundEnabled: false }) }));
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)).toEqual([
      { patch: { soundEnabled: false }, expectedRevision: '1' },
      { patch: { soundEnabled: false }, expectedRevision: '9007199254740993' },
    ]);
    expect(h.preferences.getSnapshot()).toMatchObject({ soundEnabled: false, musicEnabled: false });
    expect(h.store.getSnapshot().preferenceSync).toEqual({ saving: false, unsaved: false });
  });

  it('a second conflict preserves the local action and becomes unsaved without polling', async () => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error('PREFERENCE_CONFLICT', 409, {}, envelope('2', { musicEnabled: false })))
      .mockResolvedValueOnce(error('PREFERENCE_CONFLICT', 409, {}, envelope('3', { chatMinimized: true })));
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)).toHaveLength(2);
    expect(h.preferences.getSnapshot()).toMatchObject({ soundEnabled: false, chatMinimized: true });
    expect(h.store.getSnapshot().preferenceSync).toEqual({ saving: false, unsaved: true });
    await vi.advanceTimersByTimeAsync(60000);
    expect(putBodies(h.fetchMock)).toHaveLength(2);
    h.store.retryUnsavedPreferences();
    await vi.advanceTimersByTimeAsync(0);
    expect(putBodies(h.fetchMock)[2]).toEqual({ patch: { soundEnabled: false }, expectedRevision: '3' });
    expect(h.store.getSnapshot().preferenceSync.unsaved).toBe(false);
  });

  it('a later deliberate edit retries unsaved keys along with its new patch', async () => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    expect(h.store.getSnapshot().preferenceSync.unsaved).toBe(true);
    expect(h.store.getSnapshot().lastError?.code).toBe('ACCOUNT_SERVICE_UNAVAILABLE');
    h.preferences.setPreference('chatMinimized', true);
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)[1]).toEqual({ patch: { soundEnabled: false, chatMinimized: true }, expectedRevision: '1' });
    expect(h.store.getSnapshot().preferenceSync.unsaved).toBe(false);
  });

  it.each(['offline', 'AUTH_BUSY', 'RATE_LIMITED', 'ACCOUNTS_NOT_ENABLED', 'INVALID_REQUEST'])('does not automatically retry a first %s failure', async (code) => {
    const h = harness();
    await h.signIn();
    if (code === 'offline') h.fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    else h.fetchMock.mockResolvedValueOnce(error(code, 503));
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(60000);
    expect(putBodies(h.fetchMock)).toHaveLength(1);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedIn', preferenceSync: { saving: false, unsaved: true } });
  });

  it('honors Retry-After when explicitly retrying unsaved preferences', async () => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error('RATE_LIMITED', 429, { retryAfterSeconds: 5 }));
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    h.store.retryUnsavedPreferences();
    await vi.advanceTimersByTimeAsync(4999);
    expect(putBodies(h.fetchMock)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(putBodies(h.fetchMock)).toHaveLength(2);
  });

  it('keeps a newer same-key edit visible while the earlier PUT completes', async () => {
    const h = harness();
    await h.signIn();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    expect(h.store.getSnapshot().preferenceSync.saving).toBe(true);
    h.preferences.setPreference('soundEnabled', true);
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)).toHaveLength(1);
    response.resolve(json({ ok: true, preferences: envelope('2', { soundEnabled: false }) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.preferences.getSnapshot().soundEnabled).toBe(true);
    expect(putBodies(h.fetchMock)[1]).toEqual({ patch: { soundEnabled: true }, expectedRevision: '2' });
  });

  it('retains newer edits that toggle back to the value submitted by an in-flight PUT', async () => {
    const h = harness();
    await h.signIn();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    h.preferences.setPreference('soundEnabled', true);
    h.preferences.setPreference('soundEnabled', false);
    response.resolve(json({ ok: true, preferences: envelope('2', { soundEnabled: false }) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(putBodies(h.fetchMock)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)[1]).toEqual({ patch: { soundEnabled: false }, expectedRevision: '2' });
  });

  it('a deliberate change during a failed in-flight request schedules the next attempt', async () => {
    const h = harness();
    await h.signIn();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    h.preferences.setPreference('musicEnabled', false);
    response.resolve(new Response('gateway', { status: 504 }));
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)[1]).toEqual({ patch: { soundEnabled: false, musicEnabled: false }, expectedRevision: '1' });
  });

  it('storage events are not deliberate and never cause a PUT', async () => {
    const h = harness();
    await h.signIn();
    h.external(keys.soundEnabled, 'false');
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.preferences.getSnapshot().soundEnabled).toBe(false);
    expect(putBodies(h.fetchMock)).toHaveLength(0);
  });

  it('pending keys survive same-token resume hydration and use its latest revision', async () => {
    const h = harness();
    await h.signIn();
    h.preferences.setPreference('soundEnabled', false);
    h.fetchMock.mockResolvedValueOnce(json(resumed(false, envelope('3', { musicEnabled: false }))));
    await h.store.resume();
    expect(h.preferences.getSnapshot()).toMatchObject({ soundEnabled: false, musicEnabled: false });
    expect(putBodies(h.fetchMock)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)[0]).toEqual({ patch: { soundEnabled: false }, expectedRevision: '3' });
  });

  it('pending keys survive same-account sign-in hydration with a fresh token', async () => {
    const h = harness();
    await h.signIn();
    h.preferences.setPreference('soundEnabled', false);
    h.fetchMock.mockResolvedValueOnce(json(entry(OTHER_TOKEN, undefined, undefined, envelope('5', { musicEnabled: false }))));
    await h.signIn();
    expect(h.preferences.getSnapshot()).toMatchObject({ soundEnabled: false, musicEnabled: false });
    await vi.advanceTimersByTimeAsync(300);
    expect(putBodies(h.fetchMock)[0]).toEqual({ patch: { soundEnabled: false }, expectedRevision: '5' });
    expect(new Headers(h.fetchMock.mock.calls.at(-1)?.[1]?.headers).get('X-Account-Token')).toBe(OTHER_TOKEN);
  });

  it('does not regress a newer server revision when an earlier PUT response arrives late', async () => {
    const h = harness();
    await h.signIn();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    h.fetchMock.mockResolvedValueOnce(json(resumed(false, envelope('5', { musicEnabled: false }))));
    await h.store.resume();
    response.resolve(json({ ok: true, preferences: envelope('2', { soundEnabled: false }) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.store.getSnapshot()).toMatchObject({ preferences: { revision: '5' } });
    expect(h.preferences.getSnapshot().musicEnabled).toBe(false);
  });

  it.each(['logout', 'cross-tab', 'different-account'] as const)('%s cancels queued saves', async (action) => {
    const h = harness();
    await h.signIn();
    h.preferences.setPreference('soundEnabled', false);
    if (action === 'logout') await h.store.logout();
    else if (action === 'cross-tab') h.external(tokenKey, null);
    else {
      h.fetchMock.mockResolvedValueOnce(json(entry(OTHER_TOKEN, OTHER_ACCOUNT_ID, 'Pilot2', envelope('7'))));
      await h.signIn();
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(putBodies(h.fetchMock)).toHaveLength(0);
  });

  it('ignores an in-flight save after logout without restoring values or authority', async () => {
    const h = harness();
    await h.signIn();
    const response = deferred<Response>();
    h.fetchMock.mockReturnValueOnce(response.promise);
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    await h.store.logout();
    response.resolve(json({ ok: true, preferences: envelope('2', { musicEnabled: false }) }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.preferences.getSnapshot()).toMatchObject({ soundEnabled: false, musicEnabled: true });
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', preferenceSync: { saving: false, unsaved: false } });
    expect(h.storage?.getItem(tokenKey)).toBeNull();
  });

  it.each(['ACCOUNT_TOKEN_INVALID', 'ACCOUNT_TOKEN_EXPIRED', 'ACCOUNT_TOKEN_REVOKED', 'ACCOUNT_BLOCKED', 'NAME_BANNED'])('owner clarification: %s clears authority immediately', async (code) => {
    const h = harness();
    await h.signIn();
    h.fetchMock.mockResolvedValueOnce(error(code, 403));
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    expect(h.store.getSnapshot()).toMatchObject({ status: 'signedOut', reason: code, lastError: { code } });
    expect(h.storage?.getItem(tokenKey)).toBeNull();
    expect(h.preferences.getSnapshot().soundEnabled).toBe(false);
    h.preferences.setPreference('musicEnabled', false);
    h.store.retryUnsavedPreferences();
    await vi.advanceTimersByTimeAsync(1000);
    expect(putBodies(h.fetchMock)).toHaveLength(1);
  });

  it('signed-out preference setters and retry produce zero fetches', async () => {
    const h = harness();
    h.preferences.setPreference('soundEnabled', false);
    h.preferences.setPreference('musicEnabled', false);
    h.store.retryUnsavedPreferences();
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.fetchMock).not.toHaveBeenCalled();
    expect(h.preferences.getSnapshot()).toMatchObject({ soundEnabled: false, musicEnabled: false });
    expect(h.storage?.getItem(keys.soundEnabled)).toBe('false');
  });

  it('a subscriber logging out when saving begins prevents the PUT from starting', async () => {
    const h = harness();
    await h.signIn();
    h.store.subscribe(() => {
      if (h.store.getSnapshot().preferenceSync.saving) void h.store.logout();
    });
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    expect(h.store.getSnapshot().status).toBe('signedOut');
    expect(putBodies(h.fetchMock)).toHaveLength(0);
  });

  it('a subscriber logging out on an accepted envelope prevents stale hydration writes', async () => {
    const h = harness();
    await h.signIn();
    h.store.subscribe(() => {
      const snapshot = h.store.getSnapshot();
      if (snapshot.status === 'signedIn' && snapshot.preferences.revision === '2') void h.store.logout();
    });
    h.fetchMock.mockResolvedValueOnce(json({ ok: true, preferences: envelope('2', { soundEnabled: false, musicEnabled: false }) }));
    h.preferences.setPreference('soundEnabled', false);
    await vi.advanceTimersByTimeAsync(300);
    expect(h.store.getSnapshot().status).toBe('signedOut');
    expect(h.preferences.getSnapshot()).toMatchObject({ soundEnabled: false, musicEnabled: true });
    expect(h.storage?.getItem(keys.musicEnabled)).toBe('true');
  });
});
