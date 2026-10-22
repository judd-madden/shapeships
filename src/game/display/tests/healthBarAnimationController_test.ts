import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnimatedHealthBarExamples, createAnimatedHealthBarGallery, HEALTH_BAR_SCALE_DEMO_ID } from '../../../components/dev/AnimatedHealthBarExamples';
import { HEALTH_BAR_EXAMPLES } from '../../../components/dev/healthBarExampleFixtures';
import type { ResolvedHealthSnapshot } from '../../client/gameSession/types';
import { createHealthBarAnimationController, type HealthBarAnimationScheduler, type HealthBarCompletion } from '../healthBars/healthBarAnimationController';
import { HEALTH_BAR_ANIMATION_CONFIG, HEALTH_BAR_ANIMATION_DEV_CONFIG } from '../healthBars/healthBarAnimationConfig';
import { prepareHealthBarScale } from '../healthBars/healthBarScale';

function clock() {
  let time = 0;
  let serial = 0;
  const pending = new Map<number, () => void>();
  const scheduler: HealthBarAnimationScheduler = {
    now: () => time,
    request: (callback) => { const id = ++serial; pending.set(id, callback); return id; },
    cancel: (id) => { pending.delete(id); },
  };
  return { scheduler, pending,
    advance(ms: number) {
      time += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}
function candidate(id = 'ordinary', turn = 1) {
  const example = HEALTH_BAR_EXAMPLES.find((item) => item.id === id)!;
  if (example.presentation.mode !== 'live') throw new Error('Expected live fixture');
  const snapshot: ResolvedHealthSnapshot = JSON.parse(JSON.stringify(example.presentation.snapshot));
  const source = { ...snapshot, resolvedTurnNumber: turn, presentationKey: `${id}-resolution-${turn}` };
  const prepare = (orientation: 'desktop' | 'mobile') =>
    prepareHealthBarScale({ mode: 'live', snapshot: source }, source, { orientation })!;
  return { snapshot: source, scales: { desktop: prepare('desktop'), mobile: prepare('mobile') } };
}

describe('desktop settled-number tail', () => {
  for (const id of ['ordinary', 'negative-final', 'recovery', 'overheal', 'excess-healing']) {
    it(`${id}: counts monotonically to exact finals, skipping unchanged sides`, () => {
      const time = clock();
      const completed = [] as HealthBarCompletion[];
      const controller = createHealthBarAnimationController({ scheduler: time.scheduler, animateSettledNumbers: true,
        onComplete: (value) => completed.push(value) });
      const { snapshot, scales } = candidate(id);
      controller.accept(snapshot, scales);
      time.advance(controller.getSnapshot().sequence!.durationMs);
      const changed = snapshot.left.startHealth !== snapshot.left.finalHealth || snapshot.right.startHealth !== snapshot.right.finalHealth;
      const boundary = controller.getSnapshot();
      expect(boundary.deltasVisible).toBe(true);
      expect(boundary.presentationCompletion !== null).toBe(!changed);
      expect(completed).toHaveLength(1);
      let previous = boundary.numbers!;
      for (let step = 0; step < 10; step += 1) {
        time.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 10);
        const next = controller.getSnapshot().numbers!;
        for (const side of ['left', 'right'] as const) {
          const { startHealth, finalHealth } = snapshot[side];
          expect(next[side]).toBeGreaterThanOrEqual(Math.min(startHealth, finalHealth));
          expect(next[side]).toBeLessThanOrEqual(Math.max(startHealth, finalHealth));
          expect(Math.abs(next[side] - finalHealth)).toBeLessThanOrEqual(Math.abs(previous[side] - finalHealth));
          if (startHealth === finalHealth) expect(next[side]).toBe(finalHealth);
        }
        previous = next;
      }
      expect(previous).toEqual({ left: snapshot.left.finalHealth, right: snapshot.right.finalHealth });
      expect(controller.getSnapshot().presentationCompletion?.reason).toBe('finished');
      expect(controller.getSnapshot().completion).toBe(boundary.completion);
      expect(controller.getSnapshot().frame).toBe(boundary.frame);
      expect(completed).toHaveLength(1);
      expect(time.pending.size).toBe(0);
    });
  }

  for (const action of ['supersede', 'recover', 'invalidate', 'reset', 'dispose', 'reduce-motion', 'stop'] as const) {
    it(`cancels stale number callbacks on ${action}`, () => {
      const time = clock();
      const controller = createHealthBarAnimationController({ scheduler: time.scheduler, animateSettledNumbers: true });
      const first = candidate();
      controller.accept(first.snapshot, first.scales);
      time.advance(controller.getSnapshot().sequence!.durationMs + 100);
      expect(controller.getSnapshot().presentationCompletion).toBeNull();
      const stale = [...time.pending.values()][0];
      if (action === 'supersede') {
        const next = candidate('ordinary', 2);
        controller.accept(next.snapshot, next.scales);
      } else if (action === 'recover') controller.updateContext({ ...first.snapshot, continuityKey: 'recovered' });
      else if (action === 'reduce-motion') controller.setMotionEnabled(false);
      else controller[action]();
      const current = controller.getSnapshot();
      stale();
      expect(controller.getSnapshot()).toBe(current);
      expect(time.pending.size).toBe(action === 'supersede' ? 1 : 0);
      if (action === 'reduce-motion' || action === 'stop') {
        expect(current.numbers).toEqual({ left: first.snapshot.left.finalHealth, right: first.snapshot.right.finalHealth });
        expect(current.presentationCompletion?.reason).toBe(action === 'stop' ? 'stopped' : 'motion-disabled');
      }
    });
  }

  it('catches up a delayed frame without scheduling a number backlog', () => {
    const time = clock();
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler, animateSettledNumbers: true });
    const input = candidate(); controller.accept(input.snapshot, input.scales);
    time.advance(100000);
    expect(controller.getSnapshot().presentationCompletion).not.toBeNull();
    expect(time.pending.size).toBe(0);
  });
});

