import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_MANIFEST } from '../../audio/music/musicManifest';
import { deferredPlay, musicHarness } from './musicHarness';
import {
  ACCOUNT_ID, TOKEN, cleanup as cleanupAccounts, entry, envelope, harness as accountHarness, json,
} from '../account/fixtures';

const harnesses: ReturnType<typeof musicHarness>[] = [];
function setup(options: Parameters<typeof musicHarness>[0] = {}) {
  const h = musicHarness(options);
  harnesses.push(h);
  h.controller.reportScene('menu');
  h.controller.reportEntry(true);
  h.flushReports();
  return h;
}
function realSources(h: ReturnType<typeof musicHarness>) {
  return h.audio.sources.filter((source) => !source.startsWith('data:'));
}
async function unlock(h: ReturnType<typeof musicHarness>) {
  h.document.activate('keydown');
  await h.settle();
  h.flushReports();
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  harnesses.splice(0).forEach((h) => h.dispose());
  cleanupAccounts();
});

describe('silent first Entry and automatic Welcome music', () => {
  it('plays the supplied silent clip once inside the gesture, never a music track on Entry', async () => {
    const h = setup();
    expect(h.audio.sources).toEqual([]);
    let insideEvent = false;
    h.audio.play.mockImplementation(() => {
      expect(insideEvent).toBe(true);
      expect(h.audio.src.startsWith('data:audio/wav;base64,')).toBe(true);
      h.audio.paused = false;
      return Promise.resolve();
    });
    insideEvent = true;
    h.document.activate('pointerup', 'touch');
    insideEvent = false;
    expect(h.audio.play).toHaveBeenCalledOnce();
    await h.settle();
    h.flushReports();
    expect(h.audio.paused).toBe(true);
    expect(h.audio.src.startsWith('data:audio/wav;base64,')).toBe(true);
    expect(h.audio.load).not.toHaveBeenCalled();
    expect(h.audio.volume).toBe(1);
    expect(h.browser.navigator.mediaSession.metadata).toBeNull();
    for (const event of ['touchend', 'keydown', 'pointerdown', 'pointerup', 'keydown']) {
      h.document.activate(event);
      h.flushReports();
    }
    await h.advance(5000);
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.sources).toHaveLength(1);
    expect(realSources(h)).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('records Entry activation while off without loading even the silent clip', async () => {
    const h = setup({ enabled: false });
    await unlock(h);
    h.document.activate('pointerup', 'touch');
    h.document.activate('touchend', 'touch');
    expect(h.audio.play).not.toHaveBeenCalled();
    expect(h.audio.sources).toEqual([]);
    h.controller.reportEntry(false);
    h.flushReports();
    expect(h.audio.sources).toEqual([]);
    h.preferences.setPreference('musicEnabled', true);
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
  });

  it.each(['menu', 'game'] as const)('leaving Entry for %s starts menu from the top without another activation', async (scene) => {
    const h = setup();
    await unlock(h);
    h.audio.currentTime = 0.0125;
    h.controller.reportScene(scene, scene === 'game' ? 'invite' : null);
    h.controller.reportEntry(false);
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
    expect(h.audio.currentTime).toBe(0);
    expect(h.audio.volume).toBe(0);
    expect(h.audio.loop).toBe(true);
    await h.settle();
    await h.advance(500);
    expect(h.audio.volume).toBe(1);
  });

  it('waits for an in-flight unlock before starting Welcome and ignores duplicate tap events', async () => {
    const h = setup();
    const pending = deferredPlay();
    h.audio.play.mockReturnValueOnce(pending.promise);
    h.document.activate('pointerup', 'touch');
    h.controller.reportEntry(false);
    h.flushReports();
    h.document.activate('touchend', 'touch');
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(realSources(h)).toEqual([]);
    pending.resolve();
    await h.settle();
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    expect(realSources(h)).toEqual([MUSIC_MANIFEST.menu.src]);
  });

  it('ignores a refused unlock without retrying it or blocking the automatic music attempt', async () => {
    const h = setup();
    h.audio.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    await unlock(h);
    h.document.activate('keydown');
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.src.startsWith('data:audio/wav;base64,')).toBe(true);
    h.controller.reportEntry(false);
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
  });

  it('silently handles a synchronously thrown unlock error', async () => {
    const h = setup();
    h.audio.play.mockImplementationOnce(() => { throw new Error('unsupported'); });
    expect(() => h.document.activate('keydown')).not.toThrow();
    expect(h.audio.paused).toBe(true);
    expect(realSources(h)).toEqual([]);
    h.controller.reportEntry(false);
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
  });

  it('re-arms after refused automatic music; the first Welcome interaction starts it', async () => {
    const h = setup();
    await unlock(h);
    h.audio.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    h.controller.reportEntry(false);
    h.flushReports();
    await h.settle();
    h.controller.reportScene('menu');
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    h.document.activate('pointerup', 'touch');
    expect(h.audio.play).toHaveBeenCalledTimes(3);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
    h.document.activate('touchend', 'touch');
    expect(h.audio.play).toHaveBeenCalledTimes(3);
  });

  it('leaving Entry with Music off loads no real track, including after a pending unlock resolves', async () => {
    const h = setup();
    const pending = deferredPlay();
    h.audio.play.mockReturnValueOnce(pending.promise);
    h.document.activate('keydown');
    h.preferences.setPreference('musicEnabled', false);
    h.controller.reportEntry(false);
    h.flushReports();
    pending.resolve();
    await h.settle();
    h.flushReports();
    expect(h.audio.src).toBe('');
    expect(realSources(h)).toEqual([]);
    expect(h.audio.play).toHaveBeenCalledOnce();
  });

  it('returning to Entry after a species track starts keeps that track and its position', async () => {
    const h = setup();
    await unlock(h);
    h.controller.reportEntry(false);
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.flushReports();
    await h.settle();
    await h.advance(500);
    h.audio.currentTime = 44;
    h.controller.reportScene('menu');
    h.controller.reportEntry(true);
    h.flushReports();
    await h.advance(5000);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.ancient.src);
    expect(h.audio.currentTime).toBe(44);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    expect(realSources(h)).toEqual([MUSIC_MANIFEST.ancient.src]);
  });

  it('remembered/menu entry without an Entry gesture still waits for its first interaction', () => {
    const h = setup();
    h.controller.reportEntry(false);
    h.flushReports();
    expect(h.audio.sources).toEqual([]);
    h.document.activate('keydown');
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
    expect(h.audio.play).toHaveBeenCalledOnce();
  });

  it.each([false, true])('coalesces initial Entry and scene reports in either order (Entry first=%s)', (entryFirst) => {
    const h = musicHarness();
    harnesses.push(h);
    if (entryFirst) { h.controller.reportEntry(true); h.controller.reportScene('menu'); }
    else { h.controller.reportScene('menu'); h.controller.reportEntry(true); }
    expect(h.microtasks).toHaveLength(1);
    h.document.activate('keydown');
    expect(realSources(h)).toEqual([]);
    expect(h.audio.src.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  it('ownership guards ignore stale Entry cleanup while current cleanup enables an invite game', async () => {
    const h = setup();
    const oldCleanup = h.controller.reportEntry(true);
    const currentCleanup = h.controller.reportEntry(true);
    oldCleanup();
    await unlock(h);
    expect(realSources(h)).toEqual([]);
    h.controller.reportScene('game', 'invite');
    currentCleanup();
    h.flushReports();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
  });

  it('a hidden unlock is cancelled; its late resolution cannot pause newer real playback', async () => {
    const h = setup();
    const pending = deferredPlay();
    h.audio.play.mockReturnValueOnce(pending.promise);
    h.document.activate('keydown');
    h.document.visibility('hidden');
    expect(h.audio.src).toBe('');
    expect(h.audio.paused).toBe(true);
    h.document.visibility('visible');
    h.controller.reportEntry(false);
    h.flushReports();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
    pending.resolve();
    await h.settle();
    expect(h.audio.paused).toBe(false);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('disposal clears the silent source and fences queued reports, listeners, and a pending unlock', async () => {
    const h = setup();
    const pending = deferredPlay();
    h.audio.play.mockReturnValueOnce(pending.promise);
    h.document.activate('keydown');
    h.controller.reportEntry(false);
    h.controller.dispose();
    h.flushReports();
    h.audio.paused = false;
    pending.resolve();
    await h.settle();
    h.document.activate('keydown');
    h.document.visibility('visible');
    h.preferences.setPreference('musicEnabled', false);
    h.preferences.setPreference('musicEnabled', true);
    await h.advance(5000);
    expect(h.audio.src).toBe('');
    expect(h.audio.paused).toBe(true);
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applies the real account Music-off snapshot before sign-in resolves and Welcome can start', async () => {
    const account = accountHarness();
    const h = setup({ preferences: account.preferences });
    await unlock(h);
    account.fetchMock.mockResolvedValueOnce(json(entry(TOKEN, ACCOUNT_ID, 'Pilot1', envelope('1', { musicEnabled: false }))));
    await account.signIn();
    expect(account.store.getSnapshot().status).toBe('signedIn');
    expect(h.preferences.getSnapshot().musicEnabled).toBe(false);
    h.controller.reportEntry(false);
    h.flushReports();
    await h.advance(1000);
    expect(realSources(h)).toEqual([]);
    expect(h.audio.play).toHaveBeenCalledOnce();
  });
});
