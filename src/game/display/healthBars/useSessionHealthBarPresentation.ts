import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type {
  ResolvedHealthCompletionIdentity, ResolvedHealthPresentation, ResolvedHealthSessionPresentation,
} from '../../client/gameSession/types';
import { getResolvedHealthIdentityKey } from '../../client/gameSession/resolvedHealth';
import {
  createHealthBarAnimationController, type HealthBarAnimationController,
  browserHealthBarScheduler, type HealthBarAnimationScheduler, type HealthBarPlaybackState,
} from './healthBarAnimationController';
import { prepareHealthBarScale, type HealthBarOrientation, type PreparedHealthBarScale } from './healthBarScale';
import { settledHealthBarState } from './healthBarSequence';
import type { HealthBarPresentationState } from './healthBarPresentation';
import {
  prepareHealthBarLegendTransition, sampleHealthBarLegendTransition,
  type HealthBarScales,
} from './healthBarScaleTransition';
import { useHealthBarAnimation } from './useHealthBarAnimation';
import { HEALTH_BAR_ANIMATION_CONFIG } from './healthBarAnimationConfig';
import {
  recordReactUpdateDiagnostic, type ReactUpdateDiagnostic,
} from '../../client/gameSession/clienteffects/useEndOfTurnPresentation';
import {
  prepareHealthBarOutcome, type HealthBarOutcomePair, type HealthBarOutcomePresentation,
} from './healthBarOutcomePresentation';

export interface SessionHealthBarPresentation {
  readonly scale: Readonly<PreparedHealthBarScale>;
  readonly left: HealthBarPresentationState;
  readonly right: HealthBarPresentationState;
  readonly sequence: HealthBarPlaybackState['sequence'];
  readonly scaleProgress: number;
  readonly numbers: Readonly<{ left: number; right: number }>;
  readonly presentationComplete: boolean;
  readonly outcome: HealthBarOutcomePresentation | null;
  readonly delta: { readonly left: number; readonly right: number; readonly visible: boolean; readonly key: string } | null;
}

/** Owned by the mounted live session, independently of playback identity/recovery. */
export interface SessionHealthBarScaleRetention {
  gameId: string | null;
  negativeFloor: number;
}

function matchesSession(
  context: { identity: ResolvedHealthSessionPresentation['identity']; continuityKey: string },
  session: ResolvedHealthSessionPresentation,
) {
  return context.continuityKey === session.continuityKey &&
    getResolvedHealthIdentityKey(context.identity) === getResolvedHealthIdentityKey(session.identity);
}

export function prepareSessionHealthBarScales(
  presentation: ResolvedHealthPresentation | null | undefined,
  session: ResolvedHealthSessionPresentation | null | undefined,
  retainedNegativeFloor = 0,
): HealthBarScales | null {
  if (!session || !presentation) return null;
  const desktop = prepareHealthBarScale(presentation, session, { orientation: 'desktop', retainedNegativeFloor });
  const mobile = prepareHealthBarScale(presentation, session, { orientation: 'mobile', retainedNegativeFloor });
  return desktop && mobile ? { desktop, mobile } : null;
}

// Per accepted sequence, independent of controller completion/deduplication.
// Once newer health has been shown, returning to the old finals cannot revive its deltas.
const supersededHealthDeltas = new WeakSet<NonNullable<HealthBarPlaybackState['sequence']>>();

function settledHealthMatchesPlayback(state: HealthBarPlaybackState, session: ResolvedHealthSessionPresentation) {
  const snapshot = state.sequence?.snapshot;
  return !!snapshot && !!session.settled && (['left', 'right'] as const).every((side) =>
    snapshot[side].finalHealth === session.settled![side].health);
}

function settledMatchesPlayback(state: HealthBarPlaybackState, session: ResolvedHealthSessionPresentation) {
  return settledHealthMatchesPlayback(state, session) && (['left', 'right'] as const).every((side) =>
    state.sequence!.snapshot[side].maxHealth === session.settled![side].maxHealth);
}