describe('captured health-bar playback ownership', () => {
  it('does not replay or cancel on duplicate delivery, rerender subscriptions or source release', () => {
    const time = clock();
    const completed: HealthBarCompletion[] = [];
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler, onComplete: (value) => completed.push(value) });
    const input = candidate();
    expect(controller.accept(input.snapshot, input.scales)).toBe(true);
    const sequence = controller.getSnapshot().sequence;
    const unsubscribe = controller.subscribe(() => {});
    time.advance(200);
    expect(controller.accept(input.snapshot, input.scales)).toBe(false);
    expect(controller.accept(null)).toBe(false);
    expect(controller.accept(undefined)).toBe(false);
    unsubscribe();
    expect(controller.getSnapshot().sequence).toBe(sequence);
    expect(time.pending.size).toBe(1);
    expect(controller.getSnapshot().deltasVisible).toBe(false);
    time.advance(sequence!.durationMs);
    expect(completed).toHaveLength(1);
    expect(controller.getSnapshot().completion!.presentationKey).toBe(input.snapshot.presentationKey);
    expect(controller.getSnapshot().deltasVisible).toBe(true);
    expect(controller.getSnapshot().deltas).toEqual({ left: -6, right: 15 });
    expect(controller.accept(input.snapshot, input.scales)).toBe(false);
    expect(time.pending.size).toBe(0);
  });

  it('captures immutable contributions, caps, actual deltas, outcome and identity', () => {
    const time = clock();
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
    const input = candidate('excess-healing');
    controller.accept(input.snapshot, input.scales);
    const captured = controller.getSnapshot().sequence!.snapshot;
    (input.snapshot.left as { finalHealth: number }).finalHealth = 999;
    (input.snapshot.left as { actualNetDelta: number }).actualNetDelta = 999;
    (input.snapshot.identity as { gameId: string }).gameId = 'changed-dto';
    expect(captured.left.finalHealth).toBe(35);
    expect(captured.identity.gameId).not.toBe('changed-dto');
    expect(Object.isFrozen(captured.left)).toBe(true);
    expect(Object.isFrozen(controller.getSnapshot().sequence!.scales.desktop.leftCap)).toBe(true);
    time.advance(100000);
    // Actual capped change is zero, even though gross healing minus damage is 99.
    expect(controller.getSnapshot().deltas).toEqual({ left: 0, right: 10 });
    expect(controller.getSnapshot().frame!.left.health).toBe(35);
  });

  it('reveals both deltas only after surplus return and holds completion stable', () => {
    const time = clock();
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
    const input = candidate('overheal');
    controller.accept(input.snapshot, input.scales);
    const duration = controller.getSnapshot().sequence!.durationMs;
    time.advance(duration - 1);
    expect(controller.getSnapshot().frame!.stage).toBe('surplus-return');
    expect(controller.getSnapshot().completion).toBeNull();
    expect(controller.getSnapshot().deltasVisible).toBe(false);
    time.advance(1);
    const completed = controller.getSnapshot();
    expect(completed.deltasVisible).toBe(true);
    time.advance(100000);
    expect(controller.getSnapshot()).toBe(completed);
  });

  it('supersedes without backlog, rejects old turns and blocks stale completion callbacks', () => {
    const time = clock();
    const completed: HealthBarCompletion[] = [];
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler, onComplete: (value) => completed.push(value) });
    const old = candidate();
    controller.accept(old.snapshot, old.scales);
    const stale = [...time.pending.values()][0];
    const next = candidate('ordinary', 2);
    expect(controller.accept(next.snapshot, next.scales)).toBe(true);
    const current = controller.getSnapshot();
    stale();
    expect(controller.getSnapshot()).toBe(current);
    expect(controller.accept(old.snapshot, old.scales)).toBe(false);
    time.advance(100000);
    expect(completed.map((value) => value.resolvedTurnNumber)).toEqual([2]);
    expect(time.pending.size).toBe(0);
  });

  it('rejects mismatched prepared scales without interrupting accepted playback', () => {
    const time = clock();
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
    const first = candidate();
    const second = candidate('ordinary', 2);
    controller.accept(first.snapshot, first.scales);
    const state = controller.getSnapshot();
    expect(() => controller.accept(second.snapshot, first.scales)).toThrow('matching complete prepared scales');
    expect(controller.getSnapshot()).toBe(state);
    expect(time.pending.size).toBe(1);
  });

  it('cannot emit an obsolete completion if a subscriber resets ownership at completion', () => {
    const time = clock();
    const completed: HealthBarCompletion[] = [];
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler, onComplete: (value) => completed.push(value) });
    const input = candidate();
    controller.accept(input.snapshot, input.scales);
    controller.subscribe(() => {
      if (controller.getSnapshot().completion) controller.updateContext(null);
    });
    time.advance(100000);
    expect(completed).toHaveLength(0);
    expect(controller.getSnapshot().sequence).toBeNull();
    expect(time.pending.size).toBe(0);
  });

  it('retains settled scales until preparing a new resolution, permitting contraction', () => {
    const time = clock();
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
    const first = candidate('recovery');
    controller.accept(first.snapshot, first.scales);
    time.advance(100000);
    const retained = controller.getSnapshot().sequence!.scales;
    const secondSnapshot = { ...first.snapshot, resolvedTurnNumber: 2, presentationKey: 'recovered-next',
      left: { ...first.snapshot.left, startHealth: 23, damageTaken: 0, damageStageHealth: 23, finalHealth: 23, grossHealingReceived: 0, actualNetDelta: 0 },
      right: { ...first.snapshot.right, startHealth: 25, damageTaken: 0, damageStageHealth: 25, finalHealth: 25, grossHealingReceived: 0, actualNetDelta: 0 } };
    const prep = (orientation: 'desktop' | 'mobile') => prepareHealthBarScale({ mode: 'live', snapshot: secondSnapshot }, secondSnapshot, { orientation })!;
    controller.accept(secondSnapshot, { desktop: prep('desktop'), mobile: prep('mobile') });
    const current = controller.getSnapshot().sequence!;
    expect(current.previousScales.desktop.domainMin).toBe(retained.desktop.domainMin);
    expect(current.scales.desktop.domainMin).toBe(0);
    expect(current.stages.map((stage) => stage.name)).toEqual(['scale']);
    expect(controller.getSnapshot().frame!.left.health).toBe(23);
  });

  it('context change/reset/disposal invalidate callbacks and clear captured completion', () => {
    const time = clock();
    const completed: HealthBarCompletion[] = [];
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler, onComplete: (value) => completed.push(value) });
    const input = candidate();
    controller.accept(input.snapshot, input.scales);
    const stale = [...time.pending.values()][0];
    const another = candidate('recovery');
    controller.updateContext(another.snapshot);
    stale();
    expect(controller.getSnapshot().sequence).toBeNull();
    expect(controller.accept(input.snapshot, input.scales)).toBe(false);
    controller.accept(another.snapshot, another.scales);
    controller.reset();
    expect(time.pending.size).toBe(0);
    expect(controller.getSnapshot().completion).toBeNull();
    controller.accept(another.snapshot, another.scales);
    const late = [...time.pending.values()][0];
    controller.dispose();
    late();
    expect(completed).toHaveLength(0);
    expect(controller.accept(another.snapshot, another.scales)).toBe(false);
  });

  it('Stop completes once at captured finals and preserves deduplication', () => {
    const time = clock();
    const completed: HealthBarCompletion[] = [];
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler, onComplete: (value) => completed.push(value) });
    const input = candidate('negative-final');
    controller.accept(input.snapshot, input.scales);
    const stale = [...time.pending.values()][0];
    controller.stop();
    stale();
    controller.stop();
    expect(controller.getSnapshot().frame!.left).toEqual({ health: -13, red: { from: -13, to: 0 } });
    expect(controller.getSnapshot().deltasVisible).toBe(true);
    expect(completed.map((value) => value.reason)).toEqual(['stopped']);
    expect(controller.accept(input.snapshot, input.scales)).toBe(false);
  });

  it('invalidates the owner for viewer, role, player order and continuity changes', () => {
    for (const change of [
      { viewerId: 'another-viewer' }, { viewerRole: 'spectator' as const },
      { leftPlayerId: 'b', rightPlayerId: 'a' },
    ]) {
      const time = clock();
      const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
      const input = candidate();
      controller.accept(input.snapshot, input.scales);
      const stale = [...time.pending.values()][0];
      controller.updateContext({ ...input.snapshot, identity: { ...input.snapshot.identity, ...change } });
      stale();
      expect(controller.getSnapshot().sequence).toBeNull();
      expect(controller.accept(input.snapshot, input.scales)).toBe(false);
      expect(time.pending.size).toBe(0);
    }
    const time = clock();
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
    const input = candidate();
    controller.accept(input.snapshot, input.scales);
    controller.updateContext({ ...input.snapshot, continuityKey: 'recovery-2' });
    expect(controller.getSnapshot().sequence).toBeNull();
    expect(time.pending.size).toBe(0);
  });

  it('samples delayed/background frames directly and handles disabled/reduced motion safely', () => {
    const time = clock();
    const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
    const input = candidate('compression');
    controller.accept(input.snapshot, input.scales);
    time.advance(2000);
    expect(controller.getSnapshot().frame!.elapsedMs).toBe(2000);
    time.advance(3600000);
    expect(controller.getSnapshot().frame!.complete).toBe(true);
    expect(time.pending.size).toBe(0);
    controller.reset();
    controller.setMotionEnabled(false);
    controller.accept(input.snapshot, input.scales);
    expect(controller.getSnapshot().completion!.reason).toBe('motion-disabled');
    expect(time.pending.size).toBe(0);
    controller.reset();
    controller.setMotionEnabled(true);
    controller.accept(input.snapshot, input.scales);
    controller.setMotionEnabled(false);
    expect(controller.getSnapshot().frame!.complete).toBe(true);
    expect(time.pending.size).toBe(0);
  });
});

