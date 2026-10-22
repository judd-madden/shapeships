import type { ResolvedHealthSnapshot } from '../../client/gameSession/types';
import type { HealthBarScaleContext } from './healthBarScale';
import { prepareHealthBarSequence, sampleHealthBarSequence, type HealthBarAnimationFrame, type HealthBarSequence } from './healthBarSequence';
import type { HealthBarScales } from './healthBarScaleTransition';
import { HEALTH_BAR_ANIMATION_CONFIG, healthBarEasing } from './healthBarAnimationConfig';

export interface HealthBarAnimationScheduler {
  now(): number;
  request(callback: () => void): number;
  cancel(handle: number): void;
}
export const browserHealthBarScheduler: HealthBarAnimationScheduler = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};
export interface HealthBarCompletion {
  readonly presentationKey: string;
  readonly resolvedTurnNumber: number;
  readonly identity: ResolvedHealthSnapshot['identity'];
  readonly continuityKey: string;
  readonly reason: 'finished' | 'stopped' | 'motion-disabled';
}
export interface HealthBarPlaybackState {
  readonly sequence: Readonly<HealthBarSequence> | null;
  readonly frame: HealthBarAnimationFrame | null;
  /** Bar completion reveals deltas; overall completion also waits for desktop numbers. */
  readonly completion: HealthBarCompletion | null;
  readonly numbers: Readonly<{ left: number; right: number }> | null;
  readonly presentationCompletion: HealthBarCompletion | null;
  readonly deltas: Readonly<{ left: number; right: number }> | null;
  readonly deltasVisible: boolean;
}
const emptyState = (): HealthBarPlaybackState => ({
  sequence: null, frame: null, completion: null, numbers: null, presentationCompletion: null,
  deltas: null, deltasVisible: false,
});
const contextKey = (context: HealthBarScaleContext) => JSON.stringify([
  context.identity.gameId, context.identity.viewerId, context.identity.viewerRole,
  context.identity.leftPlayerId, context.identity.rightPlayerId, context.continuityKey,
]);