/** Pure frame selection keeps animated numbers out of authoritative board/stat inputs. */
export function selectSessionHealthBarPresentation(
  playback: HealthBarPlaybackState,
  presentation: ResolvedHealthPresentation | null | undefined,
  session: ResolvedHealthSessionPresentation | null | undefined,
  orientation: HealthBarOrientation = 'desktop',
  retainedNegativeFloor = 0,
): SessionHealthBarPresentation | null {
  if (!session) return null;
  const snapshot = playback.sequence?.snapshot;
  const incoming = presentation?.mode === 'live' ? presentation.snapshot : null;
  const current = snapshot && matchesSession(snapshot, session) &&
    (session.observedResolvedTurnNumber ?? 0) <= snapshot.resolvedTurnNumber &&
    (!incoming || incoming.resolvedTurnNumber <= snapshot.resolvedTurnNumber);
  const retainsCompleted = session.settledIncludesLiveResolution === false;
  const delta = current && playback.deltas ? { ...playback.deltas,
    visible: playback.deltasVisible && !supersededHealthDeltas.has(playback.sequence!) &&
      (!!retainsCompleted || !session.settled || settledHealthMatchesPlayback(playback, session)),
    key: JSON.stringify([snapshot.continuityKey, snapshot.presentationKey, snapshot.resolvedTurnNumber, 'complete']),
  } : null;
  if (current && playback.frame && (!playback.presentationCompletion ||
      (playback.frame.scales[orientation].domainMin <= retainedNegativeFloor &&
        (retainsCompleted || settledMatchesPlayback(playback, session))))) {
    return {
      scale: playback.frame.scales[orientation], left: playback.frame.left, right: playback.frame.right,
      sequence: playback.sequence, scaleProgress: playback.frame.scaleProgress,
      delta, numbers: playback.numbers!, presentationComplete: playback.presentationCompletion !== null, outcome: null,
    };
  }
  const settled = session.settled;
  const scale = settled && prepareHealthBarScale(settled, session, { orientation, retainedNegativeFloor });
  return settled && scale ? {
    scale, left: settledHealthBarState(settled.left.health), right: settledHealthBarState(settled.right.health),
    sequence: null, scaleProgress: 1, delta,
    numbers: { left: settled.left.health, right: settled.right.health }, presentationComplete: true, outcome: null,
  } : null;
}

/** React development reattachment cancels disposal; a real unmount cancels RAF before the next frame. */
export function attachSessionHealthBarController(controller: HealthBarAnimationController, lease: { current: number }) {
  const token = ++lease.current;
  return () => { queueMicrotask(() => { if (lease.current === token) controller.dispose(); }); };
}

export function syncSessionHealthBarController(
  controller: HealthBarAnimationController,
  presentation: ResolvedHealthPresentation | null | undefined,
  session: ResolvedHealthSessionPresentation | null | undefined,
  canAccept = true,
  retention?: SessionHealthBarScaleRetention,
) {
  if (session && retention && retention.gameId !== session.identity.gameId) {
    retention.gameId = session.identity.gameId;
    retention.negativeFloor = 0;
  }
  const retainedNegativeFloor = retention?.negativeFloor ?? 0;
  controller.updateContext(session ?? null);
  const candidate = canAccept && presentation?.mode === 'live' && session &&
    matchesSession(presentation.snapshot, session) &&
    presentation.snapshot.resolvedTurnNumber >= (session.observedResolvedTurnNumber ?? 0)
    ? presentation.snapshot : null;
  const owned = controller.getSnapshot().sequence?.snapshot;
  const scales = candidate && (!owned || candidate.resolvedTurnNumber > owned.resolvedTurnNumber)
    ? prepareSessionHealthBarScales({ mode: 'live', snapshot: candidate }, session, retainedNegativeFloor) : null;
  if (candidate && scales && controller.accept(candidate, scales, retainedNegativeFloor) && retention) {
    retention.negativeFloor = Math.min(retention.negativeFloor, scales.desktop.domainMin, scales.mobile.domainMin);
  }
  const state = controller.getSnapshot();
  if (session && state.sequence) {
    if ((session.observedResolvedTurnNumber ?? 0) > state.sequence.snapshot.resolvedTurnNumber) controller.invalidate();
    else if (state.presentationCompletion && session.settled &&
      session.settledIncludesLiveResolution !== false &&
      !settledHealthMatchesPlayback(state, session)) {
      supersededHealthDeltas.add(state.sequence);
    }
  }
  // Commit only a valid selected settled fallback, never a hidden DTO or animated frame.
  if (retention) {
    const selected = selectSessionHealthBarPresentation(controller.getSnapshot(), presentation, session,
      'desktop', retention.negativeFloor);
    if (selected && !selected.sequence) retention.negativeFloor = Math.min(retention.negativeFloor, selected.scale.domainMin);
  }
}

