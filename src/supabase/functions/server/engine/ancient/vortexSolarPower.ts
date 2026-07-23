import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import { countDistinctTypes } from '../../engine_shared/resolve/phaseComputedEffects.ts';
import { getFleetForChargeScopedDynamicCount } from '../../engine_shared/resolve/resolvePowerAction.ts';
import type { GameState } from '../state/GameStateTypes.ts';
import type { ManualSolarResolverDescriptor } from './manualSolarDeclaration.ts';
import {
  buildSolarHealthEffect,
  requireSolarOpponentPlayerId,
} from './solarHealthEffects.ts';

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
