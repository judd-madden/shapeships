import type { ResolvedHealthSide, ResolvedHealthSnapshot } from '../../client/gameSession/types';
import { HEALTH_BAR_ANIMATION_CONFIG, healthBarEasing, healthBarMovementDuration } from './healthBarAnimationConfig';
import type { HealthBarPresentationState } from './healthBarPresentation';
import { mapHealthBarValue, prepareHealthBarScale, retainPreparedHealthBarScale, unmapHealthBarValue } from './healthBarScale';
import { interpolateHealthBarScale, sameHealthBarMapping, type HealthBarScales } from './healthBarScaleTransition';

export interface HealthBarPairState {
  readonly left: HealthBarPresentationState;
  readonly right: HealthBarPresentationState;
}
export type HealthBarAnimationStage = 'scale' | 'damage' | 'damage-clearance' | 'handover' |
  'healing' | 'healing-clearance' | 'surplus-out' | 'surplus-return' | 'settle';
export interface HealthBarSequenceStage {
  readonly name: HealthBarAnimationStage;
  readonly startMs: number;
  readonly durationMs: number;
  readonly from: HealthBarPairState;
  readonly to: HealthBarPairState;
}
export interface HealthBarSequence {
  readonly snapshot: Readonly<ResolvedHealthSnapshot>;
  readonly scales: HealthBarScales;
  readonly previousScales: HealthBarScales;
  readonly start: HealthBarPairState;
  readonly final: HealthBarPairState;
  readonly stages: readonly HealthBarSequenceStage[];
  readonly durationMs: number;
}
export interface HealthBarAnimationFrame extends HealthBarPairState {
  readonly stage: HealthBarAnimationStage | 'complete';
  readonly progress: number;
  readonly elapsedMs: number;
  readonly complete: boolean;
  readonly scales: HealthBarScales;
  readonly scaleProgress: number;
}

const sides = ['left', 'right'] as const;
const orientations = ['desktop', 'mobile'] as const;
export const settledHealthBarState = (health: number): HealthBarPresentationState => ({
  health, ...(health < 0 ? { red: { from: health, to: 0 } } : {}),
});
const freezePair = (pair: HealthBarPairState): HealthBarPairState => {
  const freeze = (state: HealthBarPresentationState) => Object.freeze({
    ...state,
    ...(state.red ? { red: Object.freeze({ ...state.red }) } : {}),
    ...(state.green ? { green: Object.freeze({ ...state.green }) } : {}),
  });
  return Object.freeze({ left: freeze(pair.left), right: freeze(pair.right) });
};

/** Copies all retained metadata; caller DTO/scale mutation cannot change playback. */
function captureScales(scales: HealthBarScales): HealthBarScales {
  const capture = (scale: HealthBarScales['desktop']) => Object.freeze({
    ...scale, identity: Object.freeze({ ...scale.identity }),
    leftCap: Object.freeze({ ...scale.leftCap }), rightCap: Object.freeze({ ...scale.rightCap }),
  });
  return Object.freeze({ desktop: capture(scales.desktop), mobile: capture(scales.mobile) });
}

