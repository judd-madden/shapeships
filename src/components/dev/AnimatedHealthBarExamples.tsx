import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ResolvedHealthSnapshot } from '../../game/client/gameSession/types';
import { HealthBarPair } from '../../game/display/healthBars/HealthBar';
import { HEALTH_BAR_ANIMATION_CONFIG, HEALTH_BAR_ANIMATION_DEV_CONFIG, healthBarEasing } from '../../game/display/healthBars/healthBarAnimationConfig';
import { browserHealthBarScheduler, createHealthBarAnimationController, type HealthBarAnimationScheduler, type HealthBarPlaybackState } from '../../game/display/healthBars/healthBarAnimationController';
import { prepareHealthBarScale, type HealthBarOrientation } from '../../game/display/healthBars/healthBarScale';
import { interpolateHealthBarScale, prepareHealthBarLegendTransition, sampleHealthBarLegendTransition, type HealthBarScales } from '../../game/display/healthBars/healthBarScaleTransition';
import { useHealthBarAnimation } from '../../game/display/healthBars/useHealthBarAnimation';
import { formatHealthChange } from '../../game/display/layout/boardStage/healthBreakdownPresentation';
import { HEALTH_BAR_EXAMPLES, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS } from './healthBarExampleFixtures';

export const HEALTH_BAR_SCALE_DEMO_ID = 'scale-change';
const orientations = ['desktop', 'mobile'] as const;
const identity = { gameId: 'health-scale-demo', viewerId: 'a', viewerRole: 'player' as const, leftPlayerId: 'a', rightPlayerId: 'b' };
const scaleDemoSnapshot: ResolvedHealthSnapshot = {
  identity, continuityKey: 'health-scale-demo', presentationKey: 'health-scale-demo', resolvedTurnNumber: 1,
  source: 'poll', eligibility: 'live', outcome: { isTerminal: false, winnerPlayerId: null, resultReason: null },
  left: { playerId: 'a', startHealth: 25, damageTaken: 325, damageStageHealth: -300, grossHealingReceived: 325, finalHealth: 25, actualNetDelta: 0, maxHealth: 35 },
  right: { playerId: 'b', startHealth: 20, damageTaken: 0, damageStageHealth: 20, grossHealingReceived: 0, finalHealth: 20, actualNetDelta: 0, maxHealth: 50 },
};
function scaleDemoScales(expanded: boolean): HealthBarScales {
  const context = { identity, continuityKey: scaleDemoSnapshot.continuityKey };
  const prepare = (orientation: HealthBarOrientation) => prepareHealthBarScale(expanded
    ? { mode: 'live', snapshot: scaleDemoSnapshot }
    : { mode: 'settled', identity, outcome: scaleDemoSnapshot.outcome,
      left: { playerId: 'a', health: 25, maxHealth: 35 }, right: { playerId: 'b', health: 20, maxHealth: 50 } },
  context, { orientation })!;
  return Object.freeze({ desktop: prepare('desktop'), mobile: prepare('mobile') });
}
const narrowScales = scaleDemoScales(false);
const expandedScales = scaleDemoScales(true);
interface ScaleDemoFrame {
  readonly from: HealthBarScales;
  readonly to: HealthBarScales;
  readonly scales: HealthBarScales;
  readonly progress: number;
}
interface GalleryState {
  readonly selectedId: string | null;
  readonly playing: boolean;
  readonly scaleDemo: ScaleDemoFrame | null;
}

