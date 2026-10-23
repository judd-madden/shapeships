import { useEffect, useRef } from 'react';
import { getSoundManifestEntry, type SoundCueId } from './soundManifest';
import type { ShipEffectAudioVm } from '../gameSession/types';

type CuePlayKey = string | number;

interface UseGameSoundArgs {
  enabled: boolean;
  active: boolean;
  diceAnimateKey: number;
  voidShipInstanceIds?: string[];
  shipEffects?: ShipEffectAudioVm;
}

export function useGameSound({
  enabled,
  active,
  diceAnimateKey,
  voidShipInstanceIds,
  shipEffects,
}: UseGameSoundArgs): void {
  const audioByCueIdRef = useRef<Partial<Record<SoundCueId, HTMLAudioElement>>>({});
  const scheduledCueTimeoutByCueIdRef = useRef<Partial<Record<SoundCueId, number>>>({});
  const scheduledCueTimeoutsRef = useRef<Set<number>>(new Set());
  const lastPlayedKeyByCueIdRef = useRef<Partial<Record<SoundCueId, CuePlayKey>>>({});
  const lastObservedDiceAnimateKeyRef = useRef<number | null>(null);
  const observedVoidShipIdsRef = useRef<Set<string>>(new Set());
  const hasSeededVoidShipIdsRef = useRef(false);
  const unlockReadyRef = useRef(false);
  const scheduledOwnerByCueRef = useRef<Partial<Record<SoundCueId, 'effect' | 'ordinary'>>>({});
  const playingOwnerByCueRef = useRef<Partial<Record<SoundCueId, 'effect' | 'ordinary'>>>({});
  const effectScopeRef = useRef<string | null>(null);
  const observedEffectImpactRef = useRef<string | null>(null);

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
    scheduledOwnerByCueRef.current = {};
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

  function scheduleCue(cueId: SoundCueId, playKey: CuePlayKey, delayMs: number, owner: 'effect' | 'ordinary' = 'ordinary'): void {
    const existingTimeoutId = scheduledCueTimeoutByCueIdRef.current[cueId];
    if (existingTimeoutId !== undefined) {
      window.clearTimeout(existingTimeoutId);
      scheduledCueTimeoutsRef.current.delete(existingTimeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      scheduledCueTimeoutsRef.current.delete(timeoutId);
      delete scheduledCueTimeoutByCueIdRef.current[cueId];
      delete scheduledOwnerByCueRef.current[cueId];

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
      playingOwnerByCueRef.current[cueId] = owner;

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
    scheduledOwnerByCueRef.current[cueId] = owner;
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
    if (effectScopeRef.current === (shipEffects?.scopeKey ?? null)) return;
    effectScopeRef.current = shipEffects?.scopeKey ?? null;
    // Recovery owns only effect-originated destroy audio, never dice or fallback cues.
    if (scheduledOwnerByCueRef.current.destroy === 'effect') {
      const timer = scheduledCueTimeoutByCueIdRef.current.destroy;
      if (timer !== undefined) { window.clearTimeout(timer); scheduledCueTimeoutsRef.current.delete(timer); }
      delete scheduledCueTimeoutByCueIdRef.current.destroy;
      delete scheduledOwnerByCueRef.current.destroy;
    }
    if (playingOwnerByCueRef.current.destroy === 'effect') {
      stopCue('destroy');
      delete playingOwnerByCueRef.current.destroy;
    }
  }, [shipEffects?.scopeKey]);

  useEffect(() => {
    const impactKey = shipEffects?.impactKey ?? null;
    const previous = observedEffectImpactRef.current;
    observedEffectImpactRef.current = impactKey;
    if (impactKey === previous) return;
    if (active && enabled && shipEffects && !shipEffects.baseline && impactKey) {
      scheduleCue('destroy', `effect:${shipEffects.scopeKey}:${impactKey}`, 0, 'effect');
    }
  }, [active, enabled, shipEffects?.scopeKey, shipEffects?.impactKey, shipEffects?.baseline]);

  const observedVoidIds = shipEffects?.authoritativeVoidInstanceIds ?? voidShipInstanceIds;
  useEffect(() => {
    if (!active || observedVoidIds === undefined) {
      return;
    }

    if (!hasSeededVoidShipIdsRef.current || shipEffects?.baseline) {
      observedVoidShipIdsRef.current = new Set(observedVoidIds);
      hasSeededVoidShipIdsRef.current = true;
      return;
    }

    const observedVoidShipIds = observedVoidShipIdsRef.current;
    const newVoidShipIds = observedVoidIds.filter((instanceId) => !observedVoidShipIds.has(instanceId));

    if (newVoidShipIds.length === 0) {
      return;
    }

    for (const instanceId of newVoidShipIds) {
      observedVoidShipIds.add(instanceId);
    }

    if (!enabled) {
      return;
    }

    const sortedNewVoidShipIds = newVoidShipIds.filter((id) => !shipEffects?.suppressedVoidInstanceIds.includes(id)).sort();
    if (!sortedNewVoidShipIds.length) return;
    scheduleCue('destroy', `destroy:${sortedNewVoidShipIds.join(',')}`, 0);
  }, [active, enabled, observedVoidIds, shipEffects?.baseline, shipEffects?.suppressedVoidInstanceIds]);

  useEffect(() => {
    return () => {
      clearScheduledCueTimeouts();
      stopAllCues();
    };
  }, []);
}