export function prepareHealthBarSequence(
  input: Readonly<ResolvedHealthSnapshot>, inputScales: HealthBarScales, previous?: HealthBarScales | null,
): Readonly<HealthBarSequence> {
  const snapshot = Object.freeze({
    ...input, identity: Object.freeze({ ...input.identity }), outcome: Object.freeze({ ...input.outcome }),
    left: Object.freeze({ ...input.left }), right: Object.freeze({ ...input.right }),
  });
  const context = { identity: snapshot.identity, continuityKey: snapshot.continuityKey };
  for (const orientation of orientations) {
    const scale = inputScales[orientation];
    if (!retainPreparedHealthBarScale(scale, context) || scale.presentationKey !== snapshot.presentationKey ||
      scale.resolvedTurnNumber !== snapshot.resolvedTurnNumber ||
      sides.some((side) => [snapshot[side].startHealth, snapshot[side].damageStageHealth, snapshot[side].finalHealth]
        .some((value) => mapHealthBarValue(scale, value) === null))) {
      throw new Error('Health-bar sequence requires matching complete prepared scales');
    }
  }
  const scales = captureScales(inputScales);
  const pair = (state: (s: ResolvedHealthSide) => HealthBarPresentationState) =>
    freezePair({ left: state(snapshot.left), right: state(snapshot.right) });
  const start = pair((s) => settledHealthBarState(s.startHealth));
  const final = pair((s) => settledHealthBarState(s.finalHealth));
  const startPresentation = {
    mode: 'settled' as const, identity: snapshot.identity, outcome: snapshot.outcome,
    left: { playerId: snapshot.left.playerId, health: snapshot.left.startHealth, maxHealth: snapshot.left.maxHealth },
    right: { playerId: snapshot.right.playerId, health: snapshot.right.startHealth, maxHealth: snapshot.right.maxHealth },
  };
  const previousFor = (orientation: 'desktop' | 'mobile') =>
    retainPreparedHealthBarScale(previous?.[orientation] ?? null, context) ??
    prepareHealthBarScale(startPresentation, context, { orientation })!;
  const previousScales = captureScales({ desktop: previousFor('desktop'), mobile: previousFor('mobile') });
  const stages: HealthBarSequenceStage[] = [];
  let durationMs = 0;
  const add = (name: HealthBarAnimationStage, from: HealthBarPairState, to: HealthBarPairState, fixedMs?: number) => {
    let travel = 0;
    for (const orientation of orientations) {
      const scale = scales[orientation];
      for (const side of sides) {
        const a = from[side];
        const b = to[side];
        // Health contributes only the visible white endpoint. Negative movement belongs to red/green.
        const endpoints: [number, number][] = [[Math.max(0, a.health), Math.max(0, b.health)]];
        for (const layer of ['red', 'green'] as const) {
          const old = a[layer] ?? { from: b[layer]?.from ?? 0, to: b[layer]?.from ?? 0 };
          const next = b[layer] ?? { from: old.to, to: old.to };
          endpoints.push([old.from, next.from], [old.to, next.to]);
        }
        for (const [aValue, bValue] of endpoints) {
          travel = Math.max(travel, Math.abs(mapHealthBarValue(scale, aValue)! - mapHealthBarValue(scale, bValue)!));
        }
      }
    }
    if (fixedMs === undefined && travel === 0) return false;
    const length = fixedMs ?? healthBarMovementDuration(travel);
    if (length <= 0) return false;
    stages.push(Object.freeze({ name, startMs: durationMs, durationMs: length, from, to }));
    durationMs += length;
    return true;
  };
  if (orientations.some((orientation) => !sameHealthBarMapping(previousScales[orientation], scales[orientation]))) {
    add('scale', start, start, HEALTH_BAR_ANIMATION_CONFIG.scaleTransitionMs);
  }
  const damageStart = pair((s) => ({ ...settledHealthBarState(s.startHealth),
    ...(s.damageTaken > 0 ? { red: { from: s.startHealth, to: Math.max(0, s.startHealth) } } : {}) }));
  const damaged = pair((s) => ({ health: s.damageStageHealth,
    ...(s.damageTaken > 0 || s.damageStageHealth < 0
      ? { red: { from: s.damageStageHealth, to: Math.max(0, s.startHealth) } } : {}) }));
  const cleared = pair((s) => ({ health: s.damageStageHealth,
    red: { from: s.damageStageHealth, to: Math.max(0, s.damageStageHealth) } }));
  const hasDamage = add('damage', damageStart, damaged);
  add('damage-clearance', damaged, cleared);
  const heals = (s: ResolvedHealthSide) => s.finalHealth > s.damageStageHealth;
  const unused = (s: ResolvedHealthSide) => Math.min(s.maxHealth,
    Math.max(0, s.damageStageHealth + s.grossHealingReceived - s.finalHealth));
  const hasGreen = sides.some((side) => heals(snapshot[side]) || unused(snapshot[side]) > 0);
  const healingStart = pair((s) => ({ ...settledHealthBarState(s.damageStageHealth),
    ...(heals(s) ? { green: { from: s.damageStageHealth, to: s.damageStageHealth } } : {}) }));
  if (hasDamage && hasGreen) add('handover', healingStart, healingStart, HEALTH_BAR_ANIMATION_CONFIG.handoverMs);
  const healed = pair((s) => ({ health: s.finalHealth,
    ...(s.damageStageHealth < 0 ? { red: { from: s.damageStageHealth, to: 0 } } : {}),
    ...(heals(s) ? { green: { from: s.damageStageHealth, to: s.finalHealth } } : {}) }));
  add('healing', healingStart, healed);
  // Trim only covered red at target arrival; leave the uncovered final-negative red untouched.
  const clearanceStart = pair((s) => ({ ...settledHealthBarState(s.finalHealth),
    ...(heals(s) ? { green: { from: s.damageStageHealth, to: s.finalHealth } } : {}) }));
  const clearanceEnd = pair((s) => ({ ...settledHealthBarState(s.finalHealth),
    ...(heals(s) ? { green: { from: s.finalHealth, to: s.finalHealth } } : {}) }));
  add('healing-clearance', clearanceStart, clearanceEnd);
  const surplusStart = pair((s) => ({ ...settledHealthBarState(s.finalHealth),
    ...(unused(s) > 0 ? { green: { from: 0, to: 0 } } : {}) }));
  const surplusPeak = pair((s) => ({ ...settledHealthBarState(s.finalHealth),
    ...(unused(s) > 0 ? { green: { from: 0, to: unused(s) } } : {}) }));
  add('surplus-out', surplusStart, surplusPeak);
  add('surplus-return', surplusPeak, surplusStart);
  add('settle', final, final, HEALTH_BAR_ANIMATION_CONFIG.finalSettleMs);
  return Object.freeze({ snapshot, scales, previousScales, start, final, stages: Object.freeze(stages), durationMs });
}

