import type { ResolvedHealthSnapshot } from '../../client/gameSession/types';
import type { HealthBarScaleContext } from './healthBarScale';
import { prepareHealthBarSequence, sampleHealthBarSequence, type HealthBarAnimationFrame, type HealthBarSequence } from './healthBarSequence';
import type { HealthBarScales } from './healthBarScaleTransition';

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
  readonly completion: HealthBarCompletion | null;
  readonly deltas: Readonly<{ left: number; right: number }> | null;
  readonly deltasVisible: boolean;
}
const emptyState = (): HealthBarPlaybackState => ({
  sequence: null, frame: null, completion: null, deltas: null, deltasVisible: false,
});
const contextKey = (context: HealthBarScaleContext) => JSON.stringify([
  context.identity.gameId, context.identity.viewerId, context.identity.viewerRole,
  context.identity.leftPlayerId, context.identity.rightPlayerId, context.continuityKey,
]);

/** Owns captured inputs beyond candidate release. No phase holds, networking or replay queue. */
export function createHealthBarAnimationController(options: {
  readonly scheduler?: HealthBarAnimationScheduler;
  readonly onComplete?: (completion: HealthBarCompletion) => void;
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
    if (!state.sequence || state.completion) return;
    cancel();
    const sequence = state.sequence;
    const completion = Object.freeze({
      presentationKey: sequence.snapshot.presentationKey, resolvedTurnNumber: sequence.snapshot.resolvedTurnNumber,
      identity: sequence.snapshot.identity, continuityKey: sequence.snapshot.continuityKey, reason,
    });
    const token = generation;
    publish({ ...state, frame: sampleHealthBarSequence(sequence, sequence.durationMs), completion, deltasVisible: true });
    if (!disposed && token === generation) options.onComplete?.(completion);
  };
  const schedule = () => {
    const token = generation;
    handle = scheduler.request(() => {
      if (disposed || token !== generation || !state.sequence || state.completion) return;
      handle = null;
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
