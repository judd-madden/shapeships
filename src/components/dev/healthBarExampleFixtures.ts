import type {
  ResolvedHealthIdentity, ResolvedHealthPresentation, ResolvedHealthSide,
} from '../../game/client/gameSession/types';
import { prepareHealthBarScale, type HealthBarOrientation, type PreparedHealthBarScale } from '../../game/display/healthBars/healthBarScale';
import type { HealthBarPresentationState } from '../../game/display/healthBars/healthBarPresentation';

export interface HealthBarExampleStage {
  readonly name: string;
  readonly left: HealthBarPresentationState;
  readonly right: HealthBarPresentationState;
}

export interface HealthBarExample {
  readonly id: string;
  readonly name: string;
  readonly presentation: ResolvedHealthPresentation;
  readonly scales: Readonly<Record<HealthBarOrientation, Readonly<PreparedHealthBarScale>>>;
  readonly stages: readonly HealthBarExampleStage[];
}

export const HEALTH_BAR_EXAMPLE_AXIS_LENGTHS = { desktop: 320, mobile: 256 } as const;

// Authored development facts only: final health is supplied, never resolved by the renderer.
function side(playerId: string, start: number, damage: number, healing: number, final: number, cap = 35): ResolvedHealthSide {
  return Object.freeze({ playerId, startHealth: start, damageTaken: damage, grossHealingReceived: healing,
    finalHealth: final, maxHealth: cap, actualNetDelta: final - start, damageStageHealth: start - damage });
}

export function createHealthBarExample(id: string, name: string, left: ResolvedHealthSide, right: ResolvedHealthSide): HealthBarExample {
  const identity: ResolvedHealthIdentity = {
    gameId: `health-example-${id}`, viewerId: 'a', viewerRole: 'player', leftPlayerId: 'a', rightPlayerId: 'b',
  };
  const context = { identity, continuityKey: `example-${id}` };
  const presentation: ResolvedHealthPresentation = { mode: 'live', snapshot: {
    identity, continuityKey: context.continuityKey, presentationKey: `${id}-resolution`,
    resolvedTurnNumber: 1, source: 'poll', eligibility: 'live', left, right,
    // No synthetic winner or finish inference: this gallery inspects geometry only.
    outcome: { isTerminal: false, winnerPlayerId: null, resultReason: null },
  } };
  const prepare = (orientation: HealthBarOrientation) => {
    const scale = prepareHealthBarScale(presentation, context, { orientation });
    if (!scale) throw new Error(`Invalid health-bar example: ${id}`);
    return scale;
  };
  const stages: HealthBarExampleStage[] = [];
  const add = (stageName: string, state: (s: ResolvedHealthSide) => HealthBarPresentationState) => {
    stages.push(Object.freeze({ name: stageName, left: Object.freeze(state(left)), right: Object.freeze(state(right)) }));
  };
  const damageState = (s: ResolvedHealthSide, fraction: number): HealthBarPresentationState => {
    const health = s.startHealth - s.damageTaken * fraction;
    return { health, ...(s.damageTaken ? { red: { from: health, to: s.startHealth } } : {}) };
  };
  const settledState = (s: ResolvedHealthSide): HealthBarPresentationState => ({
    health: s.finalHealth,
    ...(s.finalHealth < 0 ? { red: { from: s.finalHealth, to: 0 } } : {}),
  });
  const damageClearedState = (s: ResolvedHealthSide): HealthBarPresentationState => ({
    health: s.damageStageHealth,
    red: { from: s.damageStageHealth, to: Math.max(0, s.damageStageHealth) },
  });
  const hasRecovery = (s: ResolvedHealthSide) => s.finalHealth > s.damageStageHealth;
  const healingState = (s: ResolvedHealthSide, fraction: number): HealthBarPresentationState => {
    if (!hasRecovery(s)) return damageClearedState(s);
    const health = s.damageStageHealth + (s.finalHealth - s.damageStageHealth) * fraction;
    return { health,
      ...(s.damageStageHealth < 0 ? { red: { from: s.damageStageHealth, to: 0 } } : {}),
      green: { from: s.damageStageHealth, to: health } };
  };
  // These are static sample poses, not a controller or a playback sequence.
  add('Settled start', (s) => ({ health: s.startHealth }));
  if (left.damageTaken || right.damageTaken) {
    add('Damage begins', (s) => damageState(s, 0.15));
    add('Damage movement', (s) => damageState(s, 0.5));
    add('Damage reaches affected range', (s) => damageState(s, 1));
    add('Damage clearance', damageClearedState);
  }
  if (left.grossHealingReceived || right.grossHealingReceived) {
    if (left.damageTaken || right.damageTaken) {
      add('Red/green handoff', (s) => healingState(s, 0));
    }
    if (hasRecovery(left) || hasRecovery(right)) {
      add('Healing begins', (s) => healingState(s, 0));
      add('Healing grows', (s) => healingState(s, 0.15));
      add('Healing movement', (s) => healingState(s, 0.5));
      add('Healing reaches final health', (s) => healingState(s, 1));
      if ([left, right].some((s) => hasRecovery(s) && s.damageStageHealth < 0 && s.finalHealth >= 0)) {
        add('Retained red removed', (s) => hasRecovery(s)
          ? { ...settledState(s), green: { from: s.damageStageHealth, to: s.finalHealth } }
          : settledState(s));
      }
      add('Healing clearance', (s) => hasRecovery(s)
        ? { ...settledState(s),
            green: { from: s.damageStageHealth + (s.finalHealth - s.damageStageHealth) * 0.75, to: s.finalHealth } }
        : settledState(s));
      // Negative finals keep the uncovered red interval continuously through clearance.
      add('Healing cleared', settledState);
    }
    const unusedHealing = (s: ResolvedHealthSide) => Math.max(0, s.damageStageHealth + s.grossHealingReceived - s.finalHealth);
    if (unusedHealing(left) || unusedHealing(right)) {
      for (const [stageName, fraction] of [
        ['Surplus begins', 0], ['Surplus grows', 0.5], ['Surplus reaches amount', 1], ['Surplus returns', 0.5],
      ] as const) {
        add(stageName, (s) => ({ ...settledState(s),
          ...(unusedHealing(s) ? { green: { from: 0, to: Math.min(unusedHealing(s), s.maxHealth) * fraction } } : {}) }));
      }
      add('Surplus cleared', settledState);
    }
  }
  add('Settled final', settledState);
  return Object.freeze({ id, name, presentation,
    scales: Object.freeze({ desktop: prepare('desktop'), mobile: prepare('mobile') }), stages: Object.freeze(stages) });
}