/** Owns captured inputs beyond candidate release. No phase holds, networking or replay queue. */
export function createHealthBarAnimationController(options: {
  readonly scheduler?: HealthBarAnimationScheduler;
  readonly onComplete?: (completion: HealthBarCompletion) => void;
  /** Production desktop only; gallery/bar completion keeps its existing timing. */
  readonly animateSettledNumbers?: boolean;
} = {}) {
  const scheduler = options.scheduler ?? browserHealthBarScheduler;
  const listeners = new Set<() => void>();
  let state = emptyState();
  let activeContext: string | null = null;
  let latestTurn = -1;
  let latestKey: string | null = null;
  let generation = 0;
  let handle: number | null = null;
  let startedAt = 0;
  let motionEnabled = true;
  let disposed = false;
  let retainedScales: HealthBarScales | null = null;
  const publish = (next: HealthBarPlaybackState) => {
    state = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  const cancel = () => {
    generation += 1;
    if (handle !== null) scheduler.cancel(handle);
    handle = null;
  };
  const finish = (reason: HealthBarCompletion['reason']) => {
    if (!state.sequence || state.presentationCompletion) return;
    cancel();
    const sequence = state.sequence;
    const alreadyCompletedBars = state.completion;
    const receipt = Object.freeze({
      presentationKey: sequence.snapshot.presentationKey, resolvedTurnNumber: sequence.snapshot.resolvedTurnNumber,
      identity: sequence.snapshot.identity, continuityKey: sequence.snapshot.continuityKey, reason,
    });
    const completion = alreadyCompletedBars ?? receipt;
    const changed = (['left', 'right'] as const).some((side) =>
      sequence.snapshot[side].startHealth !== sequence.snapshot[side].finalHealth);
    const duration = options.animateSettledNumbers && changed ? HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs : 0;
    // Both numbers share the original bar-end timestamp, even if a frame arrives late.
    const fraction = reason !== 'finished' || duration <= 0 ? 1 :
      Math.max(0, Math.min(1, (scheduler.now() - startedAt - sequence.durationMs) / duration));
    const progress = healthBarEasing(fraction);
    const number = (side: 'left' | 'right') => {
      const { startHealth, finalHealth } = sequence.snapshot[side];
      return fraction === 1 ? finalHealth : startHealth + (finalHealth - startHealth) * progress;
    };
    const token = generation;
    publish({ ...state, frame: alreadyCompletedBars ? state.frame : sampleHealthBarSequence(sequence, sequence.durationMs),
      completion, deltasVisible: true, numbers: Object.freeze({ left: number('left'), right: number('right') }),
      presentationCompletion: fraction === 1 ? receipt : null });
    if (!disposed && token === generation && !alreadyCompletedBars) options.onComplete?.(completion);
    if (!disposed && token === generation && !state.presentationCompletion) schedule();
  };
  const schedule = () => {
    const token = generation;
    handle = scheduler.request(() => {
      if (disposed || token !== generation || !state.sequence || state.presentationCompletion) return;
      handle = null;
      if (state.completion) { finish('finished'); return; }
      const frame = sampleHealthBarSequence(state.sequence, scheduler.now() - startedAt);
      if (frame.complete) finish('finished');
      else {
        publish({ ...state, frame });
        if (token === generation && !disposed) schedule();
      }
    });
  };
  const reset = () => {
    cancel();
    retainedScales = null;
    latestTurn = -1;
    latestKey = null;
    publish(emptyState());
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    updateContext(context: HealthBarScaleContext | null) {
      if (disposed) return;
      const key = context ? contextKey(context) : null;
      if (key !== activeContext) { activeContext = key; reset(); }
    },
    setMotionEnabled(enabled: boolean) {
      if (disposed) return;
      motionEnabled = enabled;
      if (!enabled) finish('motion-disabled');
    },
    accept(candidate: Readonly<ResolvedHealthSnapshot> | null | undefined, scales?: HealthBarScales): boolean {
      if (disposed || !candidate || !scales) return false;
      const incomingContext = contextKey(candidate);
      if (activeContext === null) activeContext = incomingContext;
      if (incomingContext !== activeContext || candidate.resolvedTurnNumber <= latestTurn ||
        candidate.presentationKey === latestKey) return false;
      // Prepare before replacing anything so a rejected candidate cannot cancel accepted work.
      const sequence = prepareHealthBarSequence(candidate, scales, retainedScales);
      cancel();
      // The old sequence is superseded at its captured final state; no obsolete completion is emitted.
      retainedScales = sequence.scales;
      latestTurn = candidate.resolvedTurnNumber;
      latestKey = candidate.presentationKey;
      startedAt = scheduler.now();
      const token = generation;
      publish({ sequence, frame: sampleHealthBarSequence(sequence, 0), completion: null,
        numbers: Object.freeze({ left: sequence.snapshot.left.startHealth, right: sequence.snapshot.right.startHealth }),
        presentationCompletion: null,
        deltas: Object.freeze({ left: sequence.snapshot.left.actualNetDelta, right: sequence.snapshot.right.actualNetDelta }),
        deltasVisible: false });
      if (token !== generation || disposed) return true;
      if (!motionEnabled) finish('motion-disabled');
      else if (sequence.durationMs === 0) finish('finished');
      else schedule();
      return true;
    },
    /** Stop is a completion at captured final health, and preserves production deduplication. */
    stop() { if (!disposed) finish('stopped'); },
    /** Unsupported newer facts replace stale visuals without completing or replaying them. */
    invalidate() {
      if (disposed) return;
      cancel();
      retainedScales = null;
      publish(emptyState());
    },
    /** Explicit recovery/development replay only; source release must never call reset. */
    reset() { if (!disposed) reset(); },
    dispose() {
      if (disposed) return;
      cancel();
      disposed = true;
      state = emptyState();
      listeners.clear();
    },
  };
}
export type HealthBarAnimationController = ReturnType<typeof createHealthBarAnimationController>;