describe('single-owner animated development gallery', () => {
  it('renders nine scenario buttons plus a separate scale demonstration, initially idle', () => {
    const gallery = createAnimatedHealthBarGallery(clock().scheduler);
    expect(gallery.getSnapshot()).toEqual({ selectedId: null, playing: false, scaleDemo: null });
    const markup = renderToStaticMarkup(createElement(AnimatedHealthBarExamples));
    expect(markup.match(/<button/g)).toHaveLength(10);
    expect(markup).toContain('Animated Health Bars');
    expect(markup).not.toContain('data-health-pair=');
  });

  it('holds completed deltas before explicit replay, and never catches up missed cycles', () => {
    const time = clock();
    const gallery = createAnimatedHealthBarGallery(time.scheduler);
    gallery.select('overheal');
    time.advance(3600000);
    const completed = gallery.controller.getSnapshot();
    expect(completed.deltasVisible).toBe(true);
    expect(time.pending.size).toBe(1);
    time.advance(HEALTH_BAR_ANIMATION_DEV_CONFIG.completedHoldMs - 1);
    expect(gallery.controller.getSnapshot()).toBe(completed);
    time.advance(1);
    expect(gallery.controller.getSnapshot().deltasVisible).toBe(false);
    expect(gallery.controller.getSnapshot().sequence).not.toBe(completed.sequence);
    expect(time.pending.size).toBe(1);
  });

  it('switches exclusively and cancels previous playback and hold callbacks', () => {
    const time = clock();
    const gallery = createAnimatedHealthBarGallery(time.scheduler);
    gallery.select('ordinary');
    const staleFrame = [...time.pending.values()][0];
    gallery.select('overheal');
    const current = gallery.controller.getSnapshot();
    staleFrame();
    expect(gallery.controller.getSnapshot()).toBe(current);
    expect(time.pending.size).toBe(1);
    time.advance(100000);
    const staleHold = [...time.pending.values()][0];
    gallery.select('negative-final');
    staleHold();
    expect(gallery.getSnapshot().selectedId).toBe('negative-final');
    expect(gallery.controller.getSnapshot().sequence!.snapshot.left.finalHealth).toBe(-13);
    expect(time.pending.size).toBe(1);
    gallery.select('negative-final'); // Same scenario's Stop button.
    expect(gallery.getSnapshot().playing).toBe(false);
    expect(gallery.controller.getSnapshot().deltasVisible).toBe(true);
    expect(time.pending.size).toBe(0);
  });

  it('shares scale progress across both previews, contracts, and cancels on scenario switch/unmount', () => {
    const time = clock();
    const gallery = createAnimatedHealthBarGallery(time.scheduler);
    gallery.select(HEALTH_BAR_SCALE_DEMO_ID);
    expect(gallery.controller.getSnapshot().sequence).toBeNull();
    time.advance(175);
    const expansion = gallery.getSnapshot().scaleDemo!;
    expect(expansion.progress).toBeCloseTo(0.5);
    expect(expansion.scales.desktop.zeroPosition).toBe(expansion.scales.mobile.zeroPosition);
    time.advance(175);
    expect(gallery.getSnapshot().scaleDemo!.scales.desktop.domainMin).toBe(-300);
    time.advance(HEALTH_BAR_ANIMATION_DEV_CONFIG.completedHoldMs);
    time.advance(350);
    expect(gallery.getSnapshot().scaleDemo!.scales.desktop.domainMin).toBe(0);
    gallery.select('ordinary');
    expect(gallery.getSnapshot().scaleDemo).toBeNull();
    const stale = [...time.pending.values()][0];
    gallery.dispose();
    stale();
    expect(time.pending.size).toBe(0);
    expect(gallery.getSnapshot().playing).toBe(false);
  });
});