export function useSessionHealthBarPresentation(input: {
  onReactDiagnostic?: ReactUpdateDiagnostic;
  presentation: ResolvedHealthPresentation | null | undefined;
  session: ResolvedHealthSessionPresentation | null | undefined;
  canAccept: boolean;
  onComplete: (completion: ResolvedHealthCompletionIdentity) => void;
  scheduler?: HealthBarAnimationScheduler;
  orientation?: HealthBarOrientation;
}) {
  const [scheduler] = useState(() => input.scheduler ?? browserHealthBarScheduler);
  const [controller] = useState(() => createHealthBarAnimationController({
    scheduler, animateSettledNumbers: true,
  }));
  const lease = useRef(0);
  const retention = useRef<SessionHealthBarScaleRetention>({ gameId: null, negativeFloor: 0 });
  const playback = useHealthBarAnimation(controller);
  const [, commitCapture] = useState(0);
  const motionEnabled = useRef(true);
  const onComplete = useRef(input.onComplete);
  onComplete.current = input.onComplete;

  recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.playback.render', () => ({
    resolvedTurn: playback.sequence?.snapshot.resolvedTurnNumber ?? null,
    observedTurn: input.session?.observedResolvedTurnNumber ?? null,
    complete: playback.presentationCompletion !== null,
    canAccept: input.canAccept,
  }), { playback, presentation: input.presentation, session: input.session });

  useLayoutEffect(() => {
    const release = attachSessionHealthBarController(controller, lease);
    const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const update = () => {
      const enabled = !media?.matches;
      if (motionEnabled.current !== enabled) {
        motionEnabled.current = enabled;
        recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.capture.dispatch', () => ({
          reason: 'motion_change', enabled,
        }));
        commitCapture((revision) => revision + 1);
      }
      controller.setMotionEnabled(enabled);
    };
    update();
    media?.addEventListener?.('change', update);
    return () => { media?.removeEventListener?.('change', update); release(); };
  }, [controller]);

  useLayoutEffect(() => {
    const before = controller.getSnapshot();
    recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.controller.sync.attempt', () => ({
      canAccept: input.canAccept,
      playbackMatches: before === playback,
    }), { presentation: input.presentation, session: input.session, completion: playback.presentationCompletion });
    syncSessionHealthBarController(controller, input.presentation, input.session, input.canAccept, retention.current);
    recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.controller.sync.observe', () => ({
      snapshotChanged: controller.getSnapshot() !== before,
    }));
    // Acceptance can precede the external-store subscription on its first commit.
    // Publish the captured starting frame before paint, including its hidden deltas.
    if (controller.getSnapshot() !== playback) {
      recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.capture.dispatch', () => ({
        reason: 'snapshot_mismatch',
      }));
      commitCapture((revision) => revision + 1);
    }
  }, [controller, input.presentation, input.session, input.canAccept, playback.presentationCompletion]);

  useEffect(() => {
    const completion = playback.presentationCompletion;
    if (completion && input.session && matchesSession(completion, input.session) &&
      controller.getSnapshot().presentationCompletion === completion &&
      completion.resolvedTurnNumber >= (input.session.observedResolvedTurnNumber ?? 0)) {
      recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.completion.callback', () => ({
        resolvedTurn: completion.resolvedTurnNumber,
        presentationKey: completion.presentationKey,
      }), { completion });
      onComplete.current(completion);
    }
  }, [controller, playback.presentationCompletion, input.session]);

  const floor = retention.current.gameId === input.session?.identity.gameId ? retention.current.negativeFloor : 0;
  const selected = selectSessionHealthBarPresentation(playback, input.presentation, input.session, input.orientation, floor);
  const outcome = useSessionHealthBarOutcome({ selected, session: input.session, scheduler, motionEnabled,
    onReactDiagnostic: input.onReactDiagnostic,
    selectCurrent: () => selectSessionHealthBarPresentation(controller.getSnapshot(), input.presentation, input.session,
      input.orientation, retention.current.gameId === input.session?.identity.gameId ? retention.current.negativeFloor : 0),
  });
  return selected ? { ...selected, outcome } : null;
}

