import { getPlayerPreferencesStore } from '../../preferences/playerPreferences';
import { MUSIC_MANIFEST, type MusicTrackId } from './musicManifest';
import { getMusicTrackRule, resolveMusicPlayback, type MusicGameInfo, type MusicPlayback, type MusicScene } from './musicTrackRule';

export interface MusicAudio extends EventTarget {
  src: string;
  preload: string;
  loop: boolean;
  volume: number;
  currentTime: number;
  readonly paused: boolean;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
}

interface MusicWindow {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(id: number): void;
  queueMicrotask(callback: () => void): void;
  navigator?: {
    audioSession?: { type: string };
    mediaSession?: { metadata: MediaMetadata | null };
  };
  MediaMetadata?: new (init: MediaMetadataInit) => MediaMetadata;
}

interface MusicControllerOptions {
  audio: MusicAudio;
  document: EventTarget & { readonly visibilityState: DocumentVisibilityState };
  window: MusicWindow;
  preferences: ReturnType<typeof getPlayerPreferencesStore>;
}

type FadeKind = 'out' | 'in' | 'restore' | 'off';
const ACTIVATION_EVENTS = ['keydown', 'pointerdown', 'pointerup', 'touchend'] as const;
const ACTIVATION_OPTIONS = { capture: true, passive: true };

