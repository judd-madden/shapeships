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
import {
  countDistinctTypes,
  getEffectiveDiceRollForPlayer,
} from '../../engine_shared/resolve/phaseComputedEffects.ts';
import { getFleetForChargeScopedDynamicCount } from '../../engine_shared/resolve/resolvePowerAction.ts';
import type {
  ManualSolarResolverDescriptor,
  ManualSolarResolverRegistry,
} from './manualSolarDeclaration.ts';

export type MonoColourSolarPowerId = Extract<
  AncientSolarPowerId,
  'SLIF' | 'SSTA' | 'SAST' | 'SSUP' | 'SCON'
>;

// Shared Solar opponent/effect helpers

export function requireSolarOpponentPlayerId(
  state: Readonly<any>,
  playerId: string,
): string {
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

export function buildSolarHealthEffect(args: {
  castIdentity: string;
  ownerPlayerId: string;
  powerId: AncientSolarPowerId;
  targetPlayerId: string;
  kind: EffectKind.Heal | EffectKind.Damage;
  amount: number;
  idSuffix: string;
}): Effect {
  return {
    id: `${args.castIdentity}:${args.idSuffix}`,
    ownerPlayerId: args.ownerPlayerId,
    source: { type: 'system', reason: `ancient-solar:${args.powerId}` },
    timing: 'battle.end_of_turn_resolution',
    activationTag: EffectTiming.Charge,
    survivability: SurvivabilityRule.ResolvesIfDestroyed,
    target: { playerId: args.targetPlayerId },
    kind: args.kind,
    amount: args.amount,
  } as Effect;
}

// Mono-colour costs and Autocast construction

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

// Mono-colour resolver implementations

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

// Siphon resolver

function requireSiphonAmounts(value: unknown): {
  selectedAmount: number;
  effectAmount: number;
} {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    !Number.isSafeInteger(value) ||
    value < 4
  ) {
    throw new Error('Siphon lockedAmount must be a safe integer of at least 4');
  }

  let effectAmount: number;
  if (value <= 7) {
    effectAmount = 3 * value - 4;
  } else {
    const acceleratedFactor = value - 4;
    if (
      !Number.isSafeInteger(acceleratedFactor) ||
      acceleratedFactor <= 0 ||
      acceleratedFactor > Math.floor(Number.MAX_SAFE_INTEGER / 5)
    ) {
      throw new Error('Siphon effect amount must be a positive safe integer');
    }
    effectAmount = acceleratedFactor * 5;
  }

  if (!Number.isSafeInteger(effectAmount) || effectAmount <= 0) {
    throw new Error('Siphon effect amount must be a positive safe integer');
  }
  return { selectedAmount: value, effectAmount };
}

export const SIPHON_SOLAR_RESOLVER: ManualSolarResolverDescriptor = {
  acceptedFields: { lockedAmount: true },
  resolve(context) {
    if (context.sourceMode !== 'manual') {
      throw new Error('Siphon may only be resolved from a manual Solar cast');
    }
    if (typeof context.cast.targetInstanceId !== 'undefined') {
      throw new Error('Siphon does not accept targetInstanceId');
    }
    if (typeof context.cast.targetInstanceIds !== 'undefined') {
      throw new Error('Siphon does not accept targetInstanceIds');
    }

    const { selectedAmount, effectAmount } = requireSiphonAmounts(context.cast.lockedAmount);
    if (selectedAmount > context.remainingEnergy.green) {
      throw new Error('Insufficient green Energy for SSIP at its ordered cast position');
    }
    if (selectedAmount > context.remainingEnergy.red) {
      throw new Error('Insufficient red Energy for SSIP at its ordered cast position');
    }

    const opponentPlayerId = requireSolarOpponentPlayerId(context.state, context.playerId);
    return {
      candidateState: structuredClone(context.state),
      paidEnergy: { green: selectedAmount, red: selectedAmount, blue: 0 },
      effects: [
        buildSolarHealthEffect({
          castIdentity: context.castIdentity,
          ownerPlayerId: context.playerId,
          powerId: 'SSIP',
          targetPlayerId: context.playerId,
          kind: EffectKind.Heal,
          amount: effectAmount,
          idSuffix: 'heal',
        }),
        buildSolarHealthEffect({
          castIdentity: context.castIdentity,
          ownerPlayerId: context.playerId,
          powerId: 'SSIP',
          targetPlayerId: opponentPlayerId,
          kind: EffectKind.Damage,
          amount: effectAmount,
          idSuffix: 'damage',
        }),
      ],
      ledgerMetadata: { lockedAmount: effectAmount },
    };
  },
};

// Vortex resolver

export const VORTEX_SOLAR_RESOLVER: ManualSolarResolverDescriptor = {
  acceptedFields: {},
  resolve(context) {
    if (context.sourceMode !== 'manual') {
      throw new Error('Vortex may only be resolved from a manual Solar cast');
    }

    const countFleet = getFleetForChargeScopedDynamicCount(
      context.state as GameState,
      context.playerId,
      'battle.charge_declaration',
    );
    const lockedDamage = countDistinctTypes(countFleet) * 2;
    const opponentPlayerId = requireSolarOpponentPlayerId(context.state, context.playerId);

    return {
      candidateState: structuredClone(context.state),
      paidEnergy: { green: 2, red: 2, blue: 2 },
      effects: [buildSolarHealthEffect({
        castIdentity: context.castIdentity,
        ownerPlayerId: context.playerId,
        powerId: 'SVOR',
        targetPlayerId: opponentPlayerId,
        kind: EffectKind.Damage,
        amount: lockedDamage,
        idSuffix: 'damage',
      })],
      ledgerMetadata: { lockedAmount: lockedDamage },
    };
  },
};