function selectedOutcome(selected: SessionHealthBarPresentation | null, session: ResolvedHealthSessionPresentation | null | undefined) {
  if (!selected || !session) return null;
  const snapshot = selected.sequence?.snapshot;
  const settled = session.settled;
  if (settled && getResolvedHealthIdentityKey(settled.identity) !== getResolvedHealthIdentityKey(session.identity)) return null;
  // A captured terminal intent can precede its settled DTO and outlive source release.
  const outcome = snapshot?.outcome.isTerminal &&
    (!settled?.outcome.isTerminal || session.settledIncludesLiveResolution === false)
    ? snapshot.outcome : settled?.outcome;
  return outcome ? prepareHealthBarOutcome(session.identity, outcome) : null;
}

const outcomeKey = (identity: string | null, pair: HealthBarOutcomePair | null) =>
  pair ? JSON.stringify([identity, pair.left, pair.right]) : null;

/** Visual-only reveal owned above layout branches; never delays the completion receipt. */
function useSessionHealthBarOutcome(input: {
  onReactDiagnostic?: ReactUpdateDiagnostic;
  selected: SessionHealthBarPresentation | null;
  selectCurrent: () => SessionHealthBarPresentation | null;
  session: ResolvedHealthSessionPresentation | null | undefined;
  scheduler: HealthBarAnimationScheduler;
  motionEnabled: { current: boolean };
}): HealthBarOutcomePresentation | null {
  const [, publish] = useState(0);
  const reveal = useRef({
    identity: null as string | null, continuity: null as string | null, observedActive: false,
    key: null as string | null, pair: null as HealthBarOutcomePair | null, animate: false,
    startedAt: null as number | null, handle: null as number | null, generation: 0, mounted: false,
    view: null as HealthBarOutcomePresentation | null,
  });
  const scheduler = input.scheduler;
  useLayoutEffect(() => {
    const state = reveal.current;
    state.mounted = true;
    return () => {
      state.mounted = false;
      state.generation += 1;
      if (state.handle !== null) scheduler.cancel(state.handle);
      state.handle = null;
    };
  }, [scheduler]);

  // Read the controller after capture's layout effect, before painting any settled fallback.
  useLayoutEffect(() => {
    const state = reveal.current;
    const previousView = state.view;
    const selected = input.selectCurrent();
    const identity = input.session ? getResolvedHealthIdentityKey(input.session.identity) : null;
    const continuity = input.session?.continuityKey ?? null;
    const recovered = identity === state.identity && state.continuity !== null && continuity !== state.continuity;
    const cancel = () => {
      state.generation += 1;
      if (state.handle !== null) scheduler.cancel(state.handle);
      state.handle = null;
    };
    if (identity !== state.identity) {
      cancel(); state.identity = identity; state.observedActive = false; state.key = null; state.view = null;
    }
    state.continuity = continuity;
    const pair = selectedOutcome(selected, input.session);
    const key = outcomeKey(identity, pair);
    if (!pair || !selected) {
      cancel(); state.key = null; state.pair = null; state.view = null; state.startedAt = null;
      if (selected && (selected.sequence?.snapshot.outcome ?? input.session?.settled?.outcome)?.isTerminal === false) {
        state.observedActive = true;
      }
    } else {
      if (key !== state.key) {
        cancel(); state.key = key; state.pair = pair; state.startedAt = null; state.view = null;
        state.animate = state.observedActive || !!selected.sequence;
      }
      if (recovered) { cancel(); state.animate = false; state.startedAt = null; }
      if (!selected.presentationComplete) {
        cancel(); state.view = null; state.startedAt = null;
        state.animate = true;
      } else if (!input.motionEnabled.current || !state.animate) {
        cancel();
        state.animate = false;
        if (state.view?.opacity !== 1) state.view = { ...state.pair!, opacity: 1 };
      } else {
        if (state.startedAt === null) {
          state.startedAt = scheduler.now(); state.view = { ...state.pair!, opacity: 0 };
        }
        if (state.view!.opacity < 1 && state.handle === null) {
          const generation = state.generation;
          const frame = () => {
            if (!state.mounted || generation !== state.generation || state.key !== key || state.identity !== identity) return;
            state.handle = null;
            const opacity = Math.min(1, Math.max(0,
              (scheduler.now() - state.startedAt!) / HEALTH_BAR_ANIMATION_CONFIG.outcomeLetterFadeMs));
            state.view = { ...state.pair!, opacity };
            if (opacity < 1) state.handle = scheduler.request(frame);
            recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.outcome.publish.dispatch', () => ({
              reason: 'animation_frame', opacity,
            }));
            publish((revision) => revision + 1);
          };
          state.handle = scheduler.request(frame);
        }
      }
    }
    if (previousView !== state.view) {
      recordReactUpdateDiagnostic(input.onReactDiagnostic, 'health.outcome.publish.dispatch', () => ({
        reason: 'layout_change', opacity: state.view?.opacity ?? null,
      }));
      publish((revision) => revision + 1);
    }
  });

  const identity = input.session ? getResolvedHealthIdentityKey(input.session.identity) : null;
  return input.selected?.presentationComplete &&
    outcomeKey(identity, selectedOutcome(input.selected, input.session)) === reveal.current.key
    ? reveal.current.view : null;
}

