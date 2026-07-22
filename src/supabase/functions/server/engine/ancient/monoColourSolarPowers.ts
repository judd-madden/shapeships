import type {
  AncientEnergyPool,
  AncientNormalizedSolarCast,
  AncientSolarPowerId,
  GameState,
} from '../state/GameStateTypes.ts';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
  type Effect,
} from '../../engine_shared/effects/Effect.ts';
import { getEffectiveDiceRollForPlayer } from '../../engine_shared/resolve/phaseComputedEffects.ts';
import type {
  ManualSolarResolverDescriptor,
  ManualSolarResolverRegistry,
} from './manualSolarDeclaration.ts';

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

function requireOpponentPlayerId(state: Readonly<any>, playerId: string): string {
  const activeSeats = Array.isArray(state?.players)
    ? state.players.filter((player: any) => player?.role === 'player')
    : [];
  const casterSeats = activeSeats.filter((player: any) => player?.id === playerId);
  const opponentSeats = activeSeats.filter((player: any) => player?.id !== playerId);
  if (activeSeats.length !== 2 || casterSeats.length !== 1 || opponentSeats.length !== 1) {
    throw new Error(`Solar damage requires exactly two active player seats including caster ${playerId}`);
  }
  const opponentPlayerId = opponentSeats[0]?.id;
  if (typeof opponentPlayerId !== 'string' || opponentPlayerId.length === 0) {
    throw new Error(`Solar damage requires one valid opposing active player for ${playerId}`);
  }
  return opponentPlayerId;
}

function healthEffect(args: {
  castIdentity: string;
  playerId: string;
  powerId: MonoColourSolarPowerId;
  targetPlayerId: string;
  kind: EffectKind.Heal | EffectKind.Damage;
  amount: number;
}): Effect {
  return {
    id: `${args.castIdentity}:${args.kind.toLowerCase()}`,
    ownerPlayerId: args.playerId,
    source: { type: 'system', reason: `ancient-solar:${args.powerId}` },
    timing: 'battle.end_of_turn_resolution',
    activationTag: EffectTiming.Charge,
    survivability: SurvivabilityRule.ResolvesIfDestroyed,
    target: { playerId: args.targetPlayerId },
    kind: args.kind,
    amount: args.amount,
  } as Effect;
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
        : requireOpponentPlayerId(context.state, context.playerId);
      return {
        candidateState: structuredClone(context.state),
        paidEnergy: cloneCost(args.powerId),
        effects: [healthEffect({
          castIdentity: context.castIdentity,
          playerId: context.playerId,
          powerId: args.powerId,
          targetPlayerId,
          kind: args.kind,
          amount: 1,
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
        : requireOpponentPlayerId(context.state, context.playerId);
      return {
        candidateState: structuredClone(context.state),
        paidEnergy: cloneCost(args.powerId),
        effects: [healthEffect({
          castIdentity: context.castIdentity,
          playerId: context.playerId,
          powerId: args.powerId,
          targetPlayerId,
          kind: args.kind,
          amount: lockedAmount,
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
      effects: [{
        id: `${context.castIdentity}:gain-lines`,
        ownerPlayerId: context.playerId,
        source: { type: 'system', reason: 'ancient-solar:SCON' },
        timing: 'battle.charge_declaration',
        activationTag: EffectTiming.Charge,
        survivability: SurvivabilityRule.ResolvesIfDestroyed,
        target: { playerId: context.playerId },
        kind: EffectKind.GainLines,
        amount: 1,
        appliesToFutureBuildPhases: true,
      }],
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
