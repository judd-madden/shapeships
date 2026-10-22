import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResolvedHealthSnapshot, ResolvedHealthSessionPresentation } from '../../client/gameSession/types';
import { createHealthBarAnimationController, type HealthBarAnimationScheduler } from '../healthBars/healthBarAnimationController';
import { HealthBarPair } from '../healthBars/HealthBar';
import { calculateHealthBarGeometry } from '../healthBars/healthBarPresentation';
import { prepareHealthBarLegendTransition, sampleHealthBarLegendTransition } from '../healthBars/healthBarScaleTransition';
import {
  attachSessionHealthBarController, selectSessionHealthBarPresentation, syncSessionHealthBarController,
} from '../healthBars/useSessionHealthBarPresentation';

function clock() {
  let now = 0;
  let id = 0;
  const pending = new Map<number, () => void>();
  const scheduler: HealthBarAnimationScheduler = { now: () => now,
    request: (callback) => { pending.set(++id, callback); return id; }, cancel: (key) => { pending.delete(key); } };
  return { scheduler, pending, advance(ms: number) {
    now += ms;
    const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach((callback) => callback());
  } };
}
function facts(turn = 3): ResolvedHealthSnapshot {
  return {
    identity: { gameId: 'g', viewerId: 'p2', viewerRole: 'player', leftPlayerId: 'p2', rightPlayerId: 'p1' },
    continuityKey: 'session-0', presentationKey: `g::health::${turn}`, resolvedTurnNumber: turn,
    source: 'intent', eligibility: 'live', outcome: { isTerminal: false, winnerPlayerId: null, resultReason: null },
    left: { playerId: 'p2', startHealth: 30, damageTaken: 40, damageStageHealth: -10,
      grossHealingReceived: 20, finalHealth: 10, actualNetDelta: -20, maxHealth: 35 },
    right: { playerId: 'p1', startHealth: 20, damageTaken: 2, damageStageHealth: 18,
      grossHealingReceived: 6, finalHealth: 24, actualNetDelta: 4, maxHealth: 50 },
  };
}
function session(snapshot = facts()): ResolvedHealthSessionPresentation {
  return { identity: snapshot.identity, continuityKey: snapshot.continuityKey,
    observedResolvedTurnNumber: snapshot.resolvedTurnNumber,
    settledIncludesLiveResolution: true,
    settled: { mode: 'settled', identity: snapshot.identity, outcome: snapshot.outcome,
      left: { playerId: snapshot.left.playerId, health: snapshot.left.finalHealth, maxHealth: snapshot.left.maxHealth },
      right: { playerId: snapshot.right.playerId, health: snapshot.right.finalHealth, maxHealth: snapshot.right.maxHealth } } };
}
function setup(snapshot = facts()) {
  const time = clock();
  const controller = createHealthBarAnimationController({ scheduler: time.scheduler });
  const context = session(snapshot);
  const live = { mode: 'live' as const, snapshot };
  const sync = (presentation = live as typeof live | typeof context.settled, current = context) =>
    syncSessionHealthBarController(controller, presentation, current);
  const view = (presentation = live as typeof live | typeof context.settled, current = context) =>
    selectSessionHealthBarPresentation(controller.getSnapshot(), presentation, current);
  return { time, controller, context, live, sync, view };
}

