import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type {
  ResolvedHealthCompletionIdentity, ResolvedHealthPresentation, ResolvedHealthSessionPresentation,
} from '../../client/gameSession/types';
import { getResolvedHealthIdentityKey } from '../../client/gameSession/resolvedHealth';
import {
  createHealthBarAnimationController, type HealthBarAnimationController,
  type HealthBarAnimationScheduler, type HealthBarPlaybackState,
} from './healthBarAnimationController';
import { prepareHealthBarScale, type PreparedHealthBarScale } from './healthBarScale';
import { settledHealthBarState } from './healthBarSequence';
import type { HealthBarPresentationState } from './healthBarPresentation';
import {
  prepareHealthBarLegendTransition, sampleHealthBarLegendTransition,
  type HealthBarScales,
} from './healthBarScaleTransition';
import { useHealthBarAnimation } from './useHealthBarAnimation';

export interface SessionHealthBarPresentation {
  readonly scale: Readonly<PreparedHealthBarScale>;
  readonly left: HealthBarPresentationState;
  readonly right: HealthBarPresentationState;
  readonly sequence: HealthBarPlaybackState['sequence'];
  readonly scaleProgress: number;
  readonly numbers: Readonly<{ left: number; right: number }>;
  readonly presentationComplete: boolean;
  readonly delta: { readonly left: number; readonly right: number; readonly visible: boolean; readonly key: string } | null;
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
): HealthBarScales | null {
  if (!session || !presentation) return null;
  const desktop = prepareHealthBarScale(presentation, session, { orientation: 'desktop' });
  const mobile = prepareHealthBarScale(presentation, session, { orientation: 'mobile' });
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
  if (current && playback.frame && (!playback.presentationCompletion || retainsCompleted || settledMatchesPlayback(playback, session))) {
    return {
      scale: playback.frame.scales.desktop, left: playback.frame.left, right: playback.frame.right,
      sequence: playback.sequence, scaleProgress: playback.frame.scaleProgress,
      delta, numbers: playback.numbers!, presentationComplete: playback.presentationCompletion !== null,
    };
  }
  const settled = session.settled;
  const scale = settled && prepareHealthBarScale(settled, session, { orientation: 'desktop' });
  return settled && scale ? {
    scale, left: settledHealthBarState(settled.left.health), right: settledHealthBarState(settled.right.health),
    sequence: null, scaleProgress: 1, delta,
    numbers: { left: settled.left.health, right: settled.right.health }, presentationComplete: true,
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
) {
  controller.updateContext(session ?? null);
  const candidate = canAccept && presentation?.mode === 'live' && session &&
    matchesSession(presentation.snapshot, session) &&
    presentation.snapshot.resolvedTurnNumber >= (session.observedResolvedTurnNumber ?? 0)
    ? presentation.snapshot : null;
  const owned = controller.getSnapshot().sequence?.snapshot;
  const scales = candidate && (!owned || candidate.resolvedTurnNumber > owned.resolvedTurnNumber)
    ? prepareSessionHealthBarScales({ mode: 'live', snapshot: candidate }, session) : null;
  if (candidate && scales) controller.accept(candidate, scales);
  const state = controller.getSnapshot();
  if (session && state.sequence) {
    if ((session.observedResolvedTurnNumber ?? 0) > state.sequence.snapshot.resolvedTurnNumber) controller.invalidate();
    else if (state.presentationCompletion && session.settled &&
      session.settledIncludesLiveResolution !== false &&
      !settledHealthMatchesPlayback(state, session)) {
      supersededHealthDeltas.add(state.sequence);
    }
  }
}

export function useSessionHealthBarPresentation(input: {
  presentation: ResolvedHealthPresentation | null | undefined;
  session: ResolvedHealthSessionPresentation | null | undefined;
  canAccept: boolean;
  onComplete: (completion: ResolvedHealthCompletionIdentity) => void;
  scheduler?: HealthBarAnimationScheduler;
}) {
  const [controller] = useState(() => createHealthBarAnimationController({
    scheduler: input.scheduler, animateSettledNumbers: true,
  }));
  const lease = useRef(0);
  const playback = useHealthBarAnimation(controller);
  const [, commitCapture] = useState(0);
  const onComplete = useRef(input.onComplete);
  onComplete.current = input.onComplete;

  useLayoutEffect(() => {
    const release = attachSessionHealthBarController(controller, lease);
    const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const update = () => controller.setMotionEnabled(!media?.matches);
    update();
    media?.addEventListener?.('change', update);
    return () => { media?.removeEventListener?.('change', update); release(); };
  }, [controller]);

  useLayoutEffect(() => {
    syncSessionHealthBarController(controller, input.presentation, input.session, input.canAccept);
    // Acceptance can precede the external-store subscription on its first commit.
    // Publish the captured starting frame before paint, including its hidden deltas.
    if (controller.getSnapshot() !== playback) commitCapture((revision) => revision + 1);
  }, [controller, input.presentation, input.session, input.canAccept, playback.presentationCompletion]);

  useEffect(() => {
    const completion = playback.presentationCompletion;
    if (completion && input.session && matchesSession(completion, input.session) &&
      controller.getSnapshot().presentationCompletion === completion &&
      completion.resolvedTurnNumber >= (input.session.observedResolvedTurnNumber ?? 0)) onComplete.current(completion);
  }, [controller, playback.presentationCompletion, input.session]);

  return selectSessionHealthBarPresentation(playback, input.presentation, input.session);
}

export function useDesktopHealthBarAxisLength(regionRef: RefObject<HTMLDivElement | null>) {
  const [length, setLength] = useState(0);
  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const measure = () => setLength(Math.max(0, region.getBoundingClientRect().height - 4));
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(region);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [regionRef]);
  return length;
}

export function useDesktopHealthBarLegend(presentation: SessionHealthBarPresentation | null, length: number) {
  const sequence = presentation?.sequence;
  const transition = useMemo(() => sequence ? prepareHealthBarLegendTransition(
    sequence.previousScales.desktop, sequence.scales.desktop, 'desktop', length,
  ) : null, [sequence, length]);
  return transition && presentation
    ? sampleHealthBarLegendTransition(transition, presentation.scale, presentation.scaleProgress) : undefined;
}
