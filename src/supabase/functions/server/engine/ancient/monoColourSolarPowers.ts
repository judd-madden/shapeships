import type {
  AncientEnergyPool,
  AncientNormalizedSolarCast,
  AncientSolarPowerId,
  GameState,
} from '../state/GameStateTypes.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import { getEffectiveDiceRollForPlayer } from '../../engine_shared/resolve/phaseComputedEffects.ts';
import type {
  ManualSolarResolverDescriptor,
  ManualSolarResolverRegistry,
} from './manualSolarDeclaration.ts';
import {
  buildSolarHealthEffect,
  requireSolarOpponentPlayerId,
} from './solarHealthEffects.ts';

export type MonoColourSolarPowerId = Extract<
  AncientSolarPowerId,
  'SLIF' | 'SSTA' | 'SAST' | 'SSUP' | 'SCON'
>;

function frozenCost(green: number, red: number, blue: number): Readonly<AncientEnergyPool> {
  return Object.freeze({ green, red, blue });
}

export const MONO_COLOUR_SOLAR_COSTS: Readonly<Record<MonoColourSolarPowerId, Readonly<AncientEnergyPool>>> =
  Object.freeze({
    SLIF: frozenCost(1, 0, 0),
    SSTA: frozenCost(3, 0, 0),
    SAST: frozenCost(0, 1, 0),
    SSUP: frozenCost(0, 3, 0),
    SCON: frozenCost(0, 0, 1),
  });

const AUTOCAST_PRIORITY: readonly MonoColourSolarPowerId[] = Object.freeze([
  'SSTA',
  'SSUP',
  'SCON',
  'SLIF',
  'SAST',
]);

function cloneCost(powerId: MonoColourSolarPowerId): AncientEnergyPool {
  const cost = MONO_COLOUR_SOLAR_COSTS[powerId];
  return { green: cost.green, red: cost.red, blue: cost.blue };
}

function canAfford(pool: AncientEnergyPool, cost: Readonly<AncientEnergyPool>): boolean {
  return cost.green <= pool.green && cost.red <= pool.red && cost.blue <= pool.blue;
}

export function buildMonoColourAutocastCasts(
  initialEnergy: Readonly<AncientEnergyPool>,
): AncientNormalizedSolarCast[] {
  const remaining: AncientEnergyPool = {
    green: initialEnergy.green,
    red: initialEnergy.red,
    blue: initialEnergy.blue,
  };
  const casts: AncientNormalizedSolarCast[] = [];

  for (const solarPowerId of AUTOCAST_PRIORITY) {
    const cost = MONO_COLOUR_SOLAR_COSTS[solarPowerId];
    while (canAfford(remaining, cost)) {
      casts.push({ solarPowerId });
      remaining.green -= cost.green;
      remaining.red -= cost.red;
      remaining.blue -= cost.blue;
    }
  }

  return casts;
}

function requireEffectiveDice(state: Readonly<any>, playerId: string): number {
  const dice = getEffectiveDiceRollForPlayer(state as GameState, playerId);
  if (
    typeof dice !== 'number' ||
    !Number.isFinite(dice) ||
    !Number.isInteger(dice) ||
    dice < 1 ||
    dice > 6
  ) {
    throw new Error(`Missing or invalid authoritative effective dice for ${playerId}`);
  }
  return dice;
}

function fixedHealthResolver(args: {
  powerId: 'SLIF' | 'SAST';
  kind: EffectKind.Heal | EffectKind.Damage;
}): ManualSolarResolverDescriptor {
  return {
    acceptedFields: {},
    resolve(context) {
      const targetPlayerId = args.kind === EffectKind.Heal
        ? context.playerId
        : requireSolarOpponentPlayerId(context.state, context.playerId);
      return {
        candidateState: structuredClone(context.state),
        paidEnergy: cloneCost(args.powerId),
        effects: [buildSolarHealthEffect({
          castIdentity: context.castIdentity,
          ownerPlayerId: context.playerId,
          powerId: args.powerId,
          targetPlayerId,
          kind: args.kind,
          amount: 1,
          idSuffix: args.kind.toLowerCase(),
        })],
      };
    },
  };
}

function diceHealthResolver(args: {
  powerId: 'SSTA' | 'SSUP';
  kind: EffectKind.Heal | EffectKind.Damage;
}): ManualSolarResolverDescriptor {
  return {
    acceptedFields: {},
    resolve(context) {
      const lockedAmount = requireEffectiveDice(context.state, context.playerId) + 3;
      const targetPlayerId = args.kind === EffectKind.Heal
        ? context.playerId
        : requireSolarOpponentPlayerId(context.state, context.playerId);
      return {
        candidateState: structuredClone(context.state),
        paidEnergy: cloneCost(args.powerId),
        effects: [buildSolarHealthEffect({
          castIdentity: context.castIdentity,
          ownerPlayerId: context.playerId,
          powerId: args.powerId,
          targetPlayerId,
          kind: args.kind,
          amount: lockedAmount,
          idSuffix: args.kind.toLowerCase(),
        })],
        ledgerMetadata: { lockedAmount },
      };
    },
  };
}

const convertResolver: ManualSolarResolverDescriptor = {
  acceptedFields: {},
  resolve(context) {
    return {
      candidateState: structuredClone(context.state),
      paidEnergy: cloneCost('SCON'),
      effects: [],
    };
  },
};

export const PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS: Readonly<ManualSolarResolverRegistry> =
  Object.freeze({
    SLIF: fixedHealthResolver({ powerId: 'SLIF', kind: EffectKind.Heal }),
    SSTA: diceHealthResolver({ powerId: 'SSTA', kind: EffectKind.Heal }),
    SAST: fixedHealthResolver({ powerId: 'SAST', kind: EffectKind.Damage }),
    SSUP: diceHealthResolver({ powerId: 'SSUP', kind: EffectKind.Damage }),
    SCON: convertResolver,
  });