function useHealthBarAxisLength(regionRef: RefObject<HTMLDivElement | null>, orientation: HealthBarOrientation) {
  const [length, setLength] = useState(0);
  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const measure = () => setLength(Math.max(0, region.getBoundingClientRect()[orientation === 'desktop' ? 'height' : 'width'] - 4));
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(region);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [regionRef, orientation]);
  return length;
}

export function useDesktopHealthBarAxisLength(regionRef: RefObject<HTMLDivElement | null>) {
  return useHealthBarAxisLength(regionRef, 'desktop');
}

export function useMobileHealthBarAxisLength(regionRef: RefObject<HTMLDivElement | null>) {
  return useHealthBarAxisLength(regionRef, 'mobile');
}

export function useHealthBarLegend(
  presentation: SessionHealthBarPresentation | null, length: number, orientation: HealthBarOrientation = 'desktop',
) {
  const sequence = presentation?.sequence;
  const transition = useMemo(() => sequence ? prepareHealthBarLegendTransition(
    sequence.previousScales[orientation], sequence.scales[orientation], orientation, length,
  ) : null, [sequence, length, orientation]);
  return transition && presentation
    ? sampleHealthBarLegendTransition(transition, presentation.scale, presentation.scaleProgress) : undefined;
}

export function useDesktopHealthBarLegend(presentation: SessionHealthBarPresentation | null, length: number) {
  return useHealthBarLegend(presentation, length, 'desktop');
}
