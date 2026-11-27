import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_MANIFEST } from '../../audio/music/musicManifest';
import { PLAYER_PREFERENCE_DEFAULTS } from '../../preferences/playerPreferences';
import { deferredPlay, musicHarness } from './musicHarness';

const harnesses: ReturnType<typeof musicHarness>[] = [];
function setup(options: Parameters<typeof musicHarness>[0] = {}) {
  const h = musicHarness(options);
  harnesses.push(h);
  return h;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  harnesses.splice(0).forEach((h) => h.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('music controller', () => {
  it('does not set a source or play before activation, even after preference hydration', async () => {
    const h = setup();
    h.controller.reportScene('menu');
    h.flushReports();
    h.preferences.applyExternalSnapshot({ ...PLAYER_PREFERENCE_DEFAULTS, musicEnabled: false });
    h.preferences.applyExternalSnapshot(PLAYER_PREFERENCE_DEFAULTS);
    await h.advance(10000);
    expect(h.audio.preload).toBe('none');
    expect(h.audio.sources).toEqual([]);
    expect(h.audio.play).not.toHaveBeenCalled();
  });

  it.each(['keydown', 'pointerdown', 'pointerup', 'touchend'])('plays synchronously on %s', (event) => {
    const h = setup();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.document.activate(event);
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.xenite.src);
  });

  it('ignores touch pointerdown, then starts at pointerup', () => {
    const h = setup();
    h.controller.reportScene('menu');
    h.document.activate('pointerdown', 'touch');
    expect(h.audio.play).not.toHaveBeenCalled();
    expect(h.audio.sources).toEqual([]);
    h.document.activate('pointerup', 'touch');
    expect(h.audio.play).toHaveBeenCalledOnce();
  });

  it.each(['menu', 'game'] as const)('records activation while off: first %s toggle click starts synchronously', (scene) => {
    const h = setup({ enabled: false });
    h.controller.reportScene(scene, scene === 'game' ? 'g' : null);
    if (scene === 'game') h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.document.activate('pointerup', 'touch');
    expect(h.audio.sources).toEqual([]);
    let insideHandler = false;
    h.audio.play.mockImplementation(() => {
      expect(insideHandler).toBe(true);
      h.audio.paused = false;
      return Promise.resolve();
    });
    insideHandler = true;
    h.preferences.setPreference('musicEnabled', true);
    expect(h.audio.play).toHaveBeenCalledOnce();
    insideHandler = false;
    expect(h.audio.src).toBe(MUSIC_MANIFEST[scene === 'menu' ? 'menu' : 'ancient'].src);
  });

  it('makes one attempt for pointerup plus touchend, including a pending play', async () => {
    const h = setup();
    const pending = deferredPlay();
    h.audio.play.mockReturnValueOnce(pending.promise);
    h.controller.reportScene('menu');
    h.document.activate('pointerup', 'touch');
    h.document.activate('touchend', 'touch');
    h.document.activate('keydown');
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.sources).toHaveLength(1);
    pending.resolve();
    await h.settle();
    h.document.activate('touchend', 'touch');
    expect(h.audio.play).toHaveBeenCalledOnce();
  });

  it('does not retry a refusal on the paired touchend; the next tap can retry', async () => {
    const h = setup();
    h.audio.play.mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'));
    h.controller.reportScene('menu');
    h.document.activate('pointerup', 'touch');
    await h.settle();
    h.document.activate('touchend', 'touch');
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.document.activate('pointerup', 'touch');
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('re-arms listeners when a later switch is refused', async () => {
    const h = setup();
    await h.start();
    h.audio.play.mockRejectedValueOnce(new Error('refused'));
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    await h.advance(1000);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    h.document.activate('keydown');
    expect(h.audio.play).toHaveBeenCalledTimes(3);
  });

  it('never restarts or fades an unchanged track through Human game entry and exit', async () => {
    const h = setup();
    await h.start();
    h.audio.currentTime = 42;
    h.controller.reportScene('game', 'g');
    const clear = h.controller.reportGame('g', { role: 'player', species: 'human' });
    h.flushReports();
    clear();
    h.controller.reportScene('menu');
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.sources).toHaveLength(1);
    expect(h.audio.currentTime).toBe(42);
    expect(h.audio.volume).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fades for 1000 ms, swaps on the same element, then fades in for 500 ms', async () => {
    const h = setup();
    await h.start();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    await h.advance(500);
    expect(h.audio.volume).toBeCloseTo(0.5);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
    await h.advance(500);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.xenite.src);
    expect(h.audio.currentTime).toBe(0);
    expect(h.audio.volume).toBe(0);
    await h.advance(500);
    expect(h.audio.volume).toBe(1);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    h.controller.reportScene('menu');
    h.flushReports();
    await h.advance(1500);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
    expect(h.audio.currentTime).toBe(0);
  });

  it('restores the audible track when keep-current cancels a mid-fade switch', async () => {
    const h = setup();
    await h.start();
    h.audio.currentTime = 25;
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    await h.advance(400);
    expect(h.audio.volume).toBeCloseTo(0.6);
    h.controller.reportGame('g', { role: 'player', species: null });
    h.flushReports();
    await h.advance(250);
    expect(h.audio.volume).toBeCloseTo(0.8);
    await h.advance(2000);
    expect(h.audio.volume).toBe(1);
    expect(h.audio.currentTime).toBe(25);
    expect(h.audio.sources).toEqual([MUSIC_MANIFEST.menu.src]);
    expect(h.audio.play).toHaveBeenCalledOnce();
  });

  it('restores volume when a newer target cancels a fade; only the newest source loads', async () => {
    const h = setup();
    await h.start();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    await h.advance(400);
    h.controller.reportGame('g', { role: 'player', species: 'centaur' });
    h.flushReports();
    await h.advance(500);
    expect(h.audio.volume).toBe(1);
    h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.flushReports();
    await h.advance(2500);
    expect(h.audio.sources).toEqual([MUSIC_MANIFEST.menu.src, MUSIC_MANIFEST.ancient.src]);
    expect(h.audio.volume).toBe(1);
  });

  it('restores a cancelled fade-in before switching to the newer target', async () => {
    const h = setup();
    h.controller.reportScene('menu');
    h.document.activate();
    await h.settle();
    await h.advance(200);
    expect(h.audio.volume).toBeCloseTo(0.4);
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.flushReports();
    await h.advance(500);
    expect(h.audio.volume).toBe(1);
    await h.advance(1500);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.ancient.src);
    expect(h.audio.volume).toBe(1);
  });

  it('a late play resolution cannot cancel a newer switch or its volume restoration', async () => {
    const h = setup();
    const pending = deferredPlay();
    h.audio.play.mockImplementationOnce(() => { h.audio.paused = false; return pending.promise; });
    h.controller.reportScene('menu');
    h.document.activate('pointerup', 'touch');
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    h.document.activate('touchend', 'touch');
    expect(h.audio.play).toHaveBeenCalledOnce();
    await h.advance(100);
    pending.resolve();
    await h.settle();
    await h.advance(1400);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.xenite.src);
    expect(h.audio.volume).toBe(1);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('off releases src after fading, assigns none while off, and on starts in the setter', async () => {
    const h = setup();
    await h.start();
    h.preferences.setPreference('musicEnabled', false);
    await h.advance(500);
    expect(h.audio.volume).toBeCloseTo(0.5);
    await h.advance(500);
    expect(h.audio.paused).toBe(true);
    expect(h.audio.src).toBe('');
    expect(h.audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(h.audio.load).toHaveBeenCalledOnce();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.flushReports();
    h.document.activate('keydown');
    await h.advance(5000);
    expect(h.audio.sources).toHaveLength(1);
    h.preferences.setPreference('musicEnabled', true);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.ancient.src);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('applies account-synced preferences through the same path and cancels an off fade on re-enable', async () => {
    const h = setup();
    await h.start();
    h.preferences.applyExternalSnapshot({ ...PLAYER_PREFERENCE_DEFAULTS, musicEnabled: false });
    await h.advance(400);
    h.preferences.applyExternalSnapshot(PLAYER_PREFERENCE_DEFAULTS);
    await h.advance(1000);
    expect(h.audio.volume).toBe(1);
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
  });

  it('pauses hidden audio and resumes the same source and position when visible', async () => {
    const h = setup();
    await h.start();
    h.audio.currentTime = 73;
    h.document.visibility('hidden');
    expect(h.audio.paused).toBe(true);
    await h.advance(5000);
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.document.visibility('visible');
    expect(h.audio.currentTime).toBe(73);
    expect(h.audio.sources).toHaveLength(1);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('defers hidden target changes and starts the latest one on visibility return', async () => {
    const h = setup();
    await h.start();
    h.document.visibility('hidden');
    h.audio.currentTime = 73;
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.flushReports();
    await h.advance(5000);
    expect(h.audio.sources).toHaveLength(1);
    h.document.visibility('visible');
    expect(h.audio.src).toBe(MUSIC_MANIFEST.ancient.src);
    expect(h.audio.currentTime).toBe(0);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('cancels a fade when hidden and never starts a track after off while hidden', async () => {
    const h = setup();
    await h.start();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    await h.advance(300);
    h.document.visibility('hidden');
    expect(h.audio.volume).toBe(1);
    h.preferences.setPreference('musicEnabled', false);
    await h.advance(5000);
    h.document.visibility('visible');
    expect(h.audio.src).toBe('');
    expect(h.audio.play).toHaveBeenCalledOnce();
  });

  it('hiding during the Music-off fade pauses and releases immediately', async () => {
    const h = setup();
    await h.start();
    h.preferences.setPreference('musicEnabled', false);
    await h.advance(250);
    h.document.visibility('hidden');
    expect(h.audio.paused).toBe(true);
    expect(h.audio.src).toBe('');
    expect(h.audio.volume).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses instant switches and instant off when volume is not writable', async () => {
    const h = setup({ writableVolume: false });
    await h.start();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.xenite.src);
    expect(h.audio.volume).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    h.preferences.setPreference('musicEnabled', false);
    expect(h.audio.src).toBe('');
  });

  it('retains a current pair member and alternates at ended without an out fade', async () => {
    const h = setup();
    await h.start();
    h.audio.currentTime = 47;
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'spectator', left: 'xenite', right: 'human' });
    h.flushReports();
    expect(h.audio.currentTime).toBe(47);
    expect(h.audio.loop).toBe(false);
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.audio.end();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.xenite.src);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
    await h.settle();
    await h.advance(500);
    h.audio.end();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
  });

  it('starts an unrelated pair left-first, and mirror mode loops without restarting', async () => {
    const h = setup();
    await h.start();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'spectator', left: 'centaur', right: 'ancient' });
    h.flushReports();
    await h.advance(1500);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.centaur.src);
    h.controller.reportGame('g', { role: 'spectator', left: 'centaur', right: 'centaur' });
    h.flushReports();
    expect(h.audio.loop).toBe(true);
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('sets ambient audio and track metadata, and leaves external pauses alone', async () => {
    const h = setup();
    expect(h.browser.navigator.audioSession.type).toBe('ambient');
    await h.start();
    expect(h.browser.navigator.mediaSession.metadata).toMatchObject({ title: 'Human Theme', artist: 'Shapeships' });
    h.audio.pause();
    h.controller.reportScene('menu');
    h.flushReports();
    h.document.activate('keydown');
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.document.visibility('hidden');
    h.document.visibility('visible');
    expect(h.audio.play).toHaveBeenCalledTimes(2);
  });

  it('survives absent optional session APIs and throwing media metadata', async () => {
    const h = setup();
    h.browser.MediaMetadata = class {
      constructor() { throw new Error('unsupported'); }
    } as unknown as typeof h.browser.MediaMetadata;
    await h.start();
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.browser.navigator.mediaSession = undefined as unknown as typeof h.browser.navigator.mediaSession;
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.flushReports();
    await h.advance(1500);
    expect(h.audio.volume).toBe(1);
  });

  it('disposes timers, reports, activation/ended/visibility listeners and the preference subscription', async () => {
    const h = setup();
    await h.start();
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.flushReports();
    await h.advance(250);
    h.controller.dispose();
    h.controller.dispose();
    h.document.activate();
    h.document.visibility('hidden');
    h.document.visibility('visible');
    h.audio.end();
    h.preferences.setPreference('musicEnabled', false);
    h.preferences.setPreference('musicEnabled', true);
    await h.advance(10000);
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses again if an in-flight play resolves after disposal', async () => {
    const h = setup();
    const pending = deferredPlay();
    h.audio.play.mockReturnValueOnce(pending.promise);
    h.controller.reportScene('menu');
    h.document.activate();
    h.controller.dispose();
    h.audio.paused = false;
    pending.resolve();
    await h.settle();
    expect(h.audio.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('music reporting API (no React rendering)', () => {
  it.each([false, true])('combines reports in either order (game first=%s)', async (gameFirst) => {
    const h = setup();
    const reportGame = () => h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    const reportScene = () => h.controller.reportScene('game', 'g');
    if (gameFirst) { reportGame(); reportScene(); }
    else { reportScene(); reportGame(); }
    expect(h.microtasks).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    h.flushReports();
    h.document.activate();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.ancient.src);
  });

  it('uses pending values synchronously from activation and preference setters', () => {
    const h = setup({ enabled: false });
    h.controller.reportScene('game', 'g');
    h.controller.reportGame('g', { role: 'player', species: 'xenite' });
    h.document.activate('keydown');
    h.controller.reportGame('g', { role: 'player', species: 'ancient' });
    h.preferences.setPreference('musicEnabled', true);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.ancient.src);
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.flushReports();
    expect(h.audio.play).toHaveBeenCalledOnce();
  });

  it('ignores stale game IDs and stale report cleanup, including the same game ID', async () => {
    const h = setup();
    await h.start();
    h.controller.reportGame('old', { role: 'player', species: 'xenite' });
    h.controller.reportScene('game', 'new');
    h.flushReports();
    expect(h.audio.sources).toHaveLength(1);
    const oldCleanup = h.controller.reportGame('new', { role: 'player', species: 'centaur' });
    h.controller.reportGame('new', { role: 'player', species: 'ancient' });
    oldCleanup();
    h.flushReports();
    await h.advance(1500);
    expect(h.audio.src).toBe(MUSIC_MANIFEST.ancient.src);
  });

  it('null game info keeps the last track; rematch selection stops previous alternation', async () => {
    const h = setup();
    await h.start();
    h.controller.reportScene('game', 'g');
    const clear = h.controller.reportGame('g', { role: 'spectator', left: 'human', right: 'ancient' });
    h.flushReports();
    expect(h.audio.loop).toBe(false);
    clear();
    h.controller.reportScene('game', 'rematch');
    h.controller.reportGame('rematch', null);
    h.flushReports();
    expect(h.audio.loop).toBe(true);
    expect(h.audio.play).toHaveBeenCalledOnce();
    h.controller.reportGame('rematch', { role: 'spectator', left: null, right: null });
    h.flushReports();
    expect(h.audio.loop).toBe(true);
  });

  it('game loading before any playback falls back to menu, and dev stops and releases it', async () => {
    const h = setup();
    h.controller.reportScene('game', 'g');
    h.document.activate();
    await h.settle();
    expect(h.audio.src).toBe(MUSIC_MANIFEST.menu.src);
    h.controller.reportScene('none');
    h.flushReports();
    expect(h.audio.paused).toBe(true);
    expect(h.audio.src).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('invalidates queued microtasks on disposal', () => {
    const h = setup();
    h.controller.reportScene('menu');
    h.controller.dispose();
    h.flushReports();
    h.document.activate();
    h.controller.reportScene('menu');
    expect(h.audio.sources).toEqual([]);
    expect(h.audio.play).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
