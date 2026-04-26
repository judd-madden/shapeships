import { useEffect, useRef } from 'react';
import { getSoundManifestEntry, type SoundCueId } from './soundManifest';

type CuePlayKey = string | number;

interface UseGameSoundArgs {
  enabled: boolean;
  active: boolean;
  diceAnimateKey: number;
  voidShipInstanceIds?: string[];
}

export function useGameSound({
  enabled,
  active,
  diceAnimateKey,
  voidShipInstanceIds,
}: UseGameSoundArgs): void {
  const audioByCueIdRef = useRef<Partial<Record<SoundCueId, HTMLAudioElement>>>({});
  const scheduledCueTimeoutByCueIdRef = useRef<Partial<Record<SoundCueId, number>>>({});
  const scheduledCueTimeoutsRef = useRef<Set<number>>(new Set());
  const lastPlayedKeyByCueIdRef = useRef<Partial<Record<SoundCueId, CuePlayKey>>>({});
  const lastObservedDiceAnimateKeyRef = useRef<number | null>(null);
  const observedVoidShipIdsRef = useRef<Set<string>>(new Set());
  const hasSeededVoidShipIdsRef = useRef(false);
  const unlockReadyRef = useRef(false);

  function getOrCreateAudio(cueId: SoundCueId): HTMLAudioElement | null {
    const existingAudio = audioByCueIdRef.current[cueId];
    if (existingAudio) {
      return existingAudio;
    }

    const manifestEntry = getSoundManifestEntry(cueId);
    if (!manifestEntry.src) {
      return null;
    }

    const audio = new Audio(manifestEntry.src);
    audio.preload = 'auto';
    audioByCueIdRef.current[cueId] = audio;
    return audio;
  }

  function clearScheduledCueTimeouts(): void {
    for (const timeoutId of scheduledCueTimeoutsRef.current) {
      window.clearTimeout(timeoutId);
    }
    scheduledCueTimeoutsRef.current.clear();
    scheduledCueTimeoutByCueIdRef.current = {};
  }

  function stopCue(cueId: SoundCueId): void {
    const audio = audioByCueIdRef.current[cueId];
    if (!audio) {
      return;
    }

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Keep sound failures silent in the UI layer.
    }
  }

  function stopAllCues(): void {
    for (const cueId of Object.keys(audioByCueIdRef.current) as SoundCueId[]) {
      stopCue(cueId);
    }
  }

  function warmCue(cueId: SoundCueId): void {
    const audio = getOrCreateAudio(cueId);
    if (!audio) {
      return;
    }

    try {
      audio.load();
    } catch {
      // Keep warm-up failures silent.
    }
  }

  function resetObservedVoidShipIds(): void {
    observedVoidShipIdsRef.current = new Set();
    hasSeededVoidShipIdsRef.current = false;
  }

  async function attemptUnlock(): Promise<void> {
    if (unlockReadyRef.current || !enabled || !active) {
      return;
    }

    const audio = getOrCreateAudio('dice');
    if (!audio) {
      return;
    }

    const previousMuted = audio.muted;
    const previousVolume = audio.volume;

    try {
      audio.muted = true;
      audio.volume = 0;
      audio.currentTime = 0;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      unlockReadyRef.current = true;
    } catch {
      // Browser autoplay restrictions should fail quietly.
    } finally {
      audio.muted = previousMuted;
      audio.volume = previousVolume;
    }
  }

  function scheduleCue(cueId: SoundCueId, playKey: CuePlayKey, delayMs: number): void {
    const existingTimeoutId = scheduledCueTimeoutByCueIdRef.current[cueId];
    if (existingTimeoutId !== undefined) {
      window.clearTimeout(existingTimeoutId);
      scheduledCueTimeoutsRef.current.delete(existingTimeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      scheduledCueTimeoutsRef.current.delete(timeoutId);
      delete scheduledCueTimeoutByCueIdRef.current[cueId];

      if (!enabled || !active) {
        return;
      }

      if (lastPlayedKeyByCueIdRef.current[cueId] === playKey) {
        return;
      }

      const audio = getOrCreateAudio(cueId);
      if (!audio) {
        return;
      }

      lastPlayedKeyByCueIdRef.current[cueId] = playKey;

      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Ignore restart reset failures and continue the quiet failure posture.
      }

      void audio.play().catch(() => {
        // Browser autoplay restrictions should fail quietly.
      });
    }, delayMs);

    scheduledCueTimeoutByCueIdRef.current[cueId] = timeoutId;
    scheduledCueTimeoutsRef.current.add(timeoutId);
  }

  useEffect(() => {
    if (!enabled || !active) {
      clearScheduledCueTimeouts();
      stopAllCues();
      return;
    }

    warmCue('dice');
    warmCue('destroy');
  }, [active, enabled]);

  useEffect(() => {
    if (!enabled || !active) {
      return;
    }

    const handleInteraction = () => {
      void attemptUnlock();
    };

    const listenerOptions: AddEventListenerOptions = { passive: true };

    window.addEventListener('pointerdown', handleInteraction, listenerOptions);
    window.addEventListener('keydown', handleInteraction, listenerOptions);

    return () => {
      window.removeEventListener('pointerdown', handleInteraction, listenerOptions);
      window.removeEventListener('keydown', handleInteraction, listenerOptions);
    };
  }, [active, enabled]);

  useEffect(() => {
    if (!active) {
      lastObservedDiceAnimateKeyRef.current = null;
      // Future hardening could add a scopeKey (for example gameId) if game swaps
      // ever happen without passing through an inactive lifecycle.
      resetObservedVoidShipIds();
      return;
    }

    const previousKey = lastObservedDiceAnimateKeyRef.current;
    lastObservedDiceAnimateKeyRef.current = diceAnimateKey;

    if (previousKey === null || previousKey === diceAnimateKey) {
      return;
    }

    if (!enabled) {
      return;
    }

    scheduleCue('dice', diceAnimateKey, 0);
  }, [active, diceAnimateKey, enabled]);

  useEffect(() => {
    if (!active || voidShipInstanceIds === undefined) {
      return;
    }

    if (!hasSeededVoidShipIdsRef.current) {
      observedVoidShipIdsRef.current = new Set(voidShipInstanceIds);
      hasSeededVoidShipIdsRef.current = true;
      return;
    }

    const observedVoidShipIds = observedVoidShipIdsRef.current;
    const newVoidShipIds = voidShipInstanceIds.filter((instanceId) => !observedVoidShipIds.has(instanceId));

    if (newVoidShipIds.length === 0) {
      return;
    }

    for (const instanceId of newVoidShipIds) {
      observedVoidShipIds.add(instanceId);
    }

    if (!enabled) {
      return;
    }

    const sortedNewVoidShipIds = [...newVoidShipIds].sort();
    scheduleCue('destroy', `destroy:${sortedNewVoidShipIds.join(',')}`, 0);
  }, [active, enabled, voidShipInstanceIds]);

  useEffect(() => {
    return () => {
      clearScheduledCueTimeouts();
      stopAllCues();
    };
  }, []);
}