export function sampleHealthBarSequence(sequence: HealthBarSequence, elapsed: number): HealthBarAnimationFrame {
  const elapsedMs = Math.max(0, elapsed);
  const stage = sequence.stages.find((item) => elapsedMs < item.startMs + item.durationMs);
  if (!stage) return { ...sequence.final, stage: 'complete', progress: 1, elapsedMs,
    complete: true, scales: sequence.scales, scaleProgress: 1 };
  const progress = healthBarEasing((elapsedMs - stage.startMs) / stage.durationMs);
  if (stage.name === 'scale') return {
    ...sequence.start, stage: stage.name, progress, elapsedMs, complete: false, scaleProgress: progress,
    scales: {
      desktop: interpolateHealthBarScale(sequence.previousScales.desktop, sequence.scales.desktop, progress),
      mobile: interpolateHealthBarScale(sequence.previousScales.mobile, sequence.scales.mobile, progress),
    },
  };
  const scale = sequence.scales.desktop;
  const move = (from: number, to: number) => {
    if (from === to || progress === 0) return from;
    if (progress === 1) return to;
    const a = mapHealthBarValue(scale, from)!;
    const b = mapHealthBarValue(scale, to)!;
    return unmapHealthBarValue(scale, (1 - progress) * a + progress * b);
  };
  const sample = (side: 'left' | 'right'): HealthBarPresentationState => {
    const a = stage.from[side];
    const b = stage.to[side];
    const interval = (layer: 'red' | 'green') => {
      const old = a[layer];
      const next = b[layer];
      if (!old && !next) return {};
      const from = old ?? { from: next!.from, to: next!.from };
      const to = next ?? { from: from.to, to: from.to };
      return { [layer]: { from: move(from.from, to.from), to: move(from.to, to.to) } };
    };
    return { health: move(a.health, b.health), ...interval('red'), ...interval('green') };
  };
  return { left: sample('left'), right: sample('right'), stage: stage.name, progress, elapsedMs,
    complete: false, scales: sequence.scales, scaleProgress: 1 };
}
