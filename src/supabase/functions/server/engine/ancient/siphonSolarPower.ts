import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import type { ManualSolarResolverDescriptor } from './manualSolarDeclaration.ts';
import {
  buildSolarHealthEffect,
  requireSolarOpponentPlayerId,
} from './solarHealthEffects.ts';

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
