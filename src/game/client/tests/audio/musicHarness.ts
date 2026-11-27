import { vi } from 'vitest';
import { createMusicController, type MusicAudio } from '../../audio/music/musicController';
import { createPlayerPreferencesStore, PLAYER_PREFERENCE_STORAGE_KEYS } from '../../preferences/playerPreferences';

export class FakeMusicAudio extends EventTarget implements MusicAudio {
  sources: string[] = [];
  private source = '';
  private level = 1;
  preload = '';
  loop = false;
  currentTime = 0;
  paused = true;
  writableVolume = true;
  constructor(writableVolume: boolean) {
    super();
    this.writableVolume = writableVolume;
  }
  get src() { return this.source; }
  set src(value: string) { this.source = value; this.sources.push(value); }
  get volume() { return this.level; }
  set volume(value: number) { if (this.writableVolume) this.level = value; }
  play = vi.fn((): Promise<void> => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  removeAttribute = vi.fn((name: string) => { if (name === 'src') this.source = ''; });
  end() { this.paused = true; this.dispatchEvent(new Event('ended')); }
}

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  visibility(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
  activate(type = 'pointerdown', pointerType = 'mouse') {
    this.dispatchEvent(Object.assign(new Event(type), { pointerType }));
  }
}

export function deferredPlay() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export function musicHarness({ enabled = true, writableVolume = true } = {}) {
  const data = new Map([[PLAYER_PREFERENCE_STORAGE_KEYS.musicEnabled, String(enabled)]]);
  const storage: Storage = {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
  };
  const preferences = createPlayerPreferencesStore({ storage, eventTarget: null });
  const audio = new FakeMusicAudio(writableVolume);
  const document = new FakeDocument();
  // Explicit queue lets reporting tests distinguish microtasks from fade timers.
  const microtasks: Array<() => void> = [];
  const navigator = { audioSession: { type: 'auto' }, mediaSession: { metadata: null as MediaMetadata | null } };
  const MediaMetadata = vi.fn(function (this: MediaMetadataInit, init: MediaMetadataInit) {
    Object.assign(this, init);
  }) as unknown as new (init: MediaMetadataInit) => MediaMetadata;
  const browser = {
    setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay) as unknown as number,
    clearTimeout: (id: number) => globalThis.clearTimeout(id),
    queueMicrotask: (callback: () => void) => { microtasks.push(callback); },
    navigator, MediaMetadata,
  };
  const controller = createMusicController({ audio, document, window: browser, preferences });
  function flushReports() { microtasks.splice(0).forEach((callback) => callback()); }
  async function settle() { await Promise.resolve(); }
  async function advance(ms: number) { await vi.advanceTimersByTimeAsync(ms); }
  async function start() {
    controller.reportScene('menu');
    flushReports();
    document.activate();
    await settle();
    await advance(500);
  }
  return {
    audio, document, preferences, controller, browser, microtasks,
    flushReports, settle, advance, start,
    dispose() { controller.dispose(); preferences.dispose(); },
  };
}