describe('live session health-bar integration', () => {
  it('accepts intent/poll duplicates once, survives dice source release, and reveals deltas only at actual completion', () => {
    const s = setup(); s.sync();
    const sequence = s.controller.getSnapshot().sequence!;
    s.time.advance(350);
    s.sync({ ...s.live, snapshot: { ...s.live.snapshot, source: 'poll' } });
    s.sync(s.context.settled);
    expect(s.controller.getSnapshot().sequence).toBe(sequence);
    expect(s.view(s.context.settled)?.delta?.visible).toBe(false);
    s.time.advance(sequence.durationMs - 351);
    expect(s.view(s.context.settled)?.delta?.visible).toBe(false);
    s.time.advance(1);
    const completed = s.view(s.context.settled)!;
    expect(completed.delta).toMatchObject({ left: -20, right: 4, visible: true });
    expect(completed.left.health).toBe(10);
    const frame = s.controller.getSnapshot().frame;
    s.sync(s.context.settled);
    s.sync({ ...s.live });
    expect(s.controller.getSnapshot().frame).toBe(frame);
    expect(s.view(s.context.settled)?.delta?.key).toBe(completed.delta?.key);
    expect(s.time.pending.size).toBe(0);
  });

  it('uses the same unrounded logical health and explicit rectangles through negative motion, scale preparation and surplus', () => {
    const snapshot = facts();
    const s = setup({ ...snapshot, left: { ...snapshot.left, grossHealingReceived: 80, finalHealth: 35, actualNetDelta: 5 } });
    s.sync();
    const sequence = s.controller.getSnapshot().sequence!;
    let elapsed = 0;
    for (const stage of sequence.stages) {
      const target = stage.startMs + stage.durationMs / 2;
      s.time.advance(target - elapsed); elapsed = target;
      const view = s.view()!;
      const frame = s.controller.getSnapshot().frame!;
      expect(view.left).toBe(frame.left);
      expect(view.right).toBe(frame.right);
      expect(view.scale).toBe(frame.scales.desktop);
      if (stage.name === 'scale') expect(view.left.health).toBe(sequence.snapshot.left.startHealth);
      if (stage.name.startsWith('surplus')) expect(view.left.health).toBe(35);
      expect(view.delta?.visible).toBe(false);
      const markup = renderToStaticMarkup(createElement(HealthBarPair, {
        scale: view.scale, left: view.left, right: view.right, orientation: 'desktop', axisLength: 196,
        leftLabel: 'P2', rightLabel: 'P1',
      }));
      expect(markup).toContain(`displayed health ${frame.left.health}`);
      expect(calculateHealthBarGeometry(view.scale, 'left', view.left, 'desktop', 196).height).toBe(200);
    }
    s.time.advance(sequence.durationMs - elapsed);
    expect(s.view()?.left.health).toBe(35);
    expect(s.view()?.delta).toMatchObject({ left: 5, visible: true });
  });

  it('settles initial load, missing exact caps and recovery without accepting historical facts', () => {
    const s = setup();
    const sparse = { ...s.context, observedResolvedTurnNumber: null,
      settled: { ...s.context.settled!, left: { ...s.context.settled!.left, health: -8, maxHealth: null } } };
    s.sync(sparse.settled, sparse);
    const view = s.view(sparse.settled, sparse)!;
    expect(s.controller.getSnapshot().sequence).toBeNull();
    expect(view.scale.leftCap.value).toBeNull();
    expect(view.left).toEqual({ health: -8, red: { from: -8, to: 0 } });
    expect(view.delta).toBeNull();
    expect(s.time.pending.size).toBe(0);
  });

  it('invalidates an unsupported newer resolution even when its settled health equals the prior final', () => {
    const s = setup(); s.sync();
    const newer = { ...s.context, observedResolvedTurnNumber: 4 };
    s.sync(newer.settled, newer);
    expect(s.controller.getSnapshot().sequence).toBeNull();
    expect(s.controller.getSnapshot().completion).toBeNull();
    expect(s.view(newer.settled, newer)?.delta).toBeNull();
    expect(s.time.pending.size).toBe(0);
    s.sync(); // A stale source cannot replay the invalidated accepted resolution.
    expect(s.controller.getSnapshot().sequence).toBeNull();
    s.sync({ mode: 'live', snapshot: facts(4) }, newer);
    expect(s.controller.getSnapshot().sequence?.snapshot.resolvedTurnNumber).toBe(4);
  });

  it('supersedes newer eligible facts and resets on recovery or seat identity changes', () => {
    const s = setup(); s.sync();
    const newer = facts(4); const context = session(newer);
    s.sync({ mode: 'live', snapshot: newer }, context);
    expect(s.controller.getSnapshot().sequence?.snapshot.resolvedTurnNumber).toBe(4);
    const recovered = { ...context, continuityKey: 'recovered' };
    s.sync(context.settled, recovered);
    expect(s.controller.getSnapshot().sequence).toBeNull();
    expect(s.view(context.settled, recovered)?.delta).toBeNull();
    const spectator = { ...recovered, identity: { ...context.identity, viewerId: 'spectator',
      viewerRole: 'spectator' as const, leftPlayerId: 'p1', rightPlayerId: 'p2' },
      settled: { ...context.settled!, identity: { ...context.identity, viewerId: 'spectator',
        viewerRole: 'spectator' as const, leftPlayerId: 'p1', rightPlayerId: 'p2' },
        left: context.settled!.right, right: context.settled!.left } };
    s.sync(spectator.settled, spectator);
    expect(s.view(spectator.settled, spectator)?.left.health).toBe(newer.right.finalHealth);
    expect(s.time.pending.size).toBe(0);
  });

  it('retains completed scale until genuine settled cap/health changes, then represents new values without a tween', () => {
    const s = setup(); s.sync(); s.time.advance(100000);
    const prepared = s.view()!.scale;
    s.sync(s.context.settled);
    expect(s.view(s.context.settled)?.scale).toBe(prepared);
    const changed = { ...s.context, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: 70, maxHealth: 80 } } };
    s.sync(changed.settled, changed);
    const view = s.view(changed.settled, changed)!;
    expect(view.left.health).toBe(70);
    expect(view.scale.domainMax).toBe(80);
    expect(view.scale.leftCap.value).toBe(80);
    expect(view.delta).toBeNull();
    expect(s.time.pending.size).toBe(0);
  });

  it('changes physical dimensions/legend density without restarting the paired sequence or changing elapsed time', () => {
    const s = setup(); s.sync(); s.time.advance(500);
    const sequence = s.controller.getSnapshot().sequence!;
    const frame = s.controller.getSnapshot().frame!;
    for (const axisLength of [50, 320, 80, 500]) {
      const view = s.view()!;
      const transition = prepareHealthBarLegendTransition(sequence.previousScales.desktop, sequence.scales.desktop, 'desktop', axisLength);
      const legendLabels = sampleHealthBarLegendTransition(transition, view.scale, view.scaleProgress);
      renderToStaticMarkup(createElement(HealthBarPair, { scale: view.scale, left: view.left, right: view.right,
        orientation: 'desktop', axisLength, legendLabels, leftLabel: 'P2', rightLabel: 'P1' }));
      s.sync();
      expect(s.controller.getSnapshot().sequence).toBe(sequence);
      expect(s.controller.getSnapshot().frame).toBe(frame);
      expect(s.time.pending.size).toBe(1);
    }
  });

  it('protects captured finals from a lagging DTO but handles later authoritative cap changes before source release', () => {
    const s = setup();
    s.controller.setMotionEnabled(false);
    const lagging = { ...s.context, settledIncludesLiveResolution: false, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: 30 } } };
    s.sync(s.live, lagging);
    expect(s.view(s.live, lagging)?.left.health).toBe(10);
    expect(s.view(s.live, lagging)?.delta?.visible).toBe(true);
    const current = { ...s.context, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: 45, maxHealth: 60 } } };
    s.sync(s.live, current);
    const view = s.view(s.live, current)!;
    expect(view.left.health).toBe(45);
    expect(view.scale.leftCap.value).toBe(60);
    expect(view.delta).toBeNull();
    s.sync(s.live, current);
    expect(s.controller.getSnapshot().sequence).toBeNull();
    expect(s.time.pending.size).toBe(0);
  });

  it('completes reduced motion at exact finals, including persistent negative red', () => {
    const snapshot = facts();
    const s = setup({ ...snapshot, left: { ...snapshot.left, grossHealingReceived: 0, finalHealth: -10, actualNetDelta: -40 } });
    s.controller.setMotionEnabled(false); s.sync();
    expect(s.controller.getSnapshot().completion?.reason).toBe('motion-disabled');
    expect(s.view()?.left).toEqual({ health: -10, red: { from: -10, to: 0 } });
    expect(s.view()?.delta?.visible).toBe(true);
    expect(s.time.pending.size).toBe(0);
  });

  it('survives development effect cleanup/setup and disposes on real unmount', async () => {
    const s = setup(); const lease = { current: 0 };
    const detach = attachSessionHealthBarController(s.controller, lease);
    s.sync(); const sequence = s.controller.getSnapshot().sequence;
    detach();
    const unmount = attachSessionHealthBarController(s.controller, lease);
    await Promise.resolve();
    expect(s.controller.getSnapshot().sequence).toBe(sequence);
    s.time.advance(400);
    expect(s.controller.getSnapshot().frame?.elapsedMs).toBe(400);
    unmount(); await Promise.resolve();
    expect(s.time.pending.size).toBe(0);
    expect(s.controller.getSnapshot().sequence).toBeNull();
    s.sync();
    expect(s.controller.getSnapshot().sequence).toBeNull();
  });
});