export const HEALTH_BAR_EXAMPLES: readonly HealthBarExample[] = Object.freeze([
  createHealthBarExample('ordinary', 'Ordinary damage and healing', side('a', 25, 12, 6, 19), side('b', 14, 0, 15, 29)),
  createHealthBarExample('small', 'Small damage and healing', side('a', 25, 1, 0, 24), side('b', 14, 0, 1, 15)),
  createHealthBarExample('recovery', 'Large damage below zero followed by recovery', side('a', 25, 85, 83, 23), side('b', 25, 85, 85, 25)),
  createHealthBarExample('negative-final', 'Large damage with a negative final result', side('a', 12, 30, 5, -13), side('b', 25, 0, 0, 25)),
  createHealthBarExample('overheal', 'Full-health overheal', side('a', 35, 0, 20, 35), side('b', 35, 0, 0, 35)),
  createHealthBarExample('excess-healing', 'Large damage followed by excess healing', side('a', 35, 200, 299, 35), side('b', 25, 85, 120, 35)),
  createHealthBarExample('caps', 'Unequal/increased caps', side('a', 35, 0, 20, 50, 50), side('b', 25, 12, 6, 19)),
  createHealthBarExample('compression', 'Extreme negative compression', side('a', 25, 10025, 10023, 23), side('b', 30, 330, 320, 20)),
  createHealthBarExample('damage-only-negative', 'Damage-only negative final', side('a', 12, 30, 0, -18), side('b', 12, 20, 8, 0)),
]);
