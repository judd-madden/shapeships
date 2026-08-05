import type { Effect } from './Effect.ts';
import { EffectKind } from './Effect.ts';
import type { EffectEvent } from './applyEffects.ts';

export type VerifiedAppliedEffect = {
  effect: Effect;
  event: EffectEvent;
};

export type AppliedEffectVerificationResult =
  | { ok: true; matches: VerifiedAppliedEffect[] }
  | { ok: false; code: string; message: string };

function expectedEventKind(effect: Effect): string {
  if (effect.kind === EffectKind.Destroy) return 'DestroyShip';
  return effect.kind;
}

function detailsMatch(effect: Effect, event: EffectEvent): boolean {
  if (effect.kind === EffectKind.CreateShip) {
    return event.details?.shipDefId === effect.shipDefId;
  }
  if (effect.kind === EffectKind.SpendCharge) {
    if (effect.source.type !== 'ship') return false;
    const before = event.details?.before;
    const after = event.details?.after;
    return event.details?.shipInstanceId === effect.source.instanceId &&
      event.details?.amount === effect.amount &&
      typeof before === 'number' &&
      typeof after === 'number' &&
      before - after === effect.amount;
  }
  return true;
}

export function verifyAppliedEffectsOneToOne(args: {
  expectedEffects: readonly Effect[];
  effectEvents: readonly EffectEvent[];
  effectIdNamespace?: string;
}): AppliedEffectVerificationResult {
  const expectedById = new Map<string, Effect>();
  for (const effect of args.expectedEffects) {
    if (expectedById.has(effect.id)) {
      return { ok: false, code: 'DUPLICATE_EXPECTED_EFFECT_ID', message: `Duplicate expected effect ID: ${effect.id}` };
    }
    expectedById.set(effect.id, effect);
  }

  const eventsById = new Map<string, EffectEvent[]>();
  for (const event of args.effectEvents) {
    const matchesExpected = expectedById.has(event.effectId);
    const belongsToNamespace = args.effectIdNamespace !== undefined &&
      event.effectId.startsWith(args.effectIdNamespace);
    if (!matchesExpected && !belongsToNamespace) continue;
    if (!matchesExpected) {
      return { ok: false, code: 'UNEXPECTED_EFFECT_EVENT', message: `Unexpected application event: ${event.effectId}` };
    }
    const matches = eventsById.get(event.effectId) ?? [];
    matches.push(event);
    eventsById.set(event.effectId, matches);
  }

  const verified: VerifiedAppliedEffect[] = [];
  for (const effect of args.expectedEffects) {
    const matchingEvents = eventsById.get(effect.id) ?? [];
    if (matchingEvents.length !== 1) {
      return {
        ok: false,
        code: matchingEvents.length === 0 ? 'MISSING_EFFECT_EVENT' : 'DUPLICATE_EFFECT_EVENT',
        message: `Expected exactly one application event for ${effect.id}`,
      };
    }
    const event = matchingEvents[0];
    if (
      event.kind !== expectedEventKind(effect) ||
      event.targetPlayerId !== effect.target.playerId ||
      !detailsMatch(effect, event)
    ) {
      return { ok: false, code: 'MISMATCHED_EFFECT_EVENT', message: `Application event did not match ${effect.id}` };
    }
    verified.push({ effect, event });
  }
  return { ok: true, matches: verified };
}

export function countVerifiedCreatedShipsByTargetPlayerId(
  matches: readonly VerifiedAppliedEffect[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const match of matches) {
    if (match.effect.kind !== EffectKind.CreateShip) continue;
    const playerId = match.effect.target.playerId;
    counts[playerId] = (counts[playerId] ?? 0) + 1;
  }
  return counts;
}

export function matchAppliedCreateShipEffectsOneToOne(args: {
  expectedEffects: readonly Effect[];
  effectEvents: readonly EffectEvent[];
}): VerifiedAppliedEffect[] {
  const availableEvents = args.effectEvents.map((event, index) => ({ event, index }));
  const usedEventIndexes = new Set<number>();
  const matches: VerifiedAppliedEffect[] = [];

  for (const effect of args.expectedEffects) {
    if (effect.kind !== EffectKind.CreateShip) continue;
    const matched = availableEvents.find(({ event, index }) =>
      !usedEventIndexes.has(index) &&
      event.effectId === effect.id &&
      event.kind === 'CreateShip' &&
      event.targetPlayerId === effect.target.playerId &&
      event.details?.shipDefId === effect.shipDefId
    );
    if (!matched) continue;
    usedEventIndexes.add(matched.index);
    matches.push({ effect, event: matched.event });
  }

  return matches;
}
