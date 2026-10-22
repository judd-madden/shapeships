import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ResolvedHealthSnapshot, ResolvedHealthSessionPresentation } from '../../client/gameSession/types';
import {
  captureResolvedHealthSnapshot, createResolvedHealthState, getIntentResolvedHealthTurn,
  prepareResolvedHealthCapture, transitionResolvedHealth,
} from '../../client/gameSession/resolvedHealth';
import { createHealthBarAnimationController, type HealthBarAnimationScheduler } from '../healthBars/healthBarAnimationController';
import { HealthBarPair } from '../healthBars/HealthBar';
import { HEALTH_BAR_EXAMPLES } from '../../../components/dev/healthBarExampleFixtures';
import { calculateHealthBarGeometry } from '../healthBars/healthBarPresentation';
import { HEALTH_BAR_ANIMATION_CONFIG } from '../healthBars/healthBarAnimationConfig';
import type { HealthBarOrientation } from '../healthBars/healthBarScale';
import { prepareHealthBarLegendTransition, sampleHealthBarLegendTransition } from '../healthBars/healthBarScaleTransition';
import {
  attachSessionHealthBarController, selectSessionHealthBarPresentation, syncSessionHealthBarController,
  type SessionHealthBarScaleRetention,
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
function setupForOrientation(snapshot: ResolvedHealthSnapshot, orientation: HealthBarOrientation) {
  const time = clock();
  const controller = createHealthBarAnimationController({ scheduler: time.scheduler, animateSettledNumbers: true });
  const context = session(snapshot);
  const retention: SessionHealthBarScaleRetention = { gameId: null, negativeFloor: 0 };
  const live = { mode: 'live' as const, snapshot };
  const sync = (presentation = live as typeof live | typeof context.settled, current = context, canAccept = true) =>
    syncSessionHealthBarController(controller, presentation, current, canAccept, retention);
  const view = (presentation = live as typeof live | typeof context.settled, current = context) =>
    selectSessionHealthBarPresentation(controller.getSnapshot(), presentation, current, orientation,
      retention.gameId === current.identity.gameId ? retention.negativeFloor : 0);
  return { time, controller, context, live, sync, view, retention };
}

function resolution(turn: number, minimum: number, side: 'left' | 'right' = 'left'): ResolvedHealthSnapshot {
  const snapshot = facts(turn);
  const stationary = (playerId: string) => ({ playerId, startHealth: 20, damageTaken: 0, damageStageHealth: 20,
    grossHealingReceived: 0, finalHealth: 20, actualNetDelta: 0, maxHealth: 35 });
  const left = stationary(snapshot.left.playerId);
  const right = stationary(snapshot.right.playerId);
  const affected = side === 'left' ? left : right;
  Object.assign(affected, { damageTaken: 20 - minimum, damageStageHealth: minimum, grossHealingReceived: 20 - minimum });
  return { ...snapshot, left, right };
}

describe.each(['desktop', 'mobile'] as const)('live %s session health-bar integration', (orientation) => {
  const setup = (snapshot = facts()) => setupForOrientation(snapshot, orientation);

  it('retains both players transient lows across turns, release and positive settled reconciliation', () => {
    const s = setup(resolution(3, -2));
    s.controller.setMotionEnabled(false);
    let priorFloor = 0;
    for (const [turn, minimum, expected] of [[3, -2, -5], [4, -37, -40], [5, -5, -40], [6, 10, -40], [7, -47, -50]]) {
      const snapshot = resolution(turn, minimum, turn % 2 ? 'left' : 'right');
      const current = session(snapshot);
      const source = { mode: 'live' as const, snapshot };
      const original = JSON.stringify(snapshot);
      s.sync(source, current);
      const sequence = s.controller.getSnapshot().sequence!;
      expect(s.retention.negativeFloor).toBe(expected);
      for (const axis of ['desktop', 'mobile'] as const) {
        expect(sequence.scales[axis].domainMin).toBe(expected);
        expect(sequence.previousScales[axis].domainMin).toBe(priorFloor);
      }
      expect(s.view(source, current)?.numbers).toEqual({ left: 20, right: 20 });
      s.sync(current.settled, current);
      expect(s.view(current.settled, current)?.scale.domainMin).toBe(expected);
      const changed = { ...current, settled: { ...current.settled!,
        left: { ...current.settled!.left, health: 25, maxHealth: 80 } } };
      s.sync(changed.settled, changed);
      expect(s.view(changed.settled, changed)?.scale.domainMin).toBe(expected);
      expect(s.view(changed.settled, changed)?.scale.domainMax).toBe(80);
      const normal = { ...changed, settled: { ...changed.settled!,
        left: { ...changed.settled!.left, maxHealth: 35 } } };
      s.sync(normal.settled, normal);
      expect(s.view(normal.settled, normal)?.scale.domainMax).toBe(35);
      expect(JSON.stringify(snapshot)).toBe(original);
      priorFloor = expected;
    }
    // Independent gallery scales never consume the live session's floor.
    const ordinary = HEALTH_BAR_EXAMPLES.find((example) => example.id === 'ordinary')!;
    expect(ordinary.scales.desktop.domainMin).toBe(0);
    expect(ordinary.scales.mobile.domainMin).toBe(0);
  });

  it('keeps only the floor through same-game recovery and temporary absence, then resets for another game', () => {
    const s = setup(resolution(3, -37)); s.sync(); s.time.advance(100000);
    expect(s.controller.getSnapshot().presentationCompletion).not.toBeNull();
    const recovered = { ...s.context, continuityKey: 'recovered' };
    s.sync(recovered.settled, recovered);
    expect(s.controller.getSnapshot().sequence).toBeNull();
    expect(s.controller.getSnapshot().completion).toBeNull();
    expect(s.view(recovered.settled, recovered)?.delta).toBeNull();
    expect(s.view(recovered.settled, recovered)?.scale.domainMin).toBe(-40);
    syncSessionHealthBarController(s.controller, null, null, false, s.retention);
    expect(s.retention.negativeFloor).toBe(-40);
    const next = { ...resolution(4, -2), continuityKey: recovered.continuityKey };
    const current = session(next);
    s.sync({ mode: 'live', snapshot: next }, current);
    for (const axis of ['desktop', 'mobile'] as const) {
      expect(s.controller.getSnapshot().sequence!.previousScales[axis].domainMin).toBe(-40);
      expect(s.controller.getSnapshot().sequence!.scales[axis].domainMin).toBe(-40);
    }
    const identity = { ...next.identity, gameId: 'another' };
    const other = { ...current, identity, settled: { ...current.settled!, identity } };
    s.sync(other.settled, other);
    expect(s.retention).toEqual({ gameId: 'another', negativeFloor: 0 });
    expect(s.view(other.settled, other)?.scale.domainMin).toBe(0);
    expect(s.controller.getSnapshot().presentationCompletion).toBeNull();
  });

  it('cannot revive a shallower completed mapping after a deeper settled low returns to the captured final', () => {
    const s = setup(resolution(3, -2));
    s.controller.setMotionEnabled(false); s.sync();
    const receipt = s.controller.getSnapshot().presentationCompletion;
    const changed = { ...s.context, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: -47 } } };
    s.sync(changed.settled, changed);
    expect(s.retention.negativeFloor).toBe(-50);
    s.sync(s.context.settled);
    expect(s.view(s.context.settled)?.scale.domainMin).toBe(-50);
    expect(s.view(s.context.settled)?.delta?.visible).toBe(false);
    expect(s.controller.getSnapshot().presentationCompletion).toBe(receipt);
    const next = resolution(4, -2);
    s.sync({ mode: 'live', snapshot: next }, session(next));
    expect(s.controller.getSnapshot().sequence!.previousScales[orientation].domainMin).toBe(-50);
    expect(s.controller.getSnapshot().sequence!.scales[orientation].domainMin).toBe(-50);
  });

  it('commits selected settled lows, and excludes hidden settled data and rejected candidates', () => {
    const s = setup(resolution(3, -2)); s.sync();
    const hidden = { ...s.context, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: -999 } } };
    s.sync(s.live, hidden);
    expect(s.retention.negativeFloor).toBe(-5);
    const accepted = s.controller.getSnapshot().sequence;
    for (const candidate of [resolution(3, -1000), resolution(2, -1000),
      { ...resolution(4, -1000), continuityKey: 'wrong' },
      { ...resolution(4, -1000), left: { ...resolution(4, -1000).left, grossHealingReceived: NaN } }]) {
      s.sync({ mode: 'live', snapshot: candidate });
      expect(s.retention.negativeFloor).toBe(-5);
      expect(s.controller.getSnapshot().sequence).toBe(accepted);
    }
    const blocked = resolution(4, -1000);
    s.sync({ mode: 'live', snapshot: blocked }, session(blocked), false);
    expect(s.retention.negativeFloor).toBe(-5);
    expect(s.controller.getSnapshot().sequence).toBeNull();
    expect(s.controller.getSnapshot().completion).toBeNull();
    // Invalidation retains controller deduplication even though it drops the sequence.
    s.sync({ mode: 'live', snapshot: resolution(3, -1000) });
    const repeatedKey = { ...blocked, presentationKey: s.live.snapshot.presentationKey };
    s.sync({ mode: 'live', snapshot: repeatedKey }, session(repeatedKey));
    expect(s.retention.negativeFloor).toBe(-5);
    expect(s.controller.getSnapshot().sequence).toBeNull();
    // A genuine selected settled low establishes memory without any historical replay.
    const settled = { ...hidden, continuityKey: 'recovery' };
    s.sync(settled.settled, settled);
    expect(s.retention.negativeFloor).toBe(-1000);
    expect(s.view(settled.settled, settled)?.numbers.left).toBe(-999);
    const positive = { ...settled, settled: s.context.settled };
    s.sync(positive.settled, positive);
    expect(s.view(positive.settled, positive)?.scale.domainMin).toBe(-1000);
    expect(s.time.pending.size).toBe(0);
  });
  it('captures an advanced bot response without history and runs through next-turn dice, Drawing and Ready DTOs', () => {
    const expected = facts();
    const response = { ok: true, events: [
      { type: 'BATTLE_LOG_FINALIZE_TURN', finalizedTurnNumber: 3 },
      { type: 'BUILD_SUBMITTED', playerId: 'p1', turnNumber: 4 },
    ], state: { gameId: 'g', turnNumber: 4, phaseKey: 'build.drawing', status: 'active',
      players: [expected.right, expected.left].map((side) => ({ id: side.playerId, role: 'player', health: side.finalHealth, maxHealth: 80 })),
      publicState: { phaseReadiness: [{ playerId: 'p1', isReady: true }],
        ships: { p1: [{ instanceId: 'bot-new', shipDefId: 'SPI', createdTurn: 4 }] },
        lastTurnStats: {
          healthResolution: { resolvedTurnNumber: 3,
            finalHealthByPlayerId: { p1: 24, p2: 10 }, maxHealthByPlayerId: { p1: 50, p2: 35 } },
          damageByPlayerId: { p1: 2, p2: 40 }, healByPlayerId: { p1: 6, p2: 20 }, netByPlayerId: { p1: 4, p2: -20 },
        } }, gameData: { turnData: { shipsMadeThisTurnByPlayerId: { p1: 1 } } },
    } };
    const turn = getIntentResolvedHealthTurn(response)!;
    const owned = prepareResolvedHealthCapture({ state: response.state, identity: expected.identity,
      continuityKey: expected.continuityKey, resolvedTurnNumber: turn, source: 'intent' });
    expect(owned).not.toBeNull();
    const snapshot = captureResolvedHealthSnapshot({ ...owned!, liveCapture: owned })!;
    expect(snapshot.left.maxHealth).toBe(35);
    let source = transitionResolvedHealth(createResolvedHealthState(), { type: 'sync', continuityKey: expected.continuityKey, candidate: snapshot });
    const s = setup(snapshot); s.sync();
    const sequence = s.controller.getSnapshot().sequence!;
    s.time.advance(sequence.stages.find((stage) => stage.name === 'damage')!.startMs + 100);
    source = transitionResolvedHealth(source, { type: 'turn_start_published', continuityKey: expected.continuityKey, gameId: 'g', turnNumber: 4 });
    expect(source.snapshot).toBeNull();
    const next = { ...s.context, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: 15, maxHealth: 80 } } };
    for (const phase of ['build.dice_roll', 'build.drawing', 'battle.reveal']) {
      response.state.phaseKey = phase;
      s.sync(next.settled, next); s.time.advance(25);
      const view = s.view(next.settled, next)!;
      expect(view.sequence).toBe(sequence);
      expect(view.left.health).not.toBe(15);
      expect(view.left.health).not.toBe(snapshot.left.finalHealth);
      expect(view.left).toBe(s.controller.getSnapshot().frame!.left);
      expect(view.scale.leftCap.value).toBe(35);
      expect(view.delta?.visible).toBe(false);
      expect(s.time.pending.size).toBe(1);
    }
    s.time.advance(sequence.durationMs);
    expect(s.view(next.settled, next)?.numbers.left).toBeLessThan(30);
    s.time.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs);
    s.sync(next.settled, next);
    expect(s.view(next.settled, next)?.left.health).toBe(15);
    expect(s.view(next.settled, next)?.delta?.visible).toBe(false);
    expect(s.controller.getSnapshot().completion?.resolvedTurnNumber).toBe(3);
  });

  it('retains paired deltas for cap-only reconciliation and permanently hides them after newer health', () => {
    const s = setup(); s.sync(); s.time.advance(100000);
    const receipt = s.controller.getSnapshot().completion;
    const deltaKey = s.view()!.delta!.key;
    const caps = { ...s.context, settled: { ...s.context.settled!, left: { ...s.context.settled!.left, maxHealth: 80 } } };
    s.sync(caps.settled, caps);
    expect(s.view(caps.settled, caps)?.scale.leftCap.value).toBe(80);
    expect(s.view(caps.settled, caps)?.delta).toMatchObject({ visible: true, key: deltaKey });
    const health = { ...caps, settled: { ...caps.settled, right: { ...caps.settled.right, health: 30 } } };
    // The render before layout synchronization must already hide stale deltas.
    expect(s.view(health.settled, health)?.delta?.visible).toBe(false);
    s.sync(health.settled, health);
    s.sync(caps.settled, caps);
    expect(s.view(caps.settled, caps)?.delta?.visible).toBe(false);
    expect(s.controller.getSnapshot().completion).toBe(receipt);
    s.sync(); // A duplicate live source cannot replay or revive the deltas.
    expect(s.controller.getSnapshot().completion).toBe(receipt);
    expect(s.view()?.delta?.visible).toBe(false);
    expect(s.time.pending.size).toBe(0);
  });

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
    expect(completed.numbers).toEqual({ left: 30, right: 20 });
    expect(completed.presentationComplete).toBe(false);
    expect(s.time.pending.size).toBe(1);
    s.time.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs);
    expect(s.view(s.context.settled)?.numbers).toEqual({ left: 10, right: 24 });
    expect(s.view(s.context.settled)?.presentationComplete).toBe(true);
    expect(s.time.pending.size).toBe(0);
  });

  it('keeps rectangles on their existing frames and numbers at the previous finals through every bar stage', () => {
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
      expect(view.scale).toBe(frame.scales[orientation]);
      expect(view.numbers).toEqual({ left: snapshot.left.startHealth, right: snapshot.right.startHealth });
      if (stage.name === 'scale') expect(view.left.health).toBe(sequence.snapshot.left.startHealth);
      if (stage.name.startsWith('surplus')) expect(view.left.health).toBe(35);
      expect(view.delta?.visible).toBe(false);
      const markup = renderToStaticMarkup(createElement(HealthBarPair, {
        scale: view.scale, left: view.left, right: view.right, orientation, axisLength: 196,
        leftLabel: 'P2', rightLabel: 'P1',
      }));
      expect(markup).toContain(`displayed health ${frame.left.health}`);
      const geometry = calculateHealthBarGeometry(view.scale, 'left', view.left, orientation, 196);
      expect(orientation === 'desktop' ? geometry.height : geometry.width).toBe(200);
    }
    s.time.advance(sequence.durationMs - elapsed);
    expect(s.view()?.left.health).toBe(35);
    expect(s.view()?.delta).toMatchObject({ left: 5, visible: true });
    expect(s.view()?.numbers.left).toBe(30);
    expect(s.view()?.presentationComplete).toBe(false);
  });

  it('holds 22 through minus 10 then counts directly to 20 alongside the healing player', () => {
    const snapshot = facts();
    const s = setup({ ...snapshot, left: { ...snapshot.left, startHealth: 22, damageTaken: 32,
      damageStageHealth: -10, grossHealingReceived: 30, finalHealth: 20, actualNetDelta: -2 } });
    s.sync();
    const sequence = s.controller.getSnapshot().sequence!;
    let elapsed = 0;
    for (const stage of sequence.stages) {
      const target = stage.startMs + stage.durationMs / 2;
      s.time.advance(target - elapsed); elapsed = target;
      expect(s.view()?.numbers).toEqual({ left: 22, right: 20 });
    }
    s.time.advance(sequence.durationMs - elapsed);
    expect(s.view()?.delta).toMatchObject({ left: -2, right: 4, visible: true });
    expect(s.view()?.numbers).toEqual({ left: 22, right: 20 });
    const displayed: number[] = [];
    let previousLeft = 22; let previousRight = 20;
    for (let i = 0; i < 30; i += 1) {
      s.time.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 30);
      // Poll delivery and source release cannot replace the captured number target.
      s.sync(i % 2 ? s.context.settled : { ...s.live });
      const view = s.view(s.context.settled)!;
      expect(view.numbers.left).toBeLessThanOrEqual(previousLeft);
      expect(view.numbers.right).toBeGreaterThanOrEqual(previousRight);
      previousLeft = view.numbers.left; previousRight = view.numbers.right;
      displayed.push(Math.round(view.numbers.left));
    }
    expect(new Set(displayed)).toEqual(new Set([22, 21, 20]));
    expect(s.view()?.numbers).toEqual({ left: 20, right: 24 });
    expect(s.view()?.presentationComplete).toBe(true);
    expect(s.time.pending.size).toBe(0);
  });

  it('retains the captured number target through cross-turn health/cap changes until the tail finishes', () => {
    const s = setup(); s.sync();
    s.time.advance(s.controller.getSnapshot().sequence!.durationMs);
    const changed = { ...s.context, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: 70, maxHealth: 80 } } };
    s.sync(changed.settled, changed);
    s.time.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    expect(s.view(changed.settled, changed)?.numbers.left).toBeCloseTo(20);
    expect(s.view(changed.settled, changed)?.scale.leftCap.value).toBe(35);
    s.time.advance(HEALTH_BAR_ANIMATION_CONFIG.settledNumberTweenMs / 2);
    s.sync(changed.settled, changed);
    expect(s.view(changed.settled, changed)?.numbers.left).toBe(70);
    expect(s.view(changed.settled, changed)?.delta?.visible).toBe(false);
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
    expect(s.view(spectator.settled, spectator)?.scale.domainMin).toBe(-10);
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
    expect(view.delta?.visible).toBe(false);
    expect(s.controller.getSnapshot().completion).not.toBeNull();
    expect(s.time.pending.size).toBe(0);
  });

  it('changes physical dimensions/legend density without restarting the paired sequence or changing elapsed time', () => {
    const s = setup(); s.sync(); s.time.advance(500);
    const sequence = s.controller.getSnapshot().sequence!;
    const frame = s.controller.getSnapshot().frame!;
    for (const axisLength of [50, 320, 80, 500]) {
      const view = s.view()!;
      const transition = prepareHealthBarLegendTransition(sequence.previousScales[orientation], sequence.scales[orientation], orientation, axisLength);
      const legendLabels = sampleHealthBarLegendTransition(transition, view.scale, view.scaleProgress);
      renderToStaticMarkup(createElement(HealthBarPair, { scale: view.scale, left: view.left, right: view.right,
        orientation, axisLength, legendLabels, leftLabel: 'P2', rightLabel: 'P1' }));
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
    s.sync(lagging.settled, lagging);
    expect(s.view(lagging.settled, lagging)?.left.health).toBe(10);
    expect(s.view(lagging.settled, lagging)?.delta?.visible).toBe(true);
    const current = { ...s.context, settled: { ...s.context.settled!,
      left: { ...s.context.settled!.left, health: 45, maxHealth: 60 } } };
    s.sync(s.live, current);
    const view = s.view(s.live, current)!;
    expect(view.left.health).toBe(45);
    expect(view.scale.leftCap.value).toBe(60);
    expect(view.delta?.visible).toBe(false);
    s.sync(s.live, current);
    expect(s.controller.getSnapshot().completion).not.toBeNull();
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