export function createMusicController({ audio, document: doc, window: browser, preferences }: MusicControllerOptions) {
  let disposed = false;
  let scene: MusicScene = 'none';
  let sceneGameId: string | null = null;
  let gameReport: { gameId: string; info: MusicGameInfo | null; owner: symbol } | null = null;
  let reportQueued = false;
  let reportGeneration = 0;
  let activated = false;
  let needsActivation = false;
  let listening = false;
  let current: MusicTrackId | null = null;
  let lastPlayed: MusicTrackId | null = null;
  let playGeneration = 0;
  let pendingPlay: number | null = null;
  let fadeGeneration = 0;
  let fadeTimer: number | undefined;
  let fadeKind: FadeKind | null = null;
  let switchTarget: MusicTrackId | null = null;
  let lastTouchEvent: { type: string; time: number } | null = null;
  let mouseDownSeen = false;
  let writableVolume = false;

  audio.preload = 'none';
  try {
    audio.volume = 0.5;
    writableVolume = audio.volume === 0.5;
  } catch { /* Read-only element volume uses instant cuts. */ }
  setVolume(1);
  try {
    if (browser.navigator?.audioSession) browser.navigator.audioSession.type = 'ambient';
  } catch { /* Optional platform support must not affect playback. */ }

  function setVolume(value: number): void {
    try { audio.volume = value; } catch { /* Quiet on read-only platforms. */ }
  }

  function playback(): MusicPlayback | null {
    const info = gameReport?.gameId === sceneGameId ? gameReport.info : null;
    return resolveMusicPlayback(getMusicTrackRule(scene, info), lastPlayed);
  }

  function targetFor(policy: MusicPlayback): MusicTrackId {
    if (policy.kind === 'loop') return policy.track;
    return current === policy.left || current === policy.right ? current : policy.left;
  }

  function canPlay(): boolean {
    return !disposed && activated && !needsActivation && preferences.getSnapshot().musicEnabled &&
      doc.visibilityState !== 'hidden' && playback() !== null;
  }

  function cancelFade(): void {
    fadeGeneration++;
    if (fadeTimer !== undefined) browser.clearTimeout(fadeTimer);
    fadeTimer = undefined;
    fadeKind = null;
    switchTarget = null;
  }

  function fadeTo(volume: number, duration: number, kind: FadeKind, done: () => void): void {
    cancelFade();
    if (!writableVolume) {
      done();
      return;
    }
    fadeKind = kind;
    const generation = fadeGeneration;
    const from = audio.volume;
    const started = Date.now();
    function step(): void {
      if (disposed || generation !== fadeGeneration) return;
      const progress = Math.min(1, (Date.now() - started) / duration);
      setVolume(from + (volume - from) * progress);
      if (progress < 1) {
        fadeTimer = browser.setTimeout(step, Math.min(25, duration - (Date.now() - started)));
      } else {
        fadeTimer = undefined;
        fadeKind = null;
        switchTarget = null;
        done();
      }
    }
    fadeTimer = browser.setTimeout(step, 25);
  }

  function pause(): void {
    playGeneration++;
    pendingPlay = null;
    try { audio.pause(); } catch { /* Audio never blocks navigation. */ }
  }

  function release(): void {
    cancelFade();
    pause();
    if (current !== null) {
      current = null;
      try {
        audio.removeAttribute('src');
        audio.load();
      } catch { /* Releasing media is best effort. */ }
    }
    audio.loop = false;
    setVolume(1);
  }

  function listen(armed: boolean): void {
    if (listening === armed) return;
    listening = armed;
    for (const event of ACTIVATION_EVENTS) {
      if (armed) doc.addEventListener(event, onActivation, ACTIVATION_OPTIONS);
      else doc.removeEventListener(event, onActivation, ACTIVATION_OPTIONS);
    }
  }

  function attemptPlay(fadeIn: boolean): void {
    if (!canPlay() || pendingPlay !== null || current === null) return;
    const generation = ++playGeneration;
    pendingPlay = generation;
    function refused(): void {
      if (disposed || generation !== playGeneration) return;
      pendingPlay = null;
      cancelFade();
      setVolume(1);
      needsActivation = true;
      listen(true);
      reconcile();
    }
    try {
      // Deliberately call play before creating a promise continuation: this must
      // remain in the activation / preference setter's synchronous call stack.
      const result = audio.play();
      void Promise.resolve(result).then(() => {
        if (disposed) {
          audio.pause();
          return;
        }
        if (generation !== playGeneration) return;
        pendingPlay = null;
        lastPlayed = current;
        listen(false);
        if (!canPlay()) {
          reconcile();
          return;
        }
        try {
          if (current && browser.navigator?.mediaSession && browser.MediaMetadata) {
            browser.navigator.mediaSession.metadata = new browser.MediaMetadata({
              title: MUSIC_MANIFEST[current].label, artist: 'Shapeships',
            });
          }
        } catch { /* Metadata is optional. */ }
        const latest = playback();
        if (fadeKind === 'out' || fadeKind === 'restore' || (latest && targetFor(latest) !== current)) {
          reconcile();
          return;
        }
        if (fadeIn) fadeTo(1, 500, 'in', () => {});
        else setVolume(1);
      }, refused);
    } catch { refused(); }
  }

  function startTrack(track: MusicTrackId): void {
    if (!canPlay()) return;
    cancelFade();
    pause();
    const policy = playback();
    if (!policy) return;
    try {
      current = track;
      audio.loop = policy.kind === 'loop';
      setVolume(writableVolume ? 0 : 1);
      audio.src = MUSIC_MANIFEST[track].src;
      audio.currentTime = 0;
      attemptPlay(true);
    } catch {
      release();
      needsActivation = true;
      listen(true);
    }
  }

  function reconcile(resume = false): void {
    if (disposed) return;
    const policy = playback();
    if (!policy) {
      release();
      return;
    }
    if (doc.visibilityState === 'hidden') {
      if (!preferences.getSnapshot().musicEnabled) release();
      else {
        cancelFade();
        pause();
        setVolume(1);
      }
      return;
    }
    if (!preferences.getSnapshot().musicEnabled) {
      if (fadeKind === 'off') return;
      if (current !== null && !audio.paused && writableVolume) {
        fadeTo(0, 1000, 'off', release);
      } else release();
      return;
    }
    if (!canPlay()) return;
    const target = targetFor(policy);
    audio.loop = policy.kind === 'loop';
    if (fadeKind === 'out' && switchTarget === target) return;
    if (fadeKind === 'out' || fadeKind === 'off' || (fadeKind === 'in' && current !== target)) {
      // A cancelled transition must not strand the audible element at a low
      // volume. Finish restoring it before reconciling the latest target.
      fadeTo(1, 500, 'restore', () => reconcile(resume));
      return;
    }
    if (fadeKind === 'restore') return;
    if (current === target) {
      if (resume && audio.paused) attemptPlay(false);
      return;
    }
    if (current !== null && !audio.paused && writableVolume) {
      fadeTo(0, 1000, 'out', () => {
        if (!canPlay()) { reconcile(); return; }
        const latest = playback();
        if (latest) startTrack(targetFor(latest));
      });
      switchTarget = target;
    } else startTrack(target);
  }

  function onActivation(event: Event): void {
    if (disposed) return;
    const pointerType = (event as PointerEvent).pointerType;
    if (event.type === 'pointerdown') {
      if (pointerType !== 'mouse') return;
      mouseDownSeen = true;
    } else if (event.type === 'pointerup' && pointerType === 'mouse' && mouseDownSeen) {
      mouseDownSeen = false;
      return;
    }
    if (event.type === 'touchend' || (event.type === 'pointerup' && pointerType === 'touch')) {
      if (lastTouchEvent && lastTouchEvent.type !== event.type && Date.now() - lastTouchEvent.time < 500) return;
      lastTouchEvent = { type: event.type, time: Date.now() };
    }
    activated = true;
    needsActivation = false;
    reconcile(true);
  }

  function onVisibility(): void {
    reconcile(true);
  }

  function onEnded(): void {
    if (!canPlay() || pendingPlay !== null || fadeKind === 'out' || fadeKind === 'restore') return;
    const policy = playback();
    if (policy?.kind === 'alternate' && (current === policy.left || current === policy.right)) {
      startTrack(current === policy.left ? policy.right : policy.left);
    }
  }

  function queueReport(): void {
    if (disposed || reportQueued) return;
    reportQueued = true;
    const generation = reportGeneration;
    browser.queueMicrotask(() => {
      if (disposed || generation !== reportGeneration) return;
      reportQueued = false;
      reconcile();
    });
  }

  listen(true);
  doc.addEventListener('visibilitychange', onVisibility);
  audio.addEventListener('ended', onEnded);
  const unsubscribe = preferences.subscribe('musicEnabled', () => reconcile(true));

  return {
    reportScene(nextScene: MusicScene, gameId: string | null = null): void {
      if (disposed) return;
      scene = nextScene;
      sceneGameId = gameId;
      queueReport();
    },
    reportGame(gameId: string, info: MusicGameInfo | null): () => void {
      if (disposed) return () => {};
      const owner = Symbol();
      gameReport = { gameId, info, owner };
      queueReport();
      return () => {
        if (disposed || gameReport?.owner !== owner) return;
        gameReport = null;
        queueReport();
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      reportGeneration++;
      reportQueued = false;
      listen(false);
      doc.removeEventListener('visibilitychange', onVisibility);
      audio.removeEventListener('ended', onEnded);
      unsubscribe();
      release();
    },
  };
}

let singleton: ReturnType<typeof createMusicController> | undefined;

export function getMusicController(): ReturnType<typeof createMusicController> {
  return singleton ??= createMusicController({
    audio: new Audio(), document, window, preferences: getPlayerPreferencesStore(),
  });
}
