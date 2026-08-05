import type { ShipInstance } from '../../engine/state/GameStateTypes.ts';
import type { Effect } from '../effects/Effect.ts';
import { EffectKind, EffectTiming, SurvivabilityRule } from '../effects/Effect.ts';
import type { PhaseKey } from '../phase/PhaseTable.ts';

export type ShipsThatBuildEffectIdFactory = (effectOrdinal: number) => string;

type SourceEffectArgs = {
  source: Readonly<ShipInstance>;
  playerId: string;
  turnNumber: number;
  phaseKey: PhaseKey;
  effectIdFactory?: ShipsThatBuildEffectIdFactory;
};

function baseEffect(args: SourceEffectArgs, id: string) {
  return {
    id,
    ownerPlayerId: args.playerId,
    source: {
      type: 'ship' as const,
      instanceId: args.source.instanceId,
      shipDefId: args.source.shipDefId,
    },
    timing: args.phaseKey,
    activationTag: EffectTiming.Automatic,
    target: { playerId: args.playerId },
    survivability: SurvivabilityRule.DiesWithSource,
  };
}

export function createBugBreederSourceEffects(args: SourceEffectArgs): Effect[] {
  if ((args.source.chargesCurrent ?? 0) < 1) return [];
  const id = args.effectIdFactory ?? ((ordinal: number) =>
    ordinal === 0
      ? `bug_build_${args.turnNumber}_${args.source.instanceId}_charge`
      : `bug_build_${args.turnNumber}_${args.source.instanceId}_xenite`);

  return [
    {
      ...baseEffect(args, id(0)),
      kind: EffectKind.SpendCharge,
      amount: 1,
    },
    {
      ...baseEffect(args, id(1)),
      kind: EffectKind.CreateShip,
      shipDefId: 'XEN',
    },
  ];
}

export function createQueenSourceEffects(args: SourceEffectArgs): Effect[] {
  const id = args.effectIdFactory?.(0) ??
    `queen_build_${args.turnNumber}_${args.source.instanceId}`;
  return [{
    ...baseEffect(args, id),
    kind: EffectKind.CreateShip,
    shipDefId: 'XEN',
  }];
}

export function createRecurringZenithSourceEffects(
  args: SourceEffectArgs & { roll: number | undefined },
): Effect[] {
  const shipDefIds = args.roll === 2
    ? ['XEN']
    : args.roll === 3
    ? ['ANT']
    : args.roll === 4
    ? ['XEN', 'XEN']
    : [];

  return shipDefIds.map((shipDefId, ordinal) => ({
    ...baseEffect(
      args,
      args.effectIdFactory?.(ordinal) ??
        `zenith_build_${args.turnNumber}_${args.source.instanceId}_${shipDefId.toLowerCase()}_${ordinal}`,
    ),
    kind: EffectKind.CreateShip,
    shipDefId,
  }));
}