/** Development ownership only. A single selection owns either playback, a hold, or scale motion. */
export function createAnimatedHealthBarGallery(scheduler: HealthBarAnimationScheduler = browserHealthBarScheduler) {
  const controller = createHealthBarAnimationController({ scheduler });
  const listeners = new Set<() => void>();
  let state: GalleryState = { selectedId: null, playing: false, scaleDemo: null };
  let generation = 0;
  let handle: number | null = null;
  let motionEnabled = true;
  let handledCompletion: HealthBarPlaybackState['completion'] = null;
  const publish = (next: GalleryState) => { state = next; for (const listener of listeners) listener(); };
  const cancel = () => {
    generation += 1;
    if (handle !== null) scheduler.cancel(handle);
    handle = null;
  };
  const request = (callback: () => void) => {
    const token = generation;
    handle = scheduler.request(() => {
      if (token !== generation || !state.playing) return;
      handle = null;
      callback();
    });
  };
  const hold = (callback: () => void) => {
    const until = scheduler.now() + HEALTH_BAR_ANIMATION_DEV_CONFIG.completedHoldMs;
    const tick = () => {
      if (scheduler.now() >= until) callback();
      else request(tick);
    };
    request(tick);
  };
  const playScenario = () => {
    const example = HEALTH_BAR_EXAMPLES.find((item) => item.id === state.selectedId);
    if (!example || example.presentation.mode !== 'live') return;
    handledCompletion = null;
    controller.reset(); // Explicit development replay; never caused by candidate release.
    controller.updateContext(example.presentation.snapshot);
    controller.accept(example.presentation.snapshot, example.scales);
  };
  controller.subscribe(() => {
    const completion = controller.getSnapshot().completion;
    if (!state.playing || state.selectedId === HEALTH_BAR_SCALE_DEMO_ID || !completion || completion === handledCompletion) return;
    handledCompletion = completion;
    hold(playScenario);
  });
  const playScaleLeg = (expand: boolean) => {
    const from = expand ? narrowScales : expandedScales;
    const to = expand ? expandedScales : narrowScales;
    const start = scheduler.now();
    const tick = () => {
      const progress = motionEnabled && HEALTH_BAR_ANIMATION_CONFIG.scaleTransitionMs > 0
        ? healthBarEasing(Math.min(1, (scheduler.now() - start) / HEALTH_BAR_ANIMATION_CONFIG.scaleTransitionMs)) : 1;
      publish({ ...state, scaleDemo: { from, to, progress, scales: {
        desktop: interpolateHealthBarScale(from.desktop, to.desktop, progress),
        mobile: interpolateHealthBarScale(from.mobile, to.mobile, progress),
      } } });
      if (!state.playing) return;
      if (progress === 1) hold(() => playScaleLeg(!expand));
      else request(tick);
    };
    tick();
  };
  const stop = () => {
    cancel();
    publish({ ...state, playing: false, scaleDemo: state.scaleDemo
      ? { ...state.scaleDemo, scales: state.scaleDemo.to, progress: 1 } : null });
    controller.stop();
  };
  return {
    controller,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    select(id: string) {
      if (id !== HEALTH_BAR_SCALE_DEMO_ID && !HEALTH_BAR_EXAMPLES.some((item) => item.id === id)) return;
      if (state.selectedId === id && state.playing) { stop(); return; }
      stop();
      controller.reset();
      publish({ selectedId: id, playing: true, scaleDemo: null });
      if (id === HEALTH_BAR_SCALE_DEMO_ID) playScaleLeg(true);
      else playScenario();
    },
    setMotionEnabled(enabled: boolean) { motionEnabled = enabled; controller.setMotionEnabled(enabled); },
    stop,
    dispose() { stop(); controller.dispose(); listeners.clear(); },
  };
}

function AnimatedPreview({ playback, scaleDemo }: { readonly playback: HealthBarPlaybackState; readonly scaleDemo: ScaleDemoFrame | null }) {
  const sequence = playback.sequence;
  const frame = playback.frame;
  // Resize may reselect endpoint label sets; no frame-by-frame tick selection.
  const legends = useMemo(() => Object.fromEntries(orientations.map((orientation) => [orientation,
    sequence ? prepareHealthBarLegendTransition(sequence.previousScales[orientation], sequence.scales[orientation],
      orientation, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]) : null,
  ])), [sequence]);
  const scaleLegends = useMemo(() => Object.fromEntries(orientations.map((orientation) => [orientation,
    scaleDemo ? prepareHealthBarLegendTransition(scaleDemo.from[orientation], scaleDemo.to[orientation],
      orientation, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]) : null,
  ])), [scaleDemo?.from, scaleDemo?.to]);
  if (!frame && !scaleDemo) return null;
  return <div className="flex flex-wrap items-start gap-[40px] overflow-x-auto px-[16px] py-[20px]">
    {orientations.map((orientation) => {
      const scale = scaleDemo?.scales[orientation] ?? frame!.scales[orientation];
      const transition = scaleDemo ? scaleLegends[orientation] : frame?.stage === 'scale' ? legends[orientation] : null;
      const progress = scaleDemo?.progress ?? frame!.scaleProgress;
      return <div key={orientation} className="flex flex-col gap-[16px]">
        <p className="text-[12px] text-[var(--shapeships-grey-50)]">
          {orientation === 'desktop' ? 'Desktop: A left / B right' : 'Mobile: A upper / B lower'}<br />
          Example inner axis: {HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]}px
        </p>
        <HealthBarPair scale={scale} orientation={orientation} axisLength={HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]}
          left={scaleDemo ? { health: 25 } : frame!.left} right={scaleDemo ? { health: 20 } : frame!.right}
          leftLabel="Player A" rightLabel="Player B"
          legendLabels={transition ? sampleHealthBarLegendTransition(transition, scale, progress) : undefined} />
      </div>;
    })}
  </div>;
}

