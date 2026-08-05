import assert from 'node:assert/strict';
import { EffectKind, EffectTiming, SurvivabilityRule, type Effect } from '../../../engine_shared/effects/Effect.ts';
import type { EffectEvent } from '../../../engine_shared/effects/applyEffects.ts';
import {
  countVerifiedCreatedShipsByTargetPlayerId,
  matchAppliedCreateShipEffectsOneToOne,
  verifyAppliedEffectsOneToOne,
} from '../../../engine_shared/effects/appliedEffectVerification.ts';

function createEffect(id: string): Effect {
  return {
    id,
    ownerPlayerId: 'p1',
    source: { type: 'ship', instanceId: 'bug-1', shipDefId: 'BUG' },
    timing: 'build.drawing',
    activationTag: EffectTiming.Automatic,
    target: { playerId: 'p1' },
    survivability: SurvivabilityRule.DiesWithSource,
    kind: EffectKind.CreateShip,
    shipDefId: 'XEN',
  };
}

function event(id: string, overrides: Partial<EffectEvent> = {}): EffectEvent {
  return {
    type: 'EFFECT_APPLIED',
    effectId: id,
    kind: 'CreateShip',
    targetPlayerId: 'p1',
    details: { shipDefId: 'XEN', instanceId: 'made-1' },
    atMs: 1,
    ...overrides,
  };
}

Deno.test('applied-effect verification matches and counts CreateShip one-to-one', () => {
  const effects = [createEffect('ns:0'), createEffect('ns:1')];
  const result = verifyAppliedEffectsOneToOne({ expectedEffects: effects, effectEvents: [event('ns:0'), event('ns:1')], effectIdNamespace: 'ns:' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(countVerifiedCreatedShipsByTargetPlayerId(result.matches), { p1: 2 });
});

Deno.test('applied-effect verification rejects duplicate expected and applied IDs', () => {
  assert.equal(verifyAppliedEffectsOneToOne({ expectedEffects: [createEffect('ns:0'), createEffect('ns:0')], effectEvents: [event('ns:0')], effectIdNamespace: 'ns:' }).ok, false);
  assert.equal(verifyAppliedEffectsOneToOne({ expectedEffects: [createEffect('ns:0')], effectEvents: [event('ns:0'), event('ns:0')], effectIdNamespace: 'ns:' }).ok, false);
});

Deno.test('applied-effect verification rejects missing, extra, kind, target, and created definition mismatches', () => {
  const expected = [createEffect('ns:0')];
  const invalidEventSets = [
    [],
    [event('ns:0'), event('ns:extra')],
    [event('ns:0', { kind: 'SpendCharge' })],
    [event('ns:0', { targetPlayerId: 'p2' })],
    [event('ns:0', { details: { shipDefId: 'ANT' } })],
  ];
  for (const effectEvents of invalidEventSets) {
    assert.equal(verifyAppliedEffectsOneToOne({ expectedEffects: expected, effectEvents, effectIdNamespace: 'ns:' }).ok, false);
  }
});

Deno.test('SpendCharge verification requires source, amount, target, and exact delta', () => {
  const spend: Effect = {
    ...createEffect('ns:charge'),
    kind: EffectKind.SpendCharge,
    amount: 1,
  };
  const valid = event('ns:charge', {
    kind: 'SpendCharge',
    details: { shipInstanceId: 'bug-1', amount: 1, before: 1, after: 0 },
  });
  assert.equal(verifyAppliedEffectsOneToOne({ expectedEffects: [spend], effectEvents: [valid], effectIdNamespace: 'ns:' }).ok, true);
  assert.equal(verifyAppliedEffectsOneToOne({ expectedEffects: [spend], effectEvents: [{ ...valid, details: { ...valid.details, after: 1 } }], effectIdNamespace: 'ns:' }).ok, false);
});

Deno.test('BUG verification rejects charge-only and ship-only partial application', () => {
  const spend: Effect = { ...createEffect('bug:charge'), kind: EffectKind.SpendCharge, amount: 1 };
  const create = createEffect('bug:create');
  const spendEvent = event('bug:charge', {
    kind: 'SpendCharge',
    details: { shipInstanceId: 'bug-1', amount: 1, before: 1, after: 0 },
  });
  const createEvent = event('bug:create');
  assert.equal(verifyAppliedEffectsOneToOne({ expectedEffects: [spend, create], effectEvents: [spendEvent], effectIdNamespace: 'bug:' }).ok, false);
  assert.equal(verifyAppliedEffectsOneToOne({ expectedEffects: [spend, create], effectEvents: [createEvent], effectIdNamespace: 'bug:' }).ok, false);
});

Deno.test('legacy applied-creation matching preserves positive subset matches', () => {
  const expected = [
    createEffect('legacy:created'),
    createEffect('legacy:missing'),
    { ...createEffect('legacy:wrong-detail'), shipDefId: 'ANT' },
  ];
  const matches = matchAppliedCreateShipEffectsOneToOne({
    expectedEffects: expected,
    effectEvents: [
      event('legacy:created'),
      event('legacy:wrong-detail', { details: { shipDefId: 'XEN' } }),
    ],
  });
  assert.deepEqual(matches.map((match) => match.effect.id), ['legacy:created']);
  assert.deepEqual(countVerifiedCreatedShipsByTargetPlayerId(matches), { p1: 1 });
});