export function AnimatedHealthBarExamples() {
  const [gallery] = useState(() => createAnimatedHealthBarGallery());
  const state = useSyncExternalStore(gallery.subscribe, gallery.getSnapshot, gallery.getSnapshot);
  const playback = useHealthBarAnimation(gallery.controller);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => gallery.setMotionEnabled(!media.matches);
    update();
    media.addEventListener('change', update);
    // Stop cancels work and remains safe across React's development effect reattachment.
    return () => { media.removeEventListener('change', update); gallery.stop(); };
  }, [gallery]);
  const rows = [...HEALTH_BAR_EXAMPLES.map(({ id, name }) => ({ id, name })),
    { id: HEALTH_BAR_SCALE_DEMO_ID, name: 'Scale change: expansion / contraction (A 25, B 20 unchanged)' }];
  const selected = HEALTH_BAR_EXAMPLES.find((example) => example.id === state.selectedId);
  const source = selected?.presentation.mode === 'live' ? selected.presentation.snapshot : null;
  return <section aria-labelledby="animated-health-bars-title" className="bg-black p-[20px] text-white">
    <h2 id="animated-health-bars-title" className="mb-[12px] text-[20px]">Animated Health Bars</h2>
    <p className="mb-[16px] text-[12px] text-[var(--shapeships-grey-50)]">
      One active example. Desktop and mobile share playback. Stop settles to final health. Completed examples hold their deltas before replay.
    </p>
    <div className="flex flex-col gap-[8px]">
      {rows.map((row) => <div key={row.id} className="flex items-center gap-[12px] text-[14px]">
        <button type="button" aria-label={`${state.playing && state.selectedId === row.id ? 'Stop' : 'Play'} ${row.name}`}
          aria-pressed={state.playing && state.selectedId === row.id} onClick={() => gallery.select(row.id)}
          className="border border-[var(--shapeships-grey-50)] bg-[var(--shapeships-grey-90)] px-[12px] py-[4px]">
          {state.playing && state.selectedId === row.id ? 'Stop' : 'Play'}
        </button><span>{row.name}</span>
      </div>)}
    </div>
    {state.selectedId && <>
      {source && <div className="mt-[16px] text-[12px] text-[var(--shapeships-grey-50)]">
        {[source.left, source.right].map((side, index) => <p key={side.playerId}>
          Player {index === 0 ? 'A' : 'B'}: start {side.startHealth}, damage {side.damageTaken}, healing {side.grossHealingReceived}, final {side.finalHealth}, cap {side.maxHealth}
        </p>)}
      </div>}
      <p className="mt-[16px] text-[12px] text-[var(--shapeships-grey-50)]">
        {state.scaleDemo ? 'Scale changes only; logical health remains A 25 / B 20.' : `Stage: ${playback.frame?.stage ?? 'ready'}`}
      </p>
      {!state.scaleDemo && <p className="mt-[8px] min-h-[20px] text-[14px]" aria-live="polite">
        {playback.deltasVisible && playback.deltas
          ? `Net delta: A ${formatHealthChange(playback.deltas.left)} / B ${formatHealthChange(playback.deltas.right)}` : null}
      </p>}
      <AnimatedPreview playback={playback} scaleDemo={state.scaleDemo} />
    </>}
  </section>;
}
